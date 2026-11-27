import { z } from "zod";
import type { Queryable } from "../db/types";
import { generateToken, sha256Hex } from "../security/crypto";
import { recordSecurityEvent } from "../security/events";
import { consumeRateLimit } from "../security/rate-limit";
import { getDummyHash, hashPassword, passwordPolicyError, verifyPassword } from "./password";
import { ROLES, type Role } from "./permissions";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export type RequestMeta = { ip?: string | null; userAgent?: string | null };

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  sessionId: string;
};

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: "Correo electrónico no válido." }));

export const createUserSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(1, "Indica un nombre.").max(80),
  role: z.enum(ROLES),
  password: z.string(),
});

export class AuthError extends Error {
  constructor(
    public readonly code: "invalid_credentials" | "rate_limited" | "weak_password" | "email_taken" | "invalid_input",
    message: string,
  ) {
    super(message);
  }
}

export async function countUsers(db: Queryable): Promise<number> {
  const [row] = await db.query<{ n: number }>("select count(*)::int as n from vmf.users");
  return row!.n;
}

/** Crea un usuario (contexto de servicio). La contraseña se valida y se guarda con scrypt. */
export async function createUser(
  db: Queryable,
  input: z.input<typeof createUserSchema>,
  createdBy?: string | null,
): Promise<{ id: string }> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) throw new AuthError("invalid_input", parsed.error.issues[0]!.message);
  const { email, displayName, role, password } = parsed.data;
  const policy = passwordPolicyError(password, email);
  if (policy) throw new AuthError("weak_password", policy);
  const existing = await db.query("select 1 from vmf.users where email = $1", [email]);
  if (existing.length) throw new AuthError("email_taken", "Ya existe un usuario con ese correo.");
  const [row] = await db.query<{ id: string }>(
    `insert into vmf.users (email, display_name, role, password_hash) values ($1, $2, $3, $4) returning id`,
    [email, displayName, role, await hashPassword(password)],
  );
  await recordSecurityEvent(db, {
    type: "user_created",
    userId: createdBy ?? row!.id,
    details: { created_user_id: row!.id, role },
  });
  return row!;
}

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  status: string;
  password_hash: string;
  failed_login_count: number;
  locked_until: Date | null;
};

/**
 * Verifica credenciales con límites por IP y por correo, bloqueo temporal tras
 * intentos fallidos y respuesta uniforme (no revela si el correo existe).
 * Devuelve el token de sesión en claro: solo se entrega a la cookie.
 */
export async function login(
  db: Queryable,
  emailInput: string,
  password: string,
  meta: RequestMeta,
  ttlHours: number,
): Promise<{ token: string; userId: string; expiresAt: Date }> {
  const invalid = new AuthError("invalid_credentials", "Correo o contraseña incorrectos, o cuenta bloqueada temporalmente.");
  const email = emailSchema.safeParse(emailInput);
  if (!email.success || password.length === 0 || password.length > 256) throw invalid;

  const ipLimit = await consumeRateLimit(db, `login:ip:${meta.ip ?? "unknown"}`, 30, 15 * 60);
  const emailLimit = await consumeRateLimit(db, `login:email:${sha256Hex(email.data)}`, 10, 15 * 60);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    await recordSecurityEvent(db, { type: "login_rate_limited", severity: "warning", ...meta, details: { email_hash: sha256Hex(email.data) } });
    throw new AuthError("rate_limited", "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
  }

  const [user] = await db.query<UserRow>(
    `select id, email, display_name, role, status, password_hash, failed_login_count, locked_until
       from vmf.users where email = $1 for update`,
    [email.data],
  );

  if (!user) {
    await verifyPassword(password, await getDummyHash());
    await recordSecurityEvent(db, { type: "login_failed", ...meta, details: { reason: "unknown_user", email_hash: sha256Hex(email.data) } });
    throw invalid;
  }

  const now = new Date();
  if (user.status !== "active" || (user.locked_until && user.locked_until > now)) {
    await verifyPassword(password, await getDummyHash());
    await recordSecurityEvent(db, {
      type: "login_failed", severity: "warning", userId: user.id, ...meta,
      details: { reason: user.status !== "active" ? "disabled" : "locked" },
    });
    throw invalid;
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    const failures = user.failed_login_count + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await db.query(
      `update vmf.users set failed_login_count = $2,
         locked_until = case when $3::boolean then now() + make_interval(mins => $4) else locked_until end
       where id = $1`,
      [user.id, lock ? 0 : failures, lock, LOCKOUT_MINUTES],
    );
    await recordSecurityEvent(db, {
      type: lock ? "account_locked" : "login_failed",
      severity: lock ? "critical" : "warning",
      userId: user.id, ...meta,
      details: { reason: "bad_password", failures },
    });
    throw invalid;
  }

  await db.query("update vmf.users set failed_login_count = 0, locked_until = null, last_login_at = now() where id = $1", [user.id]);
  const session = await createSession(db, user.id, meta, ttlHours);
  await recordSecurityEvent(db, { type: "login_succeeded", userId: user.id, ...meta });
  return { ...session, userId: user.id };
}

export async function createSession(db: Queryable, userId: string, meta: RequestMeta, ttlHours: number) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
  await db.query(
    `insert into vmf.sessions (user_id, token_hash, expires_at, ip, user_agent) values ($1, $2, $3, $4, $5)`,
    [userId, sha256Hex(token), expiresAt, meta.ip ?? null, meta.userAgent?.slice(0, 300) ?? null],
  );
  return { token, expiresAt };
}

/** Valida un token: expiración absoluta, inactividad, revocación, usuario activo y cambio de contraseña. */
export async function validateSession(db: Queryable, token: string, idleHours: number): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [row] = await db.query<{
    session_id: string; last_seen_at: Date; id: string; email: string; display_name: string; role: Role;
  }>(
    `select s.id as session_id, s.last_seen_at, u.id, u.email, u.display_name, u.role
       from vmf.sessions s join vmf.users u on u.id = s.user_id
      where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
        and s.last_seen_at > now() - make_interval(hours => $2)
        and s.created_at >= u.password_changed_at
        and u.status = 'active'`,
    [sha256Hex(token), idleHours],
  );
  if (!row) return null;
  if (Date.now() - row.last_seen_at.getTime() > LAST_SEEN_THROTTLE_MS) {
    await db.query("update vmf.sessions set last_seen_at = now() where id = $1", [row.session_id]);
  }
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role, sessionId: row.session_id };
}

export async function revokeSessionByToken(db: Queryable, token: string, reason = "logout"): Promise<string | null> {
  const [row] = await db.query<{ user_id: string }>(
    "update vmf.sessions set revoked_at = now(), revoked_reason = $2 where token_hash = $1 and revoked_at is null returning user_id",
    [sha256Hex(token), reason],
  );
  return row?.user_id ?? null;
}

/** Revoca una sesión concreta. Solo el dueño de la sesión o un owner pueden hacerlo. */
export async function revokeSessionById(db: Queryable, sessionId: string, actor: { id: string; role: Role }): Promise<boolean> {
  const rows = await db.query(
    `update vmf.sessions set revoked_at = now(), revoked_reason = 'revoked_by_user'
      where id = $1 and revoked_at is null and (user_id = $2 or $3::boolean) returning id`,
    [sessionId, actor.id, actor.role === "owner"],
  );
  if (rows.length) await recordSecurityEvent(db, { type: "session_revoked", userId: actor.id, details: { session_id: sessionId } });
  return rows.length > 0;
}

export async function listActiveSessions(db: Queryable, userId: string) {
  return db.query<{ id: string; created_at: Date; last_seen_at: Date; expires_at: Date; ip: string | null; user_agent: string | null }>(
    `select id, created_at, last_seen_at, expires_at, ip, user_agent from vmf.sessions
      where user_id = $1 and revoked_at is null and expires_at > now() order by last_seen_at desc`,
    [userId],
  );
}

export async function changePassword(db: Queryable, userId: string, current: string, next: string): Promise<void> {
  const [user] = await db.query<{ email: string; password_hash: string }>("select email, password_hash from vmf.users where id = $1", [userId]);
  if (!user || !(await verifyPassword(current, user.password_hash))) {
    throw new AuthError("invalid_credentials", "La contraseña actual no es correcta.");
  }
  const policy = passwordPolicyError(next, user.email);
  if (policy) throw new AuthError("weak_password", policy);
  // Cambiar la contraseña invalida todas las sesiones previas (created_at < password_changed_at).
  await db.query("update vmf.users set password_hash = $2, password_changed_at = now() where id = $1", [userId, await hashPassword(next)]);
  await recordSecurityEvent(db, { type: "password_changed", severity: "warning", userId });
}
