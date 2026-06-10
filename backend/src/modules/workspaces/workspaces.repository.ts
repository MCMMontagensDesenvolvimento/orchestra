import { prisma } from '../../infrastructure/prisma/prisma.service';

export const workspacesRepository = {
  list(tenantId: string) {
    return prisma.workspace.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  },
};
