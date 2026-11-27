import { createPgliteDb } from "@/server/db/pglite";
import { runMigrations } from "@/server/db/migrate";
import { setDbForTests, type Db } from "@/server/db";

/** Base Postgres en memoria, migrada y con datos iniciales. */
export async function createTestDb(opts: { bootstrap?: boolean } = {}): Promise<Db> {
  const db = await createPgliteDb();
  await runMigrations(db);
  if (opts.bootstrap !== false) {
    const { bootstrap } = await import("@/server/bootstrap");
    await bootstrap(db);
  }
  setDbForTests(db);
  return db;
}
