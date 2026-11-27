import { createPgliteDatabase } from "@/server/db/pglite";
import { createPostgresDatabase } from "@/server/db/postgres";
import { migrate } from "@/server/db/migrate";
import type { Database, Queryable } from "@/server/db/types";
import { hashPassword } from "@/server/auth/password";
import type { Role } from "@/server/auth/permissions";

/**
 * Base de datos de prueba: PGlite en memoria por defecto. Con TEST_DATABASE_URL
 * (base desechable) las mismas pruebas corren contra PostgreSQL real.
 */
export async function createTestDb(): Promise<Database> {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const db = createPostgresDatabase({ connectionString: url, sslMode: "disable" });
    await db.exec("drop schema if exists vmf cascade; drop schema if exists vmf_meta cascade;");
    await migrate(db);
    return db;
  }
  const db = await createPgliteDatabase();
  await migrate(db);
  return db;
}

let passwordHash: string | undefined;
export async function insertUser(db: Queryable, email: string, role: Role): Promise<string> {
  passwordHash ??= await hashPassword("contraseña-de-prueba-segura");
  const [row] = await db.query<{ id: string }>(
    "insert into vmf.users (email, display_name, role, password_hash) values ($1, $2, $3, $4) returning id",
    [email, email.split("@")[0], role, passwordHash],
  );
  return row!.id;
}

/** Ejecuta como vmf_runtime con el usuario indicado (igual que withUserContext). */
export function asUser<T>(db: Database, userId: string, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('vmf.user_id', $1, true), set_config('vmf.actor', 'panel', true)", [userId]);
    await tx.query("set local role vmf_runtime");
    return fn(tx);
  });
}
