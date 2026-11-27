/** Autenticación: contraseñas con scrypt, sesiones opacas (solo se guarda el hash), bloqueo por intentos. */
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash, createHmac } from "node:crypto";
import { promisify } from "node:util";
import type { Db, Queryable } from "../db";
import { appendAudit } from "../audit-log";
import type { Actor, Role } from "../permissions";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_TTL_HOURS = 12;
export const MAX_FAILED_LOGINS = 5; // por correo en 15 minutos

export async function hashPassword(pw: string): Promise<string> {
  if (pw.length < 12) throw new Error("La contraseña debe tener al menos 12 caracteres");
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64, PARAMS);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, s, k] = stored.split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const expected = Buffer.from(k, "base64");
  const key = await scrypt(pw, Buffer.from(s, "base64"), expected.length, PARAMS);
  return timingSafeEqual(key, expected);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Hash anónimo (IP/UA) con sal secreta: no se guardan IPs en claro. */
export function anonHash(value: string): string {
  const salt = process.env.ANALYTICS_SALT ?? process.env.SESSION_SECRET ?? "dev-only-salt";
  return createHmac("sha256", salt).update(value).digest("hex").slice(0, 32);
}

export async function createUser(q: Queryable, u: { email: string; name: string; role: Role; password: string }, by = "system") {
  if (!["owner", "operator", "viewer"].includes(u.role)) throw new Error("Rol inválido");
  const hash = await hashPassword(u.password);
  const r = await q.query<{ id: string }>("insert into users(email, name, role, password_hash) values (lower($1),$2,$3,$4) returning id", [u.email, u.name, u.role, hash]);
  await appendAudit(q, { actor: by, action: "user.create", level: "red", target: r.rows[0]!.id, result: "created", detail: { role: u.role } });
  return r.rows[0]!.id;
}

export type LoginResult = { ok: true; token: string; user: SessionUser } | { ok: false; error: string };
export interface SessionUser { id: string; email: string; name: string; role: "owner" | "operator" | "viewer" }

export async function login(db: Db, email: string, password: string, ipHash?: string): Promise<LoginResult> {
  const e = email.trim().toLowerCase();
  const recent = await db.query<{ n: string }>("select count(*) n from login_attempts where email=$1 and not success and at > now() - interval '15 minutes'", [e]);
  if (Number(recent.rows[0]?.n) >= MAX_FAILED_LOGINS) return { ok: false, error: "Cuenta bloqueada temporalmente por intentos fallidos. Espera 15 minutos." };
  const r = await db.query<SessionUser & { password_hash: string; disabled: boolean }>("select id, email, name, role, password_hash, disabled from users where email=$1", [e]);
  const u = r.rows[0];
  // Verificación con costo constante aunque el usuario no exista.
  const ok = u ? await verifyPassword(password, u.password_hash) : (await verifyPassword(password, "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==").catch(() => false), false);
  await db.query("insert into login_attempts(email, ip_hash, success) values ($1,$2,$3)", [e, ipHash ?? null, ok && !u?.disabled]);
  if (!u || !ok || u.disabled) {
    await audit(db, { actor: "public", action: "auth.login", level: "system", target: e.replace(/^(.).*@/, "$1***@"), result: "failed" });
    return { ok: false, error: "Credenciales inválidas" };
  }
  const token = randomBytes(32).toString("base64url");
  await db.query("insert into sessions(token_hash, user_id, expires_at, ip_hash) values ($1,$2, now() + ($3 || ' hours')::interval, $4)", [sha256(token), u.id, String(SESSION_TTL_HOURS), ipHash ?? null]);
  await audit(db, { actor: `user:${u.id}`, action: "auth.login", level: "system", target: u.id, result: "success" });
  return { ok: true, token, user: { id: u.id, email: u.email, name: u.name, role: u.role } };
}

async function audit(db: Db, e: Parameters<typeof appendAudit>[1]) { await db.transaction((tx) => appendAudit(tx, e)); }

export async function getSessionUser(q: Queryable, token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const r = await q.query<SessionUser>(
    `select u.id, u.email, u.name, u.role from sessions s join users u on u.id=s.user_id
     where s.token_hash=$1 and s.expires_at > now() and not u.disabled`, [sha256(token)]);
  return r.rows[0] ?? null;
}

export async function logout(q: Queryable, token: string) {
  await q.query("delete from sessions where token_hash=$1", [sha256(token)]);
}

export const userActor = (u: SessionUser): Actor => ({ id: `user:${u.id}`, role: u.role });
