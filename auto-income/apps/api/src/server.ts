/**
 * Punto de entrada: API + worker del orquestador en un solo proceso (una instancia).
 * Variables: ver ../../../.env.example
 */
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { openDatabase, run, get } from '../../../packages/database/src/index.ts';
import { createApp } from './app.ts';

const env = process.env;
const dbPath = env.DATABASE_PATH ?? resolve(import.meta.dirname, '../../../data/auto-income.db');
const db = openDatabase(dbPath);

// Registro inicial de costos de infraestructura ($0): datos verificables, editables por el propietario.
if (!get(db, 'SELECT id FROM service_costs LIMIT 1')) {
  const seed: [string, string, string, string][] = [
    ['Node.js + SQLite (node:sqlite)', 'runtime', 'Software libre; sin costo.', 'Incluido en Node 22.'],
    ['Alojamiento', 'hosting', 'Pendiente de elegir; ver docs/DEPLOYMENT.md.', 'No contratado. $0 hasta que el propietario decida.'],
    ['Pasarela de pago', 'payments', 'Solo modo demo configurado.', 'Las pasarelas cobran comisión por venta; se registra como fee.'],
  ];
  for (const [name, category, free, notes] of seed) {
    run(db, 'INSERT INTO service_costs (id, name, category, monthly_cents, free_tier, notes) VALUES (?, ?, ?, 0, ?, ?)', `svc_${category}`, name, category, free, notes);
  }
}

const app = createApp(db, { env, staticDir: resolve(import.meta.dirname, '../../web/dist') });
const port = Number(env.PORT ?? 8787);
const server = createServer((req, res) => { void app.handle(req, res); });
server.listen(port, () => console.log(`AUTO-INCOME AI escuchando en http://localhost:${port}`));

// Worker: ciclo del orquestador.
const intervalMs = Math.max(2_000, Number(env.WORKER_INTERVAL_MS ?? 10_000));
const worker = env.WORKER_ENABLED === '0' ? null : setInterval(() => {
  app.orchestrator.tick(5).catch((err) => console.error('[worker]', err));
}, intervalMs);

function shutdown() {
  if (worker) clearInterval(worker);
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
