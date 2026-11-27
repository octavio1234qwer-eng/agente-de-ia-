import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Database } from "./types";

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

export type Migration = { version: string; name: string; sql: string; checksum: string };

export function loadMigrations(dir = MIGRATIONS_DIR): Migration[] {
  return readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((file) => {
      const sql = readFileSync(path.join(/*turbopackIgnore: true*/ dir, file), "utf8");
      return {
        version: file.slice(0, 4),
        name: file.replace(/\.sql$/, ""),
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    });
}

/**
 * Aplica las migraciones pendientes, cada una en su transacción. Falla si una
 * migración ya aplicada fue modificada (checksum distinto).
 */
export async function migrate(db: Database, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.exec(`
    create schema if not exists vmf_meta;
    create table if not exists vmf_meta.schema_migrations (
      version text primary key,
      name text not null,
      checksum text not null,
      applied_at timestamptz not null default now()
    );
  `);
  const applied = new Map(
    (await db.query<{ version: string; checksum: string }>("select version, checksum from vmf_meta.schema_migrations")).map(
      (r) => [r.version, r.checksum],
    ),
  );
  const done: string[] = [];
  for (const m of loadMigrations(dir)) {
    const existing = applied.get(m.version);
    if (existing) {
      if (existing !== m.checksum) {
        throw new Error(`La migración ${m.name} ya aplicada fue modificada. Crea una migración nueva en su lugar.`);
      }
      continue;
    }
    await db.transaction(async (tx) => {
      // Las sentencias múltiples sin parámetros usan el protocolo simple en ambos drivers.
      await tx.exec(m.sql);
      await tx.query("insert into vmf_meta.schema_migrations (version, name, checksum) values ($1, $2, $3)", [
        m.version,
        m.name,
        m.checksum,
      ]);
    });
    done.push(m.name);
  }
  return done;
}
