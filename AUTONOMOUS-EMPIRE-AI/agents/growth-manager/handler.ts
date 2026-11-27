import type { AgentHandlers } from "../../core/agent-registry/types";
import { saveReport } from "../shared";
import { periodKey } from "../../core/scheduler";

export const handlers: AgentHandlers = {
  async funnel_metrics(ctx, input) {
    await ctx.require("analysis.run");
    const days = Number(input.days ?? 30);
    const since = new Date(ctx.now.getTime() - days * 86400000).toISOString();
    const views = await ctx.db.query<{ path: string; n: string }>("select path, count(*) n from page_views where at >= $1 group by path order by n desc", [since]);
    const leads = await ctx.db.query<{ unit: string; source: string; n: string }>(
      "select business_unit_id unit, coalesce(utm->>'source', source) source, count(*) n from leads where created_at >= $1 group by 1,2 order by n desc", [since]);
    const won = await ctx.db.query<{ n: string }>("select count(*) n from leads where status='won' and updated_at >= $1", [since]);
    const clicks = await ctx.db.query<{ slug: string; title: string; n: string }>(
      "select l.slug, l.title, count(c.id) n from affiliate_links l left join affiliate_clicks c on c.link_id=l.id and c.at >= $1 group by l.slug, l.title order by n desc", [since]);
    const landingViews = Number(views.rows.find((v) => v.path === "/cotizafacil")?.n ?? 0);
    const cfLeads = leads.rows.filter((l) => l.unit === "cotizafacil-mx").reduce((s, l) => s + Number(l.n), 0);
    const conversion = landingViews ? cfLeads / landingViews : null;
    const idleLinks = clicks.rows.filter((c) => Number(c.n) === 0).map((c) => c.slug);
    await ctx.require("metrics.update");
    const body = `# Embudo (${days} días)\n\n- Visitas a /cotizafacil: ${landingViews}\n- Leads CotizaFácil: ${cfLeads}\n- Conversión visita→lead: ${conversion === null ? "sin datos" : `${(conversion * 100).toFixed(1)} %`}\n- Leads ganados (todas las unidades): ${won.rows[0]?.n ?? 0}\n- Enlaces de afiliado sin clics: ${idleLinks.length ? idleLinks.join(", ") : "ninguno"}\n`;
    await ctx.require("report.generate");
    await saveReport(ctx.db, { kind: "funnel", periodKey: periodKey("daily", ctx.now), agentId: ctx.agentId, bodyMd: body });
    return { views: views.rows, leads: leads.rows, conversion, clicks: clicks.rows, idleLinks };
  },
};
