"use server";

import { redirect } from "next/navigation";
import { getEnv } from "@/server/config/env";
import { withServiceContext } from "@/server/db/context";
import { recordSecurityEvent } from "@/server/security/events";
import { AuthError, login, revokeSessionByToken } from "@/server/auth/service";
import { clearSessionCookie, getRequestMeta, readSessionToken, writeSessionCookie } from "@/server/auth/session";

export type LoginState = { error?: string; email?: string };

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const meta = await getRequestMeta();
  try {
    const session = await withServiceContext("panel", (db) => login(db, email, password, meta, getEnv().SESSION_TTL_HOURS));
    await writeSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message, email };
    throw error;
  }
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    const meta = await getRequestMeta();
    await withServiceContext("panel", async (db) => {
      const userId = await revokeSessionByToken(db, token, "logout");
      if (userId) await recordSecurityEvent(db, { type: "logout", userId, ...meta });
    });
  }
  await clearSessionCookie();
  redirect("/login");
}
