import type { Queryable } from "../../db/types";
import { recordSecurityEvent } from "../../security/events";

export type SwitchState = { active: boolean; reason: string | null; changed_at: string | null; changed_by?: string | null };
export type SystemState = { emergencyStop: SwitchState; operationsPaused: SwitchState };

const OFF: SwitchState = { active: false, reason: null, changed_at: null };

export async function getSystemState(db: Queryable): Promise<SystemState> {
  const rows = await db.query<{ key: string; value: SwitchState }>(
    "select key, value from vmf.system_settings where key in ('emergency_stop', 'operations_paused')",
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return { emergencyStop: map.get("emergency_stop") ?? OFF, operationsPaused: map.get("operations_paused") ?? OFF };
}

/** ¿Pueden ejecutarse automatizaciones? Lo consulta el worker antes de cada trabajo. */
export function automationAllowed(state: SystemState): { allowed: boolean; reason?: string } {
  if (state.emergencyStop.active) return { allowed: false, reason: `Parada de emergencia: ${state.emergencyStop.reason ?? "sin motivo"}` };
  if (state.operationsPaused.active) return { allowed: false, reason: `Operaciones en pausa: ${state.operationsPaused.reason ?? "sin motivo"}` };
  return { allowed: true };
}

/**
 * Activa o desactiva un interruptor. Con contexto de usuario, RLS exige admin+.
 * El llamador registra el evento de seguridad (contexto de servicio) después:
 * no se anidan transacciones (PGlite usa una sola conexión).
 */
export async function setSwitch(
  db: Queryable,
  key: "emergency_stop" | "operations_paused",
  active: boolean,
  reason: string | null,
  userId: string,
): Promise<boolean> {
  const value: SwitchState = { active, reason: active ? reason : null, changed_at: new Date().toISOString(), changed_by: userId };
  const rows = await db.query("update vmf.system_settings set value = $2, updated_by = $3 where key = $1 returning key", [
    key,
    JSON.stringify(value),
    userId,
  ]);
  return rows.length > 0;
}

export async function recordSwitchEvent(serviceDb: Queryable, key: string, active: boolean, reason: string | null, userId: string) {
  await recordSecurityEvent(serviceDb, {
    type: `${key}_${active ? "on" : "off"}`,
    severity: key === "emergency_stop" ? "critical" : "warning",
    userId,
    details: { reason },
  });
}
