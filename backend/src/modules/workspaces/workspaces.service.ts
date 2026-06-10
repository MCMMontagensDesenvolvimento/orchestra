import { AppError } from '../../shared/errors/app-error';
import { hasPermission } from '../../shared/security/rbac';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import { workspacesRepository } from './workspaces.repository';
import type { WorkspaceCreateInput, WorkspacesQuery, WorkspaceUpdateInput } from './workspaces.schema';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function managedWorkspaceIds(user: AuthenticatedUser) {
  return hasPermission(user, 'workspaces.manage') ? undefined : user.workspaces.map((workspace) => workspace.id);
}

function mapWorkspace(workspace: {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: workspace.id,
    tenantId: workspace.tenantId,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    status: workspace.status,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

export const workspacesService = {
  async list(user: AuthenticatedUser, query: WorkspacesQuery) {
    const result = await workspacesRepository.list(user.tenant.id, managedWorkspaceIds(user), query);
    return {
      data: result.data.map(mapWorkspace),
      pagination: paginationMeta(query, result.total),
    };
  },

  async get(id: string, user: AuthenticatedUser) {
    const workspace = await workspacesRepository.findById(id, user.tenant.id, managedWorkspaceIds(user));
    if (!workspace) {
      throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace nao encontrado.');
    }
    return mapWorkspace(workspace);
  },

  async create(
    input: WorkspaceCreateInput,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const workspace = await workspacesRepository.create({
      ...input,
      tenantId: user.tenant.id,
      createdById: user.id,
      slug: input.slug ?? slugify(input.name),
    });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'workspace_created',
      entity: 'workspace',
      entityId: workspace.id,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapWorkspace(workspace);
  },

  async update(
    id: string,
    input: WorkspaceUpdateInput,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const workspace = await workspacesRepository.update(id, user.tenant.id, managedWorkspaceIds(user), input);
    if (!workspace) {
      throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace nao encontrado.');
    }
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'workspace_updated',
      entity: 'workspace',
      entityId: workspace.id,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapWorkspace(workspace);
  },
};
