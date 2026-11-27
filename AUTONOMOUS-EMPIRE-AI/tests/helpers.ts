import { createTestDb, type Db } from "../core/db";
import { seed } from "../infrastructure/database/seed";
import { resetSyncCache } from "../core/orchestrator";

export async function freshDb(): Promise<Db> {
  resetSyncCache();
  const db = await createTestDb();
  await seed(db);
  return db;
}
export const owner = { id: "user:owner-test", role: "owner" as const };
export const operator = { id: "user:operator-test", role: "operator" as const };
