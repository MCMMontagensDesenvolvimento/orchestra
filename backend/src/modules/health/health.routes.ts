import { Router } from 'express';
import { healthController } from './health.controller';
import type { HealthServiceDependencies } from './health.service';

export type HealthDependencies = HealthServiceDependencies;

export function createHealthRouter(dependencies: HealthDependencies = {}) {
  const router = Router();

  router.get('/', (req, res, next) => {
    void healthController.check(req, res).catch(next);
  });
  router.get('/db', (req, res, next) => {
    void healthController.checkDb(req, res, dependencies).catch(next);
  });

  return router;
}
