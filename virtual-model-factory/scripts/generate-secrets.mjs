// Genera valores aleatorios para .env.local. No los compartas ni los subas al repositorio.
import { randomBytes } from "node:crypto";

console.log(`ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`);
console.log(`SETUP_TOKEN=${randomBytes(24).toString("base64url")}`);
console.log(`CRON_SECRET=${randomBytes(32).toString("base64url")}`);
console.log(`TELEGRAM_WEBHOOK_SECRET=${randomBytes(32).toString("hex")}`);
