import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Registry, collectDefaultMetrics } from 'prom-client';
import { usersRoutes } from './admin/users.routes';
import { kycRoutes } from './admin/kyc.routes';
import { analyticsRoutes } from './admin/analytics.routes';
import { disputesRoutes } from './admin/disputes.routes';
import { featureFlagsRoutes } from './admin/feature-flags.routes';
import { logger } from './logger';
import { env } from './config/env';
import { pool } from './db/postgres';

const app = express();
const register = new Registry();
collectDefaultMetrics({ register });

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'admin-service', timestamp: new Date().toISOString() });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Audit logs endpoint
app.get('/api/v1/admin/audit-logs', async (req, res) => {
  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = Math.min(parseInt(req.query['pageSize'] as string) || 20, 100);
  const userId = req.query['userId'] as string | undefined;
  const offset = (page - 1) * pageSize;
  const conditions = userId ? ['user_id = $1'] : [];
  const params: unknown[] = userId ? [userId, pageSize, offset] : [pageSize, offset];
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitIdx = userId ? 2 : 1;
  const rows = await pool.query(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${limitIdx + 1}`,
    params,
  );
  res.json({ success: true, data: { items: rows.rows } });
});

app.use('/api/v1/admin/users', usersRoutes);
app.use('/api/v1/admin/kyc', kycRoutes);
app.use('/api/v1/admin/analytics', analyticsRoutes);
app.use('/api/v1/admin/disputes', disputesRoutes);
app.use('/api/v1/admin/feature-flags', featureFlagsRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

const server = app.listen(env.PORT, () => {
  logger.info(`Admin Service listening on port ${env.PORT}`);
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
