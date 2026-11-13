import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
// Parámetros scrypt: N=2^15, r=8, p=1 (~32 MiB por hash). Ajusta N si tu servidor es muy pequeño.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2,
  });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const [algo, n, r, p, saltB64, hashB64] = String(stored).split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const N = Number(n);
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N, r: Number(r), p: Number(p), maxmem: 128 * N * Number(r) * 2,
  });
  return crypto.timingSafeEqual(actual, expected);
}

/** Token aleatorio para enviar al usuario; en la base solo se guarda su hash. */
export function createToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}
