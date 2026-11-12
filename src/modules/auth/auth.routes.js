import { Router } from 'express';
import { HttpError } from '../../utils/http-error.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { signToken } from '../../lib/jwt.js';
import { usersRepository } from '../users/users.repository.js';

export const authRouter = Router();

const DUMMY_HASH = hashPassword('contraseña-que-nadie-usa');

authRouter.post('/register', (req, res) => {
  const { name, email, password, carnet } = req.body;
  if (!name || !email || !password) throw new HttpError(400, 'Nombre, email y contraseña son obligatorios');
  if (usersRepository.findByEmail(email)) throw new HttpError(409, 'El email ya está registrado');

  const user = usersRepository.create({
    name,
    email,
    carnet,
    passwordHash: hashPassword(password),
    role: 'estudiante',
  });
  res.status(201).json(user);
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Mismo mensaje y mismo código si el email no existe o la contraseña falla (no se enumeran cuentas).
  // Si el usuario no existe se verifica contra un hash falso para que el tiempo de respuesta sea parecido.
  const user = typeof email === 'string' ? usersRepository.findByEmailWithHash(email) : undefined;
  const ok = verifyPassword(String(password ?? ''), user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Credenciales inválidas');

  res.json({
    token: signToken(user),
    user: { id: user.id, name: user.name, role: user.role },
  });
});
