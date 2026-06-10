import type { Request, Response } from 'express';
import { usersRepository } from './users.repository';

export const usersController = {
  async list(req: Request, res: Response) {
    const data = await usersRepository.list(req.user!.tenant.id);
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
