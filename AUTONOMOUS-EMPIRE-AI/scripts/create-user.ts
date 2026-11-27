/** Uso: npm run user:create -- --email tu@correo --name "Tu nombre" --role owner   (la contraseña se pide por stdin) */
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { getDb } from "../core/db";
import { seed } from "../infrastructure/database/seed";
import { createUser } from "../core/auth";

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string", default: "" }, role: { type: "string", default: "owner" } } });
if (!values.email) { console.error("Falta --email"); process.exit(1); }
const pw = process.env.NEW_USER_PASSWORD ?? (await createInterface({ input: process.stdin, output: process.stdout }).question("Contraseña (mín. 12 caracteres): "));
const db = await getDb();
await seed(db);
const id = await db.transaction((tx) => createUser(tx, { email: values.email!, name: values.name!, role: values.role as "owner", password: pw.trim() }, "cli"));
console.log(`Usuario creado: ${id} (${values.role})`);
await db.close();
process.exit(0);
