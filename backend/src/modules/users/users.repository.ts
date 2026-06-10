import { prisma } from '../../infrastructure/prisma/prisma.service';

export const usersRepository = {
  list(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  },
};
