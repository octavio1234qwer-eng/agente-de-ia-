import { z } from "zod";
import { audit } from "../audit.ts";
import { decrypt, encrypt, hashPassword, randomToken, sha256, verifyPassword } from "../crypto.ts";
import { rateLimit } from "../security/rate-limit.ts";
import type { Db } from "../db/types.ts";
import { verifyTotp } from "./totp.ts";

export const SESSION_TTL_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type Role = "owner" | "operator" | "viewer";

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  totpEnabled: boolean;
}

export const passwordSchema = z
  .string()
  .min(12, "Usa al menos 12 caracteres.")
  .max(200)
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Incluye letras y números.");

export const emailSchema = z.string().trim().toLowerCase().email("Correo inválido.").max(254);

export async function hasAnyUser(db: Db): Promise<boolean> {
  const { rows } = await db.query("SELECT 1 FROM users LIMIT 1");
  return rows.length > 0;
}

/** Crea al dueño. Solo funciona si todavía no existe ningún usuario. */
export async function createOwner(db: Db, email: string, password: string, ipHash: string | null = null): Promise<string> {
  const e = emailSchema.parse(email);
  const p = passwordSchema.parse(password);
  const hash = await hashPassword(p);
  return db.tx(async (q) => {
    await q.query("SELECT pg_advisory_xact_lock(727276)");
    const any = await q.query("SELECT 1 FROM users LIMIT 1");
    if (any.rows.length) throw new Error("Ya existe un administrador. La configuración inicial está cerrada.");
    const { rows } = await q.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'owner') RETURNING id",
      [e, hash],
    );
    await audit(q, { actorType: "user", actorId: rows[0]!.id, action: "admin.owner_created", ipHash });
    return rows[0]!.id;
  });
}

export type LoginResult =
  | { ok: true; token: string; user: AdminUser }
  | { ok: false; error: "invalid" | "locked" | "rate_limited" | "totp_required" | "totp_invalid"; retryAfterSeconds?: number };

/**
 * Inicio de sesión con límite por IP y por cuenta, bloqueo temporal tras 5 fallos
 * y TOTP si está activado. Los mensajes no revelan si el correo existe.
 */
export async function login(
  db: Db,
  input: { email: string; password: string; totp?: string; ipHash: string | null; userAgent?: string | null },
): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const ipLimit = await rateLimit(db, `login:ip:${input.ipHash ?? "none"}`, 20, 900);
  const accountLimit = await rateLimit(db, `login:acct:${sha256(email)}`, 10, 900);
  if (!ipLimit.ok || !accountLimit.ok) {
    return { ok: false, error: "rate_limited", retryAfterSeconds: Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds) };
  }

  const { rows } = await db.query<{
    id: string; email: string; password_hash: string; role: Role; totp_secret_enc: string | null;
    disabled: boolean; failed_logins: number; locked_until: Date | null;
  }>("SELECT * FROM users WHERE lower(email) = $1", [email]);
  const user = rows[0];

  // Compara siempre contra un hash para no revelar por tiempo si la cuenta existe.
  const dummy = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86);
  const passwordOk = await verifyPassword(input.password, user?.password_hash ?? dummy);

  if (!user || user.disabled) return { ok: false, error: "invalid" };
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    return { ok: false, error: "locked", retryAfterSeconds: Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 1000) };
  }
  if (!passwordOk) {
    const failed = user.failed_logins + 1;
    await db.tx(async (q) => {
      await q.query(
        `UPDATE users SET failed_logins = $2::int, locked_until = CASE WHEN $2::int >= $3::int THEN now() + make_interval(mins => $4::int) ELSE locked_until END WHERE id = $1`,
        [user.id, failed, MAX_FAILED, LOCK_MINUTES],
      );
      await audit(q, {
        actorType: "anonymous", action: "admin.login_failed", targetType: "user", targetId: user.id,
        severity: failed >= MAX_FAILED ? "critical" : "warning", metadata: { failed }, ipHash: input.ipHash,
      });
    });
    return { ok: false, error: failed >= MAX_FAILED ? "locked" : "invalid" };
  }
  if (user.totp_secret_enc) {
    if (!input.totp) return { ok: false, error: "totp_required" };
    if (!verifyTotp(decrypt(user.totp_secret_enc), input.totp)) {
      await db.tx((q) => audit(q, { actorType: "anonymous", action: "admin.totp_failed", targetType: "user", targetId: user.id, severity: "warning", ipHash: input.ipHash }));
      return { ok: false, error: "totp_invalid" };
    }
  }

  const token = randomToken(32);
  await db.tx(async (q) => {
    await q.query("UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [user.id]);
    await q.query(
      `INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES ($1, $2, now() + make_interval(hours => $3::int), $4)`,
      [sha256(token), user.id, SESSION_TTL_HOURS, input.userAgent?.slice(0, 300) ?? null],
    );
    await audit(q, { actorType: "user", actorId: user.id, action: "admin.login", ipHash: input.ipHash });
  });
  return { ok: true, token, user: { id: user.id, email: user.email, role: user.role, totpEnabled: !!user.totp_secret_enc } };
}

/** Valida el token de sesión y renueva su vencimiento (inactividad máxima de 12 h). */
export async function getSessionUser(db: Db, token: string | undefined | null): Promise<AdminUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const { rows } = await db.query<{ id: string; email: string; role: Role; totp_secret_enc: string | null }>(
    `UPDATE sessions s SET last_seen_at = now(), expires_at = now() + make_interval(hours => $2::int)
     FROM users u
     WHERE s.id = $1 AND s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now() AND u.disabled = false
     RETURNING u.id, u.email, u.role, u.totp_secret_enc`,
    [sha256(token), SESSION_TTL_HOURS],
  );
  const u = rows[0];
  return u ? { id: u.id, email: u.email, role: u.role, totpEnabled: !!u.totp_secret_enc } : null;
}

export async function logout(db: Db, token: string): Promise<void> {
  await db.query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [sha256(token)]);
}

export async function enableTotp(db: Db, userId: string, secret: string, code: string): Promise<boolean> {
  if (!verifyTotp(secret, code)) return false;
  await db.tx(async (q) => {
    await q.query("UPDATE users SET totp_secret_enc = $2 WHERE id = $1", [userId, encrypt(secret)]);
    await q.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1", [userId]);
    await audit(q, { actorType: "user", actorId: userId, action: "admin.totp_enabled", severity: "warning" });
  });
  return true;
}

export function canWrite(user: AdminUser): boolean {
  return user.role === "owner" || user.role === "operator";
}
