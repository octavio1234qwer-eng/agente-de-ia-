/** Micro-framework HTTP sin dependencias: router, JSON, cookies, errores. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ValidationError } from '../../../packages/shared/src/validate.ts';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, message: string, code = 'error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  rawBody: string;
  body: unknown;
  ip: string;
  cookies: Record<string, string>;
  user?: { id: string; email: string; name: string; role: 'owner' | 'admin' | 'viewer'; sessionId: string; csrfToken: string };
  headers: Record<string, string>;
}

export type Handler = (ctx: Ctx) => unknown | Promise<unknown>;
interface Route { method: string; parts: string[]; handler: Handler; opts: RouteOpts }
export interface RouteOpts { auth?: boolean; permission?: string; rateKey?: 'auth' | 'public' | 'default'; rawBody?: boolean }

export class Router {
  private routes: Route[] = [];
  add(method: string, pattern: string, handler: Handler, opts: RouteOpts = {}) {
    this.routes.push({ method, parts: pattern.split('/').filter(Boolean), handler, opts: { auth: true, ...opts } });
  }
  get(p: string, h: Handler, o?: RouteOpts) { this.add('GET', p, h, o); }
  post(p: string, h: Handler, o?: RouteOpts) { this.add('POST', p, h, o); }
  patch(p: string, h: Handler, o?: RouteOpts) { this.add('PATCH', p, h, o); }
  delete(p: string, h: Handler, o?: RouteOpts) { this.add('DELETE', p, h, o); }

  match(method: string, path: string): { route: Route; params: Record<string, string> } | { allowed: string[] } | null {
    const parts = path.split('/').filter(Boolean);
    const allowed: string[] = [];
    for (const route of this.routes) {
      if (route.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const rp = route.parts[i];
        if (rp.startsWith(':')) params[rp.slice(1)] = decodeURIComponent(parts[i]);
        else if (rp !== parts[i]) { ok = false; break; }
      }
      if (!ok) continue;
      if (route.method === method) return { route, params };
      allowed.push(route.method);
    }
    return allowed.length ? { allowed } : null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignora cookie mal formada */ }
  }
  return out;
}

export async function readBody(req: IncomingMessage, limitBytes = 1_000_000): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limitBytes) throw new HttpError(413, 'cuerpo demasiado grande', 'payload_too_large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

export function sendJson(res: ServerResponse, status: number, data: unknown, extraHeaders: Record<string, string | string[]> = {}) {
  if (res.headersSent) return;
  const body = JSON.stringify(data);
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(body);
}

export function errorToResponse(err: unknown): { status: number; body: { error: string; code: string; field?: string } } {
  if (err instanceof HttpError) return { status: err.status, body: { error: err.message, code: err.code } };
  if (err instanceof ValidationError) return { status: 400, body: { error: err.message, code: 'validation_error', field: err.field } };
  if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    return { status: (err as { status: number }).status, body: { error: (err as unknown as Error).message, code: 'task_error' } };
  }
  if (err instanceof RangeError) return { status: 400, body: { error: err.message, code: 'invalid_input' } };
  return { status: 500, body: { error: 'error interno', code: 'internal_error' } };
}
