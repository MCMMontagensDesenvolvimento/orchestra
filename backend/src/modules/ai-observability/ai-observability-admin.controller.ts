import type { Request, Response } from 'express';
import { aiObservabilityAdminService } from './ai-observability-admin.service';

export const aiObservabilityAdminController = {
  async listUsageEvents(req: Request, res: Response) {
    const result = await aiObservabilityAdminService.listUsageEvents(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async getUsageEvent(req: Request, res: Response) {
    const data = await aiObservabilityAdminService.getUsageEvent(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async summarizeUsage(req: Request, res: Response) {
    const result = await aiObservabilityAdminService.summarizeUsage(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async listLimitPolicies(req: Request, res: Response) {
    const result = await aiObservabilityAdminService.listLimitPolicies(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async getLimitPolicy(req: Request, res: Response) {
    const data = await aiObservabilityAdminService.getLimitPolicy(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async evaluateLimits(req: Request, res: Response) {
    const data = await aiObservabilityAdminService.evaluateLimits(req.user!, req.body);
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
