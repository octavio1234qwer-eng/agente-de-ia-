import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Database, Queryable } from "./types";

// int8 y numeric como number en ambos drivers (importes en céntimos < 2^53).
const parsers = { 20: (v: string) => Number(v), 1700: (v: string) => Number(v) };

/**
 * PostgreSQL embebido (WASM). Sin `dataDir` la base vive en memoria (pruebas).
 * Un solo proceso debe abrir un directorio a la vez.
 */
export async function createPgliteDatabase(dataDir?: string): Promise<Database> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const pg = new PGlite({ dataDir, parsers });
  await pg.waitReady;

  const wrap = (q: { query: PGlite["query"] }): Queryable => ({
    async query<T>(sql: string, params?: unknown[]) {
      const result = await q.query<T>(sql, params as unknown[] | undefined);
      return result.rows;
    },
  });

  return {
    kind: "pglite",
    query: wrap(pg).query,
    async exec(sql) {
      await pg.exec(sql);
    },
    transaction(fn) {
      return pg.transaction((tx) => fn(wrap(tx as unknown as { query: PGlite["query"] })));
    },
    close: () => pg.close(),
  };
}
