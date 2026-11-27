import { q } from "@/lib/queries";
import { ROUTINES } from "@empire/automation/routines";
import { Badge, Section, Table, dt } from "@/components/ui";
import { runRoutineNow } from "../actions";
export const dynamic = "force-dynamic";
export default async function Automations() {
  const runs = await q<{ job_name: string; period_key: string; status: string; attempts: number; started_at: string; finished_at: string | null; error: string | null }>(
    "select job_name, period_key, status, attempts, started_at, finished_at, error from job_runs order by started_at desc limit 100");
  return (<><h1>Automatizaciones</h1>
    <p className="muted">Disparadas por GitHub Actions (o Vercel Cron) contra <span className="mono">/api/cron/&lt;rutina&gt;</span> o con <span className="mono">npm run routine</span>. Cada rutina corre una sola vez por periodo, con reintentos, límite de tiempo y alerta si falla.</p>
    <Section title="Rutinas">
      <Table rows={Object.entries(ROUTINES)} cols={[
        { h: "Rutina", c: ([k]) => <span className="mono">{k}</span> }, { h: "Periodo", c: ([, r]) => r.kind }, { h: "Descripción", c: ([, r]) => r.description },
        { h: "", c: ([k]) => <div className="row">
          <form action={runRoutineNow}><input type="hidden" name="name" value={k} /><button className="btn ghost">Ejecutar</button></form>
          <form action={runRoutineNow}><input type="hidden" name="name" value={k} /><input type="hidden" name="force" value="1" /><button className="btn ghost" title="Re-ejecutar aunque ya haya corrido en este periodo">Forzar</button></form></div> },
      ]} />
    </Section>
    <Section title="Historial">
      <Table rows={runs} empty="Ninguna ejecución todavía." cols={[
        { h: "Rutina", c: (r) => r.job_name }, { h: "Periodo", c: (r) => <span className="mono">{r.period_key}</span> }, { h: "Estado", c: (r) => <Badge v={r.status} /> },
        { h: "Intentos", c: (r) => r.attempts, num: true }, { h: "Inicio", c: (r) => dt(r.started_at) }, { h: "Fin", c: (r) => dt(r.finished_at) }, { h: "Error", c: (r) => <span className="muted">{r.error ?? ""}</span> },
      ]} />
    </Section></>);
}
