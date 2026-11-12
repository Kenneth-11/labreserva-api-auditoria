import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../utils/validate.js';
import { usersRepository } from './users.repository.js';

export const usersRouter = Router();

const withoutHash = ({ password_hash, ...user }) => user;

usersRouter.use(requireAuth);

// Directorio: (se restringe y se limpia en F08)
usersRouter.get('/', (_req, res) => {
  res.json(usersRepository.findAll());
});

usersRouter.get('/me', (req, res) => {
  res.json(withoutHash(usersRepository.findById(req.user.id)));
});

// Lista blanca: solo estos campos son editables, y cualquier campo extra (role, id, email...) se rechaza.
const profileSchema = z.strictObject({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().regex(/^[0-9+\- ]{4,20}$/, 'teléfono inválido').optional(),
  carnet: z.string().trim().regex(/^\d{6,12}$/, 'carnet inválido').optional(),
});

usersRouter.patch('/me', (req, res) => {
  const changes = validate(profileSchema, req.body);
  const current = usersRepository.findById(req.user.id);
  res.json(
    withoutHash(
      usersRepository.updateProfile(req.user.id, {
        name: changes.name ?? current.name,
        phone: changes.phone ?? current.phone,
        carnet: changes.carnet ?? current.carnet,
      }),
    ),
  );
});
