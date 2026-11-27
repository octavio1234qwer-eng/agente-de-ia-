import { getDb } from "./index";
import type { Queryable } from "./types";

export type ActorSource = "panel" | "telegram" | "worker" | "cli" | "system";

/**
 * Ejecuta `fn` en una transacción con el rol `vmf_runtime`: todas las consultas
 * quedan sujetas a RLS según el usuario. Es la vía por defecto del panel.
 */
export async function withUserContext<T>(
  userId: string,
  source: ActorSource,
  fn: (tx: Queryable) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.query("select set_config('vmf.user_id', $1, true), set_config('vmf.actor', $2, true)", [userId, source]);
    await tx.query("set local role vmf_runtime");
    return fn(tx);
  });
}

/**
 * Contexto de servicio (propietario de las tablas, sin RLS). Solo para
 * autenticación, worker y tareas del sistema. `userId` se registra en auditoría.
 */
export async function withServiceContext<T>(
  source: ActorSource,
  fn: (tx: Queryable) => Promise<T>,
  userId?: string,
): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.query("select set_config('vmf.user_id', $1, true), set_config('vmf.actor', $2, true)", [userId ?? "", source]);
    return fn(tx);
  });
}
