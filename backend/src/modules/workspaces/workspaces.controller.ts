import type { Request, Response } from 'express';
import { workspacesService } from './workspaces.service';

export const workspacesController = {
  async list(req: Request, res: Response) {
    const result = await workspacesService.list(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async get(req: Request, res: Response) {
    const data = await workspacesService.get(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async create(req: Request, res: Response) {
    const data = await workspacesService.create(req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async update(req: Request, res: Response) {
    const data = await workspacesService.update(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
