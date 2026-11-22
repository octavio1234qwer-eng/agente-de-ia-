"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { integrations } from "@/lib/env";
import { sendCertificateEmail } from "@/lib/email/automations";
import type { ActionState } from "./types";

const uuid = z.uuid();

export async function enrollFreeAction(courseId: string, slug: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/cursos/${slug}`)}`);
  if (!uuid.safeParse(courseId).success) return { error: "Curso inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("enroll_free_course", { p_course_id: courseId });
  if (error) return { error: "No fue posible inscribirte en este curso." };
  revalidatePath(`/cursos/${slug}`);
  redirect(`/aprender/${slug}`);
}

export async function toggleFavoriteAction(courseId: string, path: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!uuid.safeParse(courseId).success) return { favorite: false };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("favorites").select("course_id").eq("course_id", courseId).eq("user_id", user.id).maybeSingle();
  if (existing) {
    await supabase.from("favorites").delete().eq("course_id", courseId).eq("user_id", user.id);
  } else {
    await supabase.from("favorites").insert({ user_id: user.id, course_id: courseId });
  }
  revalidatePath("/cuenta/favoritos");
  return { favorite: !existing };
}

async function maybeSendCertificate(userId: string, courseId: string) {
  if (!integrations.serviceRole()) return;
  const supabase = await createClient();
  const { data } = await supabase.from("certificates").select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
  if (data) await sendCertificateEmail(userId, courseId).catch((e) => console.error("[certificate email]", e));
}

export async function setLessonCompleteAction(lessonId: string, completed: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión." };
  if (!uuid.safeParse(lessonId).success) return { error: "Lección inválida." };
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("course_id, type").eq("id", lessonId).maybeSingle();
  if (!lesson) return { error: "Lección no encontrada." };
  if (lesson.type === "quiz") return { error: "Aprueba la evaluación para completarla." };

  const { error } = await supabase
    .from("lesson_progress")
    .upsert({ user_id: user.id, lesson_id: lessonId, completed_at: completed ? new Date().toISOString() : null }, { onConflict: "user_id,lesson_id" });
  if (error) return { error: "No tienes acceso a esta lección." };
  if (completed) await maybeSendCertificate(user.id, lesson.course_id);
  revalidatePath("/aprender", "layout");
  return { success: true };
}

export async function saveVideoPositionAction(lessonId: string, seconds: number) {
  const user = await getCurrentUser();
  if (!user || !uuid.safeParse(lessonId).success || !Number.isFinite(seconds)) return;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id).eq("lesson_id", lessonId).maybeSingle();
  const pos = Math.max(0, Math.floor(seconds));
  if (existing) {
    await supabase.from("lesson_progress").update({ last_position_seconds: pos }).eq("user_id", user.id).eq("lesson_id", lessonId);
  } else {
    await supabase.from("lesson_progress").insert({ user_id: user.id, lesson_id: lessonId, last_position_seconds: pos });
  }
}

export type QuizResult = {
  score: number;
  total: number;
  passed: boolean;
  pass_percent: number;
  results: { question_id: string; selected: number | null; correct: boolean; explanation: string | null; correct_index?: number }[];
};

export async function submitQuizAction(lessonId: string, answers: Record<string, number>): Promise<{ error?: string; result?: QuizResult }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión." };
  if (!uuid.safeParse(lessonId).success) return { error: "Evaluación inválida." };
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (uuid.safeParse(k).success && Number.isInteger(v) && v >= 0 && v < 10) clean[k] = v;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_lesson_id: lessonId, p_answers: clean });
  if (error) return { error: "No pudimos registrar tu intento." };
  const result = data as unknown as QuizResult;
  if (result.passed) {
    const { data: lesson } = await supabase.from("lessons").select("course_id").eq("id", lessonId).single();
    if (lesson) await maybeSendCertificate(user.id, lesson.course_id);
    revalidatePath("/aprender", "layout");
  }
  return { result };
}

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Elige una calificación.").max(5),
  comment: z.string().trim().max(2000).optional(),
});

export async function submitReviewAction(courseId: string, slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión." };
  const parsed = reviewSchema.safeParse({ rating: formData.get("rating"), comment: formData.get("comment") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("reviews").select("id").eq("user_id", user.id).eq("course_id", courseId).maybeSingle();
  const { error } = existing
    ? await supabase.from("reviews").update({ rating: parsed.data.rating, comment: parsed.data.comment ?? null }).eq("id", existing.id)
    : await supabase.from("reviews").insert({ user_id: user.id, course_id: courseId, rating: parsed.data.rating, comment: parsed.data.comment ?? null });
  if (error) return { error: "Solo los alumnos inscritos pueden opinar sobre este curso." };
  revalidatePath(`/cursos/${slug}`);
  return { success: existing ? "Actualizamos tu reseña." : "¡Gracias por tu reseña!" };
}
