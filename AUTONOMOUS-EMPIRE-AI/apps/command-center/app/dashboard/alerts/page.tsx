import { q } from "@/lib/queries";
import { Badge, Section, Table, dt } from "@/components/ui";
import { resolveAlert } from "../actions";
export const dynamic = "force-dynamic";
export default async function Alerts() {
  const rows = await q<{ id: string; severity: string; source: string; message: string; resolved: boolean; created_at: string }>(
    "select * from alerts order by resolved, created_at desc limit 200");
  return (<><h1>Alertas</h1>
    <Section title="Alertas">
      <Table rows={rows} empty="Sin alertas." cols={[
        { h: "Fecha", c: (r) => dt(r.created_at) }, { h: "Severidad", c: (r) => <Badge v={r.severity} /> }, { h: "Origen", c: (r) => r.source },
        { h: "Mensaje", c: (r) => r.message }, { h: "", c: (r) => r.resolved ? <Badge v="ok" /> : <form action={resolveAlert}><input type="hidden" name="id" value={r.id} /><button className="btn ghost">Resolver</button></form> },
      ]} />
    </Section></>);
}
