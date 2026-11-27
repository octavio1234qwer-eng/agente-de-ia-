import path from "node:path";
import { getEnv } from "../config/env";
import { migrate } from "./migrate";
import { createPgliteDatabase } from "./pglite";
import { createPostgresDatabase } from "./postgres";
import type { Database } from "./types";

export type { Database, Queryable, Row } from "./types";

const globalForDb = globalThis as unknown as { __vmfDb?: Promise<Database> };

async function init(): Promise<Database> {
  const env = getEnv();
  if (env.DATABASE_URL) {
    const db = createPostgresDatabase({
      connectionString: env.DATABASE_URL,
      sslMode: env.DATABASE_SSL_MODE,
      sslCa: env.DATABASE_SSL_CA,
      poolMax: env.DATABASE_POOL_MAX,
    });
    if (env.DB_AUTO_MIGRATE) await migrate(db);
    return db;
  }
  if (env.NODE_ENV === "production" && !env.ALLOW_EMBEDDED_DB_IN_PRODUCTION) {
    throw new Error(
      "DATABASE_URL no está configurada. En producción usa PostgreSQL (Supabase); la base embebida no persiste en servidores efímeros.",
    );
  }
  const db = await createPgliteDatabase(path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.PGLITE_DATA_DIR));
  await migrate(db);
  return db;
}

/** Conexión única por proceso (sobrevive a la recarga en caliente de Next). */
export function getDb(): Promise<Database> {
  if (!globalForDb.__vmfDb) {
    globalForDb.__vmfDb = init().catch((error) => {
      globalForDb.__vmfDb = undefined;
      throw error;
    });
  }
  return globalForDb.__vmfDb;
}

/** Solo pruebas y scripts: inyecta una base ya creada. */
export function setDbForTesting(db: Database | undefined): void {
  globalForDb.__vmfDb = db ? Promise.resolve(db) : undefined;
}
