import type { AgentDefinition } from "@/server/orchestrator/agent";
import { financeSummary } from "@/server/finance/ledger";
import { funnel } from "@/server/analytics";
import { businessIdBySlug } from "@/server/bootstrap";
import { notifyAdmin } from "@/server/notifications";
import { integrationStatus } from "@/server/env";

/**
 * Informe semanal con prioridades basadas en reglas explícitas (no en opiniones):
 * el cuello de botella es la primera etapa del embudo que no alcanza su mínimo.
 */
export function weeklyPriorities(f: { visitors: number; toolUsers: number; pricingViews: number; checkoutsStarted: number; paidOrders: number }, missingRequired: string[]): string[] {
  const p: string[] = [];
  if (missingRequired.length) p.push(`Configurar integraciones obligatorias: ${missingRequired.join(", ")}.`);
  if (f.visitors < 100) p.push("Tráfico: menos de 100 visitantes por semana. Prioridad: publicar guías SEO y compartir la herramienta en comunidades (con mensajes aprobados).");
  else if (f.toolUsers / Math.max(1, f.visitors) < 0.3) p.push("Activación: menos del 30 % de visitantes usa la herramienta. Revisar la portada y el botón principal.");
  else if (f.pricingViews === 0) p.push("Monetización: nadie ve la página de precios. Mostrar los beneficios Pro dentro de la herramienta.");
  else if (f.checkoutsStarted > 0 && f.paidOrders === 0) p.push("Pago: hay intentos de compra sin pagos. Revisar el checkout y probar con una tarjeta de prueba.");
  if (f.paidOrders > 0) p.push(`Validación: ${f.paidOrders} compras reales esta semana. Pedir opinión a cada comprador.`);
  if (!p.length) p.push("Mantener el plan y medir otra semana.");
  return p;
}

export const ceoAgent: AgentDefinition = {
  name: "ceo",
  title: "Dirección",
  mission: "Resumir la semana con datos reales y proponer prioridades. No ejecuta cambios de negocio: los propone para aprobación.",
  async run(ctx) {
    const businessId = await businessIdBySlug(ctx.db);
    const to = ctx.now;
    const from = new Date(to.getTime() - 7 * 86_400_000);
    const [fin, fun] = await Promise.all([financeSummary(ctx.db, from, to), funnel(ctx.db, businessId, from, to)]);
    const pending = (await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM approvals WHERE status = 'pending'")).rows[0]?.n ?? 0;
    const failedRuns = (await ctx.db.query<{ n: number }>("SELECT count(*)::int AS n FROM agent_runs WHERE status = 'failed' AND started_at > $1", [from.toISOString()])).rows[0]?.n ?? 0;
    const missing = integrationStatus().filter((i) => i.required && !i.configured).map((i) => i.name);
    const priorities = weeklyPriorities(fun, missing);
    const body = [
      `Ventas reales: ${fin.salesCount} · Cobrado: ${(fin.grossCollectedCents / 100).toFixed(2)} MXN · Neto: ${(fin.netCents / 100).toFixed(2)} MXN`,
      `Visitantes: ${fun.visitors} · Usaron la herramienta: ${fun.toolUsers} · PDFs: ${fun.pdfs} · Prospectos: ${fun.leads}`,
      `Aprobaciones pendientes: ${pending} · Ejecuciones fallidas: ${failedRuns}`,
      "",
      "Prioridades:",
      ...priorities.map((p, i) => `${i + 1}. ${p}`),
    ].join("\n");
    await ctx.perform("report.write", { summary: "Informe semanal" }, async () => undefined);
    await ctx.perform("notify.admin", { summary: "Enviar informe semanal" }, () =>
      notifyAdmin(ctx.db, { subject: "Informe semanal", body, severity: "warning", dedupeKey: `weekly:${to.toISOString().slice(0, 10)}` }),
    );
    return { summary: priorities[0]!, data: { finance: fin, funnel: fun, pending, failedRuns, priorities } };
  },
};
