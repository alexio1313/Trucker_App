import { app } from './app';
import { env } from './config/env';
import { logger } from './logger';

const server = app.listen(env.PORT, () => {
  logger.info(`API Gateway listening on port ${env.PORT}`, { env: env.NODE_ENV });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});
