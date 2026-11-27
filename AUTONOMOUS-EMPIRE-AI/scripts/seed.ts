import { getDb, migrate } from "../core/db";
import { seed } from "../infrastructure/database/seed";
const db = await getDb();
console.log("Migraciones aplicadas:", (await migrate(db)).join(", ") || "ninguna nueva");
await seed(db);
console.log(`Semilla aplicada (${db.kind}).`);
await db.close();
