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

  type Q = { query: PGlite["query"]; exec: PGlite["exec"] };
  const wrap = (q: Q): Queryable => ({
    async query<T>(sql: string, params?: unknown[]) {
      const result = await q.query<T>(sql, params as unknown[] | undefined);
      return result.rows;
    },
    async exec(sql: string) {
      await q.exec(sql);
    },
  });

  return {
    kind: "pglite",
    ...wrap(pg),
    transaction(fn) {
      return pg.transaction((tx) => fn(wrap(tx as unknown as Q)));
    },
    close: () => pg.close(),
  };
}
