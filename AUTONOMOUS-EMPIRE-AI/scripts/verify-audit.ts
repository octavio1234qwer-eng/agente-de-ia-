import { getDb } from "../core/db";
import { verifyAuditChain } from "../core/audit-log";
const db = await getDb();
const r = await verifyAuditChain(db);
console.log(r.ok ? `Cadena íntegra: ${r.checked} registros.` : `CADENA ROTA en el registro ${r.brokenAt}.`);
await db.close();
process.exit(r.ok ? 0 : 2);
