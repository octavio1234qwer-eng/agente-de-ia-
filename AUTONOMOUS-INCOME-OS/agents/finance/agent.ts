import type { AgentDefinition } from "@/server/orchestrator/agent";
import { financeSummary, monthRange } from "@/server/finance/ledger";
import { reconcilePayments } from "@/server/payments/service";
import { paymentsConfigured } from "@/server/env";
import { notifyAdmin } from "@/server/notifications";
import { checkSpend } from "@/server/security/spending";

export const financeAgent: AgentDefinition = {
  name: "finance",
  title: "Finanzas",
  mission: "Conciliar cada pago con Mercado Pago, mantener el libro sin duplicados y vigilar que el gasto no supere el presupuesto.",
  async run(ctx) {
    let reconcile = null;
    if (paymentsConfigured()) {
      const r = await ctx.perform("payment.reconcile", { summary: "Consultar pagos pendientes y no liberados" }, () => reconcilePayments(ctx.db));
      if (r.status === "done") reconcile = r.result;
    }
    const { from, to } = monthRange(ctx.now);
    const summary = await financeSummary(ctx.db, from, to);
    const spend = await checkSpend(ctx.db, "other", 0);
    if (spend.spentThisMonthCents > spend.limitCents) {
      await ctx.perform("notify.admin", { summary: "Gasto sobre el límite" }, () =>
        notifyAdmin(ctx.db, { subject: "Gasto mensual sobre el límite", body: `Gastado: ${spend.spentThisMonthCents / 100} MXN; límite: ${spend.limitCents / 100} MXN.`, severity: "critical", dedupeKey: `overspend:${from.toISOString().slice(0, 7)}` }),
      );
    }
    // Integridad: un pago no puede tener más de una venta registrada.
    const dup = await ctx.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM (SELECT payment_id FROM transactions WHERE kind IN ('sale','subscription_charge') GROUP BY payment_id HAVING count(*) > 1) x",
    );
    const duplicates = dup.rows[0]?.n ?? 0;
    if (duplicates > 0) {
      await ctx.perform("notify.admin", { summary: "Ventas duplicadas en el libro" }, () =>
        notifyAdmin(ctx.db, { subject: "Posible duplicado en el libro", body: `${duplicates} pagos con más de una venta registrada.`, severity: "critical", dedupeKey: `ledger-dup:${ctx.now.toISOString().slice(0, 10)}` }),
      );
    }
    const mxn = (c: number) => (c / 100).toFixed(2);
    return {
      summary: `Mes: cobrado ${mxn(summary.grossCollectedCents)} MXN, neto ${mxn(summary.netCents)} MXN, ${summary.salesCount} ventas reales.` +
        (paymentsConfigured() ? ` Conciliación: ${reconcile?.checked ?? 0} revisados, ${reconcile?.changed ?? 0} cambios.` : " Pagos sin configurar: no hay nada que conciliar."),
      data: { summary, reconcile, duplicates },
    };
  },
};
