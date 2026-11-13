export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

export const badRequest = (message, details) => new HttpError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Inicia sesión para continuar.') => new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'No tienes permiso para realizar esta acción.') => new HttpError(403, 'forbidden', message);
export const notFound = (message = 'No encontrado.') => new HttpError(404, 'not_found', message);

/** Valida `data` con un esquema zod y devuelve los datos limpios o un 400 con detalles por campo. */
export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw badRequest('Revisa los datos enviados.', { fields });
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
