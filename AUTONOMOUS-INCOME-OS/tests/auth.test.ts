import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { createTestDb } from "./helpers/db";
import { createOwner, enableTotp, getSessionUser, login, logout } from "@/server/auth/service";
import { generateTotpSecret, totpCode, verifyTotp } from "@/server/auth/totp";
import { decide } from "@/server/security/permissions";
import { checkSpend } from "@/server/security/spending";
import { rateLimit } from "@/server/security/rate-limit";
import type { Db } from "@/server/db";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("autenticación del administrador", () => {
  it("crea al dueño una sola vez, inicia y cierra sesión", async () => {
    const db = await createTestDb();
    await expect(createOwner(db, "dueno@ejemplo.mx", "corta")).rejects.toThrow();
    await createOwner(db, "Dueno@Ejemplo.mx", "una-clave-larga-2026");
    await expect(createOwner(db, "otro@ejemplo.mx", "una-clave-larga-2026")).rejects.toThrow(/Ya existe/);

    expect((await login(db, { email: "dueno@ejemplo.mx", password: "mal-clave-123456", ipHash: "ip1" })).ok).toBe(false);
    const r = await login(db, { email: "DUENO@ejemplo.mx", password: "una-clave-larga-2026", ipHash: "ip1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = await getSessionUser(db, r.token);
    expect(u?.email).toBe("dueno@ejemplo.mx");
    // El token nunca se guarda en claro.
    const s = await db.query<{ id: string }>("SELECT id FROM sessions");
    expect(s.rows[0]!.id).not.toBe(r.token);
    await logout(db, r.token);
    expect(await getSessionUser(db, r.token)).toBeNull();
  });

  it("bloquea la cuenta tras 5 intentos fallidos", async () => {
    const db = await createTestDb();
    await createOwner(db, "a@ejemplo.mx", "una-clave-larga-2026");
    let last;
    for (let i = 0; i < 5; i++) last = await login(db, { email: "a@ejemplo.mx", password: "incorrecta-0000", ipHash: `ip${i}` });
    expect(last).toMatchObject({ ok: false, error: "locked" });
    const ok = await login(db, { email: "a@ejemplo.mx", password: "una-clave-larga-2026", ipHash: "ipx" });
    expect(ok).toMatchObject({ ok: false, error: "locked" });
    const logs = await db.query<{ n: number }>("SELECT count(*)::int n FROM audit_logs WHERE action='admin.login_failed'");
    expect(logs.rows[0]!.n).toBe(5);
  });

  it("exige TOTP cuando está activado", async () => {
    const db = await createTestDb();
    const id = await createOwner(db, "t@ejemplo.mx", "una-clave-larga-2026");
    const secret = generateTotpSecret();
    expect(await enableTotp(db, id, secret, "000000")).toBe(verifyTotp(secret, "000000"));
    expect(await enableTotp(db, id, secret, totpCode(secret))).toBe(true);
    expect(await login(db, { email: "t@ejemplo.mx", password: "una-clave-larga-2026", ipHash: "i" })).toMatchObject({ error: "totp_required" });
    expect(await login(db, { email: "t@ejemplo.mx", password: "una-clave-larga-2026", ipHash: "i", totp: "123" })).toMatchObject({ error: "totp_invalid" });
    expect((await login(db, { email: "t@ejemplo.mx", password: "una-clave-larga-2026", ipHash: "i", totp: totpCode(secret) })).ok).toBe(true);
  });

  it("TOTP coincide con el vector de prueba del RFC 6238", () => {
    // Secreto ASCII "12345678901234567890" en base32; T=59 s → 94287082 (8 dígitos) → últimos 6: 287082
    expect(totpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe("287082");
  });
});

describe("permisos y límites", () => {
  it("aplica mínimo privilegio", () => {
    expect(decide("delivery", "order.fulfill").decision).toBe("allow");
    expect(decide("marketing", "content.publish").decision).toBe("approval");
    expect(decide("finance", "payment.refund").decision).toBe("approval");
    expect(decide("marketing", "payment.refund").decision).toBe("deny");
    expect(decide("auditor", "permissions.modify").decision).toBe("deny");
    expect(decide("finance", "money.transfer").decision).toBe("deny");
    expect(decide("desconocido", "report.write").decision).toBe("deny");
    expect(decide("ceo", "accion.inventada").decision).toBe("deny");
  });

  it("bloquea cualquier gasto con presupuesto 0", async () => {
    const db: Db = await createTestDb();
    expect((await checkSpend(db, "llm", 0)).allowed).toBe(true);
    expect((await checkSpend(db, "llm", 1)).allowed).toBe(false);
    expect((await checkSpend(db, "ads", 50000)).allowed).toBe(false);
  });

  it("limita peticiones por ventana", async () => {
    const db = await createTestDb();
    for (let i = 0; i < 3; i++) expect((await rateLimit(db, "b", 3, 60)).ok).toBe(true);
    expect((await rateLimit(db, "b", 3, 60)).ok).toBe(false);
  });
});
