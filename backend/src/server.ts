import { createApp } from './app/app';
import { env } from './config/env';
import { logger } from './infrastructure/logger/logger';
import { prisma } from './infrastructure/prisma/prisma.service';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Orchestra backend listening');
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down backend');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
