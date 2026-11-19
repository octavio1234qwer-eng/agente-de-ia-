import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { MIGRATIONS } from './migrations.ts';

export type DB = DatabaseSync;
export type Row = Record<string, SQLInputValue>;
export type Params = SQLInputValue[];

/** Abre (o crea) la base de datos y aplica migraciones pendientes. Usa ':memory:' en pruebas. */
export function openDatabase(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

export function migrate(db: DB): number {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  const applied = new Set((db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version));
  let count = 0;
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    transaction(db, () => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, new Date().toISOString());
    });
    count++;
  }
  return count;
}

export function schemaVersion(db: DB): number {
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number | null };
  return row.v ?? 0;
}

/** Ejecuta fn en una transacción; hace rollback si lanza. Soporta anidamiento con SAVEPOINT. */
const depths = new WeakMap<DB, number>();
export function transaction<T>(db: DB, fn: () => T): T {
  const depth = depths.get(db) ?? 0;
  const sp = `sp_${depth}`;
  db.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
  depths.set(db, depth + 1);
  try {
    const result = fn();
    depths.set(db, depth);
    db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
    return result;
  } catch (err) {
    depths.set(db, depth);
    db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}`);
    throw err;
  }
}

export function all<T = Row>(db: DB, sql: string, ...params: Params): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function get<T = Row>(db: DB, sql: string, ...params: Params): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(db: DB, sql: string, ...params: Params): { changes: number } {
  const r = db.prepare(sql).run(...params);
  return { changes: Number(r.changes) };
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function audit(db: DB, entry: { actor: string; action: string; entity: string; entityId?: string | null; businessId?: string | null; details?: unknown }): void {
  run(
    db,
    'INSERT INTO audit_log (actor, action, entity, entity_id, business_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    entry.actor,
    entry.action,
    entry.entity,
    entry.entityId ?? null,
    entry.businessId ?? null,
    JSON.stringify(entry.details ?? {}),
    new Date().toISOString(),
  );
}

export function notify(db: DB, n: { businessId?: string | null; level: 'info' | 'warning' | 'error' | 'approval'; title: string; body?: string; link?: string }): void {
  run(
    db,
    'INSERT INTO notifications (id, business_id, level, title, body, link, read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
    `ntf_${crypto.randomUUID().replace(/-/g, '')}`,
    n.businessId ?? null,
    n.level,
    n.title,
    n.body ?? '',
    n.link ?? null,
    new Date().toISOString(),
  );
}
