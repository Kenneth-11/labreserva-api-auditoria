import { verifyToken } from '../lib/jwt.js';
import { HttpError } from '../utils/http-error.js';
import { usersRepository } from '../modules/users/users.repository.js';

// Autenticación: ¿quién eres? Verifica la firma y expiración, y luego carga al usuario REAL desde la BD,
// así un usuario eliminado pierde acceso y el rol nunca se toma de lo que diga el token.
export function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Token requerido');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Token inválido o vencido');
  }

  const user = usersRepository.findById(Number(payload.sub));
  if (!user) throw new HttpError(401, 'Token inválido o vencido');

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
}

// Autorización por rol (mínimo privilegio): falla cerrado si no hay usuario o el rol no está permitido.
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user?.role)) throw new HttpError(403, 'No tiene permisos para esta operación');
    next();
  };

export const requireAdmin = requireRole('admin');
