import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config, siteUrl } from "@/lib/env";

/** Enlaces de baja firmados (HMAC) para que nadie pueda dar de baja a otro. */
function sign(email: string) {
  const secret = config.unsubscribeSecret;
  if (!secret) throw new Error("Falta UNSUBSCRIBE_SECRET");
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("base64url");
}

export function unsubscribeUrl(email: string) {
  const e = Buffer.from(email.trim().toLowerCase()).toString("base64url");
  return `${siteUrl}/baja?e=${e}&t=${sign(email)}`;
}

export function verifyUnsubscribe(encodedEmail: string, token: string): string | null {
  try {
    const email = Buffer.from(encodedEmail, "base64url").toString("utf8");
    if (!email.includes("@")) return null;
    const expected = Buffer.from(sign(email));
    const given = Buffer.from(token);
    return expected.length === given.length && timingSafeEqual(expected, given) ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}
