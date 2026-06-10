import type { Request, Response } from 'express';
import { settingsService } from './settings.service';

export const settingsController = {
  async list(req: Request, res: Response) {
    const result = await settingsService.list(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },
};
