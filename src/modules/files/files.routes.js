import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config.js';
import { HttpError } from '../../utils/http-error.js';

export const filesRouter = Router();

// Lista blanca: solo nombres simples terminados en .txt (sin separadores de ruta ni "..").
const SAFE_NAME = /^[A-Za-z0-9_-]+\.txt$/;

// Manuales de uso de los laboratorios.
// GET /api/files          → lista de manuales
// GET /api/files?name=... → descarga un manual
filesRouter.get('/', (req, res) => {
  const { name } = req.query;
  if (name === undefined) return res.json(fs.readdirSync(config.manualsDir).filter((f) => SAFE_NAME.test(f)));
  if (typeof name !== 'string' || !SAFE_NAME.test(name)) throw new HttpError(400, 'Nombre de manual inválido');

  // Segunda barrera: la ruta resuelta debe quedar DENTRO del directorio de manuales.
  const file = path.resolve(config.manualsDir, name);
  if (path.dirname(file) !== config.manualsDir) throw new HttpError(400, 'Nombre de manual inválido');
  if (!fs.existsSync(file)) throw new HttpError(404, 'Manual no encontrado');
  res.type('text/plain').send(fs.readFileSync(file, 'utf8'));
});
