"use server";

import { redirect } from "next/navigation";
import { getEnv } from "@/server/config/env";
import { withServiceContext } from "@/server/db/context";
import { safeEqual } from "@/server/security/crypto";
import { recordSecurityEvent } from "@/server/security/events";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { AuthError, countUsers, createSession, createUser } from "@/server/auth/service";
import { getRequestMeta, writeSessionCookie } from "@/server/auth/session";

export type SetupState = { error?: string };

/**
 * Alta del primer propietario. Solo funciona si no existe ningún usuario y se
 * presenta el SETUP_TOKEN configurado en el servidor.
 */
export async function setupAction(_prev: SetupState, form: FormData): Promise<SetupState> {
  const env = getEnv();
  if (!env.SETUP_TOKEN) return { error: "SETUP_TOKEN no está configurado en el servidor." };
  const meta = await getRequestMeta();
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("passwordConfirm") ?? "")) return { error: "Las contraseñas no coinciden." };
  try {
    const session = await withServiceContext("cli", async (db) => {
      const limit = await consumeRateLimit(db, `setup:${meta.ip}`, 10, 3600);
      if (!limit.allowed) throw new AuthError("rate_limited", "Demasiados intentos. Espera una hora.");
      if (!safeEqual(String(form.get("setupToken") ?? ""), env.SETUP_TOKEN!)) {
        await recordSecurityEvent(db, { type: "setup_token_rejected", severity: "warning", ...meta });
        throw new AuthError("invalid_credentials", "Token de configuración incorrecto.");
      }
      await db.query("lock table vmf.users in exclusive mode");
      if ((await countUsers(db)) > 0) throw new AuthError("invalid_input", "La configuración inicial ya se completó.");
      const { id } = await createUser(db, {
        email: String(form.get("email") ?? ""),
        displayName: String(form.get("displayName") ?? ""),
        role: "owner",
        password,
      });
      return createSession(db, id, meta, env.SESSION_TTL_HOURS);
    });
    await writeSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message };
    throw error;
  }
  redirect("/");
}
