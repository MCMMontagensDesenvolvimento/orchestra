import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import { usersRepository } from './users.repository';
import type { UserCreateInput, UsersQuery, UserUpdateInput } from './users.schema';

function mapUser(user: {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles?: Array<{ role: { id: string; name: string; description: string | null } }>;
  memberships?: Array<{ workspace: { id: string; name: string; slug: string }; role: string }>;
}) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    roles: user.roles?.map((userRole) => ({
      id: userRole.role.id,
      name: userRole.role.name,
      description: userRole.role.description,
    })) ?? [],
    workspaces: user.memberships?.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
    })) ?? [],
  };
}

export const usersService = {
  async list(user: AuthenticatedUser, query: UsersQuery) {
    const result = await usersRepository.list(user.tenant.id, query);
    return {
      data: result.data.map(mapUser),
      pagination: paginationMeta(query, result.total),
    };
  },

  async get(id: string, user: AuthenticatedUser) {
    const targetUser = await usersRepository.findById(id, user.tenant.id);
    if (!targetUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuario nao encontrado.');
    }
    return mapUser(targetUser);
  },

  async create(
    input: UserCreateInput,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const existing = await usersRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError(409, 'USER_EMAIL_ALREADY_EXISTS', 'Ja existe usuario com este e-mail.');
    }
    const created = await usersRepository.create({ ...input, tenantId: user.tenant.id });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      actorUserId: user.id,
      action: 'user_created',
      entity: 'user',
      entityId: created.id,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapUser(created);
  },

  async update(
    id: string,
    input: UserUpdateInput,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const updated = await usersRepository.update(id, user.tenant.id, input);
    if (!updated) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuario nao encontrado.');
    }
    await recordAuditEvent({
      tenantId: user.tenant.id,
      actorUserId: user.id,
      action: 'user_updated',
      entity: 'user',
      entityId: updated.id,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapUser(updated);
  },
};
