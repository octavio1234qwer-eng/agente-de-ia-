import { sha256, stableStringify } from "./crypto.ts";
import type { Queryable } from "./db/types.ts";

export type ActorType = "user" | "agent" | "system" | "webhook" | "customer" | "anonymous";
export type Severity = "info" | "warning" | "critical";

export interface AuditEntry {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  severity?: Severity;
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
}

const GENESIS = "0".repeat(64);
const SENSITIVE = /pass|secret|token|key|authorization|card|cvv/i;

/** Elimina valores sensibles antes de guardarlos. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[profundidad]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? "[oculto]" : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") return value.replace(/\u0000/g, "").slice(0, 2000);
  return value;
}

function computeHash(prevHash: string, row: Record<string, unknown>): string {
  return sha256(prevHash + stableStringify(row));
}

/**
 * Registra una acción. Cada fila se encadena con el hash de la anterior, así que el
 * auditor detecta cualquier alteración. La tabla además rechaza UPDATE y DELETE.
 * Debe llamarse dentro de una transacción (usa un bloqueo de transacción).
 */
export async function audit(q: Queryable, entry: AuditEntry): Promise<void> {
  await q.query("SELECT pg_advisory_xact_lock(727275)");
  const prev = await q.query<{ hash: string }>("SELECT hash FROM audit_logs ORDER BY id DESC LIMIT 1");
  const prevHash = prev.rows[0]?.hash ?? GENESIS;
  const metadata = JSON.parse(JSON.stringify(redact(entry.metadata ?? {}))) as Record<string, unknown>;
  const row = {
    at: new Date().toISOString(),
    actor_type: entry.actorType,
    actor_id: entry.actorId ?? null,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    severity: entry.severity ?? "info",
    metadata,
    ip_hash: entry.ipHash ?? null,
  };
  const hash = computeHash(prevHash, row);
  await q.query(
    `INSERT INTO audit_logs (at, actor_type, actor_id, action, target_type, target_id, severity, metadata, ip_hash, prev_hash, hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [row.at, row.actor_type, row.actor_id, row.action, row.target_type, row.target_id, row.severity,
     JSON.stringify(row.metadata), row.ip_hash, prevHash, hash],
  );
}

export interface ChainCheck {
  ok: boolean;
  checked: number;
  brokenAtId?: number;
  reason?: string;
}

type AuditRow = Record<string, unknown> & { id: number; at: Date | string; prev_hash: string; hash: string };

/** Recalcula la cadena completa. Si alguien edita o borra filas, devuelve ok=false. */
export async function verifyAuditChain(q: Queryable): Promise<ChainCheck> {
  let prevHash = GENESIS;
  let lastId = 0;
  let checked = 0;
  for (;;) {
    const { rows } = await q.query<AuditRow>("SELECT * FROM audit_logs WHERE id > $1 ORDER BY id LIMIT 500", [lastId]);
    if (rows.length === 0) break;
    for (const r of rows) {
      if (r.prev_hash !== prevHash) return { ok: false, checked, brokenAtId: r.id, reason: "La cadena no coincide: falta o sobra una fila." };
      const row = {
        at: new Date(r.at as string).toISOString(),
        actor_type: r.actor_type,
        actor_id: r.actor_id,
        action: r.action,
        target_type: r.target_type,
        target_id: r.target_id,
        severity: r.severity,
        metadata: r.metadata,
        ip_hash: r.ip_hash,
      };
      if (computeHash(prevHash, row) !== r.hash) return { ok: false, checked, brokenAtId: r.id, reason: "El contenido de la fila fue alterado." };
      prevHash = r.hash;
      lastId = r.id;
      checked++;
    }
  }
  return { ok: true, checked };
}
