import type { Queryable } from "../db/types.ts";

/**
 * Libro de movimientos. Reglas (ver docs/FINANCIAL_RULES.md):
 * - Cada movimiento tiene dedupe_key única: procesar el mismo pago dos veces no duplica nada.
 * - "collected" = cobrado por Mercado Pago; "settled" = liberado a la cuenta; "reserved" = reserva estimada.
 * - live_mode=false (pagos de prueba) nunca cuenta como ingreso real.
 */
export interface LedgerEntry {
  businessId: string | null;
  kind: "sale" | "subscription_charge" | "provider_fee" | "refund" | "chargeback" | "expense" | "tax_reserve" | "adjustment";
  direction: "in" | "out";
  amountCents: number;
  currency: string;
  state: "collected" | "settled" | "pending" | "reserved" | "void";
  orderId?: string | null;
  paymentId?: string | null;
  expenseId?: string | null;
  liveMode: boolean;
  description: string;
  occurredAt: string | Date;
  dedupeKey: string;
}

/** Inserta un movimiento si no existe. Devuelve true si lo insertó. */
export async function recordEntry(q: Queryable, e: LedgerEntry): Promise<boolean> {
  if (e.amountCents <= 0) return false;
  const r = await q.query(
    `INSERT INTO transactions (business_id, kind, direction, amount_cents, currency, state, order_id, payment_id, expense_id,
                               live_mode, description, occurred_at, dedupe_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (dedupe_key) DO NOTHING`,
    [e.businessId, e.kind, e.direction, e.amountCents, e.currency, e.state, e.orderId ?? null, e.paymentId ?? null,
     e.expenseId ?? null, e.liveMode, e.description.slice(0, 300), new Date(e.occurredAt).toISOString(), e.dedupeKey],
  );
  return r.rowCount > 0;
}

export interface FinanceSummary {
  currency: "MXN";
  from: string;
  to: string;
  grossCollectedCents: number;
  settledCents: number;
  pendingSettlementCents: number;
  feesCents: number;
  refundsCents: number;
  netCents: number;
  taxReserveCents: number;
  expensesCents: number;
  estimatedProfitCents: number;
  salesCount: number;
  testPaymentsCount: number;
}

/** Resumen de un periodo, solo movimientos reales (live_mode = true) en MXN. */
export async function financeSummary(q: Queryable, from: Date, to: Date): Promise<FinanceSummary> {
  const { rows } = await q.query<{ kind: string; state: string; total: number; n: number; live: boolean }>(
    `SELECT kind, state, live_mode AS live, COALESCE(sum(amount_cents),0)::bigint AS total, count(*)::int AS n
     FROM transactions WHERE occurred_at >= $1 AND occurred_at < $2 AND currency = 'MXN' AND state <> 'void'
     GROUP BY kind, state, live_mode`,
    [from.toISOString(), to.toISOString()],
  );
  const sum = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter((r) => r.live && pred(r)).reduce((s, r) => s + Number(r.total), 0);
  const isIncome = (k: string) => k === "sale" || k === "subscription_charge";
  const gross = sum((r) => isIncome(r.kind));
  const settled = sum((r) => isIncome(r.kind) && r.state === "settled");
  const fees = sum((r) => r.kind === "provider_fee");
  const refunds = sum((r) => r.kind === "refund" || r.kind === "chargeback");
  const tax = sum((r) => r.kind === "tax_reserve");
  const ledgerExpenses = sum((r) => r.kind === "expense");
  const exp = await q.query<{ total: number }>(
    `SELECT COALESCE(sum(amount_cents),0)::bigint AS total FROM expenses
     WHERE status IN ('approved','paid') AND currency = 'MXN' AND created_at >= $1 AND created_at < $2
       AND id NOT IN (SELECT expense_id FROM transactions WHERE expense_id IS NOT NULL)`,
    [from.toISOString(), to.toISOString()],
  );
  const expenses = ledgerExpenses + Number(exp.rows[0]?.total ?? 0);
  const net = gross - fees - refunds;
  return {
    currency: "MXN",
    from: from.toISOString(),
    to: to.toISOString(),
    grossCollectedCents: gross,
    settledCents: settled,
    pendingSettlementCents: gross - settled,
    feesCents: fees,
    refundsCents: refunds,
    netCents: net,
    taxReserveCents: tax,
    expensesCents: expenses,
    estimatedProfitCents: net - tax - expenses,
    salesCount: rows.filter((r) => r.live && isIncome(r.kind)).reduce((s, r) => s + r.n, 0),
    testPaymentsCount: rows.filter((r) => !r.live && isIncome(r.kind)).reduce((s, r) => s + r.n, 0),
  };
}

export function monthRange(now = new Date()): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}
