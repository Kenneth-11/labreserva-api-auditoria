import { Router } from 'express';
import { HttpError } from '../../utils/http-error.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.js';
import { labsRepository } from '../labs/labs.repository.js';
import { reservationsRepository } from '../reservations/reservations.repository.js';
import { usersRepository } from '../users/users.repository.js';

export const adminRouter = Router();

// Mediación completa y falla cerrado: TODO lo que cuelga de /admin exige autenticación Y rol admin.
// Si mañana se agrega una ruta nueva aquí, hereda la protección sin que nadie tenga que acordarse.
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/reservations', (_req, res) => {
  res.json(reservationsRepository.findAll());
});

adminRouter.post('/labs', (req, res) => {
  const { name, building, capacity } = req.body;
  if (!name || !building || !capacity) throw new HttpError(400, 'name, building y capacity son obligatorios');
  res.status(201).json(labsRepository.create(req.body));
});

adminRouter.delete('/users/:id', (req, res) => {
  if (!usersRepository.remove(req.params.id)) throw new HttpError(404, 'Usuario no encontrado');
  res.status(204).end();
});
