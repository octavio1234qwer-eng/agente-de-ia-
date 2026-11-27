"use client";

import { useActionState } from "react";
import { Button, Notice, inputClass } from "@/components/ui";
import { loadDemoAction, toggleSwitchAction, type SettingsState } from "./actions";

export function SwitchForm({ switchKey, active, label, danger }: { switchKey: "emergency_stop" | "operations_paused"; active: boolean; label: string; danger?: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(toggleSwitchAction, {});
  return (
    <form action={action} className="space-y-3">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="success">{state.ok}</Notice> : null}
      <input type="hidden" name="key" value={switchKey} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      {!active ? (
        <input name="reason" required maxLength={300} placeholder="Motivo (obligatorio)" aria-label={`Motivo para ${label}`} className={inputClass} />
      ) : null}
      <Button type="submit" disabled={pending} variant={active ? "secondary" : danger ? "danger" : "primary"}>
        {active ? `Desactivar ${label.toLowerCase()}` : `Activar ${label.toLowerCase()}`}
      </Button>
    </form>
  );
}

export function DemoForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(loadDemoAction, {});
  return (
    <form action={action} className="space-y-3">
      {state.ok ? <Notice tone="success">{state.ok}</Notice> : null}
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Cargando…" : "Cargar modelos de demostración"}</Button>
    </form>
  );
}
