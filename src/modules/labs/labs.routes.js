import { Router } from 'express';
import { HttpError } from '../../utils/http-error.js';
import { requireAuth } from '../../middlewares/auth.js';
import { parseId } from '../../utils/parse-id.js';
import { labsRepository } from './labs.repository.js';

export const labsRouter = Router();

// Público: cualquiera puede ver los laboratorios disponibles.
labsRouter.get('/', (req, res) => {
  const { search } = req.query;
  if (search !== undefined && typeof search !== 'string') throw new HttpError(400, 'search debe ser texto');
  res.json(labsRepository.search(search));
});

labsRouter.get('/:id', (req, res) => {
  const lab = labsRepository.findById(parseId(req.params.id));
  if (!lab) throw new HttpError(404, 'Laboratorio no encontrado');
  res.json({ ...lab, comments: labsRepository.findComments(lab.id) });
});

labsRouter.post('/:id/comments', requireAuth, (req, res) => {
  const lab = labsRepository.findById(parseId(req.params.id));
  if (!lab) throw new HttpError(404, 'Laboratorio no encontrado');
  if (!req.body?.body) throw new HttpError(400, 'El comentario no puede estar vacío');
  res.status(201).json(labsRepository.addComment(lab.id, req.user.id, req.body.body));
});
