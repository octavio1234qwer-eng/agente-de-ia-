/**
 * Registro de auditoría append-only encadenado por SHA-256.
 * Cada fila guarda el hash de la anterior; alterar o borrar una fila rompe la cadena
 * y `verifyAuditChain` lo detecta.
 */
import { createHash } from "node:crypto";
import type { Queryable, Db } from "../db";

export type AuditLevel = "green" | "yellow" | "red" | "blocked" | "system";
export interface AuditInput {
  actor: string;
  action: string;
  level: AuditLevel;
  target?: string | null;
  result: string;
  detail?: Record<string, unknown>;
}

const GENESIS = "0".repeat(64);

function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}

export function computeHash(prev: string, e: AuditInput & { at: string }): string {
  return createHash("sha256")
    .update(
      canonical({
        prev,
        at: e.at,
        actor: e.actor,
        action: e.action,
        level: e.level,
        target: e.target ?? null,
        result: e.result,
        detail: e.detail ?? {},
      }),
    )
    .digest("hex");
}

/** Si recibe una conexión (Db) abre su propia transacción; si recibe una transacción, la reutiliza. */
export async function appendAudit(q: Queryable | Db, e: AuditInput): Promise<{ id: number; hash: string }> {
  if ("transaction" in q) return q.transaction((tx) => appendAudit(tx, e));
  // Bloqueo para serializar la cadena entre procesos concurrentes.
  await q.query("lock table audit_log in share row exclusive mode");
  const last = await q.query<{ hash: string }>("select hash from audit_log order by id desc limit 1");
  const prev = last.rows[0]?.hash ?? GENESIS;
  const at = new Date().toISOString();
  const detail = JSON.parse(JSON.stringify(e.detail ?? {})) as Record<string, unknown>;
  const hash = computeHash(prev, { ...e, detail, at });
  const r = await q.query<{ id: number }>(
    `insert into audit_log(at, actor, action, level, target, result, detail, prev_hash, hash)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [at, e.actor, e.action, e.level, e.target ?? null, e.result, JSON.stringify(detail), prev, hash],
  );
  return { id: Number(r.rows[0]!.id), hash };
}

export async function audit(db: Db, e: AuditInput) {
  return db.transaction((tx) => appendAudit(tx, e));
}

export async function verifyAuditChain(
  q: Queryable,
): Promise<{ ok: boolean; checked: number; brokenAt?: number }> {
  const r = await q.query<{
    id: number; at: Date | string; actor: string; action: string; level: AuditLevel;
    target: string | null; result: string; detail: Record<string, unknown>; prev_hash: string; hash: string;
  }>("select * from audit_log order by id asc");
  let prev = GENESIS;
  for (const row of r.rows) {
    const at = new Date(row.at).toISOString();
    const expected = computeHash(prev, { ...row, at });
    if (row.prev_hash !== prev || row.hash !== expected) return { ok: false, checked: r.rows.length, brokenAt: Number(row.id) };
    prev = row.hash;
  }
  return { ok: true, checked: r.rows.length };
}
