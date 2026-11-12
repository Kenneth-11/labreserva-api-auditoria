import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../utils/http-error.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.js';
import { parseId } from '../../utils/parse-id.js';
import { validate } from '../../utils/validate.js';
import { labsRepository } from '../labs/labs.repository.js';
import { reservationsRepository } from '../reservations/reservations.repository.js';
import { usersRepository } from '../users/users.repository.js';

export const adminRouter = Router();

const labSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  building: z.string().trim().min(1).max(60),
  capacity: z.number().int().min(1).max(500),
  description: z.string().trim().max(300).optional(),
});

// Mediación completa y falla cerrado: TODO lo que cuelga de /admin exige autenticación Y rol admin.
// Si mañana se agrega una ruta nueva aquí, hereda la protección sin que nadie tenga que acordarse.
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/reservations', (_req, res) => {
  res.json(reservationsRepository.findAll());
});

adminRouter.post('/labs', (req, res) => {
  res.status(201).json(labsRepository.create(validate(labSchema, req.body)));
});

adminRouter.delete('/users/:id', (req, res) => {
  if (!usersRepository.remove(parseId(req.params.id))) throw new HttpError(404, 'Usuario no encontrado');
  res.status(204).end();
});
