import { audit } from "./audit.ts";
import type { Db, Queryable } from "./db/types.ts";

export interface KillSwitch {
  active: boolean;
  reason: string | null;
  at: string | null;
  by: string | null;
}

export async function getSetting<T>(q: Queryable, key: string, fallback: T): Promise<T> {
  const { rows } = await q.query<{ value: T }>("SELECT value FROM system_settings WHERE key = $1", [key]);
  return rows[0]?.value ?? fallback;
}

export async function setSetting(q: Queryable, key: string, value: unknown, by: string): Promise<void> {
  await q.query(
    `INSERT INTO system_settings (key, value, updated_at, updated_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [key, JSON.stringify(value), by],
  );
}

export function getKillSwitch(q: Queryable): Promise<KillSwitch> {
  return getSetting<KillSwitch>(q, "kill_switch", { active: false, reason: null, at: null, by: null });
}

/**
 * Interruptor general: detiene agentes, automatizaciones y nuevos cobros.
 * Los webhooks siguen registrando pagos (no se pierde dinero), pero la entrega
 * de pagos verificados también continúa porque el cliente ya pagó.
 */
export async function setKillSwitch(db: Db, active: boolean, reason: string, actor: { type: "user" | "agent"; id: string }): Promise<void> {
  await db.tx(async (q) => {
    await setSetting(q, "kill_switch", { active, reason, at: new Date().toISOString(), by: `${actor.type}:${actor.id}` }, `${actor.type}:${actor.id}`);
    await audit(q, {
      actorType: actor.type,
      actorId: actor.id,
      action: active ? "system.kill_switch.on" : "system.kill_switch.off",
      severity: active ? "critical" : "warning",
      metadata: { reason },
    });
  });
}
