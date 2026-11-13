import { createToken, hashToken } from '../lib/security.js';

export const TOKEN_TTL = {
  verify_email: 48 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
};

/** Crea un token de un solo uso e invalida los anteriores del mismo propósito. */
export async function issueAuthToken(db, userId, purpose) {
  const token = createToken(32);
  await db.tx(async (q) => {
    await q.query('DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = $2', [userId, purpose]);
    await q.query(
      'INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at) VALUES ($1, $2, $3, $4)',
      [hashToken(token), userId, purpose, new Date(Date.now() + TOKEN_TTL[purpose])],
    );
  });
  return token;
}

/** Marca el token como usado de forma atómica y devuelve el user_id, o null si no es válido. */
export async function consumeAuthToken(db, token, purpose) {
  if (!token || token.length > 100) return null;
  const { rows } = await db.query(
    `UPDATE auth_tokens SET used_at = now()
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [hashToken(token), purpose],
  );
  return rows[0]?.user_id ?? null;
}
