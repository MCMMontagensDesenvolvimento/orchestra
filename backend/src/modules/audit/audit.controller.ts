import type { Request, Response } from 'express';
import { auditService } from './audit.service';

export const auditController = {
  async list(req: Request, res: Response) {
    const result = await auditService.list(req.user!.tenant.id, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },
};
