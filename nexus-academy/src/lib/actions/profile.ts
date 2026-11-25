"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { isTimeZoneName, parseGoal, GOAL_MAX, GOAL_MIN } from "@/lib/learning-stats";
import type { ActionState } from "./types";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre.").max(120),
  headline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(2000).optional(),
});

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión." };
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    headline: formData.get("headline") || undefined,
    bio: formData.get("bio") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, headline: parsed.data.headline ?? null, bio: parsed.data.bio ?? null })
    .eq("id", user.id);
  if (error) return { error: "No se pudo guardar tu perfil." };
  revalidatePath("/", "layout");
  return { success: "Perfil actualizado." };
}

export async function updatePreferencesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ marketing_opt_in: formData.get("marketing") === "on", reminder_opt_in: formData.get("reminders") === "on" })
    .eq("id", user.id);
  if (error) return { error: "No se pudieron guardar tus preferencias." };
  revalidatePath("/cuenta/ajustes");
  return { success: "Preferencias guardadas." };
}

export async function updateWeeklyGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión." };
  const goal = parseGoal(formData.get("goal"));
  if (goal === null) return { error: `Elige una meta entre ${GOAL_MIN} y ${GOAL_MAX} lecciones por semana.` };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ weekly_lesson_goal: goal }).eq("id", user.id);
  if (error) return { error: "No se pudo guardar tu meta." };
  revalidatePath("/cuenta", "layout");
  return { success: "Meta guardada." };
}

export async function updateTimeZoneAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión." };
  const tz = formData.get("timeZone");
  if (!isTimeZoneName(tz)) return { error: "Elige una zona horaria de la lista." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ time_zone: tz }).eq("id", user.id);
  if (error) return { error: error.code === "22023" ? "Esa zona horaria no existe." : "No se pudo guardar tu zona horaria." };
  revalidatePath("/cuenta", "layout");
  return { success: "Zona horaria guardada." };
}

/** Guarda la URL del avatar ya subido por el navegador a avatars/{uid}/. */
export async function setAvatarAction(path: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión." };
  if (!new RegExp(`^${user.id}/[A-Za-z0-9._-]+$`).test(path)) return { error: "Archivo inválido." };
  const supabase = await createClient();
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error } = await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
  if (error) return { error: "No se pudo guardar tu foto." };
  revalidatePath("/", "layout");
  return { success: "Foto actualizada." };
}

export async function subscribeNewsletterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Escribe un correo válido." };
  if (formData.get("website")) return { success: "¡Listo! Te avisaremos de nuevos cursos y promociones." }; // honeypot
  const admin = createAdminClient();
  const { error } = await admin
    .from("newsletter_subscribers")
    .upsert({ email: parsed.data, source: "footer", unsubscribed_at: null }, { onConflict: "email" });
  if (error) return { error: "No pudimos registrarte. Intenta más tarde." };
  return { success: "¡Listo! Te avisaremos de nuevos cursos y promociones." };
}
