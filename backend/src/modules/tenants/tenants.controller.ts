import type { Request, Response } from 'express';
import { tenantsRepository } from './tenants.repository';

export const tenantsController = {
  async list(req: Request, res: Response) {
    const data = await tenantsRepository.list();
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
