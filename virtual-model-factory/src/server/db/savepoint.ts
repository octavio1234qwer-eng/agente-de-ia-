import type { Queryable } from "./types";

/**
 * Ejecuta `fn` dentro de un SAVEPOINT: si falla, se deshace solo esa parte y la
 * transacción exterior sigue siendo válida (permite convertir errores de
 * restricciones en mensajes para el usuario).
 */
export async function withSavepoint<T>(db: Queryable, fn: () => Promise<T>): Promise<T> {
  await db.query("savepoint vmf_sp");
  try {
    const result = await fn();
    await db.query("release savepoint vmf_sp");
    return result;
  } catch (error) {
    await db.query("rollback to savepoint vmf_sp");
    throw error;
  }
}
