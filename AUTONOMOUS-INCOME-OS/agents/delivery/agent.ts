import type { AgentDefinition } from "@/server/orchestrator/agent";
import { DeliveryBlockedError, fulfillOrder, pendingDeliveries, recordDeliveryFailure } from "@/server/delivery/service";

export const deliveryAgent: AgentDefinition = {
  name: "delivery",
  title: "Entrega",
  mission: "Entregar cada pedido con pago verificado, reintentar fallos seguros y vencer accesos cuyo periodo terminó.",
  async run(ctx) {
    const ids = await pendingDeliveries(ctx.db);
    let delivered = 0;
    let failed = 0;
    for (const id of ids) {
      const r = await ctx.perform("order.fulfill", { summary: `Entregar pedido ${id.slice(0, 8)}` }, async () => {
        try {
          await fulfillOrder(ctx.db, id);
          return true;
        } catch (err) {
          if (!(err instanceof DeliveryBlockedError)) throw err;
          await recordDeliveryFailure(ctx.db, id, err.message);
          return false;
        }
      });
      if (r.status === "done" && r.result) delivered++;
      else failed++;
    }
    const expired = await ctx.perform("recovery.retry", { summary: "Vencer licencias de suscripciones canceladas" }, () =>
      ctx.db.query("UPDATE entitlements SET status = 'expired', updated_at = now() WHERE status = 'active' AND expires_at < now() RETURNING id"),
    );
    const n = expired.status === "done" ? expired.result.rowCount : 0;
    return { summary: `${delivered} entregados, ${failed} bloqueados o fallidos, ${n} accesos vencidos.`, data: { delivered, failed, expired: n } };
  },
};
