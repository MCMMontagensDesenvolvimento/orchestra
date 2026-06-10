import type { Request, Response } from 'express';
import { rolesService } from './roles.service';

export const rolesController = {
  async list(req: Request, res: Response) {
    const result = await rolesService.list(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async get(req: Request, res: Response) {
    const data = await rolesService.get(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async create(req: Request, res: Response) {
    const data = await rolesService.create(req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async update(req: Request, res: Response) {
    const data = await rolesService.update(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async addPermission(req: Request, res: Response) {
    const data = await rolesService.addPermission(req.params.id, req.params.permissionId, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async removePermission(req: Request, res: Response) {
    const data = await rolesService.removePermission(req.params.id, req.params.permissionId, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
