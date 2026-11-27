import { loadEnvFiles } from "./_db.ts";

loadEnvFiles();
const { getDb } = await import("@/server/db");
const { migrate } = await import("@/server/db/migrate");

const db = await getDb();
const applied = await migrate(db);
console.log(applied.length ? `Migraciones aplicadas: ${applied.join(", ")}` : "La base de datos ya está al día.");
console.log(`Destino: ${db.kind === "postgres" ? "PostgreSQL (DATABASE_URL)" : "PGlite local"}`);
await db.close();
