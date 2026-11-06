import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../shared/errors/app-error';
import { paginationOffset } from '../../shared/validation/pagination';
import type { UserCreateInput, UsersQuery, UserUpdateInput } from './users.schema';

const userInclude = {
  roles: { include: { role: true } },
  memberships: { include: { workspace: true } },
} as const;

async function principalWorkspace(tx: Prisma.TransactionClient, tenantId: string) {
  const workspace = await tx.workspace.findUnique({
    where: { tenantId_slug: { tenantId, slug: 'principal' } },
  });
  if (!workspace || workspace.status !== 'active' || workspace.deletedAt) {
    throw new AppError(409, 'USER_WORKSPACE_UNAVAILABLE', 'Workspace principal indisponivel.');
  }
  return workspace;
}

async function resolveRole(tx: Prisma.TransactionClient, tenantId: string, roleId?: string) {
  const role = roleId
    ? await tx.role.findFirst({ where: { id: roleId, tenantId } })
    : await tx.role.findUnique({ where: { tenantId_name: { tenantId, name: 'consumer' } } });
  if (!role) throw new AppError(422, 'USER_ROLE_INVALID', 'Perfil nao encontrado neste tenant.');
  return role;
}

async function protectAdmin(tx: Prisma.TransactionClient, targetId: string, tenantId: string) {
  const adminRole = await tx.userRole.findFirst({
    where: { userId: targetId, role: { tenantId, name: 'admin_platform' } },
  });
  if (!adminRole) return;
  const otherAdmins = await tx.user.count({
    where: {
      tenantId, id: { not: targetId }, deletedAt: null, status: 'active',
      roles: { some: { role: { tenantId, name: 'admin_platform' } } },
    },
  });
  if (otherAdmins === 0) {
    throw new AppError(409, 'LAST_ADMIN_PROTECTED', 'O ultimo administrador ativo nao pode ser removido.');
  }
}

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
        where, include: userInclude,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.user.count({ where }),
    ]);
    return { data, total };
  },

  findById(id: string, tenantId: string) {
    return prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null }, include: userInclude,
    });
  },

  findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
  },

  create(input: UserCreateInput & { tenantId: string }) {
    return prisma.$transaction(async (tx) => {
      const workspace = await principalWorkspace(tx, input.tenantId);
      const role = await resolveRole(tx, input.tenantId, input.roleId);
      return tx.user.create({
        data: {
          tenantId: input.tenantId, email: input.email, name: input.name,
          status: input.status, passwordHash: null,
          memberships: { create: { workspaceId: workspace.id, role: 'member' } },
          roles: { create: { roleId: role.id, workspaceId: workspace.id } },
        },
        include: userInclude,
      });
    });
  },

  update(id: string, tenantId: string, input: UserUpdateInput, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!target) return null;
      if (target.id === actorUserId && (input.roleId || input.status === 'inactive')) {
        throw new AppError(409, 'SELF_MANAGEMENT_BLOCKED', 'Nao e permitido alterar seu proprio perfil ou desativar sua conta.');
      }
      let role: Awaited<ReturnType<typeof resolveRole>> | undefined;
      if (input.roleId) role = await resolveRole(tx, tenantId, input.roleId);
      const adminChange = (input.status === 'inactive' && target.status === 'active')
        || (role && role.name !== 'admin_platform');
      if (adminChange) await protectAdmin(tx, id, tenantId);
      if (role) {
        const workspace = await principalWorkspace(tx, tenantId);
        await tx.userRole.deleteMany({ where: { userId: id, role: { tenantId } } });
        await tx.userRole.create({
          data: { userId: id, roleId: role.id, workspaceId: workspace.id },
        });
        await tx.workspaceMembership.upsert({
          where: { userId_workspaceId: { userId: id, workspaceId: workspace.id } },
          create: { userId: id, workspaceId: workspace.id, role: 'member' },
          update: {},
        });
      }
      return tx.user.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        include: userInclude,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  remove(id: string, tenantId: string, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      if (id === actorUserId) {
        throw new AppError(409, 'SELF_DELETE_BLOCKED', 'Nao e permitido excluir sua propria conta.');
      }
      const target = await tx.user.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!target) return null;
      await protectAdmin(tx, id, tenantId);
      return tx.user.update({
        where: { id }, data: { status: 'inactive', deletedAt: new Date() },
        include: userInclude,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },
};
