import type { Request, Response } from 'express';
import { tenantsService } from './tenants.service';

export const tenantsController = {
  async list(req: Request, res: Response) {
    const result = await tenantsService.list(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async get(req: Request, res: Response) {
    const data = await tenantsService.get(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async update(req: Request, res: Response) {
    const data = await tenantsService.update(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
