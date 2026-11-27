import { q } from "@/lib/queries";
import { db } from "@/lib/server";
import { budgetStatus, pnlByUnit } from "@empire/finance/ledger";
import { Badge, Kpi, Section, Table, dt, money } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Finance() {
  const d = await db();
  const [b, pnl] = await Promise.all([budgetStatus(d), pnlByUnit(d)]);
  const entries = await q<{ occurred_at: string; kind: string; nature: string; amount_cents: string; currency: string; business_unit_id: string; source: string; external_id: string | null; description: string; verified: boolean }>(
    "select * from ledger_entries order by occurred_at desc limit 300");
  const sales = entries.filter((e) => e.kind === "income" || e.kind === "commission");
  const expenses = entries.filter((e) => e.kind === "expense" || e.kind === "fee");
  const cols = [
    { h: "Fecha", c: (r: (typeof entries)[number]) => dt(r.occurred_at) }, { h: "Unidad", c: (r: (typeof entries)[number]) => r.business_unit_id },
    { h: "Tipo", c: (r: (typeof entries)[number]) => r.kind }, { h: "Naturaleza", c: (r: (typeof entries)[number]) => <Badge v={r.nature === "real" ? "ok" : "estimated"} /> },
    { h: "Descripción", c: (r: (typeof entries)[number]) => r.description }, { h: "Fuente", c: (r: (typeof entries)[number]) => <span className="mono">{r.source}{r.external_id ? ` #${r.external_id}` : ""}</span> },
    { h: "Monto", c: (r: (typeof entries)[number]) => money(r.amount_cents, r.currency), num: true },
  ];
  return (<>
    <h1>Ventas, ingresos, gastos y rentabilidad</h1>
    <div className="grid kpis" style={{ marginBottom: "1rem" }}>
      <Kpi label="Presupuesto autorizado" value={money(b.authorizedCents)} />
      <Kpi label="Gastado (real)" value={money(b.spentCents)} />
      <Kpi label="Comprometido" value={money(b.committedCents)} sub="Aprobado, sin ejecutar" />
      <Kpi label="Disponible" value={money(b.remainingCents)} sub="Gastos por encima se bloquean" />
    </div>
    <Section title="Ventas e ingresos">
      <Table rows={sales} empty="Sin ventas registradas. Solo se registran pagos verificados (Mercado Pago, Gumroad) y comisiones del reporte oficial." cols={cols} />
    </Section>
    <div id="gastos" />
    <Section title="Gastos y comisiones de plataforma">
      <Table rows={expenses} empty="Sin gastos. Todo gasto requiere autorización del propietario (Decisiones)." cols={cols} />
    </Section>
    <div id="rentabilidad" />
    <Section title="Rentabilidad por unidad (histórico)">
      <Table rows={pnl} empty="Sin movimientos." cols={[
        { h: "Unidad", c: (r) => r.businessUnitId }, { h: "Moneda", c: (r) => r.currency },
        { h: "Ingresos", c: (r) => money(r.incomeCents + r.commissionCents, r.currency), num: true },
        { h: "Comisiones plataforma", c: (r) => money(r.feeCents, r.currency), num: true },
        { h: "Margen bruto", c: (r) => money(r.grossMarginCents, r.currency), num: true },
        { h: "Gastos", c: (r) => money(r.expenseCents, r.currency), num: true },
        { h: "Beneficio neto", c: (r) => <strong style={{ color: r.netCents < 0 ? "var(--bad)" : undefined }}>{money(r.netCents, r.currency)}</strong>, num: true },
        { h: "Estimado (no real)", c: (r) => <span className="muted">{money(r.estimatedIncomeCents, r.currency)}</span>, num: true },
      ]} />
      <p className="muted" style={{ fontSize: ".8rem" }}>Las monedas no se convierten entre sí: no se usa un tipo de cambio inventado.</p>
    </Section>
  </>);
}
