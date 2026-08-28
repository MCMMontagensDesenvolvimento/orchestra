import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findServer: vi.fn(),
  findForApply: vi.fn(),
  applyImportPlan: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock('../../src/modules/mcp/mcp.repository', () => ({
  mcpRepository: {
    findServer: mocks.findServer,
  },
}));

vi.mock(
  '../../src/modules/mcp/remote/mcp-remote-catalog-import-plan.repository',
  () => ({
    mcpRemoteCatalogImportPlanPersistenceRepository: {
      persistImmutable: vi.fn(),
      findForApply: mocks.findForApply,
    },
  }),
);

vi.mock(
  '../../src/modules/mcp/remote/mcp-remote-catalog-import-apply.repository',
  () => ({
    McpRemoteCatalogImportApplyPersistenceRepository: class {},
  }),
);

vi.mock(
  '../../src/modules/mcp/remote/mcp-remote-catalog-import-apply.service',
  () => ({
    McpRemoteCatalogImportApplyService: class {
      applyImportPlan = mocks.applyImportPlan;
    },
  }),
);

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

import { mcpService } from '../../src/modules/mcp/mcp.service';

describe('mcpService remote manual apply', () => {
  const tenantId = '00000000-0000-0000-0000-000000000010';
  const workspaceId = '00000000-0000-0000-0000-000000000020';
  const userId = '00000000-0000-0000-0000-000000000030';
  const serverId = '00000000-0000-0000-0000-000000000701';

  const planHash = 'a'.repeat(64);
  const snapshotHash = 'b'.repeat(64);
  const planId =
    `mcp_remote_catalog_import_plan_${planHash.slice(0, 24)}`;

  const server = {
    id: serverId,
    tenantId,
    workspaceId,
    serverType: 'remote',
    status: 'active',
  };

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

  const plan = {
    planId,
    planHash,
    snapshotHash,
    serverId,
    tenantId,
    workspaceId,
  };

  const persisted = {
    record: {
      planId,
      planHash,
      snapshotHash,
      tenantId,
      workspaceId,
      mcpServerId: serverId,
    },
    plan,
  };

  const input = {
    planId,
    planHash,
    confirmManualApply: true as const,
    approvalReason:
      'Aprovado para inclusão no catálogo corporativo read-only.',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findServer.mockResolvedValue(server);

    mocks.findForApply.mockResolvedValue(persisted);

    mocks.applyImportPlan.mockResolvedValue({
      applyId: 'mcp_remote_catalog_apply_test',
      applyHash: 'c'.repeat(64),
      status: 'applied',
    });

    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it('returns 404 semantics when persisted plan does not exist', async () => {
    mocks.findForApply.mockResolvedValueOnce(null);

    await expect(
      mcpService.applyRemoteImportPlan(
        serverId,
        input,
        user as never,
        { requestId: 'req_manual_apply_not_found' },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: 'MCP_REMOTE_IMPORT_PLAN_NOT_FOUND',
    });

    expect(mocks.applyImportPlan).not.toHaveBeenCalled();
  });

  it('returns 409 semantics when supplied hash differs from persisted hash', async () => {
    await expect(
      mcpService.applyRemoteImportPlan(
        serverId,
        {
          ...input,
          planHash: 'd'.repeat(64),
        },
        user as never,
        { requestId: 'req_manual_apply_hash_mismatch' },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'MCP_REMOTE_IMPORT_PLAN_HASH_MISMATCH',
    });

    expect(mocks.applyImportPlan).not.toHaveBeenCalled();
  });

  it('returns 409 semantics when immutable persistence integrity fails', async () => {
    mocks.findForApply.mockRejectedValueOnce(
      Object.assign(
        new Error('persisted payload integrity failure'),
        {
          code: 'MCP_REMOTE_IMPORT_PLAN_PERSISTENCE_CONFLICT',
        },
      ),
    );

    await expect(
      mcpService.applyRemoteImportPlan(
        serverId,
        input,
        user as never,
        { requestId: 'req_manual_apply_integrity_failure' },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'MCP_REMOTE_IMPORT_PLAN_INTEGRITY_FAILED',
    });

    expect(mocks.applyImportPlan).not.toHaveBeenCalled();
  });

  it('uses the authenticated session as approver and enables pending approval only internally', async () => {
    const result = await mcpService.applyRemoteImportPlan(
      serverId,
      input,
      user as never,
      { requestId: 'req_manual_apply_valid' },
    );

    expect(mocks.findForApply).toHaveBeenCalledWith({
      tenantId,
      workspaceId,
      serverId,
      planId,
    });

    expect(mocks.applyImportPlan).toHaveBeenCalledWith({
      plan,
      authorization: {
        approvedByUserId: userId,
        approvalReason: input.approvalReason,
        confirmManualApply: true,
      },
      options: {
        allowPendingApprovalApply: true,
      },
    });

    expect(result).toMatchObject({
      status: 'applied',
    });

    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action:
          'mcp_remote_catalog_import_manual_apply_requested',
        actorUserId: userId,
        tenantId,
        workspaceId,
        entity: 'mcp_server',
        entityId: serverId,
        metadata: expect.objectContaining({
          planId,
          planHash,
          noRuntimeEnablement: true,
          noRemoteToolExecution: true,
          noToolMaterialization: true,
        }),
      }),
    );
  });

  it('maps a governed blocked apply to HTTP conflict semantics', async () => {
    mocks.applyImportPlan.mockResolvedValueOnce({
      applyId: 'mcp_remote_catalog_apply_blocked',
      applyHash: 'e'.repeat(64),
      status: 'blocked',
    });

    await expect(
      mcpService.applyRemoteImportPlan(
        serverId,
        input,
        user as never,
        { requestId: 'req_manual_apply_blocked' },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'MCP_REMOTE_CATALOG_IMPORT_APPLY_BLOCKED',
    });

    expect(mocks.recordAuditEvent).toHaveBeenCalledTimes(1);
  });
});
