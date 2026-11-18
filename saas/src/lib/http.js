import { hasMessage } from '../i18n.js';

/**
 * Error con estado HTTP. `messageKey` es una clave de src/i18n.js; el manejador de errores
 * la traduce al idioma de la petición. `details.fields` lleva errores por campo { clave, parámetros }.
 */
export class HttpError extends Error {
  constructor(status, code, messageKey, details, params = {}) {
    super(messageKey);
    this.status = status;
    this.code = code;
    this.messageKey = messageKey;
    this.params = params;
    this.details = details;
    this.expose = true;
  }
}

export const badRequest = (messageKey = 'err.bad_request', details, params) => new HttpError(400, 'bad_request', messageKey, details, params);
export const unauthorized = () => new HttpError(401, 'unauthorized', 'err.unauthorized');
export const forbidden = () => new HttpError(403, 'forbidden', 'err.forbidden');
export const notFound = (messageKey = 'err.not_found') => new HttpError(404, 'not_found', messageKey);

/** Error de validación de un solo campo. */
export function fieldError(field, key, params = {}) {
  return badRequest('err.bad_request', { fields: { [field]: { key, params } } });
}

function valueAt(data, path) {
  return path.reduce((current, segment) => (current == null ? undefined : current[segment]), data);
}

function issueToMessage(issue, data) {
  const params = { min: issue.minimum, max: issue.maximum };
  if (hasMessage(issue.message)) return { key: issue.message, params };
  switch (issue.code) {
    case 'invalid_type':
      return { key: valueAt(data, issue.path) == null ? 'v.required' : 'v.invalid', params };
    case 'too_small':
      return { key: Number(issue.minimum) <= 1 ? 'v.required' : 'v.min_chars', params };
    case 'too_big':
      return { key: 'v.max_chars', params };
    case 'invalid_value':
      return { key: 'v.option', params };
    case 'invalid_format':
      return { key: issue.format === 'email' ? 'v.email' : 'v.invalid', params };
    default:
      return { key: 'v.invalid', params };
  }
}

/** Valida `data` con un esquema zod y devuelve los datos limpios o un 400 con detalles por campo. */
export function parse(schema, data) {
  const input = data ?? {};
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) fields[[...issue.path, key].join('.')] ??= { key: 'v.unknown_field', params: {} };
      continue;
    }
    const key = issue.path.join('.') || '_';
    fields[key] ??= issueToMessage(issue, input);
  }
  throw badRequest('err.bad_request', { fields });
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key || key in out) continue;
    try {
      out[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      out[key] = part.slice(index + 1).trim();
    }
  }
  return out;
}
