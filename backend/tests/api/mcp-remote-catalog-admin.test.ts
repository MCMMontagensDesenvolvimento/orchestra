import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => {
  const mcpRemoteCatalogAdminRepository = {
    listEntries: vi.fn(),
    findEntry: vi.fn(),
    listApplyLedgers: vi.fn(),
    findApplyLedger: vi.fn(),
  };

  return {
    mcpRemoteCatalogAdminRepository,
    recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../src/modules/mcp/remote/mcp-remote-catalog-admin.repository', () => ({
  mcpRemoteCatalogAdminRepository: mocks.mcpRemoteCatalogAdminRepository,
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const otherWorkspaceId = '00000000-0000-0000-0000-000000000021';
const userId = '00000000-0000-0000-0000-000000000001';
const serverId = '00000000-0000-0000-0000-000000000701';
const entryId = '00000000-0000-0000-0000-000000000801';
const ledgerId = '00000000-0000-0000-0000-000000000901';
const approvedByUserId = '00000000-0000-0000-0000-000000000040';
const now = new Date('2026-06-28T12:00:00.000Z');
const later = new Date('2026-06-28T12:05:00.000Z');
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const hashC = 'c'.repeat(64);
const hashD = 'd'.repeat(64);
const hashE = 'e'.repeat(64);
const hashF = 'f'.repeat(64);

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
  const token = signSession({ sub: user.id, user });
  return `${env.COOKIE_NAME}=${token}`;
}

function entryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: entryId,
    tenantId,
    workspaceId,
    mcpServerId: serverId,
    externalName: 'remote_health',
    displayName: 'Remote Health',
    description: 'Governed remote catalog entry.',
    source: 'remote_discovery',
    lifecycleStatus: 'approved_for_catalog',
    riskLevel: 'medium',
    requiresApproval: true,
    specHash: hashA,
    catalogHash: hashB,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        secretRef: { type: 'string' },
      },
      headers: {
        Authorization: 'Bearer should-not-leak',
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        token: { type: 'string' },
      },
    },
    allowRuntimeExecution: false,
    sandboxOnly: true,
    blockedByDefault: true,
    approvalMode: 'manual',
    runtimeEnabled: false,
    remoteExecutionEnabled: false,
    snapshotId: 'snapshot_11j',
    snapshotHash: hashC,
    lastPlanId: 'plan_11j',
    lastPlanHash: hashD,
    lastApplyId: 'apply_11j',
    lastApplyHash: hashE,
    revision: 2,
    importedByUserId: approvedByUserId,
    importedAt: now,
    approvedByUserId,
    approvedAt: later,
    deprecatedByUserId: null,
    deprecatedAt: null,
    deprecationReasonHash: null,
    materializedMcpToolId: null,
    internalMetadata: {
      baseUrl: 'https://internal.example.test',
      Authorization: 'Bearer should-not-leak',
    },
    createdAt: now,
    updatedAt: later,
    deletedAt: null,
    ...overrides,
  };
}

function ledgerFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: ledgerId,
    tenantId,
    workspaceId,
    mcpServerId: serverId,
    planId: 'plan_11j',
    planHash: hashD,
    snapshotHash: hashC,
    applyId: 'apply_11j',
    applyHash: hashE,
    idempotencyKey: hashF,
    approvedByUserId,
    approvalReasonHash: hashA,
    status: 'applied',
    summary: {
      total: 1,
      applied: 1,
      blocked: 0,
      skipped: 0,
      failed: 0,
      noop: 0,
      idempotent: 0,
    },
    operationResults: {
      operationResults: [{
        operationId: 'op_1',
        type: 'create_tool_draft',
        externalName: 'remote_health',
        status: 'applied',
        reason: 'Created without Authorization Bearer leak.',
        baseUrl: 'https://internal.example.test',
        runtimeEnabled: false,
        remoteExecutionEnabled: false,
      }],
      sanitizedMetadata: {
        source: 'test',
        token: 'should-not-leak',
      },
      rollbackNotes: [{
        note: 'Manual reconciliation only.',
        credential: 'should-not-leak',
      }],
      auditEventMetadata: {
        idempotencyKeyHash: hashB,
        secretRef: 'should-not-leak',
      },
      appliedAt: later.toISOString(),
      schemaVersion: 1,
    },
    schemaVersion: 1,
    createdAt: now,
    completedAt: later,
    ...overrides,
  };
}

describe('MCP remote catalog admin read API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mcpRemoteCatalogAdminRepository.listEntries.mockResolvedValue({ data: [entryFixture()], total: 1 });
    mocks.mcpRemoteCatalogAdminRepository.findEntry.mockResolvedValue(entryFixture());
    mocks.mcpRemoteCatalogAdminRepository.listApplyLedgers.mockResolvedValue({ data: [ledgerFixture()], total: 1 });
    mocks.mcpRemoteCatalogAdminRepository.findApplyLedger.mockResolvedValue(ledgerFixture());
  });

  it('requires authentication and mcp.manage permission', async () => {
    const app = createApp();
    await request(app).get('/api/v1/mcp/remote-catalog/entries').expect(401);

    const readOnlyUser = {
      ...adminUser,
      permissions: ['mcp.read'],
    };
    await request(app)
      .get('/api/v1/mcp/remote-catalog/entries')
      .set('Cookie', sessionCookie(readOnlyUser))
      .expect(403);

    expect(mocks.mcpRemoteCatalogAdminRepository.listEntries).not.toHaveBeenCalled();
  });

  it('lists entries scoped by tenant and workspace with redacted list DTOs', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/mcp/remote-catalog/entries')
      .query({
        workspaceId,
        serverId,
        externalName: 'remote_health',
        lifecycleStatus: 'approved_for_catalog',
        riskLevel: 'medium',
        requiresApproval: 'true',
        snapshotHash: hashC,
        specHash: hashA,
        catalogHash: hashB,
        lastPlanHash: hashD,
        lastApplyHash: hashE,
        page: '1',
        perPage: '5',
        sortBy: 'externalName',
        sortDirection: 'asc',
      })
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(mocks.mcpRemoteCatalogAdminRepository.listEntries).toHaveBeenCalledWith(
      tenantId,
      [workspaceId],
      expect.objectContaining({
        workspaceId,
        serverId,
        externalName: 'remote_health',
        sortBy: 'externalName',
        perPage: 5,
      }),
    );
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: entryId,
      serverId,
      externalName: 'remote_health',
      policy: {
        allowRuntimeExecution: false,
        sandboxOnly: true,
        blockedByDefault: true,
        runtimeEnabled: false,
        remoteExecutionEnabled: false,
      },
      materialization: {
        isMaterialized: false,
      },
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('internalMetadata');
    expect(serialized).not.toContain('secretRef');
    expect(serialized).not.toContain('baseUrl');
    expect(serialized).not.toContain('Bearer should-not-leak');
    expect(serialized).not.toContain('inputSchema');
    expect(serialized).not.toContain('outputSchema');
  });

  it('rejects out-of-scope workspace filters before reading the repository', async () => {
    const app = createApp();
    await request(app)
      .get('/api/v1/mcp/remote-catalog/entries')
      .query({ workspaceId: otherWorkspaceId })
      .set('Cookie', sessionCookie())
      .expect(403);

    expect(mocks.mcpRemoteCatalogAdminRepository.listEntries).not.toHaveBeenCalled();
  });

  it('sanitizes entry detail schemas and does not expose internal metadata', async () => {
    const app = createApp();
    const response = await request(app)
      .get(`/api/v1/mcp/remote-catalog/entries/${entryId}`)
      .set('Cookie', sessionCookie())
      .expect(200);

    const serialized = JSON.stringify(response.body);
    expect(response.body.data.schemas.input.properties.query.type).toBe('string');
    expect(response.body.data.schemas.summary.input.present).toBe(true);
    expect(serialized).not.toContain('internalMetadata');
    expect(serialized).not.toContain('secretRef');
    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('Bearer should-not-leak');
    expect(serialized).not.toContain('token');
  });

  it('lists ledgers without exposing idempotency or operation result payloads', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/mcp/remote-catalog/apply-ledgers')
      .query({
        workspaceId,
        serverId,
        status: 'applied',
        planId: 'plan_11j',
        planHash: hashD,
        snapshotHash: hashC,
        applyId: 'apply_11j',
        applyHash: hashE,
        idempotencyKey: hashF,
        approvedByUserId,
        createdAtFrom: now.toISOString(),
        createdAtTo: later.toISOString(),
      })
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(mocks.mcpRemoteCatalogAdminRepository.listApplyLedgers).toHaveBeenCalledWith(
      tenantId,
      [workspaceId],
      expect.objectContaining({
        idempotencyKey: hashF,
        approvedByUserId,
      }),
    );
    expect(response.body.data[0]).toMatchObject({
      id: ledgerId,
      serverId,
      planHash: hashD,
      applyHash: hashE,
      status: 'applied',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('idempotencyKey');
    expect(serialized).not.toContain('approvalReasonHash');
    expect(serialized).not.toContain('operationResults');
    expect(serialized).not.toContain(hashF);
  });

  it('exposes ledger detail idempotency hashes and sanitized operation results only', async () => {
    const app = createApp();
    const response = await request(app)
      .get(`/api/v1/mcp/remote-catalog/apply-ledgers/${ledgerId}`)
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(response.body.data.idempotencyKey).toBe(hashF);
    expect(response.body.data.approvalReasonHash).toBe(hashA);
    expect(response.body.data.operationResults.operationResults[0]).toMatchObject({
      operationId: 'op_1',
      type: 'create_tool_draft',
      externalName: 'remote_health',
      status: 'applied',
      runtimeEnabled: false,
      remoteExecutionEnabled: false,
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).toContain('operationResults');
    expect(serialized).not.toContain('Bearer should-not-leak');
    expect(serialized).not.toContain('baseUrl');
    expect(serialized).not.toContain('secretRef');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('credential');
  });

  it('enforces pagination and sort allowlists', async () => {
    const app = createApp();
    await request(app)
      .get('/api/v1/mcp/remote-catalog/entries')
      .query({ perPage: '101' })
      .set('Cookie', sessionCookie())
      .expect(422);

    await request(app)
      .get('/api/v1/mcp/remote-catalog/apply-ledgers')
      .query({ sortBy: 'operationResults' })
      .set('Cookie', sessionCookie())
      .expect(422);
  });

  it('returns 404 for remote catalog records outside scoped reads', async () => {
    const app = createApp();
    mocks.mcpRemoteCatalogAdminRepository.findEntry.mockResolvedValueOnce(null);
    mocks.mcpRemoteCatalogAdminRepository.findApplyLedger.mockResolvedValueOnce(null);

    await request(app)
      .get(`/api/v1/mcp/remote-catalog/entries/${entryId}`)
      .set('Cookie', sessionCookie())
      .expect(404);

    await request(app)
      .get(`/api/v1/mcp/remote-catalog/apply-ledgers/${ledgerId}`)
      .set('Cookie', sessionCookie())
      .expect(404);
  });

  it('does not register mutation routes for the remote catalog admin scope', async () => {
    const app = createApp();
    const paths = [
      '/api/v1/mcp/remote-catalog/entries',
      `/api/v1/mcp/remote-catalog/entries/${entryId}`,
      '/api/v1/mcp/remote-catalog/apply-ledgers',
      `/api/v1/mcp/remote-catalog/apply-ledgers/${ledgerId}`,
    ];

    for (const path of paths) {
      await request(app).post(path).set('Cookie', sessionCookie()).expect(404);
      await request(app).put(path).set('Cookie', sessionCookie()).expect(404);
      await request(app).patch(path).set('Cookie', sessionCookie()).expect(404);
      await request(app).delete(path).set('Cookie', sessionCookie()).expect(404);
    }
  });
});
