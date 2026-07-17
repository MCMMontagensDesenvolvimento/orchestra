import type { Request, Response } from 'express';
import { runtimeObservabilityService } from './runtime-observability.service';

export const runtimeObservabilityController = {
  async list(req: Request, res: Response) {
    const result = await runtimeObservabilityService.listRuntimeRuns(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async get(req: Request, res: Response) {
    const data = await runtimeObservabilityService.getRuntimeRun(req.user!, req.params.id);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async summary(req: Request, res: Response) {
    const data = await runtimeObservabilityService.summarizeRuntime(req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
