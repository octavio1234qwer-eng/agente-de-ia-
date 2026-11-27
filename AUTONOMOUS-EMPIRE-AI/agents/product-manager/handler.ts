import type { AgentHandlers } from "../../core/agent-registry/types";
import { PILOT_PRICE_CENTS } from "../../businesses/cotizafacil-mx/scoring";

/**
 * Compuerta de validación (CotizaFácil MX). Criterios en businesses/cotizafacil-mx/VALIDATION.md:
 *  G1 ≥ 30 leads reales con consentimiento
 *  G2 ≥ 40 % declara pagar ≥ precio piloto
 *  G3 ≥ 5 pagos reales verificados (preventa o piloto)
 */
export const handlers: AgentHandlers = {
  async validation_gate(ctx, input) {
    await ctx.require("analysis.run");
    const unit = String(input.businessUnitId ?? "cotizafacil-mx");
    const price = Number(input.priceCents ?? PILOT_PRICE_CENTS);
    const l = await ctx.db.query<{ total: string; wtp: string; answered: string }>(
      `select count(*) total, count(*) filter (where willingness_to_pay_cents >= $2) wtp,
              count(*) filter (where willingness_to_pay_cents is not null) answered
       from leads where business_unit_id=$1`, [unit, price]);
    const p = await ctx.db.query<{ n: string }>(
      "select count(*) n from ledger_entries where business_unit_id=$1 and kind='income' and nature='real' and verified", [unit]);
    const total = Number(l.rows[0]?.total ?? 0), wtp = Number(l.rows[0]?.wtp ?? 0), answered = Number(l.rows[0]?.answered ?? 0);
    const payments = Number(p.rows[0]?.n ?? 0);
    const gates = {
      G1_leads: { target: 30, value: total, pass: total >= 30 },
      G2_willingness: { target: 0.4, value: answered ? wtp / answered : 0, pass: answered >= 10 && wtp / answered >= 0.4 },
      G3_payments: { target: 5, value: payments, pass: payments >= 5 },
    };
    const verdict = gates.G3_payments.pass && gates.G1_leads.pass ? "BUILD" : gates.G1_leads.pass && gates.G2_willingness.pass ? "PRESELL" : "KEEP_VALIDATING";
    return { unit, priceCents: price, gates, verdict };
  },
};
