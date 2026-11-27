// Ejecutor de migraciones. Autocontenido (solo módulos de Node) para poder usarlo
// tanto desde la app como desde `npm run db:migrate`.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "./types.ts";

export const MIGRATIONS_DIR = path.join(process.cwd(), "infrastructure", "database", "migrations");

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export async function runMigrations(db: Db, dir: string = MIGRATIONS_DIR): Promise<MigrationResult> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const files = (await readdir(dir)).filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
  const result: MigrationResult = { applied: [], skipped: [] };

  for (const file of files) {
    const sql = await readFile(path.join(dir, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    await db.tx(async (q) => {
      // Bloqueo para que dos procesos no migren al mismo tiempo.
      await q.query("SELECT pg_advisory_xact_lock(727274)");
      const existing = await q.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE name = $1",
        [file],
      );
      const row = existing.rows[0];
      if (row) {
        if (row.checksum !== checksum) {
          throw new Error(`La migración ${file} cambió después de aplicarse. Crea una migración nueva.`);
        }
        result.skipped.push(file);
        return;
      }
      await q.exec(sql);
      await q.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [file, checksum]);
      result.applied.push(file);
    });
  }
  return result;
}

export async function pendingMigrations(db: Db, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
  try {
    const { rows } = await db.query<{ name: string }>("SELECT name FROM schema_migrations");
    const done = new Set(rows.map((r) => r.name));
    return files.filter((f) => !done.has(f));
  } catch {
    return files;
  }
}
