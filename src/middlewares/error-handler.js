import { HttpError } from '../utils/http-error.js';

// Errores que no delatan: el detalle (stack, mensajes de la BD) va SOLO al log del servidor.
// Al cliente solo llegan los mensajes pensados para él (HttpError y errores 4xx del parser de JSON).
export function errorHandler(err, req, res, _next) {
  const status = err.status ?? err.statusCode ?? 500;

  if (status >= 500 || !(err instanceof HttpError || err.expose)) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  const message =
    err.type === 'entity.too.large' ? 'El cuerpo de la solicitud es demasiado grande'
    : err.type === 'entity.parse.failed' ? 'JSON inválido'
    : err.message;
  res.status(status).json({ error: message });
}
