import type { Request, Response } from 'express';
import { auditService } from './audit.service';

export const auditController = {
  async list(req: Request, res: Response) {
    const data = await auditService.list(req.user!.tenant.id);
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
