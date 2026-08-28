import { describe, expect, it, vi, afterEach } from 'vitest';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  MCP_REMOTE_CATALOG_APPLY_IN_PROGRESS,
  McpRemoteCatalogImportApplyPersistenceRepository,
  type McpRemoteCatalogImportApplyAuditRecord,
  type McpRemoteCatalogImportApplyAuditWriter,
} from '../../src/modules/mcp/remote/mcp-remote-catalog-import-apply.repository';
import { McpRemoteCatalogImportApplyService } from '../../src/modules/mcp/remote/mcp-remote-catalog-import-apply.service';
import type {
  McpRemoteCatalogApplyMutationContext,
  McpRemoteCatalogImportApplyAuditEvent,
  McpRemoteCatalogImportApplyResult,
  McpRemoteCatalogImportOperation,
  McpRemoteCatalogImportPlan,
  McpRemoteCatalogPolicyDraft,
  McpRemoteCatalogToolDraft,
} from '../../src/modules/mcp/remote/mcp-remote.types';

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const serverId = '00000000-0000-0000-0000-000000000701';
const approvedByUserId = '00000000-0000-0000-0000-000000000040';
const appliedAt = '2026-06-27T16:00:00.000Z';
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const hashC = 'c'.repeat(64);
const hashD = 'd'.repeat(64);
const hashE = 'e'.repeat(64);

type EntryRow = {
  id: string;
  tenantId: string;
  workspaceId: string;
  mcpServerId: string;
  externalName: string;
  displayName: string;
  description: string | null;
  source: string;
  lifecycleStatus: string;
  riskLevel: string;
  requiresApproval: boolean;
  specHash: string;
  catalogHash: string;
  inputSchema: unknown;
  outputSchema: unknown;
  allowRuntimeExecution: boolean;
  sandboxOnly: boolean;
  blockedByDefault: boolean;
  approvalMode: string;
  runtimeEnabled: boolean;
  remoteExecutionEnabled: boolean;
  snapshotId: string;
  snapshotHash: string;
  lastPlanId: string;
  lastPlanHash: string;
  lastApplyId: string;
  lastApplyHash: string;
  revision: number;
  importedByUserId: string | null;
  importedAt: Date;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  deprecatedByUserId: string | null;
  deprecatedAt: Date | null;
  deprecationReasonHash: string | null;
  materializedMcpToolId: string | null;
  internalMetadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type LedgerRow = {
  id: string;
  tenantId: string;
  workspaceId: string;
  mcpServerId: string;
  planId: string;
  planHash: string;
  snapshotHash: string;
  applyId: string;
  applyHash: string;
  idempotencyKey: string;
  approvedByUserId: string | null;
  approvalReasonHash: string | null;
  status: string;
  summary: unknown;
  operationResults: unknown;
  schemaVersion: number;
  createdAt: Date;
  completedAt: Date | null;
};

class FakeAuditWriter implements McpRemoteCatalogImportApplyAuditWriter {
  readonly records: McpRemoteCatalogImportApplyAuditRecord[] = [];

  async record(input: McpRemoteCatalogImportApplyAuditRecord): Promise<void> {
    this.records.push(input);
  }
}

class FakeRemoteCatalogPrisma {
  readonly entries: EntryRow[] = [];
  readonly ledgers: LedgerRow[] = [];
  readonly servers = [{ id: serverId, tenantId, workspaceId }];
  readonly operationalWrites = {
    mcpTool: 0,
    mcpToolPolicy: 0,
    assistantMcpBinding: 0,
    mcpToolCall: 0,
  };
  transactionCalls = 0;
  lastIsolationLevel: unknown;

  readonly mcpServer = {
    findFirst: async ({ where }: { where: { id: string; tenantId: string; workspaceId: string } }) => (
      this.servers.find((server) => server.id === where.id && server.tenantId === where.tenantId && server.workspaceId === where.workspaceId) ?? null
    ),
  };

  readonly mcpRemoteCatalogEntry = {
    findFirst: async ({ where }: { where: Partial<EntryRow> }) => (
      this.entries.find((entry) => this.matchesEntry(entry, where)) ?? null
    ),
    findUnique: async ({ where }: { where: { id: string } }) => (
      this.entries.find((entry) => entry.id === where.id) ?? null
    ),
    create: async ({ data }: { data: Partial<EntryRow> }) => {
      if (this.entries.some((entry) => (
        entry.tenantId === data.tenantId
        && entry.workspaceId === data.workspaceId
        && entry.mcpServerId === data.mcpServerId
        && entry.externalName === data.externalName
      ))) {
        throw new Error('unique entry conflict');
      }
      const now = new Date();
      const entry: EntryRow = {
        id: `entry_${this.entries.length + 1}`,
        tenantId: data.tenantId ?? tenantId,
        workspaceId: data.workspaceId ?? workspaceId,
        mcpServerId: data.mcpServerId ?? serverId,
        externalName: data.externalName ?? 'remote_health',
        displayName: data.displayName ?? 'Remote health',
        description: data.description ?? null,
        source: data.source ?? 'remote_discovery',
        lifecycleStatus: data.lifecycleStatus ?? 'draft',
        riskLevel: data.riskLevel ?? 'medium',
        requiresApproval: data.requiresApproval ?? true,
        specHash: data.specHash ?? hashA,
        catalogHash: data.catalogHash ?? hashB,
        inputSchema: data.inputSchema ?? null,
        outputSchema: data.outputSchema ?? null,
        allowRuntimeExecution: data.allowRuntimeExecution ?? false,
        sandboxOnly: data.sandboxOnly ?? true,
        blockedByDefault: data.blockedByDefault ?? true,
        approvalMode: data.approvalMode ?? 'manual',
        runtimeEnabled: data.runtimeEnabled ?? false,
        remoteExecutionEnabled: data.remoteExecutionEnabled ?? false,
        snapshotId: data.snapshotId ?? 'snapshot_11j',
        snapshotHash: data.snapshotHash ?? hashC,
        lastPlanId: data.lastPlanId ?? 'plan_11j',
        lastPlanHash: data.lastPlanHash ?? hashD,
        lastApplyId: data.lastApplyId ?? 'apply_11j',
        lastApplyHash: data.lastApplyHash ?? hashE,
        revision: data.revision ?? 1,
        importedByUserId: data.importedByUserId ?? null,
        importedAt: data.importedAt ?? now,
        approvedByUserId: data.approvedByUserId ?? null,
        approvedAt: data.approvedAt ?? null,
        deprecatedByUserId: data.deprecatedByUserId ?? null,
        deprecatedAt: data.deprecatedAt ?? null,
        deprecationReasonHash: data.deprecationReasonHash ?? null,
        materializedMcpToolId: data.materializedMcpToolId ?? null,
        internalMetadata: data.internalMetadata ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      this.entries.push(entry);
      return entry;
    },
    updateMany: async ({ where, data }: { where: Partial<EntryRow> & { id?: string | { in: string[] } }; data: Record<string, unknown> }) => {
      const matched = this.entries.filter((entry) => this.matchesEntry(entry, where));
      for (const entry of matched) this.applyEntryData(entry, data);
      return { count: matched.length };
    },
  };

  readonly mcpRemoteCatalogApplyLedger = {
    findFirst: async ({ where }: { where: Partial<LedgerRow> }) => (
      this.ledgers.find((ledger) => this.matchesLedger(ledger, where)) ?? null
    ),
    create: async ({ data }: { data: Partial<LedgerRow> }) => {
      if (this.ledgers.some((ledger) => (
        ledger.tenantId === data.tenantId
        && ledger.workspaceId === data.workspaceId
        && ledger.mcpServerId === data.mcpServerId
        && (
          ledger.idempotencyKey === data.idempotencyKey
          || ledger.applyId === data.applyId
          || ledger.planId === data.planId
        )
      ))) {
        throw new Prisma.PrismaClientKnownRequestError(
          'unique ledger conflict',
          {
            code: 'P2002',
            clientVersion: Prisma.prismaVersion.client,
            meta: {
              target: [
                'tenant_id',
                'workspace_id',
                'server_id',
                'plan_id',
              ],
            },
          },
        );
      }
      const ledger: LedgerRow = {
        id: `ledger_${this.ledgers.length + 1}`,
        tenantId: data.tenantId ?? tenantId,
        workspaceId: data.workspaceId ?? workspaceId,
        mcpServerId: data.mcpServerId ?? serverId,
        planId: data.planId ?? 'plan_11j',
        planHash: data.planHash ?? hashD,
        snapshotHash: data.snapshotHash ?? hashC,
        applyId: data.applyId ?? 'apply_11j',
        applyHash: data.applyHash ?? hashE,
        idempotencyKey: data.idempotencyKey ?? hashA,
        approvedByUserId: data.approvedByUserId ?? null,
        approvalReasonHash: data.approvalReasonHash ?? null,
        status: data.status ?? 'started',
        summary: data.summary ?? null,
        operationResults: data.operationResults ?? null,
        schemaVersion: data.schemaVersion ?? 1,
        createdAt: new Date(),
        completedAt: data.completedAt ?? null,
      };
      this.ledgers.push(ledger);
      return ledger;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<LedgerRow> }) => {
      const ledger = this.ledgers.find((item) => item.id === where.id);
      if (!ledger) throw new Error('ledger not found');
      Object.assign(ledger, data);
      return ledger;
    },
  };

  async $transaction<T>(fn: (transaction: this) => Promise<T>, options?: { isolationLevel?: unknown }) {
    this.transactionCalls += 1;
    this.lastIsolationLevel = options?.isolationLevel;
    return fn(this);
  }

  private matchesEntry(entry: EntryRow, where: Partial<EntryRow> & { id?: string | { in: string[] } }) {
    return Object.entries(where).every(([key, value]) => {
      if (typeof value === 'undefined') return true;
      const current = entry[key as keyof EntryRow];
      if (key === 'id' && typeof value === 'object' && value !== null && 'in' in value) {
        return (value.in as string[]).includes(entry.id);
      }
      return current === value;
    });
  }

  private matchesLedger(ledger: LedgerRow, where: Partial<LedgerRow>) {
    return Object.entries(where).every(([key, value]) => (
      typeof value === 'undefined' ? true : ledger[key as keyof LedgerRow] === value
    ));
  }

  private applyEntryData(entry: EntryRow, data: Record<string, unknown>) {
    for (const [key, value] of Object.entries(data)) {
      if (key === 'revision' && typeof value === 'object' && value && 'increment' in value) {
        entry.revision += Number((value as { increment: number }).increment);
      } else {
        (entry as unknown as Record<string, unknown>)[key] = value;
      }
    }
    entry.updatedAt = new Date();
  }
}

const closedPolicy: McpRemoteCatalogPolicyDraft = {
  allowRuntimeExecution: false,
  sandboxOnly: true,
  blockedByDefault: true,
  requiresApproval: true,
  approvalMode: 'manual',
  runtimeEnabled: false,
  remoteExecutionEnabled: false,
};

function applyContext(overrides: Partial<McpRemoteCatalogApplyMutationContext> = {}): McpRemoteCatalogApplyMutationContext {
  return {
    planId: 'plan_11j',
    planHash: hashD,
    snapshotId: 'snapshot_11j',
    snapshotHash: hashC,
    applyId: 'mcp_remote_catalog_apply_11j',
    applyHash: hashE,
    idempotencyKey: hashA,
    approvedByUserId,
    approvedAt: appliedAt,
    appliedAt,
    ...overrides,
  };
}

function draft(externalName: string, metadata: Record<string, unknown> = {}): McpRemoteCatalogToolDraft {
  return {
    externalName,
    displayName: 'Remote draft',
    description: 'Remote draft description',
    inputSchema: {
      type: 'object',
      properties: {
        safe: { type: 'string' },
      },
    },
    outputSchema: { type: 'object' },
    specHash: hashA,
    source: 'remote_discovery',
    remote: {
      serverId,
      importedFromSnapshotId: 'snapshot_11j',
      importedFromSnapshotHash: hashC,
    },
    metadata: { riskLevel: 'low', ...metadata },
  };
}

function createOperation(externalName = 'remote_health'): McpRemoteCatalogImportOperation {
  return {
    operationId: `operation_11j_create_${externalName}`,
    type: 'create_tool_draft',
    externalName,
    displayName: 'Remote health',
    specHash: hashA,
    riskLevel: 'low',
    requiresApproval: true,
    canApply: false,
    canApplyAutomatically: false,
    reason: 'Governed import after manual approval.',
    catalogDraft: draft(externalName),
    policyDraft: closedPolicy,
    validationMessages: [],
  };
}

function importPlan(operation = createOperation()): McpRemoteCatalogImportPlan {
  return {
    planId: 'plan_11j',
    planHash: hashD,
    snapshotId: 'snapshot_11j',
    snapshotHash: hashC,
    serverId,
    tenantId,
    workspaceId,
    requestedByUserId: approvedByUserId,
    requestId: 'request_11j',
    createdAt: '2026-06-27T15:00:00.000Z',
    sourceDecisionStatus: 'approved_for_future_import',
    status: 'ready_for_manual_apply',
    operations: [operation],
    summary: { totalOperations: 1, create: 1, update: 0, deprecate: 0, noop: 0, blocked: 0 },
    riskSummary: { low: 1, medium: 0, high: 0, critical: 0 },
    validation: { valid: true, errors: [], warnings: [] },
    preflight: { canApply: false, canApplyAutomatically: false, requiresManualApproval: true, checks: [] },
    auditEvent: {
      type: 'mcp.remote.catalog_import_plan.created',
      tenantId,
      workspaceId,
      serverId,
      requestId: 'request_11j',
      snapshotHash: hashC,
      planHash: hashD,
      status: 'ready_for_manual_apply',
      counts: { totalOperations: 1 },
      riskSummary: { low: 1 },
      operationTypes: [operation.type],
      metadata: {},
    },
    sanitizedMetadata: { noRuntimePublish: true, noToolExecution: true },
  };
}

function repositoryWith(fake = new FakeRemoteCatalogPrisma(), writer = new FakeAuditWriter()) {
  return {
    fake,
    writer,
    repository: new McpRemoteCatalogImportApplyPersistenceRepository(writer, fake as unknown as PrismaClient),
  };
}

function auditEvent(metadata: Record<string, unknown> = {}): McpRemoteCatalogImportApplyAuditEvent {
  return {
    type: 'mcp.remote.catalog_import_apply.executed',
    tenantId,
    workspaceId,
    serverId,
    planHash: hashD,
    applyHash: hashE,
    approvedByUserId,
    status: 'applied',
    counts: { total: 1, applied: 1 },
    operationTypes: ['create_tool_draft'],
    metadata,
  };
}

describe('MCP remote catalog import apply persistence repository 11J', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses a real transaction boundary with serializable isolation when available', async () => {
    const { fake, repository } = repositoryWith();

    await repository.withTransaction(async (transaction) => {
      await transaction.findByExternalName({ tenantId, workspaceId, serverId, externalName: 'missing' });
      return null;
    });

    expect(fake.transactionCalls).toBe(1);
    expect(String(fake.lastIsolationLevel)).toContain('Serializable');
  });

  it('finds entries only by full tenant/workspace/server/externalName scope', async () => {
    const { fake, repository } = repositoryWith();
    await fake.mcpRemoteCatalogEntry.create({
      data: {
        tenantId,
        workspaceId,
        mcpServerId: serverId,
        externalName: 'remote_health',
        specHash: hashA,
        catalogHash: hashB,
      },
    });
    await fake.mcpRemoteCatalogEntry.create({
      data: {
        tenantId: '00000000-0000-0000-0000-000000009999',
        workspaceId,
        mcpServerId: serverId,
        externalName: 'remote_health',
        specHash: hashA,
        catalogHash: hashB,
      },
    });

    await expect(repository.findByExternalName({
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
    })).resolves.toMatchObject({ externalName: 'remote_health', revision: 1 });
    await expect(repository.findByExternalName({
      tenantId,
      workspaceId: '00000000-0000-0000-0000-000000009999',
      serverId,
      externalName: 'remote_health',
    })).resolves.toBeNull();
  });

  it('creates a remote catalog entry with fail-closed guardrails and no operational materialization', async () => {
    const { fake, repository } = repositoryWith();

    const created = await repository.createToolDraft({
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
      displayName: 'Remote health',
      specHash: hashA,
      riskLevel: 'low',
      catalogDraft: draft('remote_health', { secretRef: 'vault-entry', safe: 'kept' }),
      policyDraft: closedPolicy,
      applyContext: applyContext(),
    });

    expect(created.id).toBe('entry_1');
    expect(fake.entries[0]).toMatchObject({
      externalName: 'remote_health',
      lifecycleStatus: 'approved_for_catalog',
      riskLevel: 'low',
      requiresApproval: true,
      allowRuntimeExecution: false,
      sandboxOnly: true,
      blockedByDefault: true,
      approvalMode: 'manual',
      runtimeEnabled: false,
      remoteExecutionEnabled: false,
      materializedMcpToolId: null,
    });
    expect(JSON.stringify(fake.entries[0]).toLowerCase()).not.toContain('secretref');
    expect(JSON.stringify(fake.entries[0]).toLowerCase()).not.toContain('vault-entry');
    expect(fake.operationalWrites).toEqual({ mcpTool: 0, mcpToolPolicy: 0, assistantMcpBinding: 0, mcpToolCall: 0 });
  });

  it('updates an entry in scope, increments revision and preserves identity', async () => {
    const { fake, repository } = repositoryWith();
    const created = await repository.createToolDraft({
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
      catalogDraft: draft('remote_health'),
      policyDraft: closedPolicy,
      applyContext: applyContext(),
    });

    await repository.updateToolDraft({
      id: created.id,
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
      displayName: 'Remote health v2',
      specHash: hashB,
      expectedRevision: 1,
      catalogDraft: draft('remote_health'),
      policyDraft: closedPolicy,
      applyContext: applyContext({ applyHash: hashB }),
    });

    expect(fake.entries[0].displayName).toBe('Remote health v2');
    expect(fake.entries[0].externalName).toBe('remote_health');
    expect(fake.entries[0].revision).toBe(2);
    await expect(repository.updateToolDraft({
      id: created.id,
      tenantId,
      workspaceId,
      serverId,
      externalName: 'renamed_health',
      catalogDraft: draft('renamed_health'),
      policyDraft: closedPolicy,
      applyContext: applyContext(),
    })).rejects.toMatchObject({ code: 'MCP_REMOTE_CATALOG_APPLY_CONFLICT' });
  });

  it('deprecates an entry without hard delete or runtime side effects', async () => {
    const { fake, repository } = repositoryWith();
    const created = await repository.createToolDraft({
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
      catalogDraft: draft('remote_health'),
      policyDraft: closedPolicy,
      applyContext: applyContext(),
    });

    await repository.deprecateToolDraft({
      id: created.id,
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
      reason: 'Removed remotely.',
      expectedRevision: 1,
      applyContext: applyContext({ applyHash: hashB }),
    });

    expect(fake.entries).toHaveLength(1);
    expect(fake.entries[0].lifecycleStatus).toBe('deprecated');
    expect(fake.entries[0].deletedAt).toBeNull();
    expect(fake.entries[0].deprecatedByUserId).toBe(approvedByUserId);
    expect(fake.operationalWrites).toEqual({ mcpTool: 0, mcpToolPolicy: 0, assistantMcpBinding: 0, mcpToolCall: 0 });
  });

  it('reserves and finalizes apply ledger, then returns an idempotent stored result', async () => {
    const { fake, repository } = repositoryWith();
    await repository.reserveApply({
      ...applyContext(),
      tenantId,
      workspaceId,
      serverId,
      approvalReasonHash: hashB,
    });
    const result: McpRemoteCatalogImportApplyResult = {
      applyId: 'mcp_remote_catalog_apply_11j',
      applyHash: hashE,
      idempotencyKey: hashA,
      planId: 'plan_11j',
      planHash: hashD,
      snapshotHash: hashC,
      serverId,
      tenantId,
      workspaceId,
      approvedByUserId,
      appliedAt,
      status: 'applied',
      operationResults: [{
        operationId: 'op_1',
        type: 'create_tool_draft',
        externalName: 'remote_health',
        status: 'applied',
        catalogItemId: 'entry_1',
        reason: 'Created.',
        runtimeEnabled: false,
        remoteExecutionEnabled: false,
      }],
      summary: { total: 1, applied: 1, blocked: 0, skipped: 0, failed: 0, noop: 0, idempotent: 0 },
      auditEvent: auditEvent(),
      sanitizedMetadata: { noRuntimeEnablement: true },
      rollbackNotes: [],
    };

    await repository.saveApplyResult({ idempotencyKey: hashA, result });
    const stored = await repository.findApplyByIdempotencyKey({ tenantId, workspaceId, serverId, idempotencyKey: hashA });

    expect(fake.ledgers[0]).toMatchObject({ status: 'applied', schemaVersion: 1 });
    expect(stored).toMatchObject({
      applyId: result.applyId,
      applyHash: result.applyHash,
      status: 'applied',
      summary: result.summary,
      operationResults: result.operationResults,
    });
  });

  it('blocks a started ledger instead of applying twice silently', async () => {
    const { repository } = repositoryWith();
    await repository.reserveApply({
      ...applyContext(),
      tenantId,
      workspaceId,
      serverId,
      approvalReasonHash: hashB,
    });

    await expect(repository.findApplyByIdempotencyKey({
      tenantId,
      workspaceId,
      serverId,
      idempotencyKey: hashA,
    })).rejects.toMatchObject({ code: MCP_REMOTE_CATALOG_APPLY_IN_PROGRESS });
    await expect(repository.reserveApply({
      ...applyContext(),
      tenantId,
      workspaceId,
      serverId,
      approvalReasonHash: hashB,
    })).rejects.toMatchObject({ code: MCP_REMOTE_CATALOG_APPLY_IN_PROGRESS });
  });

  it('blocks a second reservation for the same plan with another idempotency key', async () => {
    const { fake, repository } = repositoryWith();

    await repository.reserveApply({
      ...applyContext(),
      tenantId,
      workspaceId,
      serverId,
      approvalReasonHash: hashB,
    });

    await expect(
      repository.reserveApply({
        ...applyContext({
          applyId: 'mcp_remote_catalog_apply_second_approver',
          applyHash: hashB,
          idempotencyKey: hashC,
          approvedByUserId: '00000000-0000-0000-0000-000000000041',
        }),
        tenantId,
        workspaceId,
        serverId,
        approvalReasonHash: hashB,
      }),
    ).rejects.toMatchObject({
      code: MCP_REMOTE_CATALOG_APPLY_IN_PROGRESS,
    });

    expect(fake.ledgers).toHaveLength(1);
  });

  it('does not mutate the catalog twice when another approver applies the same plan', async () => {
    const { fake, repository } = repositoryWith();
    const service = new McpRemoteCatalogImportApplyService(repository);

    const firstInput = {
      plan: importPlan(),
      authorization: {
        approvedByUserId,
        approvalReason: 'Human review approved the blocked draft.',
        confirmManualApply: true,
      },
      appliedAt,
    };

    const first = await service.applyImportPlan(firstInput);

    const second = await service.applyImportPlan({
      ...firstInput,
      authorization: {
        ...firstInput.authorization,
        approvedByUserId: '00000000-0000-0000-0000-000000000041',
      },
      appliedAt: '2026-06-27T17:00:00.000Z',
    });

    expect(first.status).toBe('applied');
    expect(second.status).toBe('blocked');

    expect(fake.entries).toHaveLength(1);
    expect(fake.ledgers).toHaveLength(1);

    expect(fake.operationalWrites).toEqual({
      mcpTool: 0,
      mcpToolPolicy: 0,
      assistantMcpBinding: 0,
      mcpToolCall: 0,
    });
  });

  it('keeps sanitized audit data through the existing audit port', async () => {
    const writer = new FakeAuditWriter();
    const { repository } = repositoryWith(new FakeRemoteCatalogPrisma(), writer);
    await repository.recordAuditEvent({
      type: 'ignored-by-allowlist',
      tenantId,
      workspaceId,
      serverId,
      event: auditEvent({
        safe: 'kept',
        secretRef: 'vault-entry',
        nested: { token: 'sensitive', note: ['Bearer', 'very-sensitive-value'].join(' ') },
        baseUrl: 'https://user:pass@example.test',
      }),
    });

    const serialized = JSON.stringify(writer.records[0]).toLowerCase();
    expect(writer.records).toHaveLength(1);
    expect(writer.records[0].event.metadata).toMatchObject({ safe: 'kept', nested: { note: '[redacted]' } });
    expect(serialized).not.toContain('secretref');
    expect(serialized).not.toContain('vault-entry');
    expect(serialized).not.toContain('very-sensitive-value');
    expect(serialized).not.toContain('baseurl');
    expect(serialized).not.toContain('user:pass');
  });

  it('keeps the 11F apply service working with the real repository and ledger idempotency', async () => {
    const { fake, writer, repository } = repositoryWith();
    const service = new McpRemoteCatalogImportApplyService(repository);
    const input = {
      plan: importPlan(),
      authorization: {
        approvedByUserId,
        approvalReason: 'Human review approved the blocked draft.',
        confirmManualApply: true,
      },
      appliedAt,
    };

    const first = await service.applyImportPlan(input);
    const second = await service.applyImportPlan({ ...input, appliedAt: '2026-06-27T17:00:00.000Z' });

    expect(first.status).toBe('applied');
    expect(second.applyId).toBe(first.applyId);
    expect(fake.entries).toHaveLength(1);
    expect(fake.ledgers).toHaveLength(1);
    expect(fake.ledgers[0].status).toBe('applied');
    expect(writer.records).toHaveLength(1);
    expect(fake.operationalWrites).toEqual({ mcpTool: 0, mcpToolPolicy: 0, assistantMcpBinding: 0, mcpToolCall: 0 });
  });

  it('does not call network or execute tools', async () => {
    const fetchMock = vi.fn();
    const executeTool = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { repository } = repositoryWith();

    await repository.createToolDraft({
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
      catalogDraft: draft('remote_health'),
      policyDraft: closedPolicy,
      applyContext: applyContext(),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(executeTool).not.toHaveBeenCalled();
  });
});
