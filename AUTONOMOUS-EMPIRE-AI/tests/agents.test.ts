import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Db } from "../core/db";
import { freshDb } from "./helpers";
import { runAgentTask } from "../core/orchestrator";
import { runRoutine } from "../automation/routines";
import { captureLead } from "../businesses/cotizafacil-mx/leads";
import { verifyAuditChain } from "../core/audit-log";
import { login, getSessionUser, createUser, logout } from "../core/auth";

let db: Db;
beforeEach(async () => { db = await freshDb(); });
afterEach(async () => { await db.close(); });

describe("agentes", () => {
  it("el ciclo diario del CEO ejecuta a todos los agentes y genera informe sin inventar datos", async () => {
    await captureLead(db, { name: "Luis", email: "luis@example.com", consentContact: true, quotesPerMonth: 12, willingnessToPayMxn: 149, need: "cotizo por WhatsApp" });
    const r = await runAgentTask(db, "empire-ceo", "daily_cycle", {}, { idempotencyKey: "daily@t" });
    expect(r.status).toBe("succeeded");
    const steps = (r.output as { steps: Record<string, { ok: boolean; error?: string }> }).steps;
    for (const [k, s] of Object.entries(steps)) expect(s.ok, `${k}: ${s.error}`).toBe(true);
    const rep = (await db.query<{ body_md: string }>("select body_md from reports where kind='executive-daily'")).rows[0]!;
    expect(rep.body_md).toContain("Sin movimientos en el periodo");
    expect(rep.body_md).toContain("CotizaFácil MX: seguir validando");
    // seguimiento planificado como borrador, nunca enviado
    const out = (await db.query<{ status: string }>("select status from email_outbox")).rows;
    expect(out).toEqual([{ status: "draft" }]);
    expect((await db.query("select * from content_items")).rows.length).toBe(2);
    expect((await verifyAuditChain(db)).ok).toBe(true);
  });
  it("idempotencia: la misma clave no se ejecuta dos veces", async () => {
    const a = await runAgentTask(db, "finance-controller", "budget_check", {}, { idempotencyKey: "k1" });
    const b = await runAgentTask(db, "finance-controller", "budget_check", {}, { idempotencyKey: "k1" });
    expect(b.reused).toBe(true);
    expect(b.taskId).toBe(a.taskId);
  });
  it("un agente que intenta una acción fuera de su lista queda bloqueado", async () => {
    // content-factory no tiene report.generate; executive_report del CEO sí. Forzamos con risk sobre lead.manage:
    const { getAgent } = await import("../core/agent-registry");
    const cs = getAgent("content-factory");
    cs.handlers["__test"] = async (ctx) => { await ctx.require("content.publish"); };
    cs.def.tasks.push("__test");
    const r = await runAgentTask(db, "content-factory", "__test");
    expect(r.status).toBe("blocked");
    delete cs.handlers["__test"]; cs.def.tasks.pop();
  });
  it("compliance rechaza contenido con promesas de ingresos", async () => {
    await db.query("insert into content_items(business_unit_id, channel, title, body, created_by) values ('cotizafacil-mx','facebook','Ingresos garantizados','Hazte rico ya','t')");
    const r = await runAgentTask(db, "risk-compliance", "compliance_scan");
    expect(r.status).toBe("succeeded");
    expect((await db.query<{ status: string }>("select status from content_items")).rows[0]!.status).toBe("rejected");
  });
  it("detecta enlaces rotos sin marcar como roto un bloqueo 403", async () => {
    await db.query("insert into affiliate_links(slug,title,destination_url,created_by) values ('a-404','a','https://www.mercadolibre.com.mx/404','t'),('b-403','b','https://www.mercadolibre.com.mx/403','t')");
    const f = (async (url: string) => new Response("", { status: url.endsWith("404") ? 404 : 403 })) as unknown as typeof fetch;
    const r = await runAgentTask(db, "engineering", "check_affiliate_links", { __fetch: f });
    expect(r.status).toBe("succeeded");
    const rows = (await db.query<{ slug: string; status: string }>("select slug, status from affiliate_links order by slug")).rows;
    expect(rows).toEqual([{ slug: "a-404", status: "broken" }, { slug: "b-403", status: "active" }]);
  });
  it("rutina diaria vía planificador no se duplica", async () => {
    const now = new Date("2026-11-27T12:00:00Z");
    expect((await runRoutine(db, "daily.ceo-cycle", { now })).status).toBe("succeeded");
    expect((await runRoutine(db, "daily.ceo-cycle", { now })).status).toBe("skipped");
  });
});

describe("autenticación", () => {
  it("login, sesión, logout y bloqueo por intentos", async () => {
    await db.transaction((tx) => createUser(tx, { email: "dueno@example.com", name: "Dueño", role: "owner", password: "una-contraseña-larga" }));
    const ok = await login(db, "DUENO@example.com", "una-contraseña-larga");
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect((await getSessionUser(db, ok.token))?.role).toBe("owner");
    await logout(db, ok.token);
    expect(await getSessionUser(db, ok.token)).toBeNull();
    for (let i = 0; i < 5; i++) expect((await login(db, "dueno@example.com", "mala")).ok).toBe(false);
    const locked = await login(db, "dueno@example.com", "una-contraseña-larga");
    expect(locked.ok === false && locked.error).toMatch(/bloqueada/);
  });
  it("rechaza contraseñas cortas", async () => {
    await expect(db.transaction((tx) => createUser(tx, { email: "a@b.co", name: "", role: "viewer", password: "corta" }))).rejects.toThrow();
  });
});
