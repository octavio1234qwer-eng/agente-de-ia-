import type { AgentHandlers } from "../../core/agent-registry/types";
import { scoreLead } from "../../businesses/cotizafacil-mx/scoring";

export const handlers: AgentHandlers = {
  async score_leads(ctx) {
    await ctx.require("lead.score");
    const r = await ctx.db.query<{ id: string; quotes_per_month: number | null; willingness_to_pay_cents: string | null; need: string; phone: string | null; company: string | null; trade: string | null }>(
      "select id, quotes_per_month, willingness_to_pay_cents, need, phone, company, trade from leads where status in ('new','contacted')");
    for (const l of r.rows) {
      const score = scoreLead({ quotesPerMonth: l.quotes_per_month, willingnessToPayCents: l.willingness_to_pay_cents == null ? null : Number(l.willingness_to_pay_cents), need: l.need, hasPhone: !!l.phone, hasCompany: !!l.company, trade: l.trade });
      await ctx.db.query("update leads set score=$2 where id=$1", [l.id, score]);
    }
    return { scored: r.rows.length };
  },
  /** Programa seguimiento a 24 h y deja un BORRADOR de correo (no se envía). */
  async plan_follow_ups(ctx) {
    await ctx.require("lead.manage");
    const r = await ctx.db.query<{ id: string; name: string; email: string; trade: string | null }>(
      `select l.id, l.name, l.email, l.trade from leads l
       where l.status='new' and l.consent_contact and l.next_follow_up_at is null`);
    await ctx.require("draft.create");
    for (const l of r.rows) {
      await ctx.db.query("update leads set next_follow_up_at = now() + interval '24 hours', updated_at=now() where id=$1", [l.id]);
      const first = l.name.split(" ")[0];
      await ctx.db.query(
        `insert into email_outbox(lead_id, to_email, subject, body, status, created_by) values ($1,$2,$3,$4,'draft',$5)`,
        [l.id, l.email, `${first}, gracias por tu interés en CotizaFácil MX`,
          `Hola ${first}:\n\nGracias por registrarte en CotizaFácil MX${l.trade ? ` para tu negocio de ${l.trade}` : ""}. Estamos preparando el piloto y queremos entender cómo cotizas hoy.\n\n¿Podrías responder este correo con un ejemplo (sin datos de tus clientes) de una cotización reciente y cuánto tiempo te tomó?\n\nNo te enviaremos publicidad sin tu permiso. Si no quieres más mensajes, responde "BAJA".\n\nEquipo CotizaFácil MX`,
          `agent:${ctx.agentId}`]);
      await ctx.db.query("insert into lead_activities(lead_id, type, detail, actor) values ($1,'follow_up_planned','Borrador de correo creado; seguimiento en 24 h',$2)", [l.id, `agent:${ctx.agentId}`]);
    }
    return { planned: r.rows.length };
  },
};
