// Uso: npm run admin:promote -- correo@ejemplo.com
// Convierte en administrador a un usuario que ya se registró.
import { loadConfig, loadEnvFile } from '../src/config.js';
import { createDb } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { normalizeEmail } from '../src/lib/security.js';
import { audit } from '../src/services/audit.js';

loadEnvFile();
const email = process.argv[2];
if (!email) {
  console.error('Uso: npm run admin:promote -- correo@ejemplo.com');
  process.exit(1);
}
const config = loadConfig();
const db = await createDb({ ...config.db, pgliteDir: config.db.pgliteDir ?? './data/pglite' });
await migrate(db);
const { rows } = await db.query(
  "UPDATE users SET role = 'admin', updated_at = now() WHERE email_normalized = $1 RETURNING id, email",
  [normalizeEmail(email)],
);
if (!rows[0]) {
  console.error(`No existe un usuario con el correo ${email}. Regístralo primero en la plataforma.`);
  await db.close();
  process.exit(1);
}
await audit(db, { actor: null, action: 'cli.admin_promoted', target: rows[0] });
console.log(`Listo: ${rows[0].email} ahora es administrador.`);
await db.close();
