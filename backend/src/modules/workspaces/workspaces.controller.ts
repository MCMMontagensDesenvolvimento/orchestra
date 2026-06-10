import type { Request, Response } from 'express';
import { workspacesRepository } from './workspaces.repository';

export const workspacesController = {
  async list(req: Request, res: Response) {
    const data = await workspacesRepository.list(req.user!.tenant.id);
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
