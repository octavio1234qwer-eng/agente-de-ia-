import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, PlayCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CourseCover } from "@/components/course/course-cover";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { LessonSearchForm } from "@/components/search/lesson-search-form";

export const metadata: Metadata = { title: "Mis cursos" };

export default async function MyCoursesPage() {
  const user = await requireUser("/cuenta/cursos");
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("id, progress_percent, completed_at, last_activity_at, created_at, course:courses(id, slug, title, cover_url, lessons_count, category:categories(color, icon))")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("last_activity_at", { ascending: false, nullsFirst: false });
  const enrollments = (data ?? []).filter((e) => e.course);

  if (enrollments.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="size-6" />}
        title="Aún no tienes cursos"
        description="Inscríbete a un curso gratuito o explora el catálogo para empezar."
        action={<LinkButton href="/cursos">Explorar cursos</LinkButton>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <LessonSearchForm courses={enrollments.map((e) => ({ slug: e.course!.slug, title: e.course!.title }))} className="mb-2" />
      {enrollments.map((e) => {
        const c = e.course!;
        return (
          <article key={e.id} className="glass flex flex-col gap-5 rounded-2xl p-4 sm:flex-row sm:items-center">
            <CourseCover title={c.title} slug={c.slug} coverUrl={c.cover_url} color={c.category?.color} icon={c.category?.icon} className="aspect-video w-full shrink-0 rounded-xl sm:w-48" sizes="200px" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-white">{c.title}</h2>
                {e.completed_at && <Badge tone="green">Completado</Badge>}
              </div>
              <p className="mt-1 text-xs text-mist-400">
                {e.last_activity_at ? `Última actividad: ${formatDate(e.last_activity_at, { dateStyle: "medium" })}` : `Inscrito el ${formatDate(e.created_at, { dateStyle: "medium" })}`} · {c.lessons_count} lecciones
              </p>
              <div className="mt-3 flex items-center gap-3">
                <ProgressBar value={e.progress_percent} className="max-w-sm" />
                <span className="text-sm font-medium text-white">{e.progress_percent}%</span>
              </div>
            </div>
            <Link href={`/aprender/${c.slug}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-5 text-sm font-medium text-white hover:bg-white/[0.1]">
              <PlayCircle className="size-4" aria-hidden /> {e.progress_percent > 0 ? "Continuar" : "Empezar"}
            </Link>
          </article>
        );
      })}
    </div>
  );
}
