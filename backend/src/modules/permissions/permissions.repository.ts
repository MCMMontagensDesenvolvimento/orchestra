import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type { PermissionsQuery } from './permissions.schema';

export const permissionsRepository = {
  async list(query: PermissionsQuery) {
    const where = query.search
      ? {
          OR: [
            { key: { contains: query.search, mode: 'insensitive' as const } },
            { description: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      prisma.permission.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.permission.count({ where }),
    ]);
    return { data, total };
  },

  findById(id: string) {
    return prisma.permission.findUnique({ where: { id } });
  },
};
