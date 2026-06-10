import { AppError } from '../../shared/errors/app-error';
import { paginationMeta } from '../../shared/validation/pagination';
import { permissionsRepository } from './permissions.repository';
import type { PermissionsQuery } from './permissions.schema';

function mapPermission(permission: {
  id: string;
  key: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: permission.id,
    key: permission.key,
    description: permission.description,
    createdAt: permission.createdAt.toISOString(),
    updatedAt: permission.updatedAt.toISOString(),
  };
}

export const permissionsService = {
  async list(query: PermissionsQuery) {
    const result = await permissionsRepository.list(query);
    return {
      data: result.data.map(mapPermission),
      pagination: paginationMeta(query, result.total),
    };
  },

  async get(id: string) {
    const permission = await permissionsRepository.findById(id);
    if (!permission) {
      throw new AppError(404, 'PERMISSION_NOT_FOUND', 'Permissao nao encontrada.');
    }
    return mapPermission(permission);
  },
};
