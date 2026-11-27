import type { AgentHandlers, AgentContext } from "../../core/agent-registry/types";
import { budgetStatus, fmt, pnlByUnit } from "../../finance/ledger";
import { saveReport } from "../shared";
import { periodKey } from "../../core/scheduler";

type Step = { agent: string; task: string; input?: Record<string, unknown> };

async function runSteps(ctx: AgentContext, steps: Step[]) {
  const results: Record<string, { ok: boolean; output?: unknown; error?: string }> = {};
  for (const s of steps) {
    const key = `${s.agent}.${s.task}`;
    try { results[key] = { ok: true, output: await ctx.delegate(s.agent, s.task, s.input) }; }
    catch (e) { results[key] = { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  }
  return results;
}

async function executiveReport(ctx: AgentContext, kind: "daily" | "weekly" | "monthly", days: number, stepResults?: Record<string, { ok: boolean; output?: unknown; error?: string }>) {
  await ctx.require("report.generate");
  const from = new Date(ctx.now.getTime() - days * 86400000);
  const pnl = await pnlByUnit(ctx.db, from, ctx.now);
  const budget = await budgetStatus(ctx.db);
  const units = await ctx.db.query<{ id: string; name: string; status: string }>("select id, name, status from business_units order by phase");
  const leads = await ctx.db.query<{ unit: string; n: string; hot: string }>(
    "select business_unit_id unit, count(*) n, count(*) filter (where score >= 60) hot from leads where created_at >= $1 group by 1", [from.toISOString()]);
  const alerts = await ctx.db.query<{ severity: string; message: string }>("select severity, message from alerts where not resolved order by created_at desc limit 10");
  const pending = await ctx.db.query<{ n: string }>("select count(*) n from approvals where status='pending'");
  const gate = (stepResults?.["product-manager.validation_gate"]?.output as { verdict?: string; gates?: Record<string, { value: number; target: number }> } | undefined);

  const priorities: string[] = [];
  const critical = alerts.rows.filter((a) => a.severity === "critical");
  if (critical.length) priorities.push(`Resolver ${critical.length} alerta(s) crítica(s) antes de cualquier otra cosa.`);
  if (Number(pending.rows[0]?.n) > 0) priorities.push(`El propietario tiene ${pending.rows[0]!.n} autorización(es) pendiente(s).`);
  const cfLeads = Number(leads.rows.find((l) => l.unit === "cotizafacil-mx")?.n ?? 0);
  if (gate?.verdict === "KEEP_VALIDATING") priorities.push(`CotizaFácil MX: seguir validando (${cfLeads} leads en ${days} días). Acción: llevar tráfico orgánico a /cotizafacil y entrevistar a los leads.`);
  if (gate?.verdict === "PRESELL") priorities.push("CotizaFácil MX: abrir preventa con Mercado Pago (requiere credenciales y aprobación del precio).");
  if (gate?.verdict === "BUILD") priorities.push("CotizaFácil MX: validación superada — construir el MVP de cotizaciones.");
  const earning = pnl.filter((p) => p.incomeCents + p.commissionCents > 0);
  if (!earning.length) priorities.push("Ninguna unidad tiene ingresos reales en el periodo: priorizar ventas sobre nuevas funciones.");

  const failed = Object.entries(stepResults ?? {}).filter(([, r]) => !r.ok);
  const body = [
    `# Informe ejecutivo ${kind} — ${ctx.now.toISOString().slice(0, 10)}`,
    "",
    "> Generado con datos de la base. Sin datos = sin datos; no hay cifras estimadas mezcladas con reales.",
    "",
    "## Prioridades",
    ...priorities.map((p, i) => `${i + 1}. ${p}`),
    "",
    "## Finanzas (dinero real)",
    pnl.length ? pnl.map((p) => `- ${p.businessUnitId} (${p.currency}): ingresos ${fmt(p.incomeCents + p.commissionCents, p.currency)}, neto ${fmt(p.netCents, p.currency)}${p.estimatedIncomeCents ? `, estimado no confirmado ${fmt(p.estimatedIncomeCents, p.currency)}` : ""}`).join("\n") : "- Sin movimientos en el periodo.",
    `- Presupuesto disponible: ${fmt(budget.remainingCents)} de ${fmt(budget.authorizedCents)}`,
    "",
    "## Unidades",
    ...units.rows.map((u) => `- ${u.name}: ${u.status}`),
    "",
    "## Leads",
    leads.rows.length ? leads.rows.map((l) => `- ${l.unit}: ${l.n} (calientes: ${l.hot})`).join("\n") : "- Sin leads en el periodo.",
    "",
    "## Alertas abiertas",
    alerts.rows.length ? alerts.rows.map((a) => `- [${a.severity}] ${a.message}`).join("\n") : "- Ninguna.",
    ...(stepResults ? ["", "## Ejecución de agentes", ...Object.entries(stepResults).map(([k, r]) => `- ${k}: ${r.ok ? "OK" : `FALLÓ — ${r.error}`}`)] : []),
  ].join("\n");
  await saveReport(ctx.db, { kind: `executive-${kind}`, periodKey: periodKey(kind === "daily" ? "daily" : kind === "weekly" ? "weekly" : "monthly", ctx.now), agentId: ctx.agentId, bodyMd: body, data: { priorities, pnl, budget } });
  return { priorities, failedSteps: failed.map(([k]) => k) };
}

export const handlers: AgentHandlers = {
  async daily_cycle(ctx) {
    await ctx.require("analysis.run");
    const results = await runSteps(ctx, [
      { agent: "engineering", task: "health_check" },
      { agent: "customer-success", task: "score_leads" },
      { agent: "customer-success", task: "plan_follow_ups" },
      { agent: "content-factory", task: "draft_posts", input: { max: 2 } },
      { agent: "risk-compliance", task: "compliance_scan" },
      { agent: "finance-controller", task: "pnl_report", input: { days: 30 } },
      { agent: "finance-controller", task: "budget_check" },
      { agent: "growth-manager", task: "funnel_metrics", input: { days: 30 } },
      { agent: "product-manager", task: "validation_gate" },
    ]);
    return { steps: results, report: await executiveReport(ctx, "daily", 1, results) };
  },
  async weekly_cycle(ctx) {
    await ctx.require("analysis.run");
    const results = await runSteps(ctx, [
      { agent: "engineering", task: "check_affiliate_links" },
      { agent: "market-intelligence", task: "score_opportunities" },
      { agent: "finance-controller", task: "pnl_report", input: { days: 7 } },
      { agent: "growth-manager", task: "funnel_metrics", input: { days: 7 } },
      { agent: "product-manager", task: "validation_gate" },
    ]);
    const report = await executiveReport(ctx, "weekly", 7, results);
    await ctx.require("data.organize");
    await ctx.db.query("insert into decisions(made_by, title, rationale, data) values ($1,$2,$3,$4)", [
      `agent:${ctx.agentId}`, `Prioridades semana ${periodKey("weekly", ctx.now)}`, report.priorities.join(" | ") || "Sin cambios", JSON.stringify({ steps: Object.keys(results) }),
    ]);
    return { steps: results, report };
  },
  async monthly_cycle(ctx) {
    await ctx.require("analysis.run");
    const results = await runSteps(ctx, [
      { agent: "finance-controller", task: "pnl_report", input: { days: 30 } },
      { agent: "market-intelligence", task: "score_opportunities" },
      { agent: "product-manager", task: "validation_gate" },
    ]);
    return { steps: results, report: await executiveReport(ctx, "monthly", 30, results) };
  },
  async executive_report(ctx, input) {
    return executiveReport(ctx, (input.kind as "daily") ?? "daily", Number(input.days ?? 1));
  },
};
