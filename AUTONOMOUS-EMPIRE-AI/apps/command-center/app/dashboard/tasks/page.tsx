import { q } from "@/lib/queries";
import { Badge, Section, Table, dt } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Tasks() {
  const rows = await q<{ id: string; agent_id: string; type: string; status: string; error: string | null; created_at: string; finished_at: string | null }>(
    "select id, agent_id, type, status, error, created_at, finished_at from tasks order by created_at desc limit 200");
  return (<><h1>Tareas en ejecución e historial</h1>
    <Section title="Últimas 200 tareas">
      <Table rows={rows} empty="Ninguna tarea ejecutada todavía." cols={[
        { h: "Inicio", c: (r) => dt(r.created_at) }, { h: "Agente", c: (r) => r.agent_id }, { h: "Tarea", c: (r) => <span className="mono">{r.type}</span> },
        { h: "Estado", c: (r) => <Badge v={r.status} /> }, { h: "Fin", c: (r) => dt(r.finished_at) }, { h: "Error", c: (r) => <span className="muted">{r.error ?? ""}</span> },
      ]} />
    </Section></>);
}
