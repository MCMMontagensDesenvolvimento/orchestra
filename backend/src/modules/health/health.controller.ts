import type { Request, Response } from 'express';
import { healthService, type HealthServiceDependencies } from './health.service';

export const healthController = {
  async check(req: Request, res: Response) {
    const result = await healthService.check();
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async checkDb(req: Request, res: Response, dependencies: HealthServiceDependencies = {}) {
    const result = await healthService.checkDb(dependencies);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },
};
