import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

const json = (message) => ({ error: message });

// Límite general de la API (abuso / denegación de servicio básica).
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Demasiadas solicitudes, intente más tarde'),
});

// Fuerza bruta de contraseñas: 5 intentos FALLIDOS por IP + email cada 15 minutos.
// Los logins correctos no cuentan, así que un usuario legítimo no se bloquea a sí mismo.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email ?? '').toLowerCase()}`,
  message: json('Demasiados intentos fallidos, espere 15 minutos'),
});

// Contraseña distinta cada vez, mismo atacante: tope por IP para fallos de login y registros.
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json('Demasiados intentos desde esta dirección, espere 15 minutos'),
});
