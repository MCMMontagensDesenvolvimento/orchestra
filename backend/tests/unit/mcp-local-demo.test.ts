import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { seedMcpLocalDemo } from '../../prisma/mcp-local-demo.seed';
import {
  parseSeedTargetArguments,
  resolveSeedTarget,
} from '../../prisma/seed-target';
import {
  getMcpLocalDemoPrecheck,
  MCP_LOCAL_DEMO_SERVER,
  MCP_LOCAL_DEMO_SERVER_ID,
  MCP_LOCAL_DEMO_TOOLS,
} from '../../src/modules/mcp/local-demo/mcp-local-demo.catalog';

function createSeedPrismaMock() {
  const tx = {
    mcpServer: { upsert: vi.fn().mockResolvedValue(undefined) },
    mcpTool: { upsert: vi.fn().mockResolvedValue(undefined) },
    mcpToolPolicy: { upsert: vi.fn().mockResolvedValue(undefined) },
    assistantMcpBinding: { upsert: vi.fn().mockResolvedValue(undefined) },
    auditLog: { upsert: vi.fn().mockResolvedValue(undefined) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaClient;
  return { prisma, tx };
}

function createTargetPrismaMock(input: {
  preferredTenant?: { id: string; slug: string } | null;
  preferredWorkspace?: { id: string; tenantId: string; slug: string } | null;
  fallbackTenant?: { id: string; slug: string };
  fallbackWorkspace?: { id: string; tenantId: string; slug: string };
}) {
  const tenant = {
    findUnique: vi.fn().mockResolvedValue(input.preferredTenant ?? null),
    upsert: vi.fn().mockResolvedValue(input.fallbackTenant),
  };
  const workspace = {
    findUnique: vi.fn().mockResolvedValue(input.preferredWorkspace ?? null),
    upsert: vi.fn().mockResolvedValue(input.fallbackWorkspace),
  };

  return {
    prisma: { tenant, workspace } as unknown as PrismaClient,
    tenant,
    workspace,
  };
}

describe('Fase 18D governed local MCP catalog', () => {
  it('parses and resolves explicit mcm/principal seed arguments without creating fallback records', async () => {
    const targetArguments = parseSeedTargetArguments([
      '--demo',
      '--tenant-slug',
      'mcm',
      '--workspace-slug=principal',
    ]);
    const tenantRecord = { id: '0fcc5829-dc55-4758-95d0-e972f77d988c', slug: 'mcm' };
    const workspaceRecord = {
      id: '02d0aeb9-bd50-4860-bfeb-4382400c2f55',
      tenantId: tenantRecord.id,
      slug: 'principal',
    };
    const { prisma, tenant, workspace } = createTargetPrismaMock({
      preferredTenant: tenantRecord,
      preferredWorkspace: workspaceRecord,
    });

    await expect(resolveSeedTarget(prisma, targetArguments)).resolves.toMatchObject({
      tenant: tenantRecord,
      workspace: workspaceRecord,
      source: 'explicit',
    });
    expect(tenant.findUnique).toHaveBeenCalledWith({ where: { slug: 'mcm' } });
    expect(workspace.findUnique).toHaveBeenCalledWith({
      where: { tenantId_slug: { tenantId: tenantRecord.id, slug: 'principal' } },
    });
    expect(tenant.upsert).not.toHaveBeenCalled();
    expect(workspace.upsert).not.toHaveBeenCalled();
  });

  it('prefers an existing mcm/principal target when seed arguments are omitted', async () => {
    const tenantRecord = { id: '0fcc5829-dc55-4758-95d0-e972f77d988c', slug: 'mcm' };
    const workspaceRecord = {
      id: '02d0aeb9-bd50-4860-bfeb-4382400c2f55',
      tenantId: tenantRecord.id,
      slug: 'principal',
    };
    const { prisma, tenant, workspace } = createTargetPrismaMock({
      preferredTenant: tenantRecord,
      preferredWorkspace: workspaceRecord,
    });

    await expect(resolveSeedTarget(prisma, parseSeedTargetArguments([]))).resolves.toMatchObject({
      tenant: tenantRecord,
      workspace: workspaceRecord,
      source: 'preferred-local',
    });
    expect(tenant.upsert).not.toHaveBeenCalled();
    expect(workspace.upsert).not.toHaveBeenCalled();
  });

  it('uses the idempotent orchestra-dev/default fallback when mcm/principal does not exist', async () => {
    const incompletePreferredTenant = { id: '0fcc5829-dc55-4758-95d0-e972f77d988c', slug: 'mcm' };
    const fallbackTenant = { id: '00000000-0000-4000-8000-000000000010', slug: 'orchestra-dev' };
    const fallbackWorkspace = {
      id: '00000000-0000-4000-8000-000000000020',
      tenantId: fallbackTenant.id,
      slug: 'default',
    };
    const { prisma, tenant, workspace } = createTargetPrismaMock({
      preferredTenant: incompletePreferredTenant,
      preferredWorkspace: null,
      fallbackTenant,
      fallbackWorkspace,
    });

    await expect(resolveSeedTarget(prisma, parseSeedTargetArguments([]))).resolves.toMatchObject({
      tenant: fallbackTenant,
      workspace: fallbackWorkspace,
      source: 'fallback-local',
    });
    expect(tenant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: 'orchestra-dev' },
    }));
    expect(workspace.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_slug: { tenantId: fallbackTenant.id, slug: 'default' } },
    }));
  });

  it('fails clearly and does not create fallbacks for a missing explicit tenant or workspace', async () => {
    const tenantMissing = createTargetPrismaMock({ preferredTenant: null });
    const explicit = parseSeedTargetArguments([
      '--tenant-slug',
      'missing-tenant',
      '--workspace-slug',
      'missing-workspace',
    ]);

    await expect(resolveSeedTarget(tenantMissing.prisma, explicit)).rejects.toThrow(
      'Explicit seed tenant "missing-tenant" was not found. No fallback tenant or workspace was created.',
    );
    expect(tenantMissing.tenant.upsert).not.toHaveBeenCalled();
    expect(tenantMissing.workspace.upsert).not.toHaveBeenCalled();

    const existingTenant = { id: '00000000-0000-4000-8000-000000000010', slug: 'mcm' };
    const workspaceMissing = createTargetPrismaMock({
      preferredTenant: existingTenant,
      preferredWorkspace: null,
    });
    const explicitWorkspace = parseSeedTargetArguments([
      '--tenant-slug=mcm',
      '--workspace-slug=missing-workspace',
    ]);

    await expect(resolveSeedTarget(workspaceMissing.prisma, explicitWorkspace)).rejects.toThrow(
      'Explicit seed workspace "missing-workspace" was not found in tenant "mcm". No fallback workspace was created.',
    );
    expect(workspaceMissing.tenant.upsert).not.toHaveBeenCalled();
    expect(workspaceMissing.workspace.upsert).not.toHaveBeenCalled();
  });

  it('requires tenant and workspace seed arguments as a pair', () => {
    expect(() => parseSeedTargetArguments(['--tenant-slug', 'mcm'])).toThrow(
      'Seed arguments --tenant-slug and --workspace-slug must be provided together.',
    );
    expect(() => parseSeedTargetArguments(['--workspace-slug', 'principal'])).toThrow(
      'Seed arguments --tenant-slug and --workspace-slug must be provided together.',
    );
  });

  it('returns a ready but non-executable deterministic precheck', () => {
    const result = getMcpLocalDemoPrecheck({
      id: MCP_LOCAL_DEMO_SERVER_ID,
      serverType: MCP_LOCAL_DEMO_SERVER.serverType,
      metadata: MCP_LOCAL_DEMO_SERVER.metadata,
    });

    expect(result).toMatchObject({
      status: 'ready',
      configured: true,
      healthy: true,
      allowed: false,
      failClosed: true,
      mode: 'local_demo_precheck',
      policy: {
        readOnly: true,
        remoteExecution: false,
        writeToolsAllowed: false,
        externalNetworkAllowed: false,
        requiresApproval: true,
        sandboxOnly: true,
        allowRuntimeExecution: false,
        blockedByDefault: true,
        externalProviderAllowed: false,
        realEmbeddingsAllowed: false,
        chatAgentRunAllowed: false,
        executionMode: 'precheck_only',
      },
    });
  });

  it('catalogs exactly the three requested read-only tools without write capability', () => {
    expect(MCP_LOCAL_DEMO_TOOLS.map((tool) => tool.name)).toEqual([
      'corporate.status.read',
      'corporate.policy.lookup',
      'corporate.document.search.placeholder',
    ]);
    expect(MCP_LOCAL_DEMO_SERVER.metadata).toMatchObject({
      localDemo: true,
      readOnly: true,
      remoteExecution: false,
      writeToolsAllowed: false,
      externalNetworkAllowed: false,
      sandboxOnly: true,
    });
  });

  it('uses only upserts and reasserts fail-closed values on repeated seeds', async () => {
    const { prisma, tx } = createSeedPrismaMock();
    const scope = {
      tenantId: '00000000-0000-4000-8000-000000000010',
      workspaceId: '00000000-0000-4000-8000-000000000020',
      adminUserId: '00000000-0000-4000-8000-000000000030',
      assistantId: '00000000-0000-4000-8000-000000000040',
    };

    await seedMcpLocalDemo(prisma, scope);
    await seedMcpLocalDemo(prisma, scope);

    expect(tx.mcpServer.upsert).toHaveBeenCalledTimes(2);
    expect(tx.mcpTool.upsert).toHaveBeenCalledTimes(MCP_LOCAL_DEMO_TOOLS.length * 2);
    expect(tx.mcpToolPolicy.upsert).toHaveBeenCalledTimes((MCP_LOCAL_DEMO_TOOLS.length + 1) * 2);
    expect(tx.assistantMcpBinding.upsert).toHaveBeenCalledTimes(MCP_LOCAL_DEMO_TOOLS.length * 2);
    expect(tx.auditLog.upsert).toHaveBeenCalledTimes(2);

    for (const call of tx.mcpServer.upsert.mock.calls) {
      expect(call[0]).toMatchObject({
        update: { tenantId: scope.tenantId, workspaceId: scope.workspaceId },
        create: { tenantId: scope.tenantId, workspaceId: scope.workspaceId },
      });
    }

    for (const call of tx.mcpTool.upsert.mock.calls) {
      expect(call[0]).toMatchObject({
        update: {
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          riskLevel: 'low',
          requiresApproval: true,
          isEnabled: true,
          deletedAt: null,
        },
        create: {
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          riskLevel: 'low',
          requiresApproval: true,
          isEnabled: true,
        },
      });
      expect(call[0].update.metadata).toMatchObject({
        readOnly: true,
        writeOperation: false,
        remoteExecution: false,
        externalNetworkAllowed: false,
        allowRuntimeExecution: false,
      });
    }

    for (const call of tx.mcpToolPolicy.upsert.mock.calls) {
      expect(call[0]).toMatchObject({
        update: { tenantId: scope.tenantId, workspaceId: scope.workspaceId },
        create: { tenantId: scope.tenantId, workspaceId: scope.workspaceId },
      });
    }

    for (const call of tx.assistantMcpBinding.upsert.mock.calls) {
      expect(call[0]).toMatchObject({
        update: { tenantId: scope.tenantId, workspaceId: scope.workspaceId },
        create: { tenantId: scope.tenantId, workspaceId: scope.workspaceId },
      });
    }
  });
});
