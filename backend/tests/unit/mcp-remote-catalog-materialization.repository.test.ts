import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { McpRemoteCatalogMaterializationRepository } from '../../src/modules/mcp/remote/mcp-remote-catalog-materialization.repository';

const TENANT_ID = '00000000-0000-0000-0000-000000000010';
const WORKSPACE_ID = '00000000-0000-0000-0000-000000000020';
const SERVER_ID = '00000000-0000-0000-0000-000000000030';
const ENTRY_ID = '00000000-0000-0000-0000-000000000040';
const TOOL_ID = '00000000-0000-0000-0000-000000000050';
const USER_ID = '00000000-0000-0000-0000-000000000060';

function entryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: ENTRY_ID,
    tenantId: TENANT_ID,
    workspaceId: WORKSPACE_ID,
    mcpServerId: SERVER_ID,

    externalName: 'corporate.status.read',
    displayName: 'Corporate Status Read',
    description: 'Read-only corporate status endpoint.',

    lifecycleStatus: 'approved_for_catalog',
    riskLevel: 'low',
    requiresApproval: true,

    specHash: 'a'.repeat(64),
    catalogHash: 'b'.repeat(64),

    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
    },

    allowRuntimeExecution: false,
    sandboxOnly: true,
    blockedByDefault: true,
    approvalMode: 'manual',

    runtimeEnabled: false,
    remoteExecutionEnabled: false,

    snapshotHash: 'c'.repeat(64),
    lastPlanHash: 'd'.repeat(64),
    lastApplyHash: 'e'.repeat(64),

    approvedByUserId: USER_ID,
    approvedAt: new Date('2026-08-28T17:48:25.000Z'),

    materializedMcpToolId: null,
    deletedAt: null,

    server: {
      id: SERVER_ID,
      tenantId: TENANT_ID,
      workspaceId: WORKSPACE_ID,
      serverType: 'remote',
      status: 'active',
      deletedAt: null,
    },

    ...overrides,
  };
}

function toolFixture() {
  return {
    id: TOOL_ID,
    tenantId: TENANT_ID,
    workspaceId: WORKSPACE_ID,
    mcpServerId: SERVER_ID,

    name: 'corporate.status.read',
    description: 'Read-only corporate status endpoint.',

    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
    },

    riskLevel: 'low',
    requiresApproval: true,
    isEnabled: false,

    metadata: {
      source: 'remote_catalog_materialization',
    },

    createdAt: new Date('2026-08-28T18:00:00.000Z'),
    updatedAt: new Date('2026-08-28T18:00:00.000Z'),
    deletedAt: null,

    policies: [
      {
        id: '00000000-0000-0000-0000-000000000070',
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        mcpServerId: SERVER_ID,
        mcpToolId: TOOL_ID,

        allowRuntimeExecution: false,
        sandboxOnly: true,
        requiresApproval: true,
        blockedByDefault: true,

        metadata: {
          source: 'remote_catalog_materialization',
        },

        createdAt: new Date('2026-08-28T18:00:00.000Z'),
        updatedAt: new Date('2026-08-28T18:00:00.000Z'),
      },
    ],
  };
}

function fakePersistence() {
  const transactionClient = {
    mcpRemoteCatalogEntry: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    mcpTool: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };

  const transaction = vi.fn(
    async (
      callback: (
        tx: typeof transactionClient,
      ) => Promise<unknown>,
    ) => callback(transactionClient),
  );

  const db = {
    $transaction: transaction,
  } as unknown as PrismaClient;

  return {
    db,
    transaction,
    tx: transactionClient,
  };
}

describe('McpRemoteCatalogMaterializationRepository', () => {
  it('materializes an approved catalog entry as a disabled closed-policy McpTool', async () => {
    const persistence = fakePersistence();
    const entry = entryFixture();
    const tool = toolFixture();

    persistence.tx.mcpRemoteCatalogEntry.findFirst.mockResolvedValue(entry);
    persistence.tx.mcpTool.create.mockResolvedValue(tool);
    persistence.tx.mcpRemoteCatalogEntry.updateMany.mockResolvedValue({
      count: 1,
    });

    const repository = new McpRemoteCatalogMaterializationRepository(
      persistence.db,
    );

    const result = await repository.materialize({
      entryId: ENTRY_ID,
      tenantId: TENANT_ID,
      workspaceIds: [WORKSPACE_ID],
    });

    expect(result.status).toBe('materialized');

    if (result.status !== 'materialized') {
      throw new Error('Expected materialized result.');
    }

    expect(result.tool.id).toBe(TOOL_ID);
    expect(result.entry.materializedMcpToolId).toBe(TOOL_ID);

    expect(persistence.tx.mcpTool.create).toHaveBeenCalledTimes(1);

    expect(persistence.tx.mcpTool.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          workspaceId: WORKSPACE_ID,
          mcpServerId: SERVER_ID,

          name: 'corporate.status.read',
          riskLevel: 'low',

          requiresApproval: true,
          isEnabled: false,

          metadata: expect.objectContaining({
            source: 'remote_catalog_materialization',
            remoteCatalog: true,
            remoteCatalogEntryId: ENTRY_ID,
            externalName: 'corporate.status.read',
            displayName: 'Corporate Status Read',
            readOnly: true,
            noRuntimeExecution: true,
            noRemoteExecution: true,
          }),

          policies: {
            create: expect.objectContaining({
              allowRuntimeExecution: false,
              sandboxOnly: true,
              requiresApproval: true,
              blockedByDefault: true,
            }),
          },
        }),
      }),
    );

    expect(
      persistence.tx.mcpRemoteCatalogEntry.updateMany,
    ).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: ENTRY_ID,
        tenantId: TENANT_ID,
        workspaceId: WORKSPACE_ID,
        mcpServerId: SERVER_ID,
        materializedMcpToolId: null,
      }),
      data: {
        materializedMcpToolId: TOOL_ID,
      },
    });
  });

  it('returns the existing McpTool on an idempotent replay', async () => {
    const persistence = fakePersistence();
    const tool = toolFixture();

    persistence.tx.mcpRemoteCatalogEntry.findFirst.mockResolvedValue(
      entryFixture({
        materializedMcpToolId: TOOL_ID,
      }),
    );

    persistence.tx.mcpTool.findFirst.mockResolvedValue(tool);

    const repository = new McpRemoteCatalogMaterializationRepository(
      persistence.db,
    );

    const result = await repository.materialize({
      entryId: ENTRY_ID,
      tenantId: TENANT_ID,
      workspaceIds: [WORKSPACE_ID],
    });

    expect(result.status).toBe('already_materialized');

    if (result.status !== 'already_materialized') {
      throw new Error('Expected already_materialized result.');
    }

    expect(result.tool.id).toBe(TOOL_ID);

    expect(persistence.tx.mcpTool.create).not.toHaveBeenCalled();

    expect(
      persistence.tx.mcpRemoteCatalogEntry.updateMany,
    ).not.toHaveBeenCalled();
  });

  it('fails closed when the remote catalog policy attempts to open runtime', async () => {
    const persistence = fakePersistence();

    persistence.tx.mcpRemoteCatalogEntry.findFirst.mockResolvedValue(
      entryFixture({
        allowRuntimeExecution: true,
      }),
    );

    const repository = new McpRemoteCatalogMaterializationRepository(
      persistence.db,
    );

    const result = await repository.materialize({
      entryId: ENTRY_ID,
      tenantId: TENANT_ID,
      workspaceIds: [WORKSPACE_ID],
    });

    expect(result.status).toBe('blocked');

    if (result.status !== 'blocked') {
      throw new Error('Expected blocked result.');
    }

    expect(result.reason).toBe('policy_not_closed');

    expect(persistence.tx.mcpTool.create).not.toHaveBeenCalled();

    expect(
      persistence.tx.mcpRemoteCatalogEntry.updateMany,
    ).not.toHaveBeenCalled();
  });

  it('retries a lost materialization claim and returns the winning tool idempotently', async () => {
    const persistence = fakePersistence();
    const tool = toolFixture();

    persistence.tx.mcpRemoteCatalogEntry.findFirst
      .mockResolvedValueOnce(entryFixture())
      .mockResolvedValueOnce(
        entryFixture({
          materializedMcpToolId: TOOL_ID,
        }),
      );

    persistence.tx.mcpTool.create.mockResolvedValue(tool);

    // First transaction loses the atomic claim. Throwing from the
    // transaction callback is what causes Prisma/PostgreSQL to roll
    // back the temporary McpTool and policy in the real database.
    persistence.tx.mcpRemoteCatalogEntry.updateMany.mockResolvedValueOnce({
      count: 0,
    });

    persistence.tx.mcpTool.findFirst.mockResolvedValue(tool);

    const repository = new McpRemoteCatalogMaterializationRepository(
      persistence.db,
    );

    const result = await repository.materialize({
      entryId: ENTRY_ID,
      tenantId: TENANT_ID,
      workspaceIds: [WORKSPACE_ID],
    });

    expect(result.status).toBe('already_materialized');

    if (result.status !== 'already_materialized') {
      throw new Error('Expected already_materialized after retry.');
    }

    expect(result.tool.id).toBe(TOOL_ID);

    expect(persistence.transaction).toHaveBeenCalledTimes(2);

    // Only the losing first attempt reaches create.
    expect(persistence.tx.mcpTool.create).toHaveBeenCalledTimes(1);

    // Second attempt sees the winner's materializedMcpToolId and
    // therefore performs no second mutation.
    expect(
      persistence.tx.mcpRemoteCatalogEntry.updateMany,
    ).toHaveBeenCalledTimes(1);
  });

  it('blocks replay when materializedMcpToolId points to no scoped McpTool', async () => {
    const persistence = fakePersistence();

    persistence.tx.mcpRemoteCatalogEntry.findFirst.mockResolvedValue(
      entryFixture({
        materializedMcpToolId: TOOL_ID,
      }),
    );

    persistence.tx.mcpTool.findFirst.mockResolvedValue(null);

    const repository = new McpRemoteCatalogMaterializationRepository(
      persistence.db,
    );

    const result = await repository.materialize({
      entryId: ENTRY_ID,
      tenantId: TENANT_ID,
      workspaceIds: [WORKSPACE_ID],
    });

    expect(result.status).toBe('blocked');

    if (result.status !== 'blocked') {
      throw new Error('Expected blocked integrity result.');
    }

    expect(result.reason).toBe('materialization_integrity_failed');
    expect(persistence.tx.mcpTool.create).not.toHaveBeenCalled();
  });
});
