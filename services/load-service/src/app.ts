import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Registry, collectDefaultMetrics } from 'prom-client';
import { loadRoutes } from './loads/load.routes';
import { logger } from './logger';

const app = express();
const register = new Registry();
collectDefaultMetrics({ register });

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`, { userId: req.headers['x-user-id'] });
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'load-service', timestamp: new Date().toISOString() });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/v1/loads', loadRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

export { app };
