import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import { rolesRepository } from './roles.repository';
import type { RoleCreateInput, RolesQuery, RoleUpdateInput } from './roles.schema';

function mapRole(role: {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  permissions: Array<{ permission: { id: string; key: string; description: string | null } }>;
}) {
  return {
    id: role.id,
    tenantId: role.tenantId,
    name: role.name,
    description: role.description,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
    permissions: role.permissions.map((rolePermission) => ({
      id: rolePermission.permission.id,
      key: rolePermission.permission.key,
      description: rolePermission.permission.description,
    })),
  };
}

export const rolesService = {
  async list(user: AuthenticatedUser, query: RolesQuery) {
    const result = await rolesRepository.list(user.tenant.id, query);
    return {
      data: result.data.map(mapRole),
      pagination: paginationMeta(query, result.total),
    };
  },

  async get(id: string, user: AuthenticatedUser) {
    const role = await rolesRepository.findById(id, user.tenant.id);
    if (!role) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role nao encontrada.');
    }
    return mapRole(role);
  },

  async create(
    input: RoleCreateInput,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const role = await rolesRepository.create({ ...input, tenantId: user.tenant.id });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      actorUserId: user.id,
      action: 'role_created',
      entity: 'role',
      entityId: role.id,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapRole(role);
  },

  async update(
    id: string,
    input: RoleUpdateInput,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const role = await rolesRepository.update(id, user.tenant.id, input);
    if (!role) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Role nao encontrada.');
    }
    await recordAuditEvent({
      tenantId: user.tenant.id,
      actorUserId: user.id,
      action: 'role_updated',
      entity: 'role',
      entityId: role.id,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapRole(role);
  },

  async addPermission(
    id: string,
    permissionId: string,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const role = await rolesRepository.addPermission(id, user.tenant.id, permissionId);
    if (!role) {
      throw new AppError(404, 'ROLE_OR_PERMISSION_NOT_FOUND', 'Role ou permissao nao encontrada.');
    }
    await recordAuditEvent({
      tenantId: user.tenant.id,
      actorUserId: user.id,
      action: 'role_permission_added',
      entity: 'role',
      entityId: role.id,
      metadata: { permissionId },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapRole(role);
  },

  async removePermission(
    id: string,
    permissionId: string,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const role = await rolesRepository.removePermission(id, user.tenant.id, permissionId);
    if (!role) {
      throw new AppError(404, 'ROLE_PERMISSION_NOT_FOUND', 'Vinculo de permissao nao encontrado.');
    }
    await recordAuditEvent({
      tenantId: user.tenant.id,
      actorUserId: user.id,
      action: 'role_permission_removed',
      entity: 'role',
      entityId: role.id,
      metadata: { permissionId },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapRole(role);
  },
};
