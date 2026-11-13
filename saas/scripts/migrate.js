// Aplica las migraciones pendientes. El servidor también lo hace al iniciar.
import { loadConfig, loadEnvFile } from '../src/config.js';
import { createDb } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { createLogger } from '../src/lib/logger.js';

loadEnvFile();
const config = loadConfig();
const db = await createDb({ ...config.db, pgliteDir: config.db.pgliteDir ?? './data/pglite' });
const applied = await migrate(db, createLogger());
console.log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'La base de datos ya está al día.');
await db.close();
