import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type { TenantsQuery, TenantUpdateInput } from './tenants.schema';

export const tenantsRepository = {
  async list(tenantId: string, query: TenantsQuery) {
    const where = {
      id: tenantId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { slug: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.tenant.count({ where }),
    ]);
    return { data, total };
  },

  findById(id: string, tenantId: string) {
    return prisma.tenant.findFirst({
      where: { id, deletedAt: null, users: { some: { tenantId } } },
    });
  },

  async update(id: string, tenantId: string, input: TenantUpdateInput) {
    const existing = await prisma.tenant.findFirst({
      where: { id, deletedAt: null, users: { some: { tenantId } } },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    return prisma.tenant.update({
      where: { id: existing.id },
      data: input,
    });
  },
};
