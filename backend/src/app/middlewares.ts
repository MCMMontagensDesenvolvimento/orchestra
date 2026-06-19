import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from '../config/env';
import { logger } from '../infrastructure/logger/logger';
import { requestIdMiddleware } from '../shared/middleware/request-id.middleware';

export function registerMiddlewares(app: express.Express) {
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({
        requestId: req.requestId,
        userId: req.user?.id,
        tenantId: req.user?.tenant.id,
      }),
      autoLogging: {
        ignore: (req) =>
          req.url === '/health'
          || req.url?.startsWith('/api/v1/auth/microsoft/callback'),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
}

export const authRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
