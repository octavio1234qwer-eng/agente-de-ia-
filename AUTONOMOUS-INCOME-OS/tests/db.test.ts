import { describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";
import { runMigrations } from "@/server/db/migrate";
import { audit, verifyAuditChain } from "@/server/audit";

describe("migraciones", () => {
  it("se aplican una vez y son idempotentes", async () => {
    const db = await createTestDb({ bootstrap: false });
    const again = await runMigrations(db);
    expect(again.applied).toEqual([]);
    expect(again.skipped.length).toBeGreaterThan(0);
    const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'");
    expect(rows[0]!.n).toBeGreaterThanOrEqual(30);
  });

  it("aplica restricciones: no hay prospectos sin consentimiento ni pagos de producto en 0", async () => {
    const db = await createTestDb({ bootstrap: false });
    const b = await db.query<{ id: string }>("INSERT INTO businesses (slug, name) VALUES ('x-test','X') RETURNING id");
    const bid = b.rows[0]!.id;
    await expect(
      db.query("INSERT INTO leads (business_id,email,consent,consent_text,consent_at,unsubscribe_token_hash) VALUES ($1,'a@b.mx',false,'t',now(),'h')", [bid]),
    ).rejects.toThrow();
    await expect(
      db.query("INSERT INTO products (business_id,slug,name,kind,price_cents) VALUES ($1,'p','P','one_time',0)", [bid]),
    ).rejects.toThrow();
    await expect(
      db.query("INSERT INTO campaigns (business_id,slug,name,channel,budget_cents) VALUES ($1,'c','C','ads',5000)", [bid]),
    ).rejects.toThrow();
  });
});

describe("bitácora de auditoría", () => {
  it("encadena hashes, rechaza cambios y detecta alteraciones", async () => {
    const db = await createTestDb({ bootstrap: false });
    for (let i = 0; i < 3; i++) {
      await db.tx((q) => audit(q, { actorType: "system", action: "test.event", metadata: { i, password: "no-debe-guardarse" } }));
    }
    expect(await verifyAuditChain(db)).toEqual({ ok: true, checked: 3 });
    const { rows } = await db.query<{ metadata: { password: string } }>("SELECT metadata FROM audit_logs LIMIT 1");
    expect(rows[0]!.metadata.password).toBe("[oculto]");
    await expect(db.query("UPDATE audit_logs SET action='x'")).rejects.toThrow(/solo anexado/);
    await expect(db.query("DELETE FROM audit_logs")).rejects.toThrow(/solo anexado/);
    // Simula un atacante con privilegios que desactiva el trigger y altera una fila.
    await db.exec("ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_mutation");
    await db.query("UPDATE audit_logs SET metadata = '{\"i\":99}' WHERE id = 2");
    const check = await verifyAuditChain(db);
    expect(check.ok).toBe(false);
    expect(check.brokenAtId).toBe(2);
  });
});
