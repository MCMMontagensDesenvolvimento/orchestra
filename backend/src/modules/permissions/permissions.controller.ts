import type { Request, Response } from 'express';
import { permissionsService } from './permissions.service';

export const permissionsController = {
  async list(req: Request, res: Response) {
    const result = await permissionsService.list(req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async get(req: Request, res: Response) {
    const data = await permissionsService.get(req.params.id);
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
