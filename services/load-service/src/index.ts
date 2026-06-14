import { app } from './app';
import { env } from './config/env';
import { logger } from './logger';
import { disconnectKafka } from './db/kafka';
import { pool } from './db/postgres';

const server = app.listen(env.PORT, () => {
  logger.info(`Load Service listening on port ${env.PORT}`, { env: env.NODE_ENV });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(async () => {
    await disconnectKafka();
    await pool.end();
    logger.info('Load Service shut down');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});
