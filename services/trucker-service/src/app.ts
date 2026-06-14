import express from 'express';
import { createServer } from 'http';
import helmet from 'helmet';
import cors from 'cors';
import { Registry, collectDefaultMetrics } from 'prom-client';
import { authRoutes } from './auth/auth.routes';
import { trackingRoutes } from './tracking/tracking.routes';
import { setupTrackingGateway } from './websocket/tracking.gateway';
import { logger } from './logger';

const app = express();
const httpServer = createServer(app);
const register = new Registry();
collectDefaultMetrics({ register });

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'trucker-service', timestamp: new Date().toISOString() });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tracking', trackingRoutes);

// Trucker availability endpoint
app.patch('/api/v1/truckers/availability', async (req, res) => {
  const { setTruckerAvailability } = await import('./tracking/tracking.service');
  const userId = req.headers['x-user-id'] as string;
  const { status } = req.body as { status: 'available' | 'offline' };
  if (!status || !['available', 'offline'].includes(status)) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Status must be available or offline' } });
    return;
  }
  await setTruckerAvailability(userId, status);
  res.json({ success: true, data: { status } });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

const io = setupTrackingGateway(httpServer);

export { app, httpServer, io };
