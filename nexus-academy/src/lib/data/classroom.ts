import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

type LessonType = Database["public"]["Enums"]["lesson_type"];

export type OutlineLesson = { id: string; title: string; type: LessonType; duration_seconds: number; is_preview: boolean; position: number; completed: boolean; canView: boolean };
export type OutlineModule = { id: string; title: string; position: number; lessons: OutlineLesson[] };

/** Temario con el progreso del alumno. Todo pasa por RLS con la sesión del usuario. */
export const getClassroom = cache(async (slug: string, userId: string | null) => {
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title, status, price_cents, category:categories(color, icon), modules(id, title, position, lessons(id, title, type, duration_seconds, is_preview, position))")
    .eq("slug", slug)
    .maybeSingle();
  if (!course) return null;

  const [{ data: hasAccess }, enrollmentRes, progressRes] = await Promise.all([
    supabase.rpc("has_course_access", { p_course_id: course.id }),
    userId
      ? supabase.from("enrollments").select("progress_percent, last_lesson_id, completed_at").eq("course_id", course.id).eq("user_id", userId).is("revoked_at", null).maybeSingle()
      : Promise.resolve({ data: null }),
    userId ? supabase.from("lesson_progress").select("lesson_id, completed_at, last_position_seconds").eq("course_id", course.id).eq("user_id", userId) : Promise.resolve({ data: [] }),
  ]);
  const progress = new Map((progressRes.data ?? []).map((p) => [p.lesson_id, p]));
  const modules: OutlineModule[] = [...course.modules]
    .sort((a, b) => a.position - b.position)
    .map((m) => ({
      id: m.id,
      title: m.title,
      position: m.position,
      lessons: [...m.lessons]
        .sort((a, b) => a.position - b.position)
        .map((l) => ({ ...l, completed: Boolean(progress.get(l.id)?.completed_at), canView: Boolean(hasAccess) || l.is_preview })),
    }));
  const flat = modules.flatMap((m) => m.lessons);
  return {
    course: { id: course.id, slug: course.slug, title: course.title, priceCents: course.price_cents, color: course.category?.color ?? "#3b74ff" },
    hasAccess: Boolean(hasAccess),
    enrollment: enrollmentRes.data,
    modules,
    flat,
    progress,
  };
});

/** Contenido protegido de una lección (RLS decide si el usuario puede verlo). */
export async function getLessonContent(lessonId: string) {
  const supabase = await createClient();
  const [{ data: content }, { data: resources }] = await Promise.all([
    supabase.from("lesson_contents").select("body, video_provider, video_ref, has_captions, captions_lang").eq("lesson_id", lessonId).maybeSingle(),
    supabase.from("lesson_resources").select("id, title, mime_type, size_bytes, is_downloadable").eq("lesson_id", lessonId).order("created_at"),
  ]);
  return { content, resources: resources ?? [] };
}

/** URL reproducible del video; las de almacenamiento privado son firmadas y caducan. */
export async function resolveVideoSource(provider: string | null, ref: string | null) {
  if (!provider || !ref) return null;
  if (provider === "storage") {
    const { data } = await createAdminClient().storage.from("course-videos").createSignedUrl(ref, 60 * 60 * 3);
    return data?.signedUrl ? { kind: "file" as const, src: data.signedUrl } : null;
  }
  if (provider === "youtube") {
    const id = ref.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1] ?? (/^[A-Za-z0-9_-]{11}$/.test(ref) ? ref : null);
    return id ? { kind: "embed" as const, src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` } : null;
  }
  if (provider === "vimeo") {
    const id = ref.match(/(\d{6,})/)?.[1];
    return id ? { kind: "embed" as const, src: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (provider === "url" && /^https:\/\//.test(ref)) return { kind: "file" as const, src: ref };
  return null;
}
