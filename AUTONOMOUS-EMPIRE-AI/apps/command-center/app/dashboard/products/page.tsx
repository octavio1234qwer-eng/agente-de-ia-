import { q } from "@/lib/queries";
import { Badge, Section, Table, money } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Products() {
  const rows = await q<{ name: string; business_unit_id: string; kind: string; price_cents: string | null; currency: string; status: string; source: string | null; url: string | null }>(
    "select * from products order by business_unit_id, name");
  return (<><h1>Productos</h1>
    <Section title="Catálogo">
      <p className="muted" style={{ fontSize: ".85rem" }}>Los productos de Gumroad se sincronizan con la rutina <span className="mono">hourly.gumroad-sync</span> (solo lectura).</p>
      <Table rows={rows} empty="Sin productos sincronizados. Ejecuta la rutina de Gumroad desde Automatizaciones." cols={[
        { h: "Producto", c: (r) => (r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.name}</a> : r.name) },
        { h: "Unidad", c: (r) => r.business_unit_id }, { h: "Tipo", c: (r) => r.kind },
        { h: "Precio", c: (r) => (r.price_cents == null ? "—" : money(r.price_cents, r.currency)), num: true },
        { h: "Estado", c: (r) => <Badge v={r.status} /> }, { h: "Fuente", c: (r) => r.source ?? "—" },
      ]} />
    </Section></>);
}
