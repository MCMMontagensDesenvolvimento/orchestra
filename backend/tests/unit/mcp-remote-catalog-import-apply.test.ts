import { describe, expect, it, vi, afterEach } from 'vitest';
import { McpRemoteCatalogImportApplyService } from '../../src/modules/mcp/remote/mcp-remote-catalog-import-apply.service';
import type {
  McpRemoteCatalogImportApplyAuditEvent,
  McpRemoteCatalogImportApplyAuthorization,
  McpRemoteCatalogImportApplyCatalogItem,
  McpRemoteCatalogImportApplyRepository,
  McpRemoteCatalogImportApplyResult,
  McpRemoteCatalogImportApplyTransaction,
  McpRemoteCatalogImportOperation,
  McpRemoteCatalogImportOperationType,
  McpRemoteCatalogImportPlan,
  McpRemoteCatalogImportPlanStatus,
  McpRemoteCatalogPolicyDraft,
  McpRemoteCatalogToolDraft,
  McpRemoteDiscoveryApprovalDecisionStatus,
} from '../../src/modules/mcp/remote/mcp-remote.types';

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const serverId = '00000000-0000-0000-0000-000000000701';
const requestedByUserId = '00000000-0000-0000-0000-000000000030';
const approvedByUserId = '00000000-0000-0000-0000-000000000040';
const appliedAt = '2026-06-26T20:00:00.000Z';

type FindInput = Parameters<McpRemoteCatalogImportApplyTransaction['findByExternalName']>[0];
type CreateInput = Parameters<McpRemoteCatalogImportApplyTransaction['createToolDraft']>[0];
type UpdateInput = Parameters<McpRemoteCatalogImportApplyTransaction['updateToolDraft']>[0];
type DeprecateInput = Parameters<McpRemoteCatalogImportApplyTransaction['deprecateToolDraft']>[0];

type FakeCatalogItem = McpRemoteCatalogImportApplyCatalogItem & {
  tenantId: string;
  workspaceId: string;
  serverId: string;
};

const closedPolicyDraft: McpRemoteCatalogPolicyDraft = {
  allowRuntimeExecution: false,
  sandboxOnly: true,
  blockedByDefault: true,
  requiresApproval: true,
  approvalMode: 'manual',
  runtimeEnabled: false,
  remoteExecutionEnabled: false,
};

const explicitAuthorization: McpRemoteCatalogImportApplyAuthorization = {
  approvedByUserId,
  approvalReason: 'Manual review approved import as blocked runtime catalog draft.',
  confirmManualApply: true,
  approvedAt: appliedAt,
  approvalTicketId: 'approval-ticket-11f',
};

function displayName(externalName: string) {
  return externalName.replace(/_/g, ' ');
}

function catalogDraft(externalName: string, specHash = `spec_${externalName}`): McpRemoteCatalogToolDraft {
  return {
    externalName,
    displayName: displayName(externalName),
    description: `Draft for ${externalName}`,
    specHash,
    source: 'remote_discovery',
    remote: {
      serverId,
      importedFromSnapshotId: 'mcp_remote_discovery_snapshot_apply_001',
      importedFromSnapshotHash: 'snapshot_hash_apply_001',
    },
    metadata: {
      riskLevel: 'low',
      operationSource: 'unit_test',
    },
  };
}

function operation(
  type: McpRemoteCatalogImportOperationType,
  externalName: string,
  overrides: Partial<McpRemoteCatalogImportOperation> = {},
): McpRemoteCatalogImportOperation {
  const specHash = overrides.specHash ?? `spec_${externalName}`;
  return {
    operationId: `op_${type}_${externalName}`,
    type,
    externalName,
    displayName: displayName(externalName),
    specHash,
    previousSpecHash: type === 'update_tool_draft' || type === 'deprecate_tool_draft' ? `previous_${externalName}` : null,
    riskLevel: 'low',
    requiresApproval: true,
    canApply: false,
    canApplyAutomatically: false,
    reason: `Apply ${type} for ${externalName}`,
    ...(type === 'blocked' ? {} : { catalogDraft: catalogDraft(externalName, specHash) }),
    policyDraft: closedPolicyDraft,
    validationMessages: [],
    ...overrides,
  };
}

function sourceDecisionStatus(status: McpRemoteCatalogImportPlanStatus): McpRemoteDiscoveryApprovalDecisionStatus {
  switch (status) {
    case 'blocked':
      return 'blocked';
    case 'pending_approval':
      return 'pending_human_review';
    case 'ready_for_manual_apply':
      return 'approved_for_future_import';
    case 'no_changes':
      return 'no_changes';
  }
}

function planSummary(operations: McpRemoteCatalogImportOperation[]): McpRemoteCatalogImportPlan['summary'] {
  return {
    totalOperations: operations.length,
    create: operations.filter((op) => op.type === 'create_tool_draft').length,
    update: operations.filter((op) => op.type === 'update_tool_draft').length,
    deprecate: operations.filter((op) => op.type === 'deprecate_tool_draft').length,
    noop: operations.filter((op) => op.type === 'noop').length,
    blocked: operations.filter((op) => op.type === 'blocked').length,
  };
}

function importPlan(
  status: McpRemoteCatalogImportPlanStatus,
  operations: McpRemoteCatalogImportOperation[],
  overrides: Partial<McpRemoteCatalogImportPlan> = {},
): McpRemoteCatalogImportPlan {
  const summary = planSummary(operations);
  return {
    planId: `mcp_remote_catalog_import_plan_${status}`,
    planHash: `plan_hash_${status}_${operations.map((op) => op.operationId).join('_')}`,
    snapshotId: 'mcp_remote_discovery_snapshot_apply_001',
    snapshotHash: 'snapshot_hash_apply_001',
    serverId,
    tenantId,
    workspaceId,
    requestedByUserId,
    requestId: 'req_apply_11f',
    createdAt: '2026-06-26T19:00:00.000Z',
    sourceDecisionStatus: sourceDecisionStatus(status),
    status,
    operations,
    summary,
    riskSummary: {
      low: operations.length,
      medium: 0,
      high: 0,
      critical: 0,
    },
    validation: {
      valid: true,
      errors: [],
      warnings: [],
    },
    preflight: {
      canApply: false,
      canApplyAutomatically: false,
      requiresManualApproval: status !== 'no_changes',
      checks: [],
    },
    auditEvent: {
      type: 'mcp.remote.catalog_import_plan.created',
      tenantId,
      workspaceId,
      serverId,
      requestId: 'req_apply_11f',
      snapshotHash: 'snapshot_hash_apply_001',
      planHash: `plan_hash_${status}_${operations.map((op) => op.operationId).join('_')}`,
      status,
      counts: summary,
      riskSummary: {
        low: operations.length,
        medium: 0,
        high: 0,
        critical: 0,
      },
      operationTypes: [...new Set(operations.map((op) => op.type))].sort(),
      metadata: {},
    },
    sanitizedMetadata: {
      noRuntimePublish: true,
      noToolExecution: true,
    },
    ...overrides,
  };
}

class FakeApplyRepository implements McpRemoteCatalogImportApplyRepository {
  readonly catalog = new Map<string, FakeCatalogItem>();
  readonly auditEvents: McpRemoteCatalogImportApplyAuditEvent[] = [];
  readonly savedResults = new Map<string, McpRemoteCatalogImportApplyResult>();
  createCalls = 0;
  updateCalls = 0;
  deprecateCalls = 0;
  transactionCalls = 0;
  failOn?: 'create' | 'update' | 'deprecate';

  seed(item: Partial<FakeCatalogItem> & Pick<FakeCatalogItem, 'externalName'>) {
    const seeded: FakeCatalogItem = {
      id: item.id ?? `catalog_${item.externalName}`,
      tenantId: item.tenantId ?? tenantId,
      workspaceId: item.workspaceId ?? workspaceId,
      serverId: item.serverId ?? serverId,
      externalName: item.externalName,
      specHash: item.specHash ?? `previous_${item.externalName}`,
      status: item.status ?? 'draft',
      catalogHash: item.catalogHash ?? `catalog_hash_${item.externalName}`,
    };
    this.catalog.set(this.key(seeded), seeded);
    return seeded;
  }

  async withTransaction<T>(fn: (transaction: McpRemoteCatalogImportApplyTransaction) => Promise<T>): Promise<T> {
    this.transactionCalls += 1;
    return fn(this);
  }

  async findByExternalName(input: FindInput): Promise<McpRemoteCatalogImportApplyCatalogItem | null> {
    return this.catalog.get(this.key(input)) ?? null;
  }

  async createToolDraft(input: CreateInput): Promise<{ id: string; catalogHash?: string | null }> {
    this.createCalls += 1;
    if (this.failOn === 'create') throw new Error('fake create failure');
    const id = `catalog_created_${this.createCalls}`;
    const catalogHash = `catalog_hash_created_${input.specHash ?? input.externalName}`;
    this.catalog.set(this.key(input), {
      id,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      serverId: input.serverId,
      externalName: input.externalName,
      specHash: input.specHash,
      status: 'draft',
      catalogHash,
    });
    return { id, catalogHash };
  }

  async updateToolDraft(input: UpdateInput): Promise<{ id: string; catalogHash?: string | null }> {
    this.updateCalls += 1;
    if (this.failOn === 'update') throw new Error('fake update failure');
    const catalogHash = `catalog_hash_updated_${input.specHash ?? input.externalName}`;
    this.catalog.set(this.key(input), {
      id: input.id,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      serverId: input.serverId,
      externalName: input.externalName,
      specHash: input.specHash,
      status: 'draft',
      catalogHash,
    });
    return { id: input.id, catalogHash };
  }

  async deprecateToolDraft(input: DeprecateInput): Promise<{ id: string; catalogHash?: string | null }> {
    this.deprecateCalls += 1;
    if (this.failOn === 'deprecate') throw new Error('fake deprecate failure');
    const existing = this.catalog.get(this.key(input));
    const catalogHash = `catalog_hash_deprecated_${input.externalName}`;
    this.catalog.set(this.key(input), {
      id: input.id,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      serverId: input.serverId,
      externalName: input.externalName,
      specHash: existing?.specHash,
      status: 'deprecated',
      catalogHash,
    });
    return { id: input.id, catalogHash };
  }

  async recordAuditEvent(input: { event: McpRemoteCatalogImportApplyAuditEvent }): Promise<void> {
    this.auditEvents.push(input.event);
  }

  async findApplyByIdempotencyKey(input: { idempotencyKey: string }): Promise<McpRemoteCatalogImportApplyResult | null> {
    return this.savedResults.get(input.idempotencyKey) ?? null;
  }

  async saveApplyResult(input: { idempotencyKey: string; result: McpRemoteCatalogImportApplyResult }): Promise<void> {
    this.savedResults.set(input.idempotencyKey, input.result);
  }

  private key(input: { tenantId: string; workspaceId: string; serverId: string; externalName: string }) {
    return `${input.tenantId}:${input.workspaceId}:${input.serverId}:${input.externalName}`;
  }
}

function serviceWith(repository = new FakeApplyRepository()) {
  return {
    repository,
    service: new McpRemoteCatalogImportApplyService(repository),
  };
}

describe('MCP remote catalog import apply', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('blocks apply without confirmManualApply=true', async () => {
    const { service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [operation('create_tool_draft', 'create_me')]),
      authorization: { ...explicitAuthorization, confirmManualApply: false },
      appliedAt,
    });

    expect(result.status).toBe('blocked');
    expect(result.operationResults[0].reason).toContain('confirmManualApply=true is required');
  });

  it('blocks apply without approvedByUserId', async () => {
    const { service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [operation('create_tool_draft', 'create_me')]),
      authorization: { ...explicitAuthorization, approvedByUserId: '' },
      appliedAt,
    });

    expect(result.status).toBe('blocked');
    expect(result.operationResults[0].reason).toContain('approvedByUserId is required');
  });

  it('blocks apply without approvalReason', async () => {
    const { service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [operation('create_tool_draft', 'create_me')]),
      authorization: { ...explicitAuthorization, approvalReason: '' },
      appliedAt,
    });

    expect(result.status).toBe('blocked');
    expect(result.operationResults[0].reason).toContain('approvalReason is required');
  });

  it('blocks a blocked plan', async () => {
    const { repository, service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('blocked', [operation('blocked', 'blocked_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(result.status).toBe('blocked');
    expect(repository.createCalls).toBe(0);
    expect(repository.auditEvents).toHaveLength(1);
  });

  it('returns no_changes without catalog mutation for a no_changes plan', async () => {
    const { repository, service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('no_changes', [operation('noop', 'keep_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(result.status).toBe('no_changes');
    expect(result.summary.noop).toBe(1);
    expect(repository.createCalls + repository.updateCalls + repository.deprecateCalls).toBe(0);
  });

  it('blocks a pending_approval plan without explicit option', async () => {
    const { repository, service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('pending_approval', [operation('create_tool_draft', 'create_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(result.status).toBe('blocked');
    expect(result.operationResults[0].reason).toContain('pending approval');
    expect(repository.createCalls).toBe(0);
  });

  it('applies a pending_approval plan with allowPendingApprovalApply=true', async () => {
    const { repository, service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('pending_approval', [operation('create_tool_draft', 'create_me')]),
      authorization: explicitAuthorization,
      options: { allowPendingApprovalApply: true },
      appliedAt,
    });

    expect(result.status).toBe('applied');
    expect(repository.createCalls).toBe(1);
  });

  it('applies a ready_for_manual_apply plan with explicit authorization', async () => {
    const { repository, service } = serviceWith();
    const result = await service.applyPlan({
      plan: importPlan('ready_for_manual_apply', [operation('create_tool_draft', 'create_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(result.status).toBe('applied');
    expect(result.approvedByUserId).toBe(approvedByUserId);
    expect(repository.createCalls).toBe(1);
  });

  it('does not call create/update/deprecate during dryRun=true', async () => {
    const { repository, service } = serviceWith();
    repository.seed({ externalName: 'update_me' });

    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [
        operation('create_tool_draft', 'create_me'),
        operation('update_tool_draft', 'update_me'),
        operation('deprecate_tool_draft', 'deprecate_me'),
      ]),
      authorization: explicitAuthorization,
      options: { dryRun: true },
      appliedAt,
    });

    expect(result.sanitizedMetadata).toMatchObject({ dryRun: true });
    expect(repository.createCalls).toBe(0);
    expect(repository.updateCalls).toBe(0);
    expect(repository.deprecateCalls).toBe(0);
    expect(repository.savedResults.size).toBe(0);
    expect(repository.auditEvents).toHaveLength(1);
  });

  it('calls create for create_tool_draft', async () => {
    const { repository, service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [operation('create_tool_draft', 'create_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(repository.createCalls).toBe(1);
    expect(result.operationResults[0]).toMatchObject({ status: 'applied', externalName: 'create_me' });
  });

  it('calls update for update_tool_draft', async () => {
    const { repository, service } = serviceWith();
    repository.seed({ externalName: 'update_me' });

    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [operation('update_tool_draft', 'update_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(repository.updateCalls).toBe(1);
    expect(result.operationResults[0]).toMatchObject({ status: 'applied', externalName: 'update_me' });
  });

  it('calls deprecate for deprecate_tool_draft without physical delete', async () => {
    const { repository, service } = serviceWith();
    repository.seed({ externalName: 'remove_me' });

    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [operation('deprecate_tool_draft', 'remove_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(repository.deprecateCalls).toBe(1);
    expect(result.operationResults[0]).toMatchObject({ status: 'applied', externalName: 'remove_me' });
    expect(repository.catalog.size).toBe(1);
    expect(repository.catalog.values().next().value?.status).toBe('deprecated');
  });

  it('does not mutate catalog for noop operations', async () => {
    const { repository, service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [operation('noop', 'keep_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(result.status).toBe('no_changes');
    expect(result.operationResults[0].status).toBe('noop');
    expect(repository.catalog.size).toBe(0);
  });

  it('does not mutate catalog for blocked operations', async () => {
    const { repository, service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [operation('blocked', 'blocked_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(result.status).toBe('blocked');
    expect(result.operationResults[0].status).toBe('blocked');
    expect(repository.catalog.size).toBe(0);
  });

  it('keeps runtime and remote execution false for every operation result', async () => {
    const { service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [
        operation('create_tool_draft', 'create_me'),
        operation('noop', 'keep_me'),
        operation('blocked', 'blocked_me'),
      ]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(result.operationResults.every((item) => item.runtimeEnabled === false)).toBe(true);
    expect(result.operationResults.every((item) => item.remoteExecutionEnabled === false)).toBe(true);
  });

  it('records a sanitized audit event without credential-shaped payload fields', async () => {
    const { repository, service } = serviceWith();
    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [operation('create_tool_draft', 'create_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });
    const serializedAudit = JSON.stringify(repository.auditEvents[0]).toLowerCase();

    expect(repository.auditEvents).toHaveLength(1);
    expect(repository.auditEvents[0]).toMatchObject({
      type: 'mcp.remote.catalog_import_apply.executed',
      applyHash: result.applyHash,
      approvedByUserId,
    });
    expect(serializedAudit).not.toContain('authorization');
    expect(serializedAudit).not.toContain('secretref');
    expect(serializedAudit).not.toContain('credential');
    expect(serializedAudit).not.toContain('password');
    expect(serializedAudit).not.toContain('apikey');
    expect(serializedAudit).not.toContain('token');
    expect(serializedAudit).not.toContain('baseurl');
  });

  it('does not call network or tool execution hooks', async () => {
    const fetchMock = vi.fn();
    const executeTool = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { service } = serviceWith();

    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [operation('create_tool_draft', 'create_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(result.status).toBe('applied');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('returns an idempotent stored result on the second apply', async () => {
    const { repository, service } = serviceWith();
    const input = {
      plan: importPlan('ready_for_manual_apply', [operation('create_tool_draft', 'create_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    };

    const first = await service.applyImportPlan(input);
    const second = await service.applyImportPlan({ ...input, appliedAt: '2026-06-26T21:00:00.000Z' });

    expect(second).toEqual(first);
    expect(repository.createCalls).toBe(1);
    expect(repository.savedResults.size).toBe(1);
  });

  it('returns partially_applied when a repository operation fails after a prior mutation', async () => {
    const { repository, service } = serviceWith();
    repository.seed({ externalName: 'update_me' });
    repository.failOn = 'update';

    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [
        operation('create_tool_draft', 'create_me'),
        operation('update_tool_draft', 'update_me'),
      ]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(result.status).toBe('partially_applied');
    expect(result.summary.applied).toBe(1);
    expect(result.summary.failed).toBe(1);
  });

  it('uses only the fake repository boundary and no real database in unit tests', async () => {
    const { repository, service } = serviceWith();

    const result = await service.applyImportPlan({
      plan: importPlan('ready_for_manual_apply', [operation('create_tool_draft', 'create_me')]),
      authorization: explicitAuthorization,
      appliedAt,
    });

    expect(result.status).toBe('applied');
    expect(repository).toBeInstanceOf(FakeApplyRepository);
    expect(repository.transactionCalls).toBe(1);
    expect(repository.auditEvents).toHaveLength(1);
  });
});
