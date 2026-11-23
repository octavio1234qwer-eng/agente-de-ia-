"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrations, siteUrl } from "@/lib/env";
import { safeNextPath } from "@/lib/auth";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import { sendWelcomeEmail } from "@/lib/email/automations";
import type { ActionState } from "./types";

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña es demasiado larga.")
  .regex(/[A-Za-z]/, "Incluye al menos una letra.")
  .regex(/[0-9]/, "Incluye al menos un número.");

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre.").max(120),
  email: z.email("Correo inválido.").max(254),
  password: passwordSchema,
  terms: z.literal("on", { error: "Debes aceptar los términos y el aviso de privacidad." }),
});

function firstErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
    terms: formData.get("terms"),
  });
  const values = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    terms: formData.get("terms") === "on" ? "on" : "",
  };
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), error: "Revisa los campos marcados.", values };

  const next = safeNextPath(String(formData.get("next") ?? ""), "/cuenta");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return { error: "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.", values };
    }
    if (/weak|pwned|leaked/i.test(error.message)) {
      return { error: "Esa contraseña es insegura o aparece en filtraciones conocidas. Elige otra.", values };
    }
    console.error("[signUp]", error.message);
    return { error: "No pudimos crear tu cuenta. Intenta de nuevo en unos minutos.", values };
  }

  if (data.session && data.user) {
    if (integrations.serviceRole()) await sendWelcomeEmail(data.user.id).catch(() => undefined);
    redirect(next);
  }
  return { success: "Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada (y la carpeta de spam)." };
}

const signInSchema = z.object({
  email: z.email("Correo inválido."),
  password: z.string().min(1, "Escribe tu contraseña."),
});

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
  });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), error: "Revisa los campos marcados.", values };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/not confirmed/i.test(error.message)) {
      return { error: "Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.", values };
    }
    return { error: "Correo o contraseña incorrectos.", values };
  }
  redirect(safeNextPath(String(formData.get("next") ?? ""), "/cuenta"));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

const GENERIC_RESET = "Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña en unos minutos.";

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { fieldErrors: { email: "Correo inválido." }, error: "Revisa el correo.", values: { email: String(formData.get("email") ?? "") } };
  const email = parsed.data;
  const redirectTo = `${siteUrl}/auth/confirm?next=/restablecer`;

  // Con Resend configurado enviamos el correo de marca; si no, usamos el
  // correo de recuperación nativo de Supabase Auth.
  if (integrations.email() && integrations.serviceRole()) {
    const admin = createAdminClient();
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    const { count } = await admin
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .eq("template", "password_reset")
      .eq("to_email", email)
      .gte("created_at", fiveMinAgo);
    if ((count ?? 0) > 0) return { success: GENERIC_RESET };

    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
    if (!error && data?.properties?.hashed_token) {
      const link = `${siteUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/restablecer`;
      await sendEmail({ to: email, template: "password_reset", userId: data.user?.id, content: passwordResetEmail({ link, siteUrl }) });
    }
    return { success: GENERIC_RESET };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error && /rate|security purposes/i.test(error.message)) {
    return { error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." };
  }
  return { success: GENERIC_RESET };
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return { fieldErrors: { password: password.error.issues[0].message }, error: "Revisa la contraseña." };
  if (formData.get("password") !== formData.get("confirm")) {
    return { fieldErrors: { confirm: "Las contraseñas no coinciden." }, error: "Revisa la confirmación." };
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "El enlace expiró. Solicita uno nuevo." };

  const current = formData.get("current");
  if (typeof current === "string") {
    const email = claims.claims.email as string | undefined;
    const check = email ? await supabase.auth.signInWithPassword({ email, password: current }) : { error: true };
    if (check.error) return { fieldErrors: { current: "La contraseña actual no es correcta." }, error: "Revisa tu contraseña actual." };
  }

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) {
    if (/same|different/i.test(error.message)) return { error: "La nueva contraseña debe ser distinta de la anterior." };
    return { error: "No pudimos actualizar la contraseña. Intenta de nuevo." };
  }
  return { success: "Tu contraseña se actualizó correctamente." };
}
