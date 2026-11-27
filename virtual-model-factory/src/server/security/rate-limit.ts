import type { Queryable } from "../db/types";

export type RateLimitResult = { allowed: boolean; count: number; limit: number; resetAt: Date };

export function windowStart(now: Date, windowSeconds: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

/** Límite de ventana fija persistido en base de datos (válido con varias instancias). */
export async function consumeRateLimit(
  db: Queryable,
  key: string,
  limit: number,
  windowSeconds: number,
  now = new Date(),
): Promise<RateLimitResult> {
  const start = windowStart(now, windowSeconds);
  const [row] = await db.query<{ count: number }>(
    `insert into vmf.rate_limits (key, window_start, count) values ($1, $2, 1)
     on conflict (key) do update set
       count = case when vmf.rate_limits.window_start = excluded.window_start then vmf.rate_limits.count + 1 else 1 end,
       window_start = excluded.window_start
     returning count`,
    [key, start],
  );
  const count = row!.count;
  return { allowed: count <= limit, count, limit, resetAt: new Date(start.getTime() + windowSeconds * 1000) };
}
