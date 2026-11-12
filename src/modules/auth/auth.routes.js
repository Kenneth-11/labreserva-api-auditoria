import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../utils/http-error.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { signToken } from '../../lib/jwt.js';
import { validate } from '../../utils/validate.js';
import { audit } from '../../lib/audit.js';
import { loginLimiter, authIpLimiter } from '../../middlewares/rate-limit.js';
import { usersRepository } from '../users/users.repository.js';

export const authRouter = Router();

const registerSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email().max(120)),
  password: z.string().min(8, 'mínimo 8 caracteres').max(128),
  carnet: z.string().trim().regex(/^\d{6,12}$/, 'carnet inválido').optional(),
});

const DUMMY_HASH = hashPassword('contraseña-que-nadie-usa');

authRouter.post('/register', authIpLimiter, (req, res) => {
  const { name, email, password, carnet } = validate(registerSchema, req.body);
  if (usersRepository.findByEmail(email)) throw new HttpError(409, 'El email ya está registrado');

  const user = usersRepository.create({
    name,
    email,
    carnet,
    passwordHash: hashPassword(password),
    role: 'estudiante',
  });
  audit('registro', req, { userId: user.id, email: user.email });
  res.status(201).json(user);
});

authRouter.post('/login', authIpLimiter, loginLimiter, (req, res) => {
  const { email, password } = req.body;

  // Mismo mensaje y mismo código si el email no existe o la contraseña falla (no se enumeran cuentas).
  // Si el usuario no existe se verifica contra un hash falso para que el tiempo de respuesta sea parecido.
  const user = typeof email === 'string' ? usersRepository.findByEmailWithHash(email.trim().toLowerCase()) : undefined;
  const ok = verifyPassword(String(password ?? ''), user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    audit('login_fallido', req, { email: String(email ?? '').slice(0, 120) });
    throw new HttpError(401, 'Credenciales inválidas');
  }
  audit('login_ok', req, { userId: user.id, email: user.email });

  res.json({
    token: signToken(user),
    user: { id: user.id, name: user.name, role: user.role },
  });
});
