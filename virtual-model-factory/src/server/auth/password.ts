import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );

const PARAMS = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };
const MAXMEM = 128 * PARAMS.N * PARAMS.r * 2;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

const COMMON = new Set([
  "password1234", "contraseña123", "123456789012", "qwertyuiopas", "adminadmin12", "administrador",
  "passwordpassword", "letmein12345", "iloveyou1234", "000000000000", "111111111111",
]);

/** Devuelve el motivo del rechazo o null si la contraseña es aceptable. */
export function passwordPolicyError(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `La contraseña no puede superar ${PASSWORD_MAX_LENGTH} caracteres.`;
  if (COMMON.has(password.toLowerCase())) return "La contraseña es demasiado común.";
  if (new Set(password).size < 5) return "La contraseña es demasiado repetitiva.";
  if (email && password.toLowerCase().includes(email.split("@")[0]!.toLowerCase())) {
    return "La contraseña no debe contener tu usuario de correo.";
  }
  return null;
}

/** Formato: scrypt$N$r$p$salt$hash (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, PARAMS.keylen, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p, maxmem: MAXMEM });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64!, "base64url");
  const N = Number(n), R = Number(r), P = Number(p);
  if (![N, R, P].every(Number.isInteger) || N > 2 ** 20) return false;
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64!, "base64url"), expected.length, {
    N, r: R, p: P, maxmem: 128 * N * R * 2,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Hash fijo para igualar el tiempo de respuesta cuando el usuario no existe. */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(24).toString("base64url"));
  return dummyHash;
}
