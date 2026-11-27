import { q, n } from "@/lib/queries";
import { db } from "@/lib/server";
import { budgetStatus, pnlByUnit } from "@empire/finance/ledger";
import { Kpi, money, Badge, Table, Section, dt } from "@/components/ui";
import { BarChart, LineChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function Executive() {
  const d = await db();
  const since30 = new Date(Date.now() - 30 * 86400000);
  const [budget, pnl30, pnlAll] = await Promise.all([budgetStatus(d), pnlByUnit(d, since30), pnlByUnit(d)]);
  const [leads] = await q<{ total: string; last30: string; hot: string }>("select count(*) total, count(*) filter (where created_at > now() - interval '30 days') last30, count(*) filter (where score >= 60) hot from leads");
  const [views] = await q<{ n: string }>("select count(*) n from page_views where path='/cotizafacil' and at > now() - interval '30 days'");
  const [clicks] = await q<{ n: string }>("select count(*) n from affiliate_clicks where at > now() - interval '30 days'");
  const [alerts] = await q<{ n: string; crit: string }>("select count(*) n, count(*) filter (where severity='critical') crit from alerts where not resolved");
  const [pending] = await q<{ n: string }>("select count(*) n from approvals where status='pending'");
  const monthly = await q<{ m: string; currency: string; cents: string }>(
    `select to_char(date_trunc('month', occurred_at), 'YYYY-MM') m, currency, sum(amount_cents) cents from ledger_entries
     where kind in ('income','commission') and nature='real' and occurred_at > now() - interval '6 months' group by 1,2 order by 1`);
  const jobs = await q<{ job_name: string; period_key: string; status: string; finished_at: string | null; error: string | null }>(
    "select distinct on (job_name) job_name, period_key, status, finished_at, error from job_runs order by job_name, started_at desc");
  const content = await q<{ status: string; n: string }>("select status, count(*) n from content_items group by status");
  const [report] = await q<{ body_md: string; created_at: string; kind: string }>("select body_md, created_at, kind from reports where kind like 'executive-%' order by created_at desc limit 1");

  const income30 = pnl30.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.currency]: (acc[p.currency] ?? 0) + p.incomeCents + p.commissionCents }), {});
  const currencies = [...new Set(monthly.map((r) => r.currency))];
  const months = Array.from({ length: 6 }, (_, i) => { const t = new Date(); t.setUTCDate(1); t.setUTCMonth(t.getUTCMonth() - 5 + i); return t.toISOString().slice(0, 7); });
  const conv = n(views?.n) ? ((n(leads?.last30) / n(views?.n)) * 100).toFixed(1) + " %" : "sin datos";

  return (
    <>
      <h1>Dashboard ejecutivo</h1>
      <p className="muted">Solo datos reales de la base. Las estimaciones se muestran aparte y nunca se suman al dinero real.</p>
      <div className="grid kpis" style={{ margin: "1rem 0" }}>
        <Kpi label="Ingresos reales 30 d" value={Object.keys(income30).length ? Object.entries(income30).map(([c, v]) => money(v, c)).join(" · ") : money(0)} sub="Verificados contra la fuente" />
        <Kpi label="Presupuesto disponible" value={money(budget.remainingCents)} sub={`de ${money(budget.authorizedCents)} · gastado ${money(budget.spentCents)}`} />
        <Kpi label="Leads (30 d / total)" value={`${n(leads?.last30)} / ${n(leads?.total)}`} sub={`${n(leads?.hot)} calientes (score ≥ 60)`} />
        <Kpi label="Conversión CotizaFácil" value={conv} sub={`${n(views?.n)} visitas en 30 d`} />
        <Kpi label="Clics de afiliado 30 d" value={n(clicks?.n)} />
        <Kpi label="Alertas abiertas" value={n(alerts?.n)} sub={`${n(alerts?.crit)} críticas · ${n(pending?.n)} autorizaciones pendientes`} />
      </div>
      <div className="grid cols-2">
        <Section title="Ingresos por mes (real)">
          {currencies.length ? currencies.map((c) => (
            <div key={c}><div className="muted">{c}</div><LineChart format={(v) => money(v, c)} data={months.map((m) => ({ label: m.slice(5), value: n(monthly.find((r) => r.m === m && r.currency === c)?.cents) }))} /></div>
          )) : <div className="empty">Sin ingresos reales registrados todavía.</div>}
        </Section>
        <Section title="Ventas por unidad (histórico real)">
          {pnlAll.length ? pnlAll.map((p) => p.currency).filter((c, i, a) => a.indexOf(c) === i).map((c) => (
            <BarChart key={c} format={(v) => money(v, c)} data={pnlAll.filter((p) => p.currency === c).map((p) => ({ label: p.businessUnitId, value: p.incomeCents + p.commissionCents }))} />
          )) : <div className="empty">Sin ventas registradas.</div>}
        </Section>
        <Section title="Gastos por unidad">
          <BarChart color="var(--bad)" format={(v) => money(v)} data={pnlAll.filter((p) => p.currency === "MXN").map((p) => ({ label: p.businessUnitId, value: p.expenseCents }))} />
        </Section>
        <Section title="Rentabilidad por negocio (30 d)">
          <Table rows={pnl30} empty="Sin movimientos en 30 días." cols={[
            { h: "Unidad", c: (r) => r.businessUnitId }, { h: "Moneda", c: (r) => r.currency },
            { h: "Margen bruto", c: (r) => money(r.grossMarginCents, r.currency), num: true },
            { h: "Neto", c: (r) => money(r.netCents, r.currency), num: true },
            { h: "Estimado", c: (r) => <span className="muted">{money(r.estimatedIncomeCents, r.currency)}</span>, num: true },
          ]} />
        </Section>
        <Section title="Estado de las automatizaciones">
          <Table rows={jobs} empty="Ninguna rutina ha corrido todavía." cols={[
            { h: "Rutina", c: (r) => r.job_name }, { h: "Periodo", c: (r) => <span className="mono">{r.period_key}</span> },
            { h: "Estado", c: (r) => <Badge v={r.status} /> }, { h: "Fin", c: (r) => dt(r.finished_at) },
          ]} />
        </Section>
        <Section title="Rendimiento de contenido">
          <BarChart color="var(--accent-2)" data={["draft", "approved", "scheduled", "published", "rejected"].map((s) => ({ label: s, value: n(content.find((c) => c.status === s)?.n) }))} />
          <p className="muted" style={{ fontSize: ".8rem" }}>Interacciones por publicación: pendiente de conectar métricas del canal (Buffer/API oficial).</p>
        </Section>
      </div>
      <Section title={report ? `Último informe del EMPIRE CEO · ${dt(report.created_at)}` : "Informe del EMPIRE CEO"}>
        {report ? <div className="prose"><pre>{report.body_md}</pre></div> : <div className="empty">Aún no hay informe. Ejecuta <span className="mono">npm run routine -- daily.ceo-cycle</span> o espera la rutina diaria.</div>}
      </Section>
    </>
  );
}
