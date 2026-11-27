import "server-only";
import { cookies, headers } from "next/headers";
import { getEnv, shouldUseSecureCookies } from "../config/env";
import type { RequestMeta } from "./service";

/** Con HTTPS se usa el prefijo __Host- (sin dominio, ruta /, Secure obligatorio). */
export function sessionCookieName(): string {
  return shouldUseSecureCookies() ? "__Host-vmf_session" : "vmf_session";
}
export const SESSION_COOKIE_NAMES = ["__Host-vmf_session", "vmf_session"];

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

export async function writeSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(sessionCookieName(), token, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(sessionCookieName());
}

/** IP y agente de usuario. Las cabeceras de proxy solo se usan si TRUST_PROXY_HEADERS=true. */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const trust = getEnv().TRUST_PROXY_HEADERS;
  const forwarded = trust ? h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") : null;
  return { ip: forwarded ?? "direct", userAgent: h.get("user-agent") };
}
