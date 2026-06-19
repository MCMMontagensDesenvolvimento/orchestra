import { prisma } from '../../infrastructure/prisma/prisma.service';

const userForAuthInclude = {
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
} as const;

export const authRepository = {
  async findUserForLogin(email?: string) {
    return prisma.user.findFirst({
      where: email ? { email, deletedAt: null } : { deletedAt: null },
      include: userForAuthInclude,
      orderBy: { createdAt: 'asc' },
    });
  },

  async findUserForSso(email: string) {
    return prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      include: userForAuthInclude,
    });
  },

  async findUsersForSsoAutoLink(email: string) {
    return prisma.user.findMany({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      include: userForAuthInclude,
    });
  },

  async findExternalIdentityForSso(input: {
    provider: string;
    providerTenantId: string;
    providerUserId: string;
  }) {
    return prisma.externalIdentity.findFirst({
      where: {
        provider: input.provider,
        providerTenantId: input.providerTenantId,
        providerUserId: input.providerUserId,
        deletedAt: null,
      },
      include: {
        user: {
          include: userForAuthInclude,
        },
      },
    });
  },

  async findActiveExternalIdentityForUserProvider(input: {
    provider: string;
    userId: string;
  }) {
    return prisma.externalIdentity.findFirst({
      where: {
        provider: input.provider,
        userId: input.userId,
        deletedAt: null,
      },
    });
  },

  async createExternalIdentity(input: {
    tenantId: string;
    userId: string;
    provider: string;
    providerTenantId: string;
    providerUserId: string;
    issuer: string;
    email: string;
    emailVerified: boolean;
    displayName?: string | null;
    linkedAt: Date;
    lastLoginAt: Date;
  }) {
    return prisma.externalIdentity.create({
      data: input,
    });
  },

  async updateExternalIdentityLogin(input: {
    id: string;
    issuer: string;
    email: string;
    emailVerified: boolean;
    displayName?: string | null;
    lastLoginAt: Date;
  }) {
    return prisma.externalIdentity.update({
      where: { id: input.id },
      data: {
        issuer: input.issuer,
        email: input.email,
        emailVerified: input.emailVerified,
        displayName: input.displayName ?? null,
        lastLoginAt: input.lastLoginAt,
      },
    });
  },

  async updateLastLogin(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  },
};
