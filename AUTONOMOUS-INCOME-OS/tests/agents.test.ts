import { beforeEach, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { createTestDb } from "./helpers/db";
import { runTick, enqueueDueAutomations } from "@/server/orchestrator/runner";
import { enqueue, claimNext, failTask } from "@/server/orchestrator/queue";
import { createAgentContext, runAgent } from "@/server/orchestrator/agent";
import { decideApproval } from "@/server/approvals";
import { setKillSwitch, getKillSwitch } from "@/server/settings";
import { audit } from "@/server/audit";
import { scoreOpportunity } from "@/server/research/scoring";
import { AGENTS } from "@root/agents/registry";
import { LEGAL_PAGES } from "@root/agents/product/agent";
import { weeklyPriorities } from "@root/agents/ceo/agent";
import { createOwner } from "@/server/auth/service";
import type { Db } from "@/server/db";

beforeEach(() => {
  delete process.env.MP_ACCESS_TOKEN;
  delete process.env.MP_WEBHOOK_SECRET;
  delete process.env.RESEND_API_KEY;
});

async function owner(db: Db) {
  return createOwner(db, "dueno@ejemplo.mx", "una-clave-larga-2026");
}

describe("orquestador", () => {
  it("encola automatizaciones una sola vez por ventana y ejecuta los 9 agentes sin errores", async () => {
    const db = await createTestDb();
    const now = new Date();
    const first = await enqueueDueAutomations(db, now);
    expect(first.length).toBe(11);
    expect(await enqueueDueAutomations(db, now)).toEqual([]);
    const report = await runTick(db, { maxTasks: 50, timeBudgetMs: 60_000 });
    const failed = report.processed.filter((p) => p.outcome !== "succeeded");
    expect(failed).toEqual([]);
    const runs = await db.query<{ agent: string; status: string }>("SELECT agent, status FROM agent_runs");
    expect(new Set(runs.rows.map((r) => r.agent))).toEqual(new Set(Object.keys(AGENTS)));
    expect(runs.rows.every((r) => r.status === "succeeded")).toBe(true);
  });

  it("el interruptor general detiene todo", async () => {
    const db = await createTestDb();
    await setKillSwitch(db, true, "prueba", { type: "user", id: "x" });
    const r = await runTick(db);
    expect(r).toMatchObject({ killSwitch: true, stoppedReason: "kill_switch", processed: [] });
    expect((await db.query("SELECT 1 FROM tasks")).rows).toHaveLength(0);
  });

  it("un agente pausado no se ejecuta", async () => {
    const db = await createTestDb();
    await db.query("UPDATE agent_controls SET enabled = false WHERE agent = 'marketing'");
    await db.query("UPDATE automations SET enabled = false WHERE agent IS DISTINCT FROM 'marketing'");
    const r = await runTick(db);
    expect(r.processed).toEqual([expect.objectContaining({ agent: "marketing", outcome: "cancelled" })]);
  });

  it("reintenta con límite y deja la tarea como 'dead' con aviso", async () => {
    const db = await createTestDb();
    await enqueue(db, { type: "tipo.inexistente", maxAttempts: 2, idempotencyKey: "x" });
    let t = await claimNext(db, "w");
    expect(await failTask(db, t!, "error 1")).toBe("retry");
    await db.query("UPDATE tasks SET run_after = now()");
    t = await claimNext(db, "w");
    expect(await failTask(db, t!, "error 2")).toBe("dead");
    expect((await db.query("SELECT 1 FROM notifications WHERE subject LIKE 'Tarea fallida%'")).rows).toHaveLength(1);
  });

  it("evita ciclos: profundidad máxima 3", async () => {
    const db = await createTestDb();
    await expect(enqueue(db, { type: "agent.run", depth: 4 })).rejects.toThrow(/Profundidad/);
    const ctx = createAgentContext(db, "ceo", null, 3);
    await expect(ctx.enqueueChild("agent.run", "ceo", {}, "k")).rejects.toThrow(/Profundidad/);
  });
});

describe("permisos de agentes", () => {
  it("una acción fuera de su rol se bloquea y queda en la bitácora", async () => {
    const db = await createTestDb();
    const ctx = createAgentContext(db, "marketing", null, 0);
    let ran = false;
    const r = await ctx.perform("payment.refund", { summary: "intento" }, async () => {
      ran = true;
    });
    expect(r.status).toBe("denied");
    expect(ran).toBe(false);
    expect((await db.query("SELECT 1 FROM audit_logs WHERE action = 'agent.action_denied'")).rows).toHaveLength(1);
    const t = await createAgentContext(db, "finance", null, 0).perform("money.transfer", { summary: "retirar" });
    expect(t.status).toBe("denied");
  });

  it("ningún agente puede modificar permisos", () => {
    for (const name of Object.keys(AGENTS)) {
      expect(createAgentContext({} as Db, name, null, 0)).toBeTruthy();
    }
  });
});

describe("flujos con aprobación", () => {
  it("producto: QA → solicitud → aprobación humana → publicado", async () => {
    const db = await createTestDb();
    const userId = await owner(db);
    await runAgent(db, AGENTS.product!);
    const pend = await db.query<{ id: string; title: string }>("SELECT id, title FROM approvals WHERE kind = 'product.publish' AND status = 'pending' ORDER BY title");
    expect(pend.rows.map((r) => r.title)).toEqual(["Publicar CotizaFácil MX Nube (mensual)", "Publicar CotizaFácil MX Pro (pago único)"]);
    const pro = pend.rows.find((r) => r.title.includes("Pro"))!;
    expect(await decideApproval(db, pro.id, userId, "approved")).toMatchObject({ status: "executed" });
    const p = await db.query<{ status: string }>("SELECT status FROM products WHERE slug = 'cotizafacil-pro'");
    expect(p.rows[0]!.status).toBe("published");
    await expect(decideApproval(db, pro.id, userId, "approved")).rejects.toThrow(/ya está/);
    // Repetir el agente no duplica solicitudes.
    await runAgent(db, AGENTS.product!);
    expect((await db.query("SELECT 1 FROM approvals WHERE kind = 'product.publish'")).rows).toHaveLength(2);
  });

  it("marketing: borradores sin publicar hasta aprobar", async () => {
    const db = await createTestDb();
    const userId = await owner(db);
    const out = await runAgent(db, AGENTS.marketing!);
    expect(out.output.summary).toMatch(/borradores/);
    const drafts = await db.query<{ id: string; status: string }>("SELECT id, status FROM content");
    expect(drafts.rows.length).toBeGreaterThan(0);
    expect(drafts.rows.every((d) => d.status === "draft")).toBe(true);
    const a = await db.query<{ id: string }>("SELECT id FROM approvals WHERE kind = 'content.publish' LIMIT 1");
    await decideApproval(db, a.rows[0]!.id, userId, "approved");
    expect((await db.query("SELECT 1 FROM content WHERE status = 'approved'")).rows).toHaveLength(1);
  });

  it("gasto: aunque una persona lo apruebe, se bloquea si supera el límite del repositorio", async () => {
    const db = await createTestDb();
    const userId = await owner(db);
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO approvals (kind, title, payload, requested_by) VALUES ('expense.create','Vercel Pro',$1,'agent:finance') RETURNING id`,
      [JSON.stringify({ vendor: "Vercel", description: "Plan Pro", category: "hosting", amountCents: 36000 })],
    );
    const r = await decideApproval(db, rows[0]!.id, userId, "approved");
    expect(r.status).toBe("failed");
    expect(r.result).toMatch(/limits\.json/);
    expect((await db.query("SELECT 1 FROM expenses")).rows).toHaveLength(0);
  });
});

describe("auditor", () => {
  it("detecta una bitácora alterada y activa el interruptor general", async () => {
    const db = await createTestDb();
    await db.tx((q) => audit(q, { actorType: "system", action: "x" }));
    await db.tx((q) => audit(q, { actorType: "system", action: "y" }));
    await db.exec("ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_mutation");
    await db.query("UPDATE audit_logs SET action = 'z' WHERE id = 1");
    await db.exec("ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_mutation");
    const out = await runAgent(db, AGENTS.auditor!);
    expect(out.output.summary).toMatch(/ALTERADA/);
    expect((await getKillSwitch(db)).active).toBe(true);
  });

  it("pausa a un agente con 3 fallos seguidos", async () => {
    const db = await createTestDb();
    for (let i = 0; i < 3; i++) await db.query("INSERT INTO agent_runs (agent, status, error) VALUES ('traffic','failed','x')");
    await runAgent(db, AGENTS.auditor!);
    const c = await db.query<{ enabled: boolean }>("SELECT enabled FROM agent_controls WHERE agent = 'traffic'");
    expect(c.rows[0]!.enabled).toBe(false);
  });
});

describe("investigación", () => {
  it("sin evidencia no hay puntuación", () => {
    expect(scoreOpportunity([])).toMatchObject({ total: null, confidence: "none" });
  });
  it("con evidencia en las 4 dimensiones calcula un total entre 0 y 10", () => {
    const today = new Date("2026-11-27");
    const s = scoreOpportunity([
      { kind: "demand", data: { monthly_impressions: 2400 }, observed_on: "2026-11-20" },
      { kind: "competition", data: { competitors: 4 }, observed_on: "2026-11-26" },
      { kind: "difficulty", data: { build_days: 10 }, observed_on: "2026-11-26" },
      { kind: "pricing", data: { price_mxn: 49 }, observed_on: "2026-11-26" },
      { kind: "pricing", data: { price_mxn: 99 }, observed_on: "2026-11-26" },
    ], today);
    expect(s.total).not.toBeNull();
    expect(s.total!).toBeGreaterThan(0);
    expect(s.total!).toBeLessThanOrEqual(10);
    expect(s.competition).toBe(4);
  });
  it("descarta evidencia vieja", () => {
    const s = scoreOpportunity([{ kind: "demand", data: { sales: 5 }, observed_on: "2024-01-01" }], new Date("2026-11-27"));
    expect(s.demand).toBeNull();
  });
});

describe("dirección", () => {
  it("identifica el cuello de botella del embudo", () => {
    expect(weeklyPriorities({ visitors: 10, toolUsers: 5, pricingViews: 0, checkoutsStarted: 0, paidOrders: 0 }, [])[0]).toMatch(/Tráfico/);
    expect(weeklyPriorities({ visitors: 500, toolUsers: 300, pricingViews: 40, checkoutsStarted: 6, paidOrders: 0 }, [])[0]).toMatch(/Pago/);
    expect(weeklyPriorities({ visitors: 500, toolUsers: 300, pricingViews: 40, checkoutsStarted: 6, paidOrders: 0 }, ["Mercado Pago"])[0]).toMatch(/Configurar/);
  });
});

describe("páginas legales", () => {
  it("existen las páginas que declara el QA", () => {
    for (const p of LEGAL_PAGES) {
      expect(existsSync(path.join(process.cwd(), "src/app/(storefront)", p, "page.tsx")), p).toBe(true);
    }
  });
});
