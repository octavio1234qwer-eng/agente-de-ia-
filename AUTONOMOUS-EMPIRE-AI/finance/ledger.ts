/**
 * Libro de ingresos y gastos. Reglas (ver FINANCIAL_RULES.md):
 *  - Montos en centavos enteros.
 *  - "real" = dinero verificado contra la fuente; "estimated" = proyección/pendiente.
 *  - Todo gasto real necesita una autorización ROJA aprobada y cabe en el presupuesto.
 *  - No hay reinversión ni contratación automática.
 */
import type { Db, Queryable } from "../core/db";
import { toInt } from "../core/db";
import { budgetStatus } from "./budget";
import { appendAudit } from "../core/audit-log";
import { authorize, markApprovalExecuted, requestApproval, type Actor } from "../core/permissions";

export const INITIAL_BUDGET_ID = "initial";
export { budgetStatus, type BudgetStatus } from "./budget";

export class BudgetExceededError extends Error {}
export class NotAuthorizedError extends Error {}

/** Paso 1: un agente o usuario solicita gastar. Nunca gasta; solo crea la autorización pendiente. */
export async function requestSpend(
  db: Db,
  input: { requestedBy: string; businessUnitId: string; amountCents: number; vendor: string; reason: string },
): Promise<string> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Monto inválido");
  return db.transaction(async (tx) => {
    const st = await budgetStatus(tx);
    if (input.amountCents > st.remainingCents)
      throw new BudgetExceededError(
        `Solicitud de ${fmt(input.amountCents)} supera el presupuesto disponible (${fmt(st.remainingCents)}).`,
      );
    return requestApproval(tx, {
      action: "money.spend",
      requestedBy: input.requestedBy,
      reason: input.reason,
      amountCents: input.amountCents,
      payload: { businessUnitId: input.businessUnitId, vendor: input.vendor },
    });
  });
}

/**
 * Paso 3 (después de que el propietario aprueba): registra el gasto real.
 * Revalida presupuesto y que la autorización corresponda exactamente.
 */
export async function recordApprovedExpense(
  db: Db,
  actor: Actor,
  input: { approvalId: string; occurredAt?: Date; externalId?: string; description?: string },
): Promise<string> {
  return db.transaction(async (tx) => {
    await tx.query("lock table ledger_entries in share row exclusive mode");
    const d = await authorize(tx, actor, "money.spend", { approvalId: input.approvalId });
    if (!d.allowed) throw new NotAuthorizedError(d.reason);
    const a = await tx.query<{ amount_cents: string; payload: { businessUnitId: string; vendor: string } }>(
      "select amount_cents, payload from approvals where id=$1",
      [input.approvalId],
    );
    const ap = a.rows[0]!;
    const amount = toInt(ap.amount_cents);
    // El monto aprobado ya está en "committed"; se libera al marcar ejecutada.
    const st = await budgetStatus(tx);
    if (st.spentCents + amount > st.authorizedCents)
      throw new BudgetExceededError("El gasto excede el presupuesto autorizado.");
    const r = await tx.query<{ id: string }>(
      `insert into ledger_entries(occurred_at, kind, nature, amount_cents, currency, business_unit_id, source, external_id,
         description, approval_id, verified, created_by)
       values ($1,'expense','real',$2,'MXN',$3,'manual',$4,$5,$6,true,$7) returning id`,
      [
        (input.occurredAt ?? new Date()).toISOString(), amount, ap.payload.businessUnitId, input.externalId ?? null,
        input.description ?? `Gasto autorizado: ${ap.payload.vendor}`, input.approvalId, actor.id,
      ],
    );
    await markApprovalExecuted(tx, input.approvalId, `ledger:${r.rows[0]!.id}`);
    await appendAudit(tx, {
      actor: actor.id, action: "ledger.expense", level: "red", target: r.rows[0]!.id, result: "recorded",
      detail: { amountCents: amount, approvalId: input.approvalId },
    });
    return r.rows[0]!.id;
  });
}

/** Ingreso verificado contra la fuente (webhook firmado + consulta a la API). Idempotente. */
export async function recordVerifiedIncome(
  q: Queryable,
  input: {
    source: string; externalId: string; amountCents: number; currency: string; businessUnitId: string;
    occurredAt: Date; description: string; actor: string; kind?: "income" | "commission";
    feeCents?: number;
  },
): Promise<{ inserted: boolean }> {
  const r = await q.query<{ id: string }>(
    `insert into ledger_entries(occurred_at, kind, nature, amount_cents, currency, business_unit_id, source, external_id,
       description, verified, created_by)
     values ($1,$2,'real',$3,$4,$5,$6,$7,$8,true,$9)
     on conflict (source, external_id) do nothing returning id`,
    [
      input.occurredAt.toISOString(), input.kind ?? "income", input.amountCents, input.currency, input.businessUnitId,
      input.source, input.externalId, input.description, input.actor,
    ],
  );
  if (!r.rows[0]) return { inserted: false };
  if (input.feeCents && input.feeCents > 0) {
    await q.query(
      `insert into ledger_entries(occurred_at, kind, nature, amount_cents, currency, business_unit_id, source, external_id,
         description, verified, created_by)
       values ($1,'fee','real',$2,$3,$4,$5,$6,$7,true,$8) on conflict do nothing`,
      [
        input.occurredAt.toISOString(), input.feeCents, input.currency, input.businessUnitId, input.source,
        `${input.externalId}:fee`, `Comisión de plataforma (${input.source})`, input.actor,
      ],
    );
  }
  await appendAudit(q, {
    actor: input.actor, action: "ledger.income", level: "green", target: r.rows[0].id, result: "recorded",
    detail: { source: input.source, externalId: input.externalId, amountCents: input.amountCents, currency: input.currency },
  });
  return { inserted: true };
}

/** Estimaciones (p. ej. comisiones de afiliado reportadas pero no pagadas). Nunca cuentan como dinero real. */
export async function recordEstimate(
  q: Queryable,
  input: { kind: "income" | "commission" | "expense"; source: string; externalId?: string; amountCents: number;
    currency: string; businessUnitId: string; occurredAt: Date; description: string; actor: string },
) {
  await q.query(
    `insert into ledger_entries(occurred_at, kind, nature, amount_cents, currency, business_unit_id, source, external_id,
       description, verified, created_by)
     values ($1,$2,'estimated',$3,$4,$5,$6,$7,$8,false,$9) on conflict (source, external_id) do nothing`,
    [input.occurredAt.toISOString(), input.kind, input.amountCents, input.currency, input.businessUnitId, input.source,
      input.externalId ?? null, input.description, input.actor],
  );
}

export interface UnitPnl {
  businessUnitId: string; currency: string; incomeCents: number; commissionCents: number; feeCents: number;
  expenseCents: number; grossMarginCents: number; netCents: number; estimatedIncomeCents: number;
}

/** Estado de resultados por unidad y moneda (solo dinero real; estimaciones aparte). */
export async function pnlByUnit(q: Queryable, from?: Date, to?: Date): Promise<UnitPnl[]> {
  const r = await q.query<Record<string, string>>(
    `select business_unit_id, currency,
       coalesce(sum(amount_cents) filter (where kind='income' and nature='real'),0) income,
       coalesce(sum(amount_cents) filter (where kind='commission' and nature='real'),0) commission,
       coalesce(sum(amount_cents) filter (where kind='fee' and nature='real'),0) fee,
       coalesce(sum(amount_cents) filter (where kind='expense' and nature='real'),0) expense,
       coalesce(sum(amount_cents) filter (where kind in ('income','commission') and nature='estimated'),0) est
     from ledger_entries
     where ($1::timestamptz is null or occurred_at >= $1) and ($2::timestamptz is null or occurred_at < $2)
     group by business_unit_id, currency order by business_unit_id`,
    [from?.toISOString() ?? null, to?.toISOString() ?? null],
  );
  return r.rows.map((x) => {
    const income = toInt(x.income), commission = toInt(x.commission), fee = toInt(x.fee), expense = toInt(x.expense);
    const gross = income + commission - fee;
    return {
      businessUnitId: x.business_unit_id!, currency: x.currency!, incomeCents: income, commissionCents: commission,
      feeCents: fee, expenseCents: expense, grossMarginCents: gross, netCents: gross - expense, estimatedIncomeCents: toInt(x.est),
    };
  });
}

export const fmt = (cents: number, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
