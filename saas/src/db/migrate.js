import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from '../config.js';

const migrationsDir = path.join(rootDir, 'migrations');
const LOCK_ID = 727_001; // Evita que dos instancias migren al mismo tiempo.

export async function migrate(db, logger) {
  const files = fs.readdirSync(migrationsDir).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  return db.withClient(async (client) => {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    try {
      await client.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      const { rows } = await client.query('SELECT name FROM schema_migrations');
      const applied = new Set(rows.map((row) => row.name));
      const pending = files.filter((file) => !applied.has(file));
      for (const file of pending) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.exec(`BEGIN;\n${sql}\nINSERT INTO schema_migrations (name) VALUES ('${file.replace(/'/g, "''")}');\nCOMMIT;`)
          .catch(async (error) => {
            await client.exec('ROLLBACK').catch(() => {});
            throw new Error(`Falló la migración ${file}: ${error.message}`);
          });
        logger?.info('migración aplicada', { file });
      }
      return pending;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
    }
  });
}
