import "server-only";
import path from "node:path";
import { mkdirSync } from "node:fs";
import type { Db } from "./types.ts";
import { runMigrations } from "./migrate.ts";

export type { Db, Queryable, Row } from "./types.ts";

let instance: Promise<Db> | null = null;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { createPgDb } = await import("./pg.ts");
    return createPgDb(url);
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PGLITE !== "1") {
    throw new ConfigError("Falta DATABASE_URL. En producción se requiere PostgreSQL (ver docs/DEPLOYMENT.md).");
  }
  // Desarrollo: base local persistente en .data/ y migraciones automáticas.
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  const { createPgliteDb } = await import("./pglite.ts");
  const db = await createPgliteDb(dir);
  await runMigrations(db);
  const { bootstrap } = await import("../bootstrap.ts");
  await bootstrap(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!instance) {
    instance = create().catch((err) => {
      instance = null;
      throw err;
    });
  }
  return instance;
}

/** Solo pruebas: inyecta una base ya migrada. */
export function setDbForTests(db: Db | null): void {
  instance = db ? Promise.resolve(db) : null;
}
