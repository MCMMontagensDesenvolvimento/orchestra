import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import {
  mapRuntimeRunDetail,
  mapRuntimeRunSummary,
  mapRuntimeSummary,
} from './runtime-observability.mapper';
import { runtimeObservabilityRepository } from './runtime-observability.repository';
import type { RuntimeRunsQuery } from './runtime-observability.schema';

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);

function assertWorkspaceFilter(user: AuthenticatedUser, workspaceId: string | undefined) {
  if (workspaceId && !userWorkspaceIds(user).includes(workspaceId)) {
    throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Workspace fora do escopo do usuario.');
  }
}

export const runtimeObservabilityService = {
  async listRuntimeRuns(user: AuthenticatedUser, query: RuntimeRunsQuery) {
    assertWorkspaceFilter(user, query.workspaceId);
    const result = await runtimeObservabilityRepository.listRuntimeRuns(
      user.tenant.id,
      userWorkspaceIds(user),
      query,
    );
    return {
      data: result.data.map(mapRuntimeRunSummary),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getRuntimeRun(user: AuthenticatedUser, id: string) {
    const row = await runtimeObservabilityRepository.findRuntimeRun(
      id,
      user.tenant.id,
      userWorkspaceIds(user),
    );
    if (!row) {
      throw new AppError(404, 'RUNTIME_RUN_NOT_FOUND', 'Run de runtime nao encontrado.');
    }
    return mapRuntimeRunDetail(row);
  },

  async summarizeRuntime(user: AuthenticatedUser) {
    const result = await runtimeObservabilityRepository.summarizeRuntime(
      user.tenant.id,
      userWorkspaceIds(user),
    );
    return mapRuntimeSummary(result);
  },
};
