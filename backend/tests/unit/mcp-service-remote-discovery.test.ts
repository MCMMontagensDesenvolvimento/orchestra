import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findServer: vi.fn(),
  listDiscoverySpecs: vi.fn(),
  runGovernedDiscovery: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock('../../src/modules/mcp/mcp.repository', () => ({
  mcpRepository: {
    findServer: mocks.findServer,
  },
}));

vi.mock('../../src/modules/mcp/remote/mcp-remote-catalog-admin.repository', () => ({
  mcpRemoteCatalogAdminRepository: {
    listDiscoverySpecs: mocks.listDiscoverySpecs,
  },
}));

vi.mock('../../src/modules/mcp/remote/mcp-remote-discovery.service', () => ({
  mcpRemoteDiscoveryService: {
    runGovernedDiscovery: mocks.runGovernedDiscovery,
  },
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

import { mcpService } from '../../src/modules/mcp/mcp.service';

describe('mcpService remote discovery with persisted catalog', () => {
  const tenantId = '00000000-0000-0000-0000-000000000010';
  const workspaceId = '00000000-0000-0000-0000-000000000020';
  const userId = '00000000-0000-0000-0000-000000000030';
  const serverId = '00000000-0000-0000-0000-000000000701';

  const server = {
    id: serverId,
    tenantId,
    workspaceId,
    name: 'Orchestra Corporate Readonly HML',
    serverType: 'remote',
    status: 'active',
    baseUrl: 'https://api-hml.orchestra.mcm.eng.br',
    authType: 'bearer',
    secretRef: 'env://ORCHESTRA_CORPORATE_READONLY_STATUS_TOKEN',
    trustLevel: 'restricted',
    riskLevel: 'medium',
    policies: [
      {
        allowRuntimeExecution: false,
        sandboxOnly: true,
        blockedByDefault: true,
        requiresApproval: true,
        approvalMode: 'manual',
        runtimeEnabled: false,
        remoteExecutionEnabled: false,
      },
    ],
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

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findServer.mockResolvedValue(server);

    mocks.listDiscoverySpecs.mockResolvedValue([
      {
        externalName: 'corporate.status.read',
        specHash: 'a'.repeat(64),
      },
    ]);

    mocks.runGovernedDiscovery.mockResolvedValue({
      serverId,
      status: 'completed',
      discoveredAt: '2026-08-21T10:00:00.000Z',
      tools: [
        {
          externalName: 'corporate.status.read',
          displayName: 'Corporate Status Read',
          description: 'Read corporate readonly status.',
          specHash: 'a'.repeat(64),
          inferredRiskLevel: 'low',
          requiresApproval: true,
          defaultPolicy: {
            allowRuntimeExecution: false,
            sandboxOnly: true,
            blockedByDefault: true,
          },
        },
      ],
      diff: {
        added: [],
        changed: [],
        removed: [],
      },
      warnings: [],
      readiness: {
        status: 'ready',
        reason: 'Remote MCP discovery is ready.',
      },
      sanitizedMetadata: {
        executionBlocked: true,
        transportCalled: true,
        mcpRemoteHost: 'api-hml.orchestra.mcm.eng.br',
        toolCount: 1,
      },
    });

    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it('loads persisted discovery specs and forwards them as existingTools', async () => {
    const result = await mcpService.discoverRemoteTools(
      serverId,
      user as never,
      {
        requestId: 'req_remote_incremental_discovery',
      },
    );

    expect(mocks.findServer).toHaveBeenCalledTimes(1);
    expect(mocks.findServer).toHaveBeenCalledWith(
      serverId,
      tenantId,
      [workspaceId],
    );

    expect(mocks.listDiscoverySpecs).toHaveBeenCalledTimes(1);
    expect(mocks.listDiscoverySpecs).toHaveBeenCalledWith(
      tenantId,
      workspaceId,
      serverId,
    );

    expect(mocks.runGovernedDiscovery).toHaveBeenCalledTimes(1);
    expect(mocks.runGovernedDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        workspaceId,
        server,
        credentialsConfigured: true,
        requestedByUserId: userId,
        requestId: 'req_remote_incremental_discovery',
        existingTools: [
          {
            externalName: 'corporate.status.read',
            specHash: 'a'.repeat(64),
          },
        ],
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'completed',
        diff: {
          added: [],
          changed: [],
          removed: [],
        },
      }),
    );
  });

  it('audits only incremental counters and sanitized remote metadata', async () => {
    await mcpService.discoverRemoteTools(
      serverId,
      user as never,
      {
        requestId: 'req_remote_incremental_audit',
      },
    );

    expect(mocks.recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        workspaceId,
        actorUserId: userId,
        action: 'mcp_remote_readonly_discovery_checked',
        entity: 'mcp_server',
        entityId: serverId,
        requestId: 'req_remote_incremental_audit',
        metadata: expect.objectContaining({
          status: 'completed',
          toolCount: 1,
          existingToolCount: 1,
          addedCount: 0,
          changedCount: 0,
          removedCount: 0,
          transportCalled: true,
          mcpRemoteHost: 'api-hml.orchestra.mcm.eng.br',
        }),
      }),
    );

    const auditPayload = JSON.stringify(mocks.recordAuditEvent.mock.calls);

    expect(auditPayload).not.toContain(
      'ORCHESTRA_CORPORATE_READONLY_STATUS_TOKEN',
    );
    expect(auditPayload).not.toContain('env://');
  });
});
