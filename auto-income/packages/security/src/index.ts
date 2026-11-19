import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// ---------- Contraseñas (scrypt, parámetros N=16384, r=8, p=1) ----------
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password: string): string {
  validatePasswordStrength(password);
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validatePasswordStrength(password: string): void {
  if (typeof password !== 'string' || password.length < 10) throw new Error('la contraseña debe tener al menos 10 caracteres');
  if (password.length > 200) throw new Error('contraseña demasiado larga');
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) throw new Error('la contraseña debe incluir letras y números');
}

// ---------- Tokens ----------
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ---------- Webhooks ----------
/** Firma HMAC-SHA256 hex del cuerpo crudo. */
export function signPayload(secret: string, rawBody: string, timestamp?: string): string {
  return createHmac('sha256', secret).update(timestamp ? `${timestamp}.${rawBody}` : rawBody).digest('hex');
}

/** Verifica firma y antigüedad (anti-replay) de un webhook. */
export function verifyWebhookSignature(opts: { secret: string; rawBody: string; signature: string | undefined; timestamp: string | undefined; toleranceSec?: number; now?: number }): boolean {
  if (!opts.secret || !opts.signature || !opts.timestamp) return false;
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (Math.abs(now - ts) > (opts.toleranceSec ?? 300)) return false;
  const expected = signPayload(opts.secret, opts.rawBody, opts.timestamp);
  return safeEqual(expected, opts.signature.replace(/^sha256=/, ''));
}

// ---------- Rate limiting (ventana fija en memoria; una instancia) ----------
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private limit: number;
  private windowMs: number;
  private clock: () => number;
  constructor(limit: number, windowMs: number, clock: () => number = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
  }
  /** Devuelve true si la petición está permitida. */
  take(key: string): { allowed: boolean; retryAfterSec: number } {
    const now = this.clock();
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
      if (this.hits.size > 50_000) this.prune(now);
    }
    entry.count++;
    return { allowed: entry.count <= this.limit, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}

// ---------- Permisos ----------
export type Role = 'owner' | 'admin' | 'viewer';
export const PERMISSIONS = [
  'read',
  'business.write',
  'task.create',
  'task.approve',
  'agent.manage',
  'crm.write',
  'crm.export',
  'crm.delete',
  'finance.write',
  'product.write',
  'quote.write',
  'knowledge.write',
  'users.manage',
  'settings.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(PERMISSIONS),
  admin: new Set(PERMISSIONS.filter((p) => !['task.approve', 'users.manage', 'settings.manage', 'crm.delete', 'agent.manage'].includes(p))),
  viewer: new Set<Permission>(['read']),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

// ---------- Saneamiento ----------
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Envuelve contenido externo para que nunca se interprete como instrucción del sistema. */
export function untrusted(source: string, content: string): string {
  return `<<CONTENIDO_EXTERNO_NO_CONFIABLE fuente="${source.replace(/"/g, '')}">>\n${content.replace(/<<\/?CONTENIDO_EXTERNO[^>]*>>/g, '')}\n<</CONTENIDO_EXTERNO_NO_CONFIABLE>>`;
}
