import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Db } from "../core/db";
import { freshDb, owner, operator } from "./helpers";
import { audit, verifyAuditChain } from "../core/audit-log";
import { authorize, decideApproval, requestApproval } from "../core/permissions";
import { runJob } from "../core/scheduler";
import { validateRegistry } from "../core/agent-registry";

let db: Db;
beforeEach(async () => { db = await freshDb(); });
afterEach(async () => { await db.close(); });

describe("base de datos", () => {
  it("aplica migraciones y semilla", async () => {
    const u = await db.query<{ n: string }>("select count(*) n from business_units");
    expect(Number(u.rows[0]!.n)).toBe(6);
    const b = await db.query<{ amount_cents: string }>("select amount_cents from budgets where id='initial'");
    expect(Number(b.rows[0]!.amount_cents)).toBe(50000);
  });
});

describe("auditoría encadenada", () => {
  it("verifica la cadena y detecta alteraciones", async () => {
    await audit(db, { actor: "t", action: "a1", level: "green", result: "ok", detail: { b: 2, a: 1 } });
    await audit(db, { actor: "t", action: "a2", level: "yellow", result: "ok" });
    expect((await verifyAuditChain(db)).ok).toBe(true);
    await db.query("update audit_log set result='alterado' where action='a1'");
    const v = await verifyAuditChain(db);
    expect(v.ok).toBe(false);
  });
  it("detecta borrado de un registro intermedio", async () => {
    for (const a of ["x1", "x2", "x3"]) await audit(db, { actor: "t", action: a, level: "green", result: "ok" });
    await db.query("delete from audit_log where action='x2'");
    expect((await verifyAuditChain(db)).ok).toBe(false);
  });
});

describe("permisos", () => {
  it("verde permitido, rojo requiere autorización, prohibido siempre bloqueado", async () => {
    expect((await authorize(db, operator, "report.generate")).allowed).toBe(true);
    const red = await authorize(db, owner, "money.spend");
    expect(red.allowed).toBe(false);
    expect(red.allowed === false && red.needsApproval).toBe(true);
    expect((await authorize(db, owner, "spam.send")).allowed).toBe(false);
    expect((await authorize(db, owner, "accion.inventada")).allowed).toBe(false);
  });
  it("viewer no ejecuta amarillo; público solo captura leads", async () => {
    expect((await authorize(db, { id: "user:v", role: "viewer" }, "lead.manage")).allowed).toBe(false);
    expect((await authorize(db, { id: "public", role: "public" }, "lead.capture")).allowed).toBe(true);
    expect((await authorize(db, { id: "public", role: "public" }, "report.generate")).allowed).toBe(false);
  });
  it("agentes limitados a su lista blanca", async () => {
    const agent = { id: "agent:x", role: "agent" as const, allowedActions: ["draft.create"] };
    expect((await authorize(db, agent, "draft.create")).allowed).toBe(true);
    expect((await authorize(db, agent, "content.publish")).allowed).toBe(false);
  });
  it("solo el propietario aprueba; la autorización debe ser de la misma acción", async () => {
    const id = await db.transaction((tx) => requestApproval(tx, { action: "ads.buy", requestedBy: "agent:x", reason: "prueba" }));
    await expect(db.transaction((tx) => decideApproval(tx, { approvalId: id, decidedBy: operator, approve: true }))).rejects.toThrow();
    await db.transaction((tx) => decideApproval(tx, { approvalId: id, decidedBy: owner, approve: true }));
    expect((await authorize(db, owner, "ads.buy", { approvalId: id })).allowed).toBe(true);
    expect((await authorize(db, owner, "funds.transfer", { approvalId: id })).allowed).toBe(false);
    const rows = await db.query<{ decided_by: string; decided_at: string }>("select decided_by, decided_at from approvals where id=$1", [id]);
    expect(rows.rows[0]!.decided_by).toBe(owner.id);
    expect(rows.rows[0]!.decided_at).toBeTruthy();
  });
});

describe("planificador", () => {
  it("evita ejecuciones duplicadas del mismo periodo", async () => {
    let n = 0;
    const r1 = await runJob(db, "t", "2026-11-27", async () => ++n);
    const r2 = await runJob(db, "t", "2026-11-27", async () => ++n);
    expect(r1.status).toBe("succeeded");
    expect(r2.status).toBe("skipped");
    expect(n).toBe(1);
  });
  it("reintenta y luego alerta si falla", async () => {
    let n = 0;
    const r = await runJob(db, "f", "p", async () => { n++; throw new Error("boom"); }, { maxAttempts: 3, backoffMs: 1 });
    expect(r.status).toBe("failed");
    expect(n).toBe(3);
    const a = await db.query("select * from alerts where source='job:f'");
    expect(a.rows.length).toBe(1);
    // reintento posterior permitido tras fallo
    const r2 = await runJob(db, "f", "p", async () => "ok", { backoffMs: 1 });
    expect(r2.status).toBe("succeeded");
  });
  it("respeta el tiempo límite", async () => {
    const r = await runJob(db, "slow", "p", () => new Promise((res) => setTimeout(res, 500)), { maxAttempts: 1, timeoutMs: 50 });
    expect(r.status).toBe("failed");
    expect(r.error).toMatch(/Tiempo límite/);
  });
});

describe("registro de agentes", () => {
  it("cada tarea declarada tiene manejador", () => { expect(validateRegistry()).toEqual([]); });
});
