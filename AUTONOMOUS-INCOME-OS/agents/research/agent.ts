import type { AgentDefinition } from "@/server/orchestrator/agent";
import { scoreOpportunity, type EvidenceItem } from "@/server/research/scoring";

export const researchAgent: AgentDefinition = {
  name: "research",
  title: "Investigación",
  mission: "Puntuar oportunidades solo con evidencia registrada (URL y fecha). Nunca inventa datos de mercado.",
  async run(ctx) {
    const { rows: opps } = await ctx.db.query<{ id: string; title: string }>(
      "SELECT id, title FROM opportunities WHERE status IN ('idea','researching','scored') ORDER BY updated_at LIMIT 50",
    );
    let scored = 0;
    let withoutEvidence = 0;
    for (const o of opps) {
      const { rows: ev } = await ctx.db.query<EvidenceItem>("SELECT kind, data, observed_on::text AS observed_on FROM evidence WHERE opportunity_id = $1", [o.id]);
      if (ev.length === 0) withoutEvidence++;
      const s = scoreOpportunity(ev, ctx.now);
      await ctx.perform("research.score", { summary: `Puntuar "${o.title}"` }, () =>
        ctx.db.query(
          `UPDATE opportunities SET demand_score = $2, competition_score = $3, difficulty_score = $4, margin_score = $5, total_score = $6,
             confidence = $7, scoring_notes = $8, scored_at = now(), updated_at = now(),
             status = CASE WHEN $6::numeric IS NULL THEN 'researching' ELSE 'scored' END WHERE id = $1`,
          [o.id, s.demand, s.competition, s.difficulty, s.margin, s.total, s.confidence, JSON.stringify(s.notes)],
        ),
      );
      if (s.total !== null) scored++;
    }
    return { summary: `${opps.length} oportunidades revisadas: ${scored} con puntuación completa, ${withoutEvidence} sin evidencia.`, data: { reviewed: opps.length, scored, withoutEvidence } };
  },
};
