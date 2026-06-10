import type { Request, Response } from 'express';
import { rolesRepository } from './roles.repository';

export const rolesController = {
  async list(req: Request, res: Response) {
    const roles = await rolesRepository.list(req.user!.tenant.id);
    const data = roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((rolePermission) => rolePermission.permission.key),
    }));
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
