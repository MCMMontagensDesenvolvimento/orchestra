import { AppError } from '../../shared/errors/app-error';
import { hasWorkspaceAccess } from '../../shared/security/rbac';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { settingsRepository } from './settings.repository';
import type { SettingsQuery } from './settings.schema';

function mapSetting(setting: {
  id: string;
  tenantId: string;
  workspaceId: string | null;
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: setting.id,
    tenantId: setting.tenantId,
    workspaceId: setting.workspaceId,
    key: setting.key,
    value: setting.value,
    createdAt: setting.createdAt.toISOString(),
    updatedAt: setting.updatedAt.toISOString(),
  };
}

export const settingsService = {
  async list(user: AuthenticatedUser, query: SettingsQuery) {
    if (query.workspaceId && !hasWorkspaceAccess(user, query.workspaceId)) {
      throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Workspace fora do escopo do usuario.');
    }
    const result = await settingsRepository.list(
      user.tenant.id,
      user.workspaces.map((workspace) => workspace.id),
      query,
    );
    return {
      data: result.data.map(mapSetting),
      pagination: paginationMeta(query, result.total),
    };
  },
};
