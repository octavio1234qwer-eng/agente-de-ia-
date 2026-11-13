import crypto from 'node:crypto';
import helmet from 'helmet';
import { HttpError } from '../lib/http.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function securityHeaders(config) {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(config.secureCookies ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: config.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginEmbedderPolicy: false,
  });
}

/**
 * Protección CSRF para la API con cookies: en métodos que modifican datos exige que
 * Origin (o Sec-Fetch-Site) sea el propio sitio y que el cuerpo sea JSON.
 * Los formularios de otros sitios no pueden enviar JSON sin pasar por CORS.
 */
export function csrfProtection(config) {
  const allowedOrigin = config.appUrl;
  return (req, _res, next) => {
    if (!UNSAFE.has(req.method)) return next();
    const origin = req.get('origin');
    const fetchSite = req.get('sec-fetch-site');
    if (origin && origin !== allowedOrigin) throw new HttpError(403, 'csrf', 'Origen no permitido.');
    if (!origin && fetchSite && !['same-origin', 'none'].includes(fetchSite)) throw new HttpError(403, 'csrf', 'Origen no permitido.');
    const length = Number(req.get('content-length') ?? 0);
    if (length > 0 && !req.is('application/json')) throw new HttpError(415, 'unsupported_media_type', 'Envía los datos como JSON.');
    next();
  };
}

export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  next();
}

/** Respuestas de la API sin caché: contienen datos privados. */
export function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}
