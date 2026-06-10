import type { Request, Response } from 'express';
import { permissionsRepository } from './permissions.repository';

export const permissionsController = {
  async list(req: Request, res: Response) {
    const data = await permissionsRepository.list();
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
