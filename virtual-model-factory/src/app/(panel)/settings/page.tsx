import type { Metadata } from "next";
import { Badge, Card, PageHeader, formatDateTime } from "@/components/ui";
import { requireUser } from "@/server/auth/dal";
import { can } from "@/server/auth/permissions";
import { withUserContext } from "@/server/db/context";
import { getSystemState } from "@/server/modules/system/settings";
import { DemoForm, SwitchForm } from "./forms";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const user = await requireUser();
  const system = await withUserContext(user.id, "panel", (db) => getSystemState(db));
  const items = [
    { key: "emergency_stop" as const, label: "Parada de emergencia", state: system.emergencyStop, perm: "system.emergency_stop" as const, danger: true,
      text: "Detiene inmediatamente todas las automatizaciones, publicaciones y respuestas automáticas. El worker no ejecuta ningún trabajo mientras esté activa." },
    { key: "operations_paused" as const, label: "Pausa de operaciones", state: system.operationsPaused, perm: "system.pause" as const, danger: false,
      text: "Pausa las tareas programadas (equivale a /pause en Telegram). Úsala para mantenimiento o revisión." },
  ];
  return (
    <>
      <PageHeader title="Configuración" description="Controles de operación de la fábrica." />
      <div className="grid gap-6 lg:grid-cols-2">
        {items.map((i) => (
          <Card key={i.key} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-white">{i.label}</h2>
              <Badge tone={i.state.active ? "red" : "green"}>{i.state.active ? "Activa" : "Inactiva"}</Badge>
            </div>
            <p className="text-sm text-slate-400">{i.text}</p>
            {i.state.changed_at ? <p className="text-xs text-slate-500">Último cambio: {formatDateTime(i.state.changed_at)}{i.state.reason ? ` · ${i.state.reason}` : ""}</p> : null}
            {can(user.role, i.perm) ? <SwitchForm switchKey={i.key} active={i.state.active} label={i.label} danger={i.danger} /> : <p className="text-sm text-slate-500">Requiere rol de administrador.</p>}
          </Card>
        ))}
        {can(user.role, "demo.load") ? (
          <Card className="space-y-3 lg:col-span-2">
            <h2 className="font-semibold text-white">Datos de demostración</h2>
            <p className="text-sm text-slate-400">Crea tres personajes ficticios (Luna Vex, Aria Solenne, Dante Ríos) marcados como DEMO. Nunca publican en plataformas reales. La operación es idempotente.</p>
            <DemoForm />
          </Card>
        ) : null}
      </div>
    </>
  );
}
