import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Pool } from 'pg';
import { env } from './config/env';
import { logger } from './logger';
import { startEventConsumer, stopEventConsumer } from './kafka/event.consumer';

const app = express();
const pool = new Pool({ connectionString: env.DATABASE_URL });

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

// REST: list and mark-read notifications
app.get('/api/v1/notifications', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = Math.min(parseInt(req.query['pageSize'] as string) || 20, 50);
  const unreadOnly = req.query['unreadOnly'] === 'true';
  const offset = (page - 1) * pageSize;

  const conditions = ['user_id = $1'];
  const params: unknown[] = [userId];
  if (unreadOnly) conditions.push('is_read = false');

  const rows = await pool.query(
    `SELECT * FROM notifications WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [...params, pageSize, offset],
  );

  const count = await pool.query(
    `SELECT COUNT(*) FROM notifications WHERE ${conditions.join(' AND ')}`,
    params,
  );

  const total = parseInt(count.rows[0].count, 10);
  res.json({
    success: true,
    data: {
      items: rows.rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNextPage: page * pageSize < total, hasPrevPage: page > 1 },
    },
  });
});

app.patch('/api/v1/notifications/:id/read', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  await pool.query(
    'UPDATE notifications SET is_read = true, read_at = NOW() WHERE notification_id = $1 AND user_id = $2',
    [req.params.id, userId],
  );
  res.json({ success: true, data: null });
});

app.post('/api/v1/notifications/mark-all-read', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const result = await pool.query(
    'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false',
    [userId],
  );
  res.json({ success: true, data: { count: result.rowCount ?? 0 } });
});

app.patch('/api/v1/notifications/fcm-token', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { fcmToken } = req.body as { fcmToken: string };
  await pool.query('UPDATE users SET fcm_token = $2 WHERE user_id = $1', [userId, fcmToken]);
  res.json({ success: true, data: null });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

const server = app.listen(env.PORT, async () => {
  logger.info(`Notification Service listening on port ${env.PORT}`);
  try {
    await startEventConsumer();
  } catch (err) {
    logger.error('Failed to start Kafka consumer', { error: (err as Error).message });
  }
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  await stopEventConsumer();
  await pool.end();
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});

export { app };
