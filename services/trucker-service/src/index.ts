import { httpServer } from './app';
import { env } from './config/env';
import { logger } from './logger';
import { pool } from './db/postgres';

const server = httpServer.listen(env.PORT, () => {
  logger.info(`Trucker Service listening on port ${env.PORT}`, { env: env.NODE_ENV });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(async () => {
    await pool.end();
    logger.info('Trucker Service shut down');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});
