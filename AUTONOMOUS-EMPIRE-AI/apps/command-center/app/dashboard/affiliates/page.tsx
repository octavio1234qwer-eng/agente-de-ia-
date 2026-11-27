import { q, n } from "@/lib/queries";
import { Badge, Section, Table, dt } from "@/components/ui";
import { addAffiliateLink, importCommissions, reconcilePayouts } from "../actions";
export const dynamic = "force-dynamic";
export default async function Affiliates() {
  const rows = await q<{ slug: string; title: string; destination_url: string; status: string; last_http_status: number | null; last_checked_at: string | null; commission_rate_bps: number | null; clicks30: string; clicks: string }>(
    `select l.*, (select count(*) from affiliate_clicks c where c.link_id=l.id and c.at > now() - interval '30 days') clicks30,
       (select count(*) from affiliate_clicks c where c.link_id=l.id) clicks from affiliate_links l order by clicks30 desc`);
  return (<>
    <h1>Affiliate Engine</h1>
    <p className="muted">Genera tus enlaces en el panel oficial del Programa de Afiliados de Mercado Libre y regístralos aquí. Se publican como <span className="mono">/go/&lt;slug&gt;</span> para medir clics. Las comisiones se importan del reporte oficial y quedan como <em>estimadas</em> hasta conciliar el pago.</p>
    <Section title="Enlaces">
      <Table rows={rows} empty="Sin enlaces registrados." cols={[
        { h: "Enlace", c: (r) => <><a href={`/go/${r.slug}`} target="_blank" rel="noopener noreferrer">/go/{r.slug}</a><div className="muted" style={{ fontSize: ".8rem" }}>{r.title}</div></> },
        { h: "Estado", c: (r) => <Badge v={r.status} /> }, { h: "HTTP", c: (r) => r.last_http_status ?? "—" }, { h: "Revisado", c: (r) => dt(r.last_checked_at) },
        { h: "Comisión", c: (r) => (r.commission_rate_bps == null ? <span className="muted">no confirmada</span> : `${r.commission_rate_bps / 100} %`) },
        { h: "Clics 30 d", c: (r) => n(r.clicks30), num: true }, { h: "Clics total", c: (r) => n(r.clicks), num: true },
      ]} />
    </Section>
    <div className="grid cols-2">
      <Section title="Registrar enlace">
        <form action={addAffiliateLink}>
          <div className="field"><label>Slug</label><input name="slug" required pattern="[a-z0-9-]{3,64}" placeholder="taladro-inalambrico" /></div>
          <div className="field"><label>Título</label><input name="title" required /></div>
          <div className="field"><label>URL de afiliado (dominio de Mercado Libre)</label><input name="destinationUrl" type="url" required /></div>
          <div className="field"><label>Comisión confirmada en el panel (%) — vacío si no la conoces</label><input name="commissionRatePct" type="number" step="0.01" min="0" max="100" /></div>
          <button className="btn">Registrar</button>
        </form>
      </Section>
      <Section title="Importar reporte de comisiones (CSV)">
        <p className="muted" style={{ fontSize: ".85rem" }}>Columnas: <span className="mono">order_id,date,commission_mxn,status</span></p>
        <form action={importCommissions}><div className="field"><input type="file" name="csv" accept=".csv,text/csv" required /></div><button className="btn">Importar</button></form>
      </Section>
      <Section title="Conciliar depósito de comisiones (propietario)">
        <p className="muted" style={{ fontSize: ".85rem" }}>Columnas: <span className="mono">payout_id,date,amount_mxn,order_ids</span> (pedidos separados por |). Solo si el depósito cuadra (±$1) las comisiones pasan a dinero real.</p>
        <form action={reconcilePayouts}><div className="field"><input type="file" name="csv" accept=".csv,text/csv" required /></div><button className="btn">Conciliar</button></form>
      </Section>
    </div>
  </>);
}
