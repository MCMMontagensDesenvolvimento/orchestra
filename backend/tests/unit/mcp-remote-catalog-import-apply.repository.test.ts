import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY,
  McpRemoteCatalogImportApplyPersistenceRepository,
  type McpRemoteCatalogImportApplyAuditRecord,
  type McpRemoteCatalogImportApplyAuditWriter,
} from '../../src/modules/mcp/remote/mcp-remote-catalog-import-apply.repository';
import { McpRemoteCatalogImportApplyService } from '../../src/modules/mcp/remote/mcp-remote-catalog-import-apply.service';
import type {
  McpRemoteCatalogImportApplyAuditEvent,
  McpRemoteCatalogImportOperation,
  McpRemoteCatalogImportPlan,
  McpRemoteCatalogPolicyDraft,
  McpRemoteCatalogToolDraft,
} from '../../src/modules/mcp/remote/mcp-remote.types';

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const serverId = '00000000-0000-0000-0000-000000000701';
const approvedByUserId = '00000000-0000-0000-0000-000000000040';

class FakeAuditWriter implements McpRemoteCatalogImportApplyAuditWriter {
  readonly records: McpRemoteCatalogImportApplyAuditRecord[] = [];

  async record(input: McpRemoteCatalogImportApplyAuditRecord): Promise<void> {
    this.records.push(input);
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

function draft(externalName: string): McpRemoteCatalogToolDraft {
  return {
    externalName,
    displayName: 'Remote draft',
    specHash: 'spec_hash_11g',
    source: 'remote_discovery',
    remote: {
      serverId,
      importedFromSnapshotId: 'snapshot_11g',
      importedFromSnapshotHash: 'snapshot_hash_11g',
    },
    metadata: { riskLevel: 'low' },
  };
}

function createOperation(): McpRemoteCatalogImportOperation {
  return {
    operationId: 'operation_11g_create',
    type: 'create_tool_draft',
    externalName: 'remote_health',
    displayName: 'Remote health',
    specHash: 'spec_hash_11g',
    riskLevel: 'low',
    requiresApproval: true,
    canApply: false,
    canApplyAutomatically: false,
    reason: 'Governed import after manual approval.',
    catalogDraft: draft('remote_health'),
    policyDraft: closedPolicy,
    validationMessages: [],
  };
}

function importPlan(): McpRemoteCatalogImportPlan {
  const operation = createOperation();
  return {
    planId: 'plan_11g',
    planHash: 'plan_hash_11g',
    snapshotId: 'snapshot_11g',
    snapshotHash: 'snapshot_hash_11g',
    serverId,
    tenantId,
    workspaceId,
    requestedByUserId: approvedByUserId,
    requestId: 'request_11g',
    createdAt: '2026-06-26T20:00:00.000Z',
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
      requestId: 'request_11g',
      snapshotHash: 'snapshot_hash_11g',
      planHash: 'plan_hash_11g',
      status: 'ready_for_manual_apply',
      counts: { totalOperations: 1 },
      riskSummary: { low: 1 },
      operationTypes: ['create_tool_draft'],
      metadata: {},
    },
    sanitizedMetadata: { noRuntimePublish: true, noToolExecution: true },
  };
}

function auditEvent(metadata: Record<string, unknown> = {}): McpRemoteCatalogImportApplyAuditEvent {
  return {
    type: 'mcp.remote.catalog_import_apply.executed',
    tenantId,
    workspaceId,
    serverId,
    planHash: 'plan_hash_11g',
    applyHash: 'apply_hash_11g',
    approvedByUserId,
    status: 'failed',
    counts: { total: 1, failed: 1 },
    operationTypes: ['create_tool_draft'],
    metadata,
  };
}

describe('MCP remote catalog import apply persistence repository 11G', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('instantiates as a fail-closed repository', () => {
    const repository = new McpRemoteCatalogImportApplyPersistenceRepository(new FakeAuditWriter());
    expect(repository).toBeInstanceOf(McpRemoteCatalogImportApplyPersistenceRepository);
  });

  it('runs the repository callback without applying a real mutation', async () => {
    const repository = new McpRemoteCatalogImportApplyPersistenceRepository(new FakeAuditWriter());
    const callback = vi.fn(async (transaction) => transaction.findByExternalName({
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
    }));

    await expect(repository.withTransaction(callback)).resolves.toBeNull();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('returns null from findByExternalName while durable identity is unavailable', async () => {
    const repository = new McpRemoteCatalogImportApplyPersistenceRepository(new FakeAuditWriter());
    await expect(repository.findByExternalName({
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
    })).resolves.toBeNull();
  });

  it('fails create with the controlled persistence-not-ready code', async () => {
    const repository = new McpRemoteCatalogImportApplyPersistenceRepository(new FakeAuditWriter());
    await expect(repository.createToolDraft({
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
      catalogDraft: draft('remote_health'),
      policyDraft: closedPolicy,
    })).rejects.toMatchObject({ code: MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY });
  });

  it('fails update with the controlled persistence-not-ready code', async () => {
    const repository = new McpRemoteCatalogImportApplyPersistenceRepository(new FakeAuditWriter());
    await expect(repository.updateToolDraft({
      id: 'tool_11g',
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
      catalogDraft: draft('remote_health'),
      policyDraft: closedPolicy,
    })).rejects.toMatchObject({ code: MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY });
  });

  it('fails deprecate with the controlled persistence-not-ready code', async () => {
    const repository = new McpRemoteCatalogImportApplyPersistenceRepository(new FakeAuditWriter());
    await expect(repository.deprecateToolDraft({
      id: 'tool_11g',
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
      reason: 'Removed remotely.',
    })).rejects.toMatchObject({ code: MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY });
  });

  it('writes only sanitized audit data through the existing audit port', async () => {
    const writer = new FakeAuditWriter();
    const repository = new McpRemoteCatalogImportApplyPersistenceRepository(writer);
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

  it('makes the 11F apply service return failed without catalog persistence', async () => {
    const writer = new FakeAuditWriter();
    const repository = new McpRemoteCatalogImportApplyPersistenceRepository(writer);
    const service = new McpRemoteCatalogImportApplyService(repository);

    const result = await service.applyImportPlan({
      plan: importPlan(),
      authorization: {
        approvedByUserId,
        approvalReason: 'Human review approved the blocked draft.',
        confirmManualApply: true,
      },
      appliedAt: '2026-06-26T21:00:00.000Z',
    });

    expect(result.status).toBe('failed');
    expect(result.operationResults[0]).toMatchObject({
      status: 'failed',
      runtimeEnabled: false,
      remoteExecutionEnabled: false,
    });
    expect(writer.records).toHaveLength(1);
  });

  it('does not call network, execute a tool or touch a real database', async () => {
    const fetchMock = vi.fn();
    const executeTool = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const repository = new McpRemoteCatalogImportApplyPersistenceRepository(new FakeAuditWriter());

    await expect(repository.createToolDraft({
      tenantId,
      workspaceId,
      serverId,
      externalName: 'remote_health',
      catalogDraft: draft('remote_health'),
      policyDraft: closedPolicy,
    })).rejects.toMatchObject({ code: MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(executeTool).not.toHaveBeenCalled();
  });
});
