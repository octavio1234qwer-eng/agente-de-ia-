import { errorFields } from '../lib/logger.js';
import { cleanupRateLimits } from './rateLimit.js';

const EFFECTIVE_PLAN_SQL = "CASE WHEN u.plan_expires_at IS NULL OR u.plan_expires_at > now() THEN u.plan_id ELSE 'free' END";

/**
 * Limpieza periódica. Es idempotente: si corre en varias instancias a la vez no pasa nada.
 * - Sesiones y tokens vencidos.
 * - Contadores de límite de peticiones viejos.
 * - Contenido de generaciones fuera del periodo de historial del plan (se conservan los metadatos para estadísticas).
 */
export async function runMaintenance(db, plans) {
  await db.query('DELETE FROM sessions WHERE expires_at < now()');
  await db.query("DELETE FROM auth_tokens WHERE expires_at < now() - interval '1 day'");
  await cleanupRateLimits(db);
  for (const plan of plans.list) {
    await db.query(
      `UPDATE generations g SET input = '{}'::jsonb, output = NULL, title = NULL, purged_at = now()
       FROM users u
       WHERE g.user_id = u.id AND g.purged_at IS NULL
         AND (${EFFECTIVE_PLAN_SQL}) = $1
         AND g.created_at < now() - ($2::int * interval '1 day')`,
      [plan.id, plan.historyDays],
    );
  }
}

export function startMaintenance(db, plans, logger, intervalMs = 60 * 60 * 1000) {
  const run = () => runMaintenance(db, plans).catch((error) => logger.error('falló el mantenimiento', errorFields(error)));
  const first = setTimeout(run, 30_000);
  const timer = setInterval(run, intervalMs);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
