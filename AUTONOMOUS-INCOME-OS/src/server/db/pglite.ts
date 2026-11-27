import { PGlite, types } from "@electric-sql/pglite";
import type { Db, Queryable, QueryResult, Row } from "./types.ts";

const parsers = {
  [types.INT8]: (v: string) => Number(v),
  [types.NUMERIC]: (v: string) => Number(v),
};

type PgliteLike = Pick<PGlite, "query" | "exec">;

function wrap(conn: PgliteLike): Queryable {
  return {
    async query<T = Row>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      const r = await conn.query<T>(sql, params as unknown[], { parsers });
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    },
    async exec(sql: string) {
      await conn.exec(sql);
    },
  };
}

/** PGlite: Postgres real compilado a WASM. Solo para desarrollo y pruebas. */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const db = await PGlite.create(dataDir);
  const base = wrap(db);
  return {
    kind: "pglite",
    ...base,
    tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
      return db.transaction((t) => fn(wrap(t as unknown as PgliteLike)));
    },
    async close() {
      await db.close();
    },
  };
}
