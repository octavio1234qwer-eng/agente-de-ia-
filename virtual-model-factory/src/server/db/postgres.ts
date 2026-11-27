import pg from "pg";
import type { Database, Queryable } from "./types";

pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

export type PostgresOptions = {
  connectionString: string;
  sslMode?: "disable" | "require" | "verify-full";
  sslCa?: string;
  poolMax?: number;
};

function isLocalHost(host: string): boolean {
  return ["localhost", "127.0.0.1", "::1"].includes(host);
}

/** Construye la configuración TLS. `require` cifra sin verificar el certificado. */
export function buildSslConfig(opts: PostgresOptions): pg.PoolConfig["ssl"] {
  const url = new URL(opts.connectionString);
  const mode = opts.sslMode ?? (isLocalHost(url.hostname) ? "disable" : "verify-full");
  if (mode === "disable") return false;
  if (mode === "require") return { rejectUnauthorized: false };
  const ca = opts.sslCa
    ? opts.sslCa.includes("BEGIN CERTIFICATE")
      ? opts.sslCa
      : Buffer.from(opts.sslCa, "base64").toString("utf8")
    : undefined;
  return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
}

/** pg da prioridad a sslmode de la URL sobre la opción `ssl`; se elimina. */
export function stripSslParams(connectionString: string): string {
  const url = new URL(connectionString);
  for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  return url.toString();
}

export function createPostgresDatabase(opts: PostgresOptions): Database {
  const pool = new pg.Pool({
    connectionString: stripSslParams(opts.connectionString),
    ssl: buildSslConfig(opts),
    max: opts.poolMax ?? 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  const wrap = (client: pg.Pool | pg.PoolClient): Queryable => ({
    async query<T>(sql: string, params?: unknown[]) {
      const result = await client.query(sql, params);
      return result.rows as T[];
    },
    async exec(sql: string) {
      await client.query(sql);
    },
  });

  return {
    kind: "postgres",
    ...wrap(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn(wrap(client));
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
