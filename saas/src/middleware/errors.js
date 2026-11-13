import { errorFields } from '../lib/logger.js';

export function notFoundApi(_req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'Ruta no encontrada.' } });
}

export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, _next) => {
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'payload_too_large', message: 'El texto enviado es demasiado grande.' } });
    }
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'invalid_json', message: 'JSON inválido.' } });
    }
    if (error?.expose && error.status) {
      return res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ?? {}) } });
    }
    logger.error('error no controlado', { requestId: req.id, method: req.method, path: req.path, ...errorFields(error) });
    return res.status(500).json({ error: { code: 'internal', message: 'Ocurrió un error inesperado. Intenta de nuevo.', requestId: req.id } });
  };
}
