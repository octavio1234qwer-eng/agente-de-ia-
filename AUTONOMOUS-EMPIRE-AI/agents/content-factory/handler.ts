import type { AgentHandlers } from "../../core/agent-registry/types";
import { anthropicConfigured, generateText } from "../../infrastructure/integrations/anthropic";
import { findBannedClaims } from "../shared";

/** Temas educativos originales para el público de CotizaFácil MX (oficios y pequeños negocios). */
export const TOPICS = [
  { title: "5 datos que toda cotización debe tener", angle: "lista práctica: datos del negocio, del cliente, desglose, vigencia, condiciones de pago" },
  { title: "Cómo calcular el IVA en una cotización sin errores", angle: "ejemplo numérico con 16 %, precio antes y después de IVA" },
  { title: "Anticipo: cuánto pedir y cómo explicarlo al cliente", angle: "rangos comunes, cómo ponerlo por escrito, evitar malentendidos" },
  { title: "Por qué tu cotización por WhatsApp no se cierra", angle: "seguimiento, claridad del total, vigencia, tiempo de respuesta" },
  { title: "Cotizar materiales y mano de obra por separado", angle: "transparencia, márgenes, cambios de precio de materiales" },
  { title: "Vigencia de una cotización: por qué ponerla", angle: "variación de precios, urgencia honesta, protección del negocio" },
  { title: "Errores que hacen ver poco profesional una cotización", angle: "faltas de ortografía, totales sin desglose, sin datos de contacto" },
  { title: "Cómo dar seguimiento a una cotización sin ser insistente", angle: "tiempos y mensajes de ejemplo respetuosos" },
];
const CHANNELS = ["facebook", "instagram", "linkedin"] as const;

function templateBody(t: (typeof TOPICS)[number], channel: string) {
  const cta = "¿Cotizas para tu negocio? Estamos probando CotizaFácil MX con negocios reales: link en el perfil.";
  return `${t.title}\n\nIdea central: ${t.angle}.\n\n[BORRADOR — completar con un ejemplo real del negocio antes de aprobar]\n\n${cta}\n\n#pymes #México #${channel === "linkedin" ? "emprendimiento" : "negocios"}`;
}

export const handlers: AgentHandlers = {
  async draft_posts(ctx, input) {
    await ctx.require("draft.create");
    const max = Math.min(Number(input.max ?? 3), 7);
    const existing = await ctx.db.query<{ title: string; channel: string }>("select title, channel from content_items where business_unit_id='cotizafacil-mx'");
    const used = new Set(existing.rows.map((r) => `${r.channel}|${r.title}`));
    const created: string[] = [];
    outer: for (const t of TOPICS) for (const ch of CHANNELS) {
      if (created.length >= max) break outer;
      if (used.has(`${ch}|${t.title}`)) continue;
      let body = templateBody(t, ch);
      if (anthropicConfigured()) {
        try {
          body = await generateText(
            `Escribe una publicación para ${ch} sobre "${t.title}" (${t.angle}) dirigida a dueños de pequeños negocios y oficios en México. Español neutro mexicano, 120–180 palabras, un ejemplo concreto, sin promesas de ingresos ni superlativos. Termina invitando a conocer CotizaFácil MX (en prueba).`,
            "Eres redactor de contenido educativo y honesto para pymes mexicanas.");
        } catch { /* se queda la plantilla */ }
      }
      if (findBannedClaims(body).length) continue;
      await ctx.db.query(
        `insert into content_items(business_unit_id, channel, title, body, status, created_by) values ('cotizafacil-mx',$1,$2,$3,'draft',$4)`,
        [ch, t.title, body, `agent:${ctx.agentId}`]);
      created.push(`${ch}: ${t.title}`);
    }
    return { created, usedAi: anthropicConfigured() };
  },
};
