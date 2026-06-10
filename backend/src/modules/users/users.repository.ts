import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type { UserCreateInput, UsersQuery, UserUpdateInput } from './users.schema';

export const usersRepository = {
  async list(tenantId: string, query: UsersQuery) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          roles: { include: { role: true } },
          memberships: { include: { workspace: true } },
        },
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.user.count({ where }),
    ]);
    return { data, total };
  },

  findById(id: string, tenantId: string) {
    return prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        roles: { include: { role: true } },
        memberships: { include: { workspace: true } },
      },
    });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
  },

  create(input: UserCreateInput & { tenantId: string }) {
    return prisma.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        name: input.name,
        status: input.status,
      },
      include: {
        roles: { include: { role: true } },
        memberships: { include: { workspace: true } },
      },
    });
  },

  async update(id: string, tenantId: string, input: UserUpdateInput) {
    const existing = await prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
      },
    });
    if (!existing) {
      return null;
    }
    return prisma.user.update({
      where: { id: existing.id },
      data: input,
      include: {
        roles: { include: { role: true } },
        memberships: { include: { workspace: true } },
      },
    });
  },
};
