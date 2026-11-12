import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { apiRouter } from './routes.js';
import { config } from './config.js';
import { apiLimiter } from './middlewares/rate-limit.js';
import { errorHandler } from './middlewares/error-handler.js';
import { HttpError } from './utils/http-error.js';

export function createApp() {
  const app = express();

  // Headers de seguridad (CSP, nosniff, anti-clickjacking, HSTS) y sin X-Powered-By.
  // upgrade-insecure-requests solo en producción: en http://localhost rompe la carga de recursos en algunos navegadores.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: config.isProduction ? [] : null } },
    }),
  );
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '10kb' }));
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  app.use(express.static('public'));

  app.use('/api', apiLimiter, apiRouter);

  app.use(() => {
    throw new HttpError(404, 'Ruta no encontrada');
  });
  app.use(errorHandler);

  return app;
}
