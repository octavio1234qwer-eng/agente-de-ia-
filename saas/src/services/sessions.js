import { createToken, hashToken } from '../lib/security.js';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function sessionCookieName(config) {
  // El prefijo __Host- obliga a Secure, Path=/ y sin Domain: evita que subdominios la sobrescriban.
  return config.secureCookies ? '__Host-sid' : 'sid';
}

export async function createSession(db, userId, { ttlMs, ip, userAgent }) {
  const token = createToken(32);
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [hashToken(token), userId, new Date(Date.now() + ttlMs), ip ?? null, (userAgent ?? '').slice(0, 300)],
  );
  return token;
}

export async function getSessionUser(db, token) {
  if (!token || token.length > 100) return null;
  const tokenHash = hashToken(token);
  const { rows } = await db.query(
    `SELECT u.*, s.token_hash AS session_token_hash, s.last_seen_at AS session_last_seen_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  if (Date.now() - new Date(row.session_last_seen_at).getTime() > TOUCH_INTERVAL_MS) {
    await db.query('UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1', [tokenHash]);
  }
  return row;
}

export async function deleteSession(db, token) {
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

export async function deleteUserSessions(db, userId, { exceptTokenHash } = {}) {
  await db.query(
    'DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2',
    [userId, exceptTokenHash ?? ''],
  );
}

export function setSessionCookie(res, config, token) {
  res.cookie(sessionCookieName(config), token, {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: config.auth.sessionTtlMs,
  });
}

export function clearSessionCookie(res, config) {
  res.clearCookie(sessionCookieName(config), {
    httpOnly: true, secure: config.secureCookies, sameSite: 'lax', path: '/',
  });
}
