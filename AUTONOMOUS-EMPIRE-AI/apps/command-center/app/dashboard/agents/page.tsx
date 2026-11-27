import { AGENTS } from "@empire/core/agent-registry";
import { q } from "@/lib/queries";
import { Badge, Section, dt } from "@/components/ui";
import { runAgentNow } from "../actions";
export const dynamic = "force-dynamic";
export default async function Agents() {
  const st = await q<{ id: string; status: string; last_run_at: string | null }>("select id, status, last_run_at from agents");
  return (<>
    <h1>Agentes</h1>
    <div className="grid cols-2">
      {[...AGENTS.values()].map(({ def }) => {
        const s = st.find((x) => x.id === def.id);
        return (
          <Section key={def.id} title={def.name} actions={<Badge v={s?.status ?? "idle"} />}>
            <p className="muted">{def.mission}</p>
            <p style={{ fontSize: ".8rem" }} className="muted">Última ejecución: {dt(s?.last_run_at)}</p>
            <details><summary className="muted">Permisos y límites</summary>
              <p className="mono">{def.allowedActions.join(", ")}</p>
              <ul className="muted" style={{ fontSize: ".85rem" }}>{def.limits.map((l) => <li key={l}>{l}</li>)}</ul>
            </details>
            <div className="row" style={{ marginTop: ".6rem" }}>
              {def.tasks.filter((t) => !t.startsWith("add_")).map((t) => (
                <form key={t} action={runAgentNow} className="inline"><input type="hidden" name="agent" value={def.id} /><input type="hidden" name="task" value={t} /><button className="btn ghost">▶ {t}</button></form>
              ))}
            </div>
          </Section>
        );
      })}
    </div>
  </>);
}
