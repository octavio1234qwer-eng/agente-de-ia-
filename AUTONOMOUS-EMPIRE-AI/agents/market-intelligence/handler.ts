import { z } from "zod";
import type { AgentHandlers } from "../../core/agent-registry/types";

/** Puntuación 0–100: demanda y dolor suman, competencia y costo restan, viabilidad multiplica. */
export function opportunityScore(o: { demand: number; pain: number; competition: number; feasibility: number; monthlyCostCents: number }) {
  const base = (o.demand * 0.35 + o.pain * 0.35 + (6 - o.competition) * 0.3) / 5; // 0..1
  const feas = o.feasibility / 5;
  const costPenalty = Math.min(0.3, o.monthlyCostCents / 50000 * 0.3); // $500 MXN/mes ⇒ −30 %
  return Math.round(base * feas * (1 - costPenalty) * 1000) / 10;
}

const Opp = z.object({
  businessUnitId: z.string(), title: z.string().min(3),
  demand: z.number().int().min(1).max(5), pain: z.number().int().min(1).max(5),
  competition: z.number().int().min(1).max(5), feasibility: z.number().int().min(1).max(5),
  monthlyCostCents: z.number().int().min(0).default(0),
  evidence: z.array(z.object({ source: z.string().url(), note: z.string() })).default([]),
});

export const handlers: AgentHandlers = {
  async add_opportunity(ctx, input) {
    await ctx.require("research.run");
    const o = Opp.parse(input);
    const score = opportunityScore(o);
    const r = await ctx.db.query<{ id: string }>(
      `insert into opportunities(business_unit_id, title, demand, pain, competition, feasibility, monthly_cost_cents, evidence, score, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [o.businessUnitId, o.title, o.demand, o.pain, o.competition, o.feasibility, o.monthlyCostCents, JSON.stringify(o.evidence), score, `agent:${ctx.agentId}`]);
    return { id: r.rows[0]!.id, score, hasEvidence: o.evidence.length > 0 };
  },
  async score_opportunities(ctx) {
    await ctx.require("analysis.run");
    const r = await ctx.db.query<{ id: string; title: string; demand: number; pain: number; competition: number; feasibility: number; monthly_cost_cents: string; evidence: unknown[]; status: string }>(
      "select * from opportunities where status <> 'rejected'");
    const ranked = [];
    for (const o of r.rows) {
      const score = opportunityScore({ demand: o.demand, pain: o.pain, competition: o.competition, feasibility: o.feasibility, monthlyCostCents: Number(o.monthly_cost_cents) });
      await ctx.db.query("update opportunities set score=$2 where id=$1", [o.id, score]);
      ranked.push({ id: o.id, title: o.title, score, evidence: (o.evidence ?? []).length, status: o.status });
    }
    ranked.sort((a, b) => b.score - a.score);
    return { ranked, withoutEvidence: ranked.filter((x) => x.evidence === 0).length };
  },
};
