import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, Stat, formatDateTime, formatMoney } from "@/components/ui";
import { asCurrentUser } from "@/server/auth/dal";
import { getDashboardData } from "@/server/modules/dashboard/queries";
import { listModels } from "@/server/modules/models/repository";
import { automationAllowed, getSystemState } from "@/server/modules/system/settings";
import { getIntegrationStatus } from "@/server/modules/system/integrations";
import { ModelAvatar, StatusBadge } from "./model-ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const { data, models, system } = await asCurrentUser(async (db) => ({
    data: await getDashboardData(db),
    models: await listModels(db),
    system: await getSystemState(db),
  }));
  const automation = automationAllowed(system);
  const integrations = getIntegrationStatus();
  const profit = data.finance.netCents - data.finance.expensesCents;

  return (
    <>
      <PageHeader
        title="Estado de la fábrica"
        description="Datos reales de la base de datos. Sin datos de plataformas conectadas, las métricas se muestran en cero."
        actions={<ButtonLink href="/models/new">Nuevo modelo</ButtonLink>}
      />
      {params.denied ? <div className="mb-4"><Notice tone="warning">No tienes permiso para esa acción. El intento quedó registrado.</Notice></div> : null}

      <Card className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className={`size-3 rounded-full ${automation.allowed ? "bg-emerald-400 shadow-[0_0_12px] shadow-emerald-400" : "bg-rose-400 shadow-[0_0_12px] shadow-rose-400"}`} />
          <div>
            <p className="font-medium text-white">{automation.allowed ? "Operativa" : "Automatizaciones detenidas"}</p>
            <p className="text-sm text-slate-400">{automation.allowed ? "Sin parada de emergencia ni pausa activa." : automation.reason}</p>
          </div>
        </div>
        <ButtonLink href="/settings" variant="secondary">Controles</ButtonLink>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Modelos activos" value={data.models.active} hint={`${data.models.total} en total · ${data.models.demo} demo`} />
        <Stat label="Aprobaciones pendientes" value={data.pendingApprovals} />
        <Stat label="Trabajos en cola" value={data.jobs.queued + data.jobs.running} hint={`${data.jobs.failed} fallidos`} tone={data.jobs.failed ? "alert" : "default"} />
        <Stat label="Errores (24 h)" value={data.errors24h} tone={data.errors24h ? "alert" : "ok"} />
        <Stat label="Ingresos brutos (mes)" value={formatMoney(data.finance.grossCents)} hint={`${data.finance.transactions} transacciones`} />
        <Stat label="Comisiones (mes)" value={formatMoney(data.finance.feeCents)} />
        <Stat label="Gastos (mes)" value={formatMoney(data.finance.expensesCents)} />
        <Stat label="Beneficio neto (mes)" value={formatMoney(profit)} tone={profit < 0 ? "alert" : "default"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Modelos</h2>
            <Link href="/models" className="text-sm text-violet-300 hover:text-violet-200">Ver todos</Link>
          </div>
          {models.length === 0 ? (
            <EmptyState title="Aún no hay modelos">Crea uno o carga los modelos de demostración en Configuración.</EmptyState>
          ) : (
            <ul className="divide-y divide-white/5">
              {models.slice(0, 6).map((m) => (
                <li key={m.id}>
                  <Link href={`/models/${m.id}`} className="flex items-center gap-3 py-3 hover:opacity-90">
                    <ModelAvatar name={m.stageName} primary={m.primaryColor} secondary={m.secondaryColor} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{m.stageName}</p>
                      <p className="truncate text-xs text-slate-400">{m.aesthetic || m.slug}</p>
                    </div>
                    {m.isDemo ? <Badge tone="violet">DEMO</Badge> : null}
                    <StatusBadge status={m.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold text-white">Integraciones</h2>
            <ul className="space-y-2 text-sm">
              {integrations.map((i) => (
                <li key={i.name} className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">{i.name}</span>
                  <Badge tone={i.state === "configured" ? "green" : i.state === "blocked" ? "red" : "gray"}>{i.label}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Cuentas sociales conectadas: {data.socialAccounts.connected} de {data.socialAccounts.total}.</p>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-white">Errores recientes</h2>
            {data.recentErrors.length === 0 ? (
              <p className="text-sm text-slate-400">Sin errores registrados.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.recentErrors.map((e) => (
                  <li key={e.id}>
                    <p className="text-rose-200">{e.message}</p>
                    <p className="text-xs text-slate-500">{e.agent} · {formatDateTime(e.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
