import { getDb, migrate } from "../core/db";
import { seed } from "../infrastructure/database/seed";
const db = await getDb();
await migrate(db);
console.log("Esquema al día:", (await db.query<{ id: string }>("select id from schema_migrations order by id")).rows.map((r) => r.id).join(", "));
await seed(db);
console.log(`Semilla aplicada (${db.kind}).`);
await db.close();
