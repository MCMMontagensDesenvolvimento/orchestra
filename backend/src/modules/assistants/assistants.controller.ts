import type { Request, Response } from 'express';
import { assistantsService } from './assistants.service';

export const assistantsController = {
  async list(req: Request, res: Response) {
    const data = await assistantsService.list(req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async get(req: Request, res: Response) {
    const data = await assistantsService.get(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async create(req: Request, res: Response) {
    const data = await assistantsService.create(req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async update(req: Request, res: Response) {
    const data = await assistantsService.update(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
