import { q, n } from "@/lib/queries";
import { Badge, Section, Table, money } from "@/components/ui";
import { setUnitStatus } from "../actions";
export const dynamic = "force-dynamic";
export default async function Businesses() {
  const rows = await q<{ id: string; name: string; status: string; phase: number; description: string; leads: string; income: string; products: string }>(
    `select u.*, (select count(*) from leads l where l.business_unit_id=u.id) leads,
       (select coalesce(sum(amount_cents),0) from ledger_entries e where e.business_unit_id=u.id and e.nature='real' and e.kind in ('income','commission') and e.currency='MXN') income,
       (select count(*) from products p where p.business_unit_id=u.id) products
     from business_units u order by phase`);
  return (<>
    <h1>Estado de cada negocio</h1>
    <Section title="Unidades">
      <Table rows={rows} cols={[
        { h: "Unidad", c: (r) => <><strong>{r.name}</strong><div className="muted" style={{ fontSize: ".8rem" }}>{r.description}</div></> },
        { h: "Fase", c: (r) => r.phase, num: true }, { h: "Estado", c: (r) => <Badge v={r.status} /> },
        { h: "Leads", c: (r) => n(r.leads), num: true }, { h: "Productos", c: (r) => n(r.products), num: true },
        { h: "Ingresos MXN", c: (r) => money(r.income), num: true },
        { h: "Cambiar (propietario)", c: (r) => (
          <form action={setUnitStatus} className="row"><input type="hidden" name="id" value={r.id} />
            <select name="status" defaultValue={r.status} style={{ width: 130 }}>{["research", "validating", "active", "paused", "killed"].map((s) => <option key={s}>{s}</option>)}</select>
            <input name="rationale" placeholder="Justificación" style={{ width: 160 }} /><button className="btn ghost">Guardar</button></form>) },
      ]} />
    </Section>
  </>);
}
