import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  materialize: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock(
  '../../src/modules/mcp/remote/mcp-remote-catalog-materialization.repository',
  () => ({
    mcpRemoteCatalogMaterializationRepository: {
      materialize: mocks.materialize,
    },
  }),
);

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

import { mcpService } from '../../src/modules/mcp/mcp.service';

describe('mcpService remote catalog materialization', () => {
  const tenantId =
    '00000000-0000-0000-0000-000000000010';
  const workspaceId =
    '00000000-0000-0000-0000-000000000020';
  const userId =
    '00000000-0000-0000-0000-000000000030';
  const serverId =
    '00000000-0000-0000-0000-000000000701';
  const entryId =
    '00000000-0000-0000-0000-000000000801';
  const toolId =
    '00000000-0000-0000-0000-000000000901';

  const user = {
    id: userId,
    tenant: {
      id: tenantId,
    },
    workspaces: [
      {
        id: workspaceId,
      },
    ],
  };

  const entry = {
    id: entryId,
    tenantId,
    workspaceId,
    mcpServerId: serverId,
    externalName: 'corporate.status.read',
    displayName: 'Corporate Status Read',
  };

  const tool = {
    id: toolId,
    tenantId,
    workspaceId,
    mcpServerId: serverId,
    riskLevel: 'low',
    requiresApproval: true,
    isEnabled: false,
    policies: [
      {
        allowRuntimeExecution: false,
        sandboxOnly: true,
        requiresApproval: true,
        blockedByDefault: true,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.materialize.mockResolvedValue({
      status: 'materialized',
      entry,
      tool,
    });

    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it('materializes inside the authenticated scope and returns a closed tool', async () => {
    const result = await mcpService.materializeRemoteCatalogEntry(
      entryId,
      user as never,
      { requestId: 'req_materialize_valid' },
    );

    expect(mocks.materialize).toHaveBeenCalledWith({
      entryId,
      tenantId,
      workspaceIds: [workspaceId],
    });

    expect(result).toEqual({
      status: 'materialized',
      catalogEntryId: entryId,
      serverId,
      mcpTool: {
        id: toolId,
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
    });

    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'mcp_remote_catalog_entry_materialized',
        actorUserId: userId,
        tenantId,
        workspaceId,
        entity: 'mcp_remote_catalog_entry',
        entityId: entryId,
        metadata: expect.objectContaining({
          mcpServerId: serverId,
          mcpToolId: toolId,
          externalName: 'corporate.status.read',
          requiresApproval: true,
          isEnabled: false,
          materializationStatus: 'materialized',
          allowRuntimeExecution: false,
          sandboxOnly: true,
          blockedByDefault: true,
          noRemoteExecution: true,
        }),
      }),
    );
  });

  it('returns the same closed McpTool on idempotent replay', async () => {
    mocks.materialize.mockResolvedValueOnce({
      status: 'already_materialized',
      entry,
      tool,
    });

    const result = await mcpService.materializeRemoteCatalogEntry(
      entryId,
      user as never,
      { requestId: 'req_materialize_replay' },
    );

    expect(result).toMatchObject({
      status: 'already_materialized',
      catalogEntryId: entryId,
      mcpTool: {
        id: toolId,
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
        runtimeEnabled: false,
        remoteExecutionEnabled: false,
        toolExecutionPerformed: false,
      },
    });

    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action:
          'mcp_remote_catalog_entry_materialization_replayed',
        entityId: entryId,
      }),
    );
  });

  it('maps a missing scoped catalog entry to 404', async () => {
    mocks.materialize.mockResolvedValueOnce({
      status: 'not_found',
    });

    await expect(
      mcpService.materializeRemoteCatalogEntry(
        entryId,
        user as never,
        { requestId: 'req_materialize_missing' },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: 'MCP_REMOTE_CATALOG_ENTRY_NOT_FOUND',
    });

    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });

  it('maps fail-closed policy blocks to 409', async () => {
    mocks.materialize.mockResolvedValueOnce({
      status: 'blocked',
      reason: 'policy_not_closed',
      entry,
    });

    await expect(
      mcpService.materializeRemoteCatalogEntry(
        entryId,
        user as never,
        { requestId: 'req_materialize_blocked' },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'MCP_REMOTE_CATALOG_MATERIALIZATION_BLOCKED',
    });

    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });
});
