/** Bus de eventos persistente: cada evento se guarda y se entrega a los suscriptores del proceso. */
import type { Queryable } from "../db";

export type Handler = (payload: Record<string, unknown>, q: Queryable) => Promise<void>;
const handlers = new Map<string, Handler[]>();

export function subscribe(type: string, h: Handler) {
  handlers.set(type, [...(handlers.get(type) ?? []), h]);
  return () => handlers.set(type, (handlers.get(type) ?? []).filter((x) => x !== h));
}

export async function publish(q: Queryable, type: string, source: string, payload: Record<string, unknown> = {}) {
  await q.query("insert into events(type, source, payload) values ($1,$2,$3)", [type, source, JSON.stringify(payload)]);
  for (const h of handlers.get(type) ?? []) await h(payload, q);
}

export async function raiseAlert(
  q: Queryable,
  a: { severity: "info" | "warning" | "critical"; source: string; message: string; dedupeKey?: string },
) {
  await q.query(
    `insert into alerts(severity, source, message, dedupe_key) values ($1,$2,$3,$4) on conflict (dedupe_key) do nothing`,
    [a.severity, a.source, a.message, a.dedupeKey ?? null],
  );
}
