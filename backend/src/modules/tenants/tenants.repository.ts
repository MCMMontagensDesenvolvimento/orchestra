import { prisma } from '../../infrastructure/prisma/prisma.service';

export const tenantsRepository = {
  list() {
    return prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  },
};
