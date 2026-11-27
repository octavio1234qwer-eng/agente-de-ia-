import type { AgentDefinition } from "@/server/orchestrator/agent";
import { runNurture } from "@/server/leads";

export const salesAgent: AgentDefinition = {
  name: "sales",
  title: "Ventas",
  mission: "Dar seguimiento solo a prospectos que aceptaron recibir correos, con baja en un clic y máximo un correo por paso.",
  async run(ctx) {
    const r = await ctx.perform("email.send_followup", { summary: "Secuencia de bienvenida a prospectos con consentimiento" }, () => runNurture(ctx.db));
    if (r.status !== "done") return { summary: "Sin permiso para enviar seguimiento." };
    if (r.result.skipped === -1) return { summary: "Correo no configurado: no se envió nada (los prospectos esperan).", data: r.result };
    return { summary: `${r.result.sent} correos enviados, ${r.result.failed} fallidos.`, data: r.result };
  },
};
