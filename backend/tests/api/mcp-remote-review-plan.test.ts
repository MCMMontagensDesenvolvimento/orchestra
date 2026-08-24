import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => ({
  mcpRepository: {
    findServer: vi.fn(),
  },
  mcpRemoteCatalogAdminRepository: {
    listDiscoverySpecs: vi.fn(),
  },
  mcpRemoteDiscoveryService: {
    runGovernedDiscovery: vi.fn(),
  },
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/modules/mcp/mcp.repository', () => ({
  mcpRepository: mocks.mcpRepository,
}));

vi.mock('../../src/modules/mcp/remote/mcp-remote-catalog-admin.repository', () => ({
  mcpRemoteCatalogAdminRepository: mocks.mcpRemoteCatalogAdminRepository,
}));

vi.mock('../../src/modules/mcp/remote/mcp-remote-discovery.service', () => ({
  mcpRemoteDiscoveryService: mocks.mcpRemoteDiscoveryService,
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const userId = '00000000-0000-0000-0000-000000000001';
const serverId = '00000000-0000-0000-0000-000000000701';

const specHash = 'a'.repeat(64);

const adminUser: AuthenticatedUser = {
  id: userId,
  email: 'admin.dev@orchestra.local',
  name: 'Development Admin',
  tenant: {
    id: tenantId,
    name: 'Orchestra Dev Tenant',
    slug: 'orchestra-dev',
  },
  workspaces: [
    {
      id: workspaceId,
      name: 'Default Workspace',
      slug: 'default',
      role: 'admin',
    },
  ],
  roles: ['admin_platform'],
  permissions: ['mcp.manage'],
};

function sessionCookie(user: AuthenticatedUser = adminUser) {
  const token = signSession({
    sub: user.id,
    user,
  });

  return `${env.COOKIE_NAME}=${token}`;
}

function serverFixture() {
  return {
    id: serverId,
    tenantId,
    workspaceId,
    name: 'Orchestra Corporate Readonly HML',
    description: 'Governed remote MCP server.',
    serverType: 'remote',
    baseUrl: 'https://api.example.test',
    status: 'active',
    trustLevel: 'restricted',
    riskLevel: 'medium',
    authType: 'bearer',
    secretRef: 'env://ORCHESTRA_CORPORATE_READONLY_STATUS_TOKEN',
    metadata: {
      readOnly: true,
      remoteExecution: false,
      writeToolsAllowed: false,
    },
    createdById: userId,
    createdAt: new Date('2026-08-24T10:00:00.000Z'),
    updatedAt: new Date('2026-08-24T10:00:00.000Z'),
    deletedAt: null,
    policies: [
      {
        id: '00000000-0000-0000-0000-000000000702',
        tenantId,
        workspaceId,
        mcpServerId: serverId,
        mcpToolId: null,
        allowRuntimeExecution: false,
        sandboxOnly: true,
        requiresApproval: true,
        blockedByDefault: true,
        metadata: null,
        createdAt: new Date('2026-08-24T10:00:00.000Z'),
        updatedAt: new Date('2026-08-24T10:00:00.000Z'),
      },
    ],
    createdBy: {
      id: userId,
      name: 'Development Admin',
      email: 'admin.dev@orchestra.local',
    },
    _count: {
      tools: 0,
      resources: 0,
      prompts: 0,
      bindings: 0,
    },
  };
}

function discoveryFixture() {
  return {
    serverId,
    status: 'completed',
    discoveredAt: '2026-08-24T10:00:00.000Z',
    tools: [
      {
        externalName: 'corporate.status.read',
        displayName: 'Corporate Status Read',
        description: 'Read corporate readonly status.',
        specHash,
        inferredRiskLevel: 'low',
        requiresApproval: false,
        defaultPolicy: {
          allowRuntimeExecution: false,
          sandboxOnly: true,
          blockedByDefault: true,
        },
      },
    ],
    diff: {
      added: ['corporate.status.read'],
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
      mcpRemoteHost: 'api.example.test',
      toolCount: 1,
    },
  };
}

describe('MCP remote review and import plan API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mcpRepository.findServer.mockResolvedValue(serverFixture());

    mocks.mcpRemoteCatalogAdminRepository.listDiscoverySpecs.mockResolvedValue([]);

    mocks.mcpRemoteDiscoveryService.runGovernedDiscovery.mockResolvedValue(
      discoveryFixture(),
    );

    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it('requires authentication and mcp.manage permission', async () => {
    const app = createApp();

    await request(app)
      .post(`/api/v1/mcp/servers/${serverId}/remote-review`)
      .expect(401);

    await request(app)
      .post(`/api/v1/mcp/servers/${serverId}/remote-import-plan`)
      .expect(401);

    const readOnlyUser: AuthenticatedUser = {
      ...adminUser,
      permissions: ['mcp.read'],
    };

    await request(app)
      .post(`/api/v1/mcp/servers/${serverId}/remote-review`)
      .set('Cookie', sessionCookie(readOnlyUser))
      .expect(403);

    await request(app)
      .post(`/api/v1/mcp/servers/${serverId}/remote-import-plan`)
      .set('Cookie', sessionCookie(readOnlyUser))
      .expect(403);

    expect(mocks.mcpRepository.findServer).not.toHaveBeenCalled();
    expect(
      mocks.mcpRemoteCatalogAdminRepository.listDiscoverySpecs,
    ).not.toHaveBeenCalled();
    expect(
      mocks.mcpRemoteDiscoveryService.runGovernedDiscovery,
    ).not.toHaveBeenCalled();
  });

  it('returns a fail-closed review package for a newly discovered tool', async () => {
    const response = await request(createApp())
      .post(`/api/v1/mcp/servers/${serverId}/remote-review`)
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        serverId,
        tenantId,
        workspaceId,
        decision: expect.objectContaining({
          status: 'pending_human_review',
          requiresHumanReview: true,
        }),
        applyPlan: expect.objectContaining({
          canApply: false,
        }),
      }),
    );

    expect(response.body.data.diff).toEqual({
      added: ['corporate.status.read'],
      changed: [],
      removed: [],
    });

    expect(
      mocks.mcpRemoteCatalogAdminRepository.listDiscoverySpecs,
    ).toHaveBeenCalledWith(
      tenantId,
      workspaceId,
      serverId,
    );

    expect(
      mocks.mcpRemoteDiscoveryService.runGovernedDiscovery,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        workspaceId,
        existingTools: [],
        credentialsConfigured: true,
        requestedByUserId: userId,
      }),
    );

    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'mcp_remote_discovery_review_package_created',
        entity: 'mcp_server',
        entityId: serverId,
        metadata: expect.objectContaining({
          decisionStatus: 'pending_human_review',
          requiresHumanReview: true,
          noCatalogImport: true,
          noRuntimePublish: true,
          noToolExecution: true,
        }),
      }),
    );

    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain(
      'ORCHESTRA_CORPORATE_READONLY_STATUS_TOKEN',
    );
    expect(serialized).not.toContain('env://');
    expect(serialized).not.toContain('Bearer ');
  });

  it('returns an atomic review and import plan that cannot auto-apply', async () => {
    const response = await request(createApp())
      .post(`/api/v1/mcp/servers/${serverId}/remote-import-plan`)
      .set('Cookie', sessionCookie())
      .expect(200);

    const { reviewPackage, plan } = response.body.data;

    expect(reviewPackage).toBeDefined();
    expect(plan).toBeDefined();

    expect(reviewPackage.snapshotHash).toBe(plan.snapshotHash);
    expect(reviewPackage.snapshotId).toBe(plan.snapshotId);

    expect(reviewPackage.decision).toEqual(
      expect.objectContaining({
        status: 'pending_human_review',
        requiresHumanReview: true,
      }),
    );

    expect(plan).toEqual(
      expect.objectContaining({
        serverId,
        tenantId,
        workspaceId,
        status: 'pending_approval',
        sourceDecisionStatus: 'pending_human_review',
        preflight: expect.objectContaining({
          canApply: false,
          canApplyAutomatically: false,
          requiresManualApproval: true,
        }),
      }),
    );

    expect(plan.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalName: 'corporate.status.read',
          type: 'create_tool_draft',
          canApply: false,
          canApplyAutomatically: false,
          policyDraft: expect.objectContaining({
            allowRuntimeExecution: false,
            sandboxOnly: true,
            blockedByDefault: true,
            requiresApproval: true,
            approvalMode: 'manual',
            runtimeEnabled: false,
            remoteExecutionEnabled: false,
          }),
        }),
      ]),
    );

    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'mcp_remote_catalog_import_plan_created',
        entity: 'mcp_server',
        entityId: serverId,
        metadata: expect.objectContaining({
          status: 'pending_approval',
          canApply: false,
          canApplyAutomatically: false,
          noCatalogPersistence: true,
          noRuntimePublish: true,
          noToolExecution: true,
        }),
      }),
    );

    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain(
      'ORCHESTRA_CORPORATE_READONLY_STATUS_TOKEN',
    );
    expect(serialized).not.toContain('env://');
    expect(serialized).not.toContain('Bearer ');
  });
});
