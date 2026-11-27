import limits from "@root/security/spending-limits/limits.json";
import type { Queryable } from "../db/types.ts";

export type SpendCategory = keyof typeof limits.categories;

export interface SpendCheck {
  allowed: boolean;
  reason: string;
  spentThisMonthCents: number;
  limitCents: number;
}

function monthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Verifica si un gasto cabe en el presupuesto autorizado. Cuenta gastos aprobados o
 * pagados del mes y el costo de IA registrado en agent_runs. Con límite 0, cualquier
 * costo mayor que 0 se bloquea.
 */
export async function checkSpend(q: Queryable, category: SpendCategory, amountCents: number): Promise<SpendCheck> {
  const since = monthStart();
  const exp = await q.query<{ total: number }>(
    "SELECT COALESCE(sum(amount_cents),0)::bigint AS total FROM expenses WHERE status IN ('approved','paid') AND created_at >= $1",
    [since],
  );
  const llm = await q.query<{ total: number }>(
    "SELECT COALESCE(sum(cost_cents),0)::bigint AS total FROM agent_runs WHERE started_at >= $1",
    [since],
  );
  const spent = Number(exp.rows[0]?.total ?? 0) + Number(llm.rows[0]?.total ?? 0);
  const categoryLimit = limits.categories[category] ?? 0;
  const limit = Math.min(limits.monthly_total_cents, categoryLimit);
  if (amountCents <= 0) return { allowed: true, reason: "Sin costo", spentThisMonthCents: spent, limitCents: limit };
  if (amountCents > limits.per_action_cents) {
    return { allowed: false, reason: `El costo supera el límite por acción (${limits.per_action_cents} centavos)`, spentThisMonthCents: spent, limitCents: limit };
  }
  if (spent + amountCents > limit) {
    return { allowed: false, reason: `Supera el presupuesto mensual de ${category}`, spentThisMonthCents: spent, limitCents: limit };
  }
  return { allowed: true, reason: "Dentro del presupuesto", spentThisMonthCents: spent, limitCents: limit };
}

export function spendingLimits() {
  return limits;
}
