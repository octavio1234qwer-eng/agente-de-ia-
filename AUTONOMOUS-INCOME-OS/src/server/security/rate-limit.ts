import type { Queryable } from "../db/types.ts";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Límite de ventana fija guardado en Postgres (funciona con varias instancias
 * sin servidor). `bucket` ejemplo: "login:ip:<hash>".
 */
export async function rateLimit(q: Queryable, bucket: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const nowMs = Date.now();
  const windowStartMs = Math.floor(nowMs / (windowSeconds * 1000)) * windowSeconds * 1000;
  const { rows } = await q.query<{ hits: number }>(
    `INSERT INTO rate_limits (bucket, window_start, hits) VALUES ($1, $2, 1)
     ON CONFLICT (bucket, window_start) DO UPDATE SET hits = rate_limits.hits + 1
     RETURNING hits`,
    [bucket.slice(0, 200), new Date(windowStartMs).toISOString()],
  );
  const hits = Number(rows[0]?.hits ?? 1);
  const retryAfterSeconds = Math.ceil((windowStartMs + windowSeconds * 1000 - nowMs) / 1000);
  return { ok: hits <= limit, remaining: Math.max(0, limit - hits), retryAfterSeconds };
}

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Demasiados intentos. Espera un momento.");
    this.name = "RateLimitError";
  }
}

export async function enforceRateLimit(q: Queryable, bucket: string, limit: number, windowSeconds: number): Promise<void> {
  const r = await rateLimit(q, bucket, limit, windowSeconds);
  if (!r.ok) throw new RateLimitError(r.retryAfterSeconds);
}
