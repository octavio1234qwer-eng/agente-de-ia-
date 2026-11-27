import { loadEnvFiles } from "./_db.ts";

loadEnvFiles();
const { getDb } = await import("@/server/db");
const { withServiceContext } = await import("@/server/db/context");
const { seedDemoData } = await import("@/server/modules/demo/seed");

const created = await withServiceContext("cli", (db) => seedDemoData(db, null));
console.log(created.length ? `Modelos DEMO creados: ${created.join(", ")}` : "Los modelos DEMO ya existían.");
await (await getDb()).close();
