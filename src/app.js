import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { apiRouter } from './routes.js';
import { apiLimiter } from './middlewares/rate-limit.js';
import { errorHandler } from './middlewares/error-handler.js';
import { HttpError } from './utils/http-error.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use(morgan('dev'));
  app.use(express.static('public'));

  app.use('/api', apiLimiter, apiRouter);

  app.use(() => {
    throw new HttpError(404, 'Ruta no encontrada');
  });
  app.use(errorHandler);

  return app;
}
