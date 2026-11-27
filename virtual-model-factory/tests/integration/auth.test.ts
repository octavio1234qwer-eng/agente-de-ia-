import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/types";
import {
  AuthError, MAX_FAILED_LOGINS, changePassword, countUsers, createUser, listActiveSessions, login,
  revokeSessionById, revokeSessionByToken, validateSession,
} from "@/server/auth/service";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { createTestDb } from "../support/db";

let db: Database;
const PASSWORD = "Violeta-Azul-Fabrica-2026";
const meta = { ip: "203.0.113.5", userAgent: "vitest" };
let ownerId: string;

beforeAll(async () => {
  db = await createTestDb();
  ownerId = (await createUser(db, { email: "Duena@Example.com", displayName: "Dueña", role: "owner", password: PASSWORD })).id;
});
afterAll(async () => db?.close());

describe("usuarios", () => {
  it("normaliza el correo y rechaza duplicados y contraseñas débiles", async () => {
    expect(await countUsers(db)).toBe(1);
    const [u] = await db.query<{ email: string }>("select email from vmf.users");
    expect(u!.email).toBe("duena@example.com");
    await expect(createUser(db, { email: "duena@example.com", displayName: "X", role: "viewer", password: PASSWORD })).rejects.toMatchObject({ code: "email_taken" });
    await expect(createUser(db, { email: "otro@example.com", displayName: "X", role: "viewer", password: "corta" })).rejects.toMatchObject({ code: "weak_password" });
    await expect(createUser(db, { email: "no-es-correo", displayName: "X", role: "viewer", password: PASSWORD })).rejects.toMatchObject({ code: "invalid_input" });
  });
});

describe("inicio de sesión y sesiones", () => {
  it("login correcto crea sesión válida; solo se guarda el hash", async () => {
    const { token } = await login(db, "duena@example.com", PASSWORD, meta, 24);
    const user = await validateSession(db, token, 12);
    expect(user).toMatchObject({ id: ownerId, role: "owner", displayName: "Dueña" });
    const stored = await db.query<{ token_hash: string }>("select token_hash from vmf.sessions");
    expect(stored.some((s) => s.token_hash === token)).toBe(false);
    expect(await validateSession(db, token + "x", 12)).toBeNull();
    expect(await validateSession(db, "", 12)).toBeNull();
  });
  it("error uniforme para usuario inexistente y contraseña errónea", async () => {
    const a = await login(db, "nadie@example.com", PASSWORD, meta, 24).catch((e: AuthError) => e.message);
    const b = await login(db, "duena@example.com", "incorrecta-123456", meta, 24).catch((e: AuthError) => e.message);
    expect(a).toBe(b);
    await db.query("update vmf.users set failed_login_count = 0");
  });
  it("bloquea la cuenta tras intentos fallidos", async () => {
    await createUser(db, { email: "bloqueo@example.com", displayName: "B", role: "viewer", password: PASSWORD });
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await expect(login(db, "bloqueo@example.com", "mala-contraseña-xx", { ip: `198.51.100.${i}` }, 24)).rejects.toBeInstanceOf(AuthError);
    }
    await expect(login(db, "bloqueo@example.com", PASSWORD, { ip: "198.51.100.99" }, 24)).rejects.toMatchObject({ code: "invalid_credentials" });
    const [ev] = await db.query<{ n: number }>("select count(*)::int as n from vmf.security_events where type = 'account_locked'");
    expect(ev!.n).toBe(1);
  });
  it("limita la frecuencia de intentos por correo", async () => {
    await db.query("delete from vmf.rate_limits");
    let limited = false;
    for (let i = 0; i < 12; i++) {
      try {
        await login(db, "limite@example.com", "x-intento-erróneo", { ip: `192.0.2.${i}` }, 24);
      } catch (e) {
        if ((e as AuthError).code === "rate_limited") limited = true;
      }
    }
    expect(limited).toBe(true);
    await db.query("delete from vmf.rate_limits");
  });
  it("expiración por inactividad y absoluta", async () => {
    const { token } = await login(db, "duena@example.com", PASSWORD, meta, 24);
    await db.query("update vmf.sessions set last_seen_at = now() - interval '13 hours' where revoked_at is null");
    expect(await validateSession(db, token, 12)).toBeNull();
    const s2 = await login(db, "duena@example.com", PASSWORD, meta, 24);
    await db.query("update vmf.sessions set expires_at = now() - interval '1 second'");
    expect(await validateSession(db, s2.token, 12)).toBeNull();
  });
  it("logout, revocación y usuario desactivado", async () => {
    const { token } = await login(db, "duena@example.com", PASSWORD, meta, 24);
    expect(await revokeSessionByToken(db, token)).toBe(ownerId);
    expect(await validateSession(db, token, 12)).toBeNull();

    const other = await createUser(db, { email: "lector@example.com", displayName: "L", role: "viewer", password: PASSWORD });
    const s = await login(db, "lector@example.com", PASSWORD, meta, 24);
    const [session] = await listActiveSessions(db, other.id);
    expect(await revokeSessionById(db, session!.id, { id: ownerId, role: "admin" })).toBe(false);
    expect(await revokeSessionById(db, session!.id, { id: ownerId, role: "owner" })).toBe(true);
    expect(await validateSession(db, s.token, 12)).toBeNull();

    const s3 = await login(db, "lector@example.com", PASSWORD, meta, 24);
    await db.query("update vmf.users set status = 'disabled' where id = $1", [other.id]);
    expect(await validateSession(db, s3.token, 12)).toBeNull();
  });
  it("cambiar la contraseña invalida sesiones anteriores", async () => {
    const old = await login(db, "duena@example.com", PASSWORD, meta, 24);
    await new Promise((r) => setTimeout(r, 10));
    await changePassword(db, ownerId, PASSWORD, "Nueva-Frase-Segura-2027");
    expect(await validateSession(db, old.token, 12)).toBeNull();
    await expect(changePassword(db, ownerId, "incorrecta-000000", "Otra-Frase-Segura-2028")).rejects.toMatchObject({ code: "invalid_credentials" });
    const fresh = await login(db, "duena@example.com", "Nueva-Frase-Segura-2027", meta, 24);
    expect(await validateSession(db, fresh.token, 12)).not.toBeNull();
  });
});

describe("límite de solicitudes", () => {
  it("cuenta por ventana y se reinicia", async () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    expect((await consumeRateLimit(db, "k", 2, 60, t0)).allowed).toBe(true);
    expect((await consumeRateLimit(db, "k", 2, 60, t0)).allowed).toBe(true);
    expect((await consumeRateLimit(db, "k", 2, 60, t0)).allowed).toBe(false);
    expect((await consumeRateLimit(db, "k", 2, 60, new Date("2026-01-01T00:01:00Z"))).count).toBe(1);
  });
});
