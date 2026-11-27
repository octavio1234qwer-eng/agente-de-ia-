import type { AgentDefinition } from "@/server/orchestrator/agent";
import { funnel } from "@/server/analytics";
import { businessIdBySlug } from "@/server/bootstrap";
import { notifyAdmin } from "@/server/notifications";

export const trafficAgent: AgentDefinition = {
  name: "traffic",
  title: "Tráfico",
  mission: "Medir visitas, fuentes y conversión con datos propios, y avisar de caídas o picos sospechosos (posible tráfico falso).",
  async run(ctx) {
    const businessId = await businessIdBySlug(ctx.db);
    const day = 86_400_000;
    const now = ctx.now.getTime();
    const last24 = await funnel(ctx.db, businessId, new Date(now - day), ctx.now);
    const last7 = await funnel(ctx.db, businessId, new Date(now - 7 * day), ctx.now);
    const alerts: string[] = [];
    const top = last24.topReferrers[0];
    if (top && last24.visitors >= 200 && top.visitors / last24.visitors > 0.8) {
      alerts.push(`El ${Math.round((top.visitors / last24.visitors) * 100)} % de las visitas de hoy viene de ${top.host}. Revisa si es tráfico real antes de sacar conclusiones.`);
    }
    if (last7.visitors === 0) alerts.push("Cero visitas en 7 días: el sitio no está recibiendo tráfico o la analítica no está instalada.");
    for (const a of alerts) {
      await ctx.perform("notify.admin", { summary: a }, () => notifyAdmin(ctx.db, { subject: "Tráfico", body: a, severity: "warning", dedupeKey: `traffic:${a.slice(0, 40)}:${ctx.now.toISOString().slice(0, 10)}` }));
    }
    const conv = last7.visitorToPaidBp === null ? "—" : `${(last7.visitorToPaidBp / 100).toFixed(2)} %`;
    return {
      summary: `7 días: ${last7.visitors} visitantes, ${last7.toolUsers} usaron la herramienta, ${last7.pdfs} PDFs, ${last7.paidOrders} compras (conversión ${conv}).`,
      data: { last24, last7, alerts },
    };
  },
};
