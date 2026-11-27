/**
 * Acceso a base de datos. Interfaz mínima común a:
 *  - `pg` (producción: Supabase u otro PostgreSQL) cuando hay DATABASE_URL.
 *  - PGlite (Postgres embebido en WASM) para desarrollo y pruebas.
 * Ambos ejecutan el mismo SQL: no hay "base falsa".
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Db extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly kind: "pg" | "pglite";
}

export async function createPgDb(connectionString: string): Promise<Db> {
  const { default: pg } = await import("pg");
  // bigint (int8) → string para no perder precisión; lo convertimos explícitamente donde se usa.
  const pool = new pg.Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  return {
    kind: "pg",
    async query(sql, params) {
      const r = await pool.query(sql, params as unknown[]);
      return { rows: r.rows };
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const out = await fn({
          async query(sql, params) {
            const r = await client.query(sql, params as unknown[]);
            return { rows: r.rows };
          },
        });
        await client.query("commit");
        return out;
      } catch (e) {
        await client.query("rollback").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.waitReady;
  const wrap = (q: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Queryable => ({
    async query<T>(sql: string, params?: unknown[]) {
      const r = await q.query(sql, params ?? []);
      return { rows: r.rows as T[] };
    },
  });
  // PGlite es de una sola conexión: serializamos transacciones para evitar intercalado.
  let chain: Promise<unknown> = Promise.resolve();
  return {
    kind: "pglite",
    ...wrap(db as never),
    transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
      const run = chain.then(() => db.transaction((tx) => fn(wrap(tx as never))));
      chain = run.catch(() => {});
      return run as Promise<T>;
    },
    close: () => db.close(),
  } as Db;
}

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../infrastructure/database/migrations",
);

export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.query(
    "create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())",
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set(
    (await db.query<{ id: string }>("select id from schema_migrations")).rows.map((r) => r.id),
  );
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = await readFile(path.join(dir, f), "utf8");
    await db.transaction(async (tx) => {
      for (const stmt of splitSql(sql)) await tx.query(stmt);
      await tx.query("insert into schema_migrations(id) values ($1)", [f]);
    });
    applied.push(f);
  }
  return applied;
}

/** Divide un archivo SQL en sentencias (sin soporte de $$ — no lo usamos). */
export function splitSql(sql: string): string[] {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

let singleton: Promise<Db> | null = null;

/** Conexión compartida del proceso, con migraciones aplicadas. */
export function getDb(): Promise<Db> {
  if (!singleton) {
    singleton = (async () => {
      const url = process.env.DATABASE_URL;
      let db: Db;
      if (url) db = await createPgDb(url);
      else {
        if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PGLITE_IN_PRODUCTION)
          throw new Error("DATABASE_URL es obligatoria en producción.");
        db = await createPgliteDb(process.env.PGLITE_DIR ?? path.resolve(MIGRATIONS_DIR, "../../../.data/pglite"));
      }
      await migrate(db);
      return db;
    })();
    singleton.catch(() => (singleton = null));
  }
  return singleton;
}

/** Base aislada en memoria y migrada: para pruebas. */
export async function createTestDb(): Promise<Db> {
  const db = await createPgliteDb();
  await migrate(db);
  return db;
}

export const toInt = (v: unknown): number => (v == null ? 0 : Number(v));
