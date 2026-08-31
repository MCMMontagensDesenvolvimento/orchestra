import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    useMocks: false,
  },
}));

vi.mock('@/services/api/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '@/services/api/api-client';
import { endpoints } from '@/services/api/endpoints';
import { mcpService } from '@/services/mcp.service';

describe('mcpService remote catalog materialization', () => {
  const serverId =
    '00000000-0000-0000-0000-000000000701';

  const entryId =
    '00000000-0000-0000-0000-000000000801';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads remote catalog entries scoped by server', async () => {
    const entry = {
      id: entryId,
      serverId,
      externalName: 'corporate.status.read',
      displayName: 'Corporate Status Read',
      materialization: {
        isMaterialized: false,
      },
    };

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        data: [entry],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
        requestId: 'req_catalog_test',
      },
    } as never);

    const result =
      await mcpService.remoteCatalogEntries(serverId);

    expect(result).toEqual([entry]);

    expect(apiClient.get).toHaveBeenCalledWith(
      `${endpoints.mcp.remoteCatalogEntries}?serverId=${encodeURIComponent(serverId)}`,
    );
  });

  it('materializes without sending client-controlled policy payload', async () => {
    const result = {
      status: 'materialized',
      catalogEntryId: entryId,
      serverId,
      mcpTool: {
        id: '00000000-0000-0000-0000-000000000901',
        externalName: 'corporate.status.read',
        displayName: 'Corporate Status Read',
        riskLevel: 'low',
        requiresApproval: true,
        isEnabled: false,
        policy: {
          allowRuntimeExecution: false,
          sandboxOnly: true,
          requiresApproval: true,
          blockedByDefault: true,
        },
      },
      safeguards: {
        readOnly: true,
        runtimeEnabled: false,
        remoteExecutionEnabled: false,
        toolExecutionPerformed: false,
      },
    };

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        data: result,
        requestId: 'req_materialization_test',
      },
    } as never);

    await expect(
      mcpService.materializeRemoteCatalogEntry(entryId),
    ).resolves.toEqual(result);

    expect(apiClient.post).toHaveBeenCalledTimes(1);

    expect(apiClient.post).toHaveBeenCalledWith(
      endpoints.mcp.remoteCatalogMaterialize(entryId),
    );
  });
});
