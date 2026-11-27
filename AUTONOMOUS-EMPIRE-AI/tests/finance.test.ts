import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Db } from "../core/db";
import { freshDb, owner } from "./helpers";
import { BudgetExceededError, budgetStatus, pnlByUnit, recordApprovedExpense, recordEstimate, recordVerifiedIncome, requestSpend } from "../finance/ledger";
import { decideApproval } from "../core/permissions";

let db: Db;
beforeEach(async () => { db = await freshDb(); });
afterEach(async () => { await db.close(); });

describe("finanzas", () => {
  it("la base rechaza un gasto real sin autorización", async () => {
    await expect(db.query(
      `insert into ledger_entries(occurred_at, kind, nature, amount_cents, business_unit_id, source, created_by)
       values (now(),'expense','real',100,'cotizafacil-mx','manual','x')`)).rejects.toThrow(/expense_needs_approval/);
  });
  it("la base rechaza ingreso real no verificado", async () => {
    await expect(db.query(
      `insert into ledger_entries(occurred_at, kind, nature, amount_cents, business_unit_id, source, created_by, verified)
       values (now(),'income','real',100,'cotizafacil-mx','manual','x',false)`)).rejects.toThrow(/real_income_verified/);
  });
  it("flujo de gasto: solicitud → aprobación → registro, dentro del presupuesto", async () => {
    const id = await requestSpend(db, { requestedBy: "agent:empire-ceo", businessUnitId: "cotizafacil-mx", amountCents: 20000, vendor: "dominio", reason: "dominio .mx" });
    await expect(recordApprovedExpense(db, owner, { approvalId: id })).rejects.toThrow(); // aún pendiente
    await db.transaction((tx) => decideApproval(tx, { approvalId: id, decidedBy: owner, approve: true }));
    expect((await budgetStatus(db)).committedCents).toBe(20000);
    await recordApprovedExpense(db, owner, { approvalId: id });
    const st = await budgetStatus(db);
    expect(st.spentCents).toBe(20000);
    expect(st.committedCents).toBe(0);
    expect(st.remainingCents).toBe(30000);
    await expect(recordApprovedExpense(db, owner, { approvalId: id })).rejects.toThrow(); // ya ejecutada
  });
  it("bloquea solicitudes y aprobaciones que superan el presupuesto", async () => {
    await expect(requestSpend(db, { requestedBy: "x", businessUnitId: "cotizafacil-mx", amountCents: 50001, vendor: "v", reason: "r" })).rejects.toBeInstanceOf(BudgetExceededError);
    const a = await requestSpend(db, { requestedBy: "x", businessUnitId: "cotizafacil-mx", amountCents: 40000, vendor: "v", reason: "r" });
    const b = await requestSpend(db, { requestedBy: "x", businessUnitId: "cotizafacil-mx", amountCents: 40000, vendor: "v", reason: "r" });
    await db.transaction((tx) => decideApproval(tx, { approvalId: a, decidedBy: owner, approve: true }));
    await expect(db.transaction((tx) => decideApproval(tx, { approvalId: b, decidedBy: owner, approve: true }))).rejects.toThrow(/presupuesto/);
  });
  it("ingresos idempotentes, comisiones de plataforma y separación real/estimado", async () => {
    const inc = { source: "mercadopago", externalId: "1", amountCents: 14900, currency: "MXN", businessUnitId: "cotizafacil-mx", occurredAt: new Date(), description: "piloto", actor: "t", feeCents: 600 };
    expect((await recordVerifiedIncome(db, inc)).inserted).toBe(true);
    expect((await recordVerifiedIncome(db, inc)).inserted).toBe(false);
    await recordEstimate(db, { kind: "commission", source: "ml", externalId: "o1", amountCents: 5000, currency: "MXN", businessUnitId: "affiliate-engine", occurredAt: new Date(), description: "est", actor: "t" });
    const p = await pnlByUnit(db);
    const cf = p.find((x) => x.businessUnitId === "cotizafacil-mx")!;
    expect(cf.incomeCents).toBe(14900);
    expect(cf.feeCents).toBe(600);
    expect(cf.netCents).toBe(14300);
    const af = p.find((x) => x.businessUnitId === "affiliate-engine")!;
    expect(af.commissionCents).toBe(0);
    expect(af.estimatedIncomeCents).toBe(5000);
  });
});
