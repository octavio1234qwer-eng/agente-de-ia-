import { resolveLocale, t } from '../i18n.js';
import { errorFields } from '../lib/logger.js';

const localeOf = (req) => req.locale ?? resolveLocale({ header: req.get('x-locale'), acceptLanguage: req.get('accept-language') });

/** Idioma de la petición: el que envía la interfaz (X-Locale), el del usuario o el del navegador. */
export function setLocale(req, _res, next) {
  req.locale = resolveLocale({ header: req.get('x-locale'), userLocale: req.user?.locale, acceptLanguage: req.get('accept-language') });
  next();
}

export function notFoundApi(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: t(localeOf(req), 'err.route_not_found') } });
}

function translateFields(locale, fields) {
  if (!fields) return undefined;
  return Object.fromEntries(Object.entries(fields).map(([name, value]) => [
    name,
    typeof value === 'string' ? t(locale, value) : t(locale, value.key, value.params),
  ]));
}

export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, _next) => {
    const locale = localeOf(req);
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'payload_too_large', message: t(locale, 'err.payload_too_large') } });
    }
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'invalid_json', message: t(locale, 'err.invalid_json') } });
    }
    if (error?.expose && error.status) {
      const { fields, ...rest } = error.details ?? {};
      return res.status(error.status).json({
        error: {
          code: error.code,
          message: t(locale, error.messageKey ?? error.message, error.params),
          ...rest,
          ...(fields ? { fields: translateFields(locale, fields) } : {}),
        },
      });
    }
    logger.error('error no controlado', { requestId: req.id, method: req.method, path: req.path, ...errorFields(error) });
    return res.status(500).json({ error: { code: 'internal', message: t(locale, 'err.internal'), requestId: req.id } });
  };
}
