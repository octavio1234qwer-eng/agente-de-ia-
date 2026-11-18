import { forbidden, parseCookies, unauthorized, HttpError } from '../lib/http.js';
import { getSessionUser, sessionCookieName } from '../services/sessions.js';

/** Carga el usuario de la cookie de sesión (si existe) en req.user. */
export function loadSession({ db, config }) {
  const cookieName = sessionCookieName(config);
  return async (req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    req.sessionToken = req.cookies[cookieName];
    req.user = req.sessionToken ? await getSessionUser(db, req.sessionToken) : null;
    next();
  };
}

export function requireUser(req, _res, next) {
  if (!req.user) throw unauthorized();
  if (req.user.status !== 'active') throw new HttpError(403, 'account_suspended', 'err.account_suspended');
  next();
}

export function requireVerified(config) {
  return (req, _res, next) => {
    if (config.auth.requireEmailVerification && !req.user.email_verified_at) {
      throw new HttpError(403, 'email_not_verified', 'err.email_not_verified');
    }
    next();
  };
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') throw forbidden();
  next();
}
