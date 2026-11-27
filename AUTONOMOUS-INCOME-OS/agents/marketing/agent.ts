import calendar from "@root/businesses/cotizafacil-mx/content/calendar.json";
import type { AgentDefinition } from "@/server/orchestrator/agent";
import { businessIdBySlug } from "@/server/bootstrap";

interface CalendarItem {
  key: string;
  publish_on: string;
  kind: "article" | "social_post" | "video_script" | "email";
  channel: string;
  title: string;
  body: string;
}

export const marketingAgent: AgentDefinition = {
  name: "marketing",
  title: "Marketing",
  mission: "Preparar los borradores del calendario editorial con anticipación. Publicar siempre requiere aprobación humana.",
  async run(ctx) {
    const businessId = await businessIdBySlug(ctx.db);
    const horizon = new Date(ctx.now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
    const due = (calendar.items as CalendarItem[]).filter((i) => i.publish_on <= horizon);
    let created = 0;
    for (const item of due) {
      const r = await ctx.perform("content.create_draft", { summary: `Borrador: ${item.title}` }, () =>
        ctx.db.query<{ id: string }>(
          `INSERT INTO content (business_id, kind, channel, title, body, status, scheduled_for, created_by, dedupe_key)
           VALUES ($1,$2,$3,$4,$5,'draft',$6,'agent:marketing',$7) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
          [businessId, item.kind, item.channel, item.title, item.body, `${item.publish_on}T15:00:00Z`, `calendar:${item.key}`],
        ),
      );
      if (r.status !== "done" || !r.result.rows[0]) continue;
      created++;
      await ctx.perform("content.publish", {
        summary: `Publicar en ${item.channel} el ${item.publish_on}`,
        approval: { title: `Publicar: ${item.title}`, payload: { contentId: r.result.rows[0].id }, risk: "low", dedupeKey: `content:${item.key}` },
      });
    }
    return { summary: `${created} borradores nuevos; ${due.length} piezas del calendario dentro de los próximos 7 días.`, data: { created, due: due.length } };
  },
};
