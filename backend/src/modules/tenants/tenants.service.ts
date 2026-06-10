import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import { tenantsRepository } from './tenants.repository';
import type { TenantsQuery, TenantUpdateInput } from './tenants.schema';

function mapTenant(tenant: {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  };
}

export const tenantsService = {
  async list(user: AuthenticatedUser, query: TenantsQuery) {
    const result = await tenantsRepository.list(user.tenant.id, query);
    return {
      data: result.data.map(mapTenant),
      pagination: paginationMeta(query, result.total),
    };
  },

  async get(id: string, user: AuthenticatedUser) {
    if (id !== user.tenant.id) {
      throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant nao encontrado.');
    }
    const tenant = await tenantsRepository.findById(id, user.tenant.id);
    if (!tenant) {
      throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant nao encontrado.');
    }
    return mapTenant(tenant);
  },

  async update(
    id: string,
    input: TenantUpdateInput,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    if (id !== user.tenant.id) {
      throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant nao encontrado.');
    }
    const tenant = await tenantsRepository.update(id, user.tenant.id, input);
    if (!tenant) {
      throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant nao encontrado.');
    }
    await recordAuditEvent({
      tenantId: user.tenant.id,
      actorUserId: user.id,
      action: 'tenant_updated',
      entity: 'tenant',
      entityId: tenant.id,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapTenant(tenant);
  },
};
