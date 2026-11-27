/** CLI: npm run routine -- daily.ceo-cycle [--force]   |   npm run routine -- daily   (todas las diarias) */
import { getDb } from "../core/db";
import { ROUTINES, routinesOfKind, runRoutine } from "./routines";

const args = process.argv.slice(2);
const force = args.includes("--force");
const target = args.find((a) => !a.startsWith("--"));
if (!target) { console.log("Rutinas:\n" + Object.entries(ROUTINES).map(([k, r]) => `  ${k} — ${r.description}`).join("\n")); process.exit(0); }
const names = ["hourly", "daily", "weekly", "monthly"].includes(target) ? routinesOfKind(target as "daily") : [target];
const db = await getDb();
let failed = 0;
for (const n of names) {
  const r = await runRoutine(db, n, { force });
  console.log(`${n}: ${r.status}${r.error ? ` — ${r.error}` : ""}`);
  if (r.status === "failed") failed++;
}
await db.close();
process.exit(failed ? 1 : 0);
