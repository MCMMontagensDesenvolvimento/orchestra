import type { Request, Response } from 'express';
import { usersService } from './users.service';

export const usersController = {
  async list(req: Request, res: Response) {
    const result = await usersService.list(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async get(req: Request, res: Response) {
    const data = await usersService.get(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async create(req: Request, res: Response) {
    const data = await usersService.create(req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async update(req: Request, res: Response) {
    const data = await usersService.update(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },
  async remove(req: Request, res: Response) {
    await usersService.remove(req.params.id, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(204).send();
  },
};
