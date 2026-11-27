import type { AgentHandlers } from "../../core/agent-registry/types";
import { budgetStatus, fmt, pnlByUnit } from "../../finance/ledger";
import { raiseAlert } from "../../core/event-bus";
import { saveReport } from "../shared";
import { periodKey } from "../../core/scheduler";

export const handlers: AgentHandlers = {
  async pnl_report(ctx, input) {
    await ctx.require("report.generate");
    const days = Number(input.days ?? 30);
    const from = new Date(ctx.now.getTime() - days * 86400000);
    const rows = await pnlByUnit(ctx.db, from, ctx.now);
    const budget = await budgetStatus(ctx.db);
    const lines = rows.length
      ? rows.map((r) => `| ${r.businessUnitId} | ${r.currency} | ${fmt(r.incomeCents + r.commissionCents, r.currency)} | ${fmt(r.feeCents, r.currency)} | ${fmt(r.expenseCents, r.currency)} | ${fmt(r.netCents, r.currency)} | ${fmt(r.estimatedIncomeCents, r.currency)} |`).join("\n")
      : "| — | — | sin datos | — | — | — | — |";
    const body = `# Estado de resultados (${days} días)\n\nSolo dinero real verificado; estimaciones en columna aparte.\n\n| Unidad | Moneda | Ingresos | Comisiones plataforma | Gastos | Neto | Estimado (no real) |\n|---|---|---|---|---|---|---|\n${lines}\n\n**Presupuesto:** autorizado ${fmt(budget.authorizedCents)}, gastado ${fmt(budget.spentCents)}, comprometido ${fmt(budget.committedCents)}, disponible ${fmt(budget.remainingCents)}.\n`;
    await ctx.require("alert.raise");
    for (const r of rows) if (r.netCents < 0)
      await raiseAlert(ctx.db, { severity: "warning", source: ctx.agentId, message: `Pérdida en ${r.businessUnitId}: neto ${fmt(r.netCents, r.currency)} en ${days} días`, dedupeKey: `loss:${r.businessUnitId}:${periodKey("weekly", ctx.now)}` });
    await saveReport(ctx.db, { kind: "pnl", periodKey: periodKey("daily", ctx.now), agentId: ctx.agentId, bodyMd: body, data: { rows, budget } });
    return { rows, budget };
  },
  async budget_check(ctx) {
    await ctx.require("analysis.run");
    const b = await budgetStatus(ctx.db);
    const usedPct = b.authorizedCents ? ((b.spentCents + b.committedCents) / b.authorizedCents) * 100 : 0;
    if (usedPct >= 80) {
      await ctx.require("alert.raise");
      await raiseAlert(ctx.db, { severity: usedPct >= 100 ? "critical" : "warning", source: ctx.agentId, message: `Presupuesto usado/comprometido: ${usedPct.toFixed(0)} %`, dedupeKey: `budget:${Math.floor(usedPct / 10)}` });
    }
    return { ...b, usedPct: Math.round(usedPct * 10) / 10 };
  },
};
