import type { Queryable } from "../core/db";
import { toInt } from "../core/db";

export interface BudgetStatus {
  currency: "MXN";
  authorizedCents: number;
  spentCents: number;
  committedCents: number; // aprobado pero aún no ejecutado
  remainingCents: number;
}

export async function budgetStatus(q: Queryable): Promise<BudgetStatus> {
  const b = await q.query<{ total: string }>("select coalesce(sum(amount_cents),0) total from budgets where currency='MXN'");
  const s = await q.query<{ total: string }>(
    "select coalesce(sum(amount_cents),0) total from ledger_entries where kind='expense' and nature='real' and currency='MXN'",
  );
  const c = await q.query<{ total: string }>(
    "select coalesce(sum(amount_cents),0) total from approvals where action='money.spend' and status='approved'",
  );
  const authorizedCents = toInt(b.rows[0]?.total);
  const spentCents = toInt(s.rows[0]?.total);
  const committedCents = toInt(c.rows[0]?.total);
  return { currency: "MXN", authorizedCents, spentCents, committedCents, remainingCents: authorizedCents - spentCents - committedCents };
}

