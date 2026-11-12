import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../utils/http-error.js';
import { requireAuth } from '../../middlewares/auth.js';
import { parseId } from '../../utils/parse-id.js';
import { validate } from '../../utils/validate.js';
import { audit } from '../../lib/audit.js';
import { labsRepository } from '../labs/labs.repository.js';
import { reservationsRepository } from './reservations.repository.js';

export const reservationsRouter = Router();

reservationsRouter.use(requireAuth);

const isRealDate = (value) => {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

// Schema estricto: tipos, rangos y largos; campos desconocidos (p. ej. userId) => 400.
const reservationSchema = z
  .strictObject({
    labId: z.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'formato YYYY-MM-DD').refine(isRealDate, 'fecha inexistente'),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    purpose: z.string().trim().min(3).max(200),
  })
  .refine((r) => r.startHour < r.endHour, { message: 'La hora de inicio debe ser menor que la de fin', path: ['endHour'] });

// Mis reservas
reservationsRouter.get('/', (req, res) => {
  res.json(reservationsRepository.findByUser(req.user.id));
});

reservationsRouter.get('/:id', (req, res) => {
  // El userId sale del token verificado, nunca de la URL ni del body.
  const reservation = reservationsRepository.findById(parseId(req.params.id), req.user.id);
  // 404 (no 403) para una reserva ajena: no confirma que exista.
  if (!reservation) {
    audit('reserva_ajena_o_inexistente', req, { reservationId: req.params.id });
    throw new HttpError(404, 'Reserva no encontrada');
  }
  res.json(reservation);
});

reservationsRouter.post('/', (req, res) => {
  const { labId, date, startHour, endHour, purpose } = validate(reservationSchema, req.body);
  if (!labsRepository.findById(labId)) throw new HttpError(404, 'Laboratorio no encontrado');
  if (reservationsRepository.findOverlapping(labId, date, startHour, endHour)) {
    throw new HttpError(409, 'El laboratorio ya está reservado en ese horario');
  }

  const reservation = reservationsRepository.create({
    labId,
    userId: req.user.id,
    date,
    startHour,
    endHour,
    purpose,
  });
  res.status(201).json(reservation);
});

reservationsRouter.delete('/:id', (req, res) => {
  if (!reservationsRepository.remove(parseId(req.params.id), req.user.id)) {
    audit('cancelacion_denegada', req, { reservationId: req.params.id });
    throw new HttpError(404, 'Reserva no encontrada');
  }
  audit('reserva_cancelada', req, { reservationId: req.params.id });
  res.status(204).end();
});
