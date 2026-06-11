import type { Request, Response } from 'express';
import { agentRunsService } from './agent-runs.service';

function requestContext(req: Request) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export const agentRunsController = {
  async createForAssistant(req: Request, res: Response) {
    const data = await agentRunsService.createForAssistant(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async listByAssistant(req: Request, res: Response) {
    const result = await agentRunsService.listByAssistant(req.params.id, req.user!, req.query as any, requestContext(req));
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async list(req: Request, res: Response) {
    const result = await agentRunsService.list(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async get(req: Request, res: Response) {
    const data = await agentRunsService.get(req.params.runId, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async events(req: Request, res: Response) {
    const data = await agentRunsService.events(req.params.runId, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async cancel(req: Request, res: Response) {
    const data = await agentRunsService.cancel(req.params.runId, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
