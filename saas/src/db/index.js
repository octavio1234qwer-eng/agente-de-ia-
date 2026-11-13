import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

/**
 * Adaptador mínimo con la misma interfaz para PostgreSQL (producción) y
 * PGlite (Postgres embebido para desarrollo y pruebas):
 *   query(sql, params) -> { rows }
 *   tx(async (q) => ...) ejecuta dentro de una transacción
 *   exec(sql) ejecuta varias sentencias (migraciones)
 */
export async function createDb({ url, ssl = 'disable', poolMax = 10, pgliteDir, memory = false } = {}) {
  if (url) return createPostgres({ url, ssl, poolMax });
  return createPglite({ dir: memory ? undefined : pgliteDir });
}

function createPostgres({ url, ssl, poolMax }) {
  const pool = new pg.Pool({
    connectionString: url,
    max: poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: ssl === 'disable' ? undefined : { rejectUnauthorized: ssl === 'require' },
  });
  pool.on('error', () => {}); // Errores de clientes inactivos: el pool los reemplaza.
  return {
    kind: 'postgres',
    query: (sql, params) => pool.query(sql, params),
    exec: (sql) => pool.query(sql),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (sql, params) => client.query(sql, params) });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    /** Ejecuta fn con una conexión dedicada (para candados de sesión). */
    async withClient(fn) {
      const client = await pool.connect();
      try {
        return await fn({ query: (sql, params) => client.query(sql, params), exec: (sql) => client.query(sql) });
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function createPglite({ dir }) {
  let PGlite;
  try {
    ({ PGlite } = await import('@electric-sql/pglite'));
  } catch {
    throw new Error('Sin DATABASE_URL se usa la base embebida de desarrollo, pero no está instalada. Ejecuta "npm install" (incluye dependencias de desarrollo) o define DATABASE_URL.');
  }
  if (dir) fs.mkdirSync(path.resolve(dir), { recursive: true });
  const db = new PGlite(dir ? path.resolve(dir) : undefined);
  await db.waitReady;
  const self = {
    kind: dir ? 'pglite' : 'pglite-memory',
    query: (sql, params) => db.query(sql, params),
    exec: (sql) => db.exec(sql),
    tx: (fn) => db.transaction((tx) => fn({ query: (sql, params) => tx.query(sql, params) })),
    withClient: (fn) => fn({ query: self.query, exec: self.exec }),
    close: () => db.close(),
  };
  return self;
}
