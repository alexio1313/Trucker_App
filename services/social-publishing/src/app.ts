import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Registry, collectDefaultMetrics } from 'prom-client';
import { socialRoutes } from './social/social.routes';
import { logger } from './logger';
import { env } from './config/env';
import { disconnectMongo } from './db/mongo';

const app = express();
const register = new Registry();
collectDefaultMetrics({ register });

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'social-publishing', timestamp: new Date().toISOString() });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/v1/social/posts', socialRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

const server = app.listen(env.PORT, () => {
  logger.info(`Social Publishing Service listening on port ${env.PORT}`);
});

process.on('SIGTERM', async () => {
  server.close(async () => {
    await disconnectMongo();
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});

export { app };
