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

  // Provisionamento opt-in, transacional e limitado ao tenant/workspace MCM.
  // Se um recurso esperado não existir, falha fechado em vez de criar permissões.
  async provisionMicrosoftSsoUser(input: {
    email: string;
    displayName?: string;
    providerTenantId: string;
    providerUserId: string;
    issuer: string;
    emailVerified: boolean;
    linkedAt: Date;
  }) {
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { slug: 'mcm' } });
      if (!tenant || tenant.status !== 'active' || tenant.deletedAt) {
        throw new Error('MCM_SSO_TENANT_UNAVAILABLE');
      }
      const [workspace, role, existing] = await Promise.all([
        tx.workspace.findUnique({ where: {
          tenantId_slug: { tenantId: tenant.id, slug: 'principal' },
        } }),
        tx.role.findUnique({ where: {
          tenantId_name: { tenantId: tenant.id, name: 'consumer' },
        } }),
        tx.user.findFirst({ where: {
          email: { equals: input.email, mode: 'insensitive' },
        } }),
      ]);
      if (!workspace || workspace.status !== 'active' || workspace.deletedAt || !role || existing) {
        throw new Error('MCM_SSO_PROVISION_PRECONDITION_FAILED');
      }

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email,
          name: input.displayName || input.email,
          status: 'active',
          passwordHash: null,
          memberships: { create: { workspaceId: workspace.id, role: 'member' } },
          roles: { create: { roleId: role.id, workspaceId: workspace.id } },
          externalIdentities: { create: {
            tenantId: tenant.id,
            provider: 'microsoft',
            providerTenantId: input.providerTenantId,
            providerUserId: input.providerUserId,
            issuer: input.issuer,
            email: input.email,
            emailVerified: input.emailVerified,
            displayName: input.displayName ?? null,
            linkedAt: input.linkedAt,
            lastLoginAt: input.linkedAt,
          } },
        },
        include: {
          ...userForAuthInclude,
          externalIdentities: { select: { id: true } },
        },
      });
      if (user.externalIdentities.length !== 1) {
        throw new Error('MCM_SSO_PROVISION_IDENTITY_INVALID');
      }
      return { user, externalIdentityId: user.externalIdentities[0].id };
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
