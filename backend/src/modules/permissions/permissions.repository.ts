import { prisma } from '../../infrastructure/prisma/prisma.service';

export const permissionsRepository = {
  list() {
    return prisma.permission.findMany({
      orderBy: { key: 'asc' },
    });
  },
};
