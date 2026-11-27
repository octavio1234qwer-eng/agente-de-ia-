import { q } from "@/lib/queries";
import { db, requireUser } from "@/lib/server";
import { verifyAuditChain } from "@empire/core/audit-log";
import { ACTIONS } from "@empire/core/permissions";
import { Badge, Section, Table, dt } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Security() {
  await requireUser();
  const chain = await verifyAuditChain(await db());
  const log = await q<{ id: string; at: string; actor: string; action: string; level: string; target: string | null; result: string; hash: string }>(
    "select id, at, actor, action, level, target, result, hash from audit_log order by id desc limit 200");
  const users = await q<{ email: string; role: string; disabled: boolean; created_at: string }>("select email, role, disabled, created_at from users order by created_at");
  const [fails] = await q<{ n: string }>("select count(*) n from login_attempts where not success and at > now() - interval '24 hours'");
  const levels = Object.entries(ACTIONS).reduce<Record<string, string[]>>((a, [k, v]) => ({ ...a, [v]: [...(a[v] ?? []), k] }), {});
  return (<><h1>Seguridad</h1>
    <div className="grid kpis" style={{ marginBottom: "1rem" }}>
      <div className="card kpi"><div className="label">Cadena de auditoría</div><div className="value">{chain.ok ? <Badge v="ok" /> : <Badge v="critical" />}</div><div className="sub">{chain.ok ? `${chain.checked} registros íntegros` : `Rota en #${chain.brokenAt}`}</div></div>
      <div className="card kpi"><div className="label">Logins fallidos 24 h</div><div className="value">{Number(fails?.n ?? 0)}</div></div>
      <div className="card kpi"><div className="label">Usuarios</div><div className="value">{users.length}</div></div>
    </div>
    <Section title="Política de autonomía">
      {(["green", "yellow", "red", "prohibited"] as const).map((l) => <p key={l}><Badge v={l === "green" ? "ok" : l === "yellow" ? "pending" : "critical"} /> <strong>{l}</strong>: <span className="mono">{(levels[l] ?? []).join(", ")}</span></p>)}
    </Section>
    <Section title="Usuarios y roles">
      <Table rows={users} cols={[{ h: "Correo", c: (r) => r.email }, { h: "Rol", c: (r) => r.role }, { h: "Activo", c: (r) => <Badge v={r.disabled ? "blocked" : "ok"} /> }, { h: "Alta", c: (r) => dt(r.created_at) }]} />
    </Section>
    <Section title="Registro de auditoría (últimos 200)">
      <Table rows={log} cols={[
        { h: "#", c: (r) => r.id, num: true }, { h: "Fecha", c: (r) => dt(r.at) }, { h: "Actor", c: (r) => <span className="mono">{r.actor}</span> },
        { h: "Acción", c: (r) => <span className="mono">{r.action}</span> }, { h: "Nivel", c: (r) => <Badge v={r.level === "blocked" ? "blocked" : r.level === "red" ? "critical" : r.level === "yellow" ? "pending" : "ok"} /> },
        { h: "Resultado", c: (r) => r.result }, { h: "Hash", c: (r) => <span className="mono muted">{r.hash.slice(0, 12)}…</span> },
      ]} />
    </Section></>);
}
