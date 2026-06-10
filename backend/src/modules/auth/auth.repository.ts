import { prisma } from '../../infrastructure/prisma/prisma.service';

export const authRepository = {
  async findUserForLogin(email?: string) {
    return prisma.user.findFirst({
      where: email ? { email, deletedAt: null } : { deletedAt: null },
      include: {
        tenant: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        memberships: {
          include: {
            workspace: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async updateLastLogin(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  },
};
