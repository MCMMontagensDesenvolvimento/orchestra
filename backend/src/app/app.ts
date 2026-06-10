import express from 'express';
import { registerMiddlewares } from './middlewares';
import { registerRoutes, type AppDependencies } from './routes';
import { errorHandler } from '../shared/middleware/error-handler.middleware';
import { notFoundMiddleware } from '../shared/middleware/not-found.middleware';

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  registerMiddlewares(app);
  registerRoutes(app, dependencies);
  app.use(notFoundMiddleware);
  app.use(errorHandler);

  return app;
}
