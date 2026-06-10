import { prisma } from '../../infrastructure/prisma/prisma.service';

export const rolesRepository = {
  list(tenantId: string) {
    return prisma.role.findMany({
      where: { tenantId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  },
};
