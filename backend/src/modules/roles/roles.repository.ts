import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type { RoleCreateInput, RolesQuery, RoleUpdateInput } from './roles.schema';

export const rolesRepository = {
  async list(tenantId: string, query: RolesQuery) {
    const where = {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.role.findMany({
        where,
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.role.count({ where }),
    ]);
    return { data, total };
  },

  findById(id: string, tenantId: string) {
    return prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        permissions: { include: { permission: true } },
      },
    });
  },

  create(input: RoleCreateInput & { tenantId: string }) {
    return prisma.role.create({
      data: input,
      include: {
        permissions: { include: { permission: true } },
      },
    });
  },

  async update(id: string, tenantId: string, input: RoleUpdateInput) {
    const existing = await prisma.role.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    return prisma.role.update({
      where: { id: existing.id },
      data: input,
      include: {
        permissions: { include: { permission: true } },
      },
    });
  },

  async addPermission(roleId: string, tenantId: string, permissionId: string) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, tenantId },
      select: { id: true },
    });
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
      select: { id: true },
    });
    if (!role || !permission) {
      return null;
    }
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
    return this.findById(role.id, tenantId);
  },

  async removePermission(roleId: string, tenantId: string, permissionId: string) {
    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId,
        permissionId,
        role: { tenantId },
      },
      select: { id: true, roleId: true },
    });
    if (!rolePermission) {
      return null;
    }
    await prisma.rolePermission.delete({ where: { id: rolePermission.id } });
    return this.findById(rolePermission.roleId, tenantId);
  },
};
