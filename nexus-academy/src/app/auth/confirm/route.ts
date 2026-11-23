import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth";
import { integrations } from "@/lib/env";
import { sendWelcomeEmail } from "@/lib/email/automations";

const allowed: EmailOtpType[] = ["signup", "recovery", "email", "email_change", "invite", "magiclink"];

/** Verifica enlaces de correo (confirmación de cuenta y recuperación) del lado del servidor. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), "/cuenta/cursos");
  const code = searchParams.get("code");

  const supabase = await createClient();
  if (tokenHash && type && allowed.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      if ((type === "signup" || type === "email") && data.user && integrations.serviceRole()) {
        await sendWelcomeEmail(data.user.id).catch(() => undefined);
      }
      return NextResponse.redirect(new URL(type === "recovery" ? "/restablecer" : next, origin));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", origin));
}
