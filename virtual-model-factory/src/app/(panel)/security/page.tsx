import type { Metadata } from "next";
import { Badge, Button, Card, EmptyState, PageHeader, formatDateTime } from "@/components/ui";
import { requireUser } from "@/server/auth/dal";
import { can } from "@/server/auth/permissions";
import { listActiveSessions } from "@/server/auth/service";
import { withServiceContext, withUserContext } from "@/server/db/context";
import { listAuditLog, listSecurityEvents } from "@/server/modules/audit/queries";
import { revokeSessionAction } from "./actions";

export const metadata: Metadata = { title: "Seguridad" };

export default async function SecurityPage() {
  const user = await requireUser();
  const sessions = await withServiceContext("panel", (db) => listActiveSessions(db, user.id));
  const isAdmin = can(user.role, "security.view_events");
  const { events, audit } = await withUserContext(user.id, "panel", async (db) => ({
    events: await listSecurityEvents(db),
    audit: isAdmin ? await listAuditLog(db) : [],
  }));

  return (
    <>
      <PageHeader title="Seguridad" description="Sesiones activas, eventos de seguridad y registro de auditoría de operaciones." />
      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-semibold text-white">Tus sesiones activas</h2>
          <ul className="divide-y divide-white/5">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="truncate text-slate-200">{s.user_agent ?? "Agente desconocido"} {s.id === user.sessionId ? <Badge tone="green">Actual</Badge> : null}</p>
                  <p className="text-xs text-slate-500">IP {s.ip ?? "—"} · última actividad {formatDateTime(s.last_seen_at)} · expira {formatDateTime(s.expires_at)}</p>
                </div>
                {s.id !== user.sessionId ? (
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <Button variant="secondary" type="submit">Cerrar sesión</Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-white">{isAdmin ? "Eventos de seguridad" : "Tus eventos de seguridad"}</h2>
          {events.length === 0 ? <EmptyState title="Sin eventos" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2 pr-3">Fecha</th><th className="pr-3">Evento</th><th className="pr-3">Usuario</th><th>IP</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-400">{formatDateTime(e.created_at)}</td>
                      <td className="pr-3"><Badge tone={e.severity === "critical" ? "red" : e.severity === "warning" ? "amber" : "gray"}>{e.type}</Badge></td>
                      <td className="pr-3 text-slate-300">{e.user_email ?? "—"}</td>
                      <td className="text-slate-400">{e.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {isAdmin ? (
          <Card>
            <h2 className="mb-4 font-semibold text-white">Auditoría de operaciones</h2>
            {audit.length === 0 ? <EmptyState title="Sin operaciones registradas" /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2 pr-3">Fecha</th><th className="pr-3">Acción</th><th className="pr-3">Tabla</th><th className="pr-3">Actor</th><th>Campos</th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {audit.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-400">{formatDateTime(a.occurred_at)}</td>
                        <td className="pr-3"><Badge tone={a.action === "DELETE" ? "red" : a.action === "INSERT" ? "green" : "blue"}>{a.action}</Badge></td>
                        <td className="pr-3 text-slate-300">{a.table_name}</td>
                        <td className="pr-3 text-slate-300">{a.user_email ?? a.actor_source}</td>
                        <td className="max-w-[16rem] truncate text-xs text-slate-500">{a.fields.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}
