import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Registry, collectDefaultMetrics } from 'prom-client';
import { paymentRoutes } from './payments/payment.routes';
import { logger } from './logger';
import { env } from './config/env';
import { pool } from './db/postgres';

const app = express();
const register = new Registry();
collectDefaultMetrics({ register });

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'payment-service', timestamp: new Date().toISOString() });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/v1/payments', paymentRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

const server = app.listen(env.PORT, () => {
  logger.info(`Payment Service listening on port ${env.PORT}`);
});

process.on('SIGTERM', async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});

export { app };
