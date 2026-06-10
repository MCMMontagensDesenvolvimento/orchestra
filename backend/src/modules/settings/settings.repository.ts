import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type { SettingsQuery } from './settings.schema';

export const settingsRepository = {
  async list(tenantId: string, workspaceIds: string[], query: SettingsQuery) {
    const workspaceFilter: Prisma.SettingWhereInput[] = query.workspaceId
      ? [{ workspaceId: query.workspaceId }]
      : [{ workspaceId: null }, { workspaceId: { in: workspaceIds } }];
    const where: Prisma.SettingWhereInput = {
      tenantId,
      OR: workspaceFilter,
      ...(query.search
        ? {
            key: { contains: query.search, mode: 'insensitive' },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.setting.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.setting.count({ where }),
    ]);
    return { data, total };
  },
};
