import { Router } from 'express';
import { statusService, type StatusServiceDependencies } from './status.service';

export type StatusDependencies = StatusServiceDependencies;

export function createStatusRouter(dependencies: StatusDependencies = {}) {
  const router = Router();

  router.get('/', (_req, res) => {
    return res.status(200).json(statusService.read(dependencies));
  });

  router.get('/availability', (_req, res) => {
    return res.status(200).json(statusService.readAvailability(dependencies));
  });

  return router;
}
