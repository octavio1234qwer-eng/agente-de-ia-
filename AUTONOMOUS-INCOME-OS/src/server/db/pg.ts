import pg from "pg";
import type { Db, Queryable, QueryResult, Row } from "./types.ts";

// int8 (bigint) → número de JS. Los importes en centavos caben de sobra en 2^53.
pg.types.setTypeParser(20, (v: string) => Number(v));
// numeric → número.
pg.types.setTypeParser(1700, (v: string) => Number(v));

function wrap(client: pg.Pool | pg.PoolClient): Queryable {
  return {
    async query<T = Row>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      const r = await client.query(sql, params as unknown[]);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
    },
    async exec(sql: string) {
      await client.query(sql);
    },
  };
}

export function createPgDb(connectionString: string): Db {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: local || process.env.DATABASE_SSL === "disable" ? undefined : { rejectUnauthorized: true },
  });
  const base = wrap(pool);
  return {
    kind: "pg",
    ...base,
    async tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn(wrap(client));
        await client.query("COMMIT");
        return out;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}
