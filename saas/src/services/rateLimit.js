import { HttpError } from '../lib/http.js';

/**
 * Límite de peticiones por ventana fija guardado en PostgreSQL, compartido entre instancias.
 * Devuelve { allowed, remaining, resetAt }.
 */
export async function hitRateLimit(db, key, { limit, windowMs }) {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const { rows } = await db.query(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [key.slice(0, 200), windowStart],
  );
  const count = rows[0].count;
  return { allowed: count <= limit, remaining: Math.max(limit - count, 0), resetAt: new Date(windowStart.getTime() + windowMs) };
}

/**
 * Middleware de Express. `keys(req)` devuelve una o varias claves (por IP, por correo, por usuario).
 * Si alguna rebasa el límite responde 429.
 */
export function rateLimit(db, { name, limit, windowMs, keys }) {
  return async (req, res, next) => {
    for (const key of keys(req).filter(Boolean)) {
      const result = await hitRateLimit(db, `${name}:${key}`, { limit, windowMs });
      if (!result.allowed) {
        const retryAfter = Math.max(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000), 1);
        res.set('Retry-After', String(retryAfter));
        throw new HttpError(429, 'rate_limited', 'err.rate_limited', undefined, { minutes: Math.ceil(retryAfter / 60) });
      }
    }
    next();
  };
}

export async function cleanupRateLimits(db) {
  await db.query("DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'");
}
