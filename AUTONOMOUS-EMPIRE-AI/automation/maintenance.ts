/** Mantenimiento: retención de datos técnicos (no borra datos de negocio ni auditoría). */
import type { Db } from "../core/db";

export async function retention(db: Db) {
  const del = async (sql: string) => (await db.query<{ n: string }>(`with d as (${sql} returning 1) select count(*) n from d`)).rows[0]?.n ?? "0";
  return {
    rateLimits: Number(await del("delete from rate_limits where window_start < now() - interval '2 days'")),
    sessions: Number(await del("delete from sessions where expires_at < now()")),
    loginAttempts: Number(await del("delete from login_attempts where at < now() - interval '90 days'")),
    events: Number(await del("delete from events where created_at < now() - interval '180 days'")),
  };
}
