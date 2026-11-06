import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import { usersRepository } from './users.repository';
import type { UserCreateInput, UsersQuery, UserUpdateInput } from './users.schema';

interface AuditContext { requestId: string; ipAddress?: string; userAgent?: string }

function mapUser(user: {
  id: string; tenantId: string; email: string; name: string; status: string;
  lastLoginAt: Date | null; createdAt: Date; updatedAt: Date;
  roles?: Array<{ role: { id: string; name: string; description: string | null } }>;
  memberships?: Array<{ workspace: { id: string; name: string; slug: string }; role: string }>;
}) {
  return {
    id: user.id, tenantId: user.tenantId, email: user.email,
    name: user.name, status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    roles: user.roles?.map((item) => ({
      id: item.role.id, name: item.role.name, description: item.role.description,
    })) ?? [],
    workspaces: user.memberships?.map((item) => ({
      id: item.workspace.id, name: item.workspace.name, slug: item.workspace.slug, role: item.role,
    })) ?? [],
  };
}

async function audit(action: string, targetId: string, user: AuthenticatedUser, context: AuditContext, fields?: string[]) {
  await recordAuditEvent({
    tenantId: user.tenant.id, actorUserId: user.id, action,
    entity: 'user', entityId: targetId,
    ...(fields ? { metadata: { fields: fields.join(',') } } : {}),
    requestId: context.requestId,
    ipAddress: context.ipAddress, userAgent: context.userAgent,
  });
}

function ensureRoleManagement(user: AuthenticatedUser, roleId?: string) {
  if (roleId && !user.permissions.includes('roles.manage')) {
    throw new AppError(403, 'FORBIDDEN', 'Alteracao de perfil exige permissao de gerenciamento de roles.');
  }
}

export const usersService = {
  async list(user: AuthenticatedUser, query: UsersQuery) {
    const result = await usersRepository.list(user.tenant.id, query);
    return { data: result.data.map(mapUser), pagination: paginationMeta(query, result.total) };
  },

  async get(id: string, user: AuthenticatedUser) {
    const target = await usersRepository.findById(id, user.tenant.id);
    if (!target) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario nao encontrado.');
    return mapUser(target);
  },

  async create(input: UserCreateInput, user: AuthenticatedUser, context: AuditContext) {
    ensureRoleManagement(user, input.roleId);
    const existing = await usersRepository.findByEmail(input.email);
    if (existing) throw new AppError(409, 'USER_EMAIL_ALREADY_EXISTS', 'Ja existe usuario com este e-mail.');
    const created = await usersRepository.create({ ...input, tenantId: user.tenant.id });
    await audit('user_created', created.id, user, context, ['name', 'email', 'status', 'role']);
    return mapUser(created);
  },

  async update(id: string, input: UserUpdateInput, user: AuthenticatedUser, context: AuditContext) {
    ensureRoleManagement(user, input.roleId);
    const updated = await usersRepository.update(id, user.tenant.id, input, user.id);
    if (!updated) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario nao encontrado.');
    await audit('user_updated', updated.id, user, context, Object.keys(input));
    return mapUser(updated);
  },

  async remove(id: string, user: AuthenticatedUser, context: AuditContext) {
    const removed = await usersRepository.remove(id, user.tenant.id, user.id);
    if (!removed) throw new AppError(404, 'USER_NOT_FOUND', 'Usuario nao encontrado.');
    await audit('user_deleted', removed.id, user, context);
    return mapUser(removed);
  },
};
