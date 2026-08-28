import { createHash } from 'crypto';
import type {
  McpRemoteCatalogImportApplyAuthorization,
  McpRemoteCatalogImportApplyInput,
  McpRemoteCatalogImportApplyOperationResult,
  McpRemoteCatalogImportApplyRepository,
  McpRemoteCatalogImportApplyResult,
  McpRemoteCatalogImportApplyStatus,
  McpRemoteCatalogImportApplyTransaction,
  McpRemoteCatalogApplyMutationContext,
  McpRemoteCatalogImportOperation,
  McpRemoteCatalogImportOperationType,
  McpRemoteCatalogPolicyDraft,
} from './mcp-remote.types';

const unsafeTextFragments = ['authorization', 'baseurl', 'cookie', 'credential', 'password', 'privatekey', 'secret', 'secretref', 'token', 'apikey'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeForHash(item));
  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const child = normalizeForHash(value[key]);
      if (typeof child !== 'undefined') normalized[key] = child;
    }
    return normalized;
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForHash(value));
}

function sha256(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function containsUnsafeText(value: unknown) {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return unsafeTextFragments.some((fragment) => normalized.includes(fragment));
}

function isBlank(value: unknown) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function policyIsClosed(policy: McpRemoteCatalogPolicyDraft) {
  return policy.allowRuntimeExecution === false
    && policy.sandboxOnly === true
    && policy.blockedByDefault === true
    && policy.requiresApproval === true
    && policy.approvalMode === 'manual'
    && policy.runtimeEnabled === false
    && policy.remoteExecutionEnabled === false;
}

function operationOpensRuntime(operation: McpRemoteCatalogImportOperation) {
  return !policyIsClosed(operation.policyDraft);
}

function operationHasSensitivePayload(operation: McpRemoteCatalogImportOperation) {
  if (!operation.catalogDraft) return false;
  return containsUnsafeText(stableStringify(operation.catalogDraft));
}

function idempotencyKey(input: McpRemoteCatalogImportApplyInput) {
  return sha256({
    planHash: input.plan.planHash,
    snapshotHash: input.plan.snapshotHash,
    tenantId: input.plan.tenantId,
    workspaceId: input.plan.workspaceId,
    serverId: input.plan.serverId,
    approvedByUserId: input.authorization.approvedByUserId,
  });
}

function applyHash(input: {
  idempotencyKey: string;
  planHash: string;
  appliedAt: string;
  approvedByUserId: string;
  operationResults: McpRemoteCatalogImportApplyOperationResult[];
  status: McpRemoteCatalogImportApplyStatus;
}) {
  return sha256(input);
}

function applyId(hash: string) {
  return `mcp_remote_catalog_apply_${hash.slice(0, 24)}`;
}

function startedApplyHash(input: {
  idempotencyKey: string;
  planHash: string;
  snapshotHash: string;
  appliedAt: string;
  approvedByUserId: string;
}) {
  return sha256({ ...input, status: 'started' });
}

function operationTypes(operations: Array<{ type: McpRemoteCatalogImportOperationType }>) {
  return [...new Set(operations.map((operation) => operation.type))].sort();
}

function summary(operationResults: McpRemoteCatalogImportApplyOperationResult[]) {
  return {
    total: operationResults.length,
    applied: operationResults.filter((result) => result.status === 'applied').length,
    blocked: operationResults.filter((result) => result.status === 'blocked').length,
    skipped: operationResults.filter((result) => result.status === 'skipped').length,
    failed: operationResults.filter((result) => result.status === 'failed').length,
    noop: operationResults.filter((result) => result.status === 'noop').length,
    idempotent: operationResults.filter((result) => result.status === 'idempotent').length,
  };
}

function statusFromResults(operationResults: McpRemoteCatalogImportApplyOperationResult[]): McpRemoteCatalogImportApplyStatus {
  if (operationResults.length === 0) return 'no_changes';
  const hasFailure = operationResults.some((result) => result.status === 'failed');
  const hasApplied = operationResults.some((result) => result.status === 'applied');
  const allBlocked = operationResults.every((result) => result.status === 'blocked');
  const allNoop = operationResults.every((result) => result.status === 'noop' || result.status === 'idempotent');
  if (hasFailure && hasApplied) return 'partially_applied';
  if (hasFailure) return 'failed';
  if (allBlocked) return 'blocked';
  if (allNoop) return 'no_changes';
  return 'applied';
}

function operationResult(input: {
  operation: McpRemoteCatalogImportOperation;
  status: McpRemoteCatalogImportApplyOperationResult['status'];
  reason: string;
  catalogItemId?: string;
  beforeHash?: string | null;
  afterHash?: string | null;
}): McpRemoteCatalogImportApplyOperationResult {
  return {
    operationId: input.operation.operationId,
    type: input.operation.type,
    externalName: input.operation.externalName,
    status: input.status,
    ...(input.catalogItemId ? { catalogItemId: input.catalogItemId } : {}),
    reason: input.reason,
    ...(input.beforeHash ? { beforeHash: input.beforeHash } : {}),
    ...(input.afterHash ? { afterHash: input.afterHash } : {}),
    runtimeEnabled: false,
    remoteExecutionEnabled: false,
  };
}

function validateAuthorization(authorization: McpRemoteCatalogImportApplyAuthorization) {
  const reasons: string[] = [];
  if (authorization.confirmManualApply !== true) reasons.push('confirmManualApply=true is required.');
  if (isBlank(authorization.approvedByUserId)) reasons.push('approvedByUserId is required.');
  if (isBlank(authorization.approvalReason)) reasons.push('approvalReason is required.');
  if (containsUnsafeText(authorization.approvedByUserId) || containsUnsafeText(authorization.approvalReason) || containsUnsafeText(authorization.approvalTicketId)) {
    reasons.push('Authorization fields must not contain credential-shaped values.');
  }
  return reasons;
}

function blockedOperationResults(operations: McpRemoteCatalogImportOperation[], reason: string): McpRemoteCatalogImportApplyOperationResult[] {
  return operations.map((operation) => operationResult({ operation, status: 'blocked', reason }));
}

function baseResult(input: {
  applyKey: string;
  appliedAt: string;
  approvedByUserId: string;
  plan: McpRemoteCatalogImportApplyInput['plan'];
  status: McpRemoteCatalogImportApplyStatus;
  operationResults: McpRemoteCatalogImportApplyOperationResult[];
  metadata: Record<string, unknown>;
}) {
  const hash = applyHash({
    idempotencyKey: input.applyKey,
    planHash: input.plan.planHash,
    appliedAt: input.appliedAt,
    approvedByUserId: input.approvedByUserId,
    operationResults: input.operationResults,
    status: input.status,
  });
  const resultSummary = summary(input.operationResults);
  return {
    applyId: applyId(input.applyKey),
    applyHash: hash,
    idempotencyKey: input.applyKey,
    planId: input.plan.planId,
    planHash: input.plan.planHash,
    snapshotHash: input.plan.snapshotHash,
    serverId: input.plan.serverId,
    tenantId: input.plan.tenantId,
    workspaceId: input.plan.workspaceId,
    approvedByUserId: input.approvedByUserId,
    appliedAt: input.appliedAt,
    status: input.status,
    operationResults: input.operationResults,
    summary: resultSummary,
    auditEvent: {
      type: 'mcp.remote.catalog_import_apply.executed',
      tenantId: input.plan.tenantId,
      workspaceId: input.plan.workspaceId,
      serverId: input.plan.serverId,
      planHash: input.plan.planHash,
      applyHash: hash,
      approvedByUserId: input.approvedByUserId,
      status: input.status,
      counts: resultSummary,
      operationTypes: operationTypes(input.plan.operations),
      metadata: {
        idempotencyKeyHash: sha256(input.applyKey),
        dryRun: input.metadata.dryRun === true,
        noRuntimeEnablement: true,
        noRemoteToolExecution: true,
      },
    },
    sanitizedMetadata: input.metadata,
    rollbackNotes: input.operationResults
      .filter((result) => result.status === 'applied')
      .map((result) => ({
        operationId: result.operationId,
        externalName: result.externalName,
        note: 'Rollback must be handled by a future catalog apply rollback phase or manual catalog reconciliation.',
      })),
  } satisfies McpRemoteCatalogImportApplyResult;
}

async function applyOperation(
  transaction: McpRemoteCatalogImportApplyTransaction,
  plan: McpRemoteCatalogImportApplyInput['plan'],
  operation: McpRemoteCatalogImportOperation,
  applyContext: McpRemoteCatalogApplyMutationContext,
): Promise<McpRemoteCatalogImportApplyOperationResult> {
  if (operationOpensRuntime(operation)) {
    return operationResult({ operation, status: 'blocked', reason: 'Operation policy attempted to open runtime execution.' });
  }
  if (operationHasSensitivePayload(operation)) {
    return operationResult({ operation, status: 'blocked', reason: 'Operation catalog draft contains sensitive payload.' });
  }
  if (operation.type === 'blocked') {
    return operationResult({ operation, status: 'blocked', reason: 'Operation is blocked by the import plan.' });
  }
  if (operation.type === 'noop') {
    return operationResult({ operation, status: 'noop', reason: 'No catalog change required for this operation.' });
  }
  const current = await transaction.findByExternalName({
    tenantId: plan.tenantId,
    workspaceId: plan.workspaceId,
    serverId: plan.serverId,
    externalName: operation.externalName,
  });

  if (operation.type === 'create_tool_draft') {
    if (current?.specHash && operation.specHash && current.specHash === operation.specHash) {
      return operationResult({
        operation,
        status: 'idempotent',
        catalogItemId: current.id,
        reason: 'Catalog item already exists with the same specHash.',
        beforeHash: current.catalogHash ?? current.specHash,
        afterHash: current.catalogHash ?? current.specHash,
      });
    }
    if (!operation.catalogDraft) {
      return operationResult({ operation, status: 'failed', reason: 'Create operation is missing catalogDraft.' });
    }
    const created = await transaction.createToolDraft({
      tenantId: plan.tenantId,
      workspaceId: plan.workspaceId,
      serverId: plan.serverId,
      externalName: operation.externalName,
      displayName: operation.displayName,
      description: operation.catalogDraft.description,
      specHash: operation.specHash,
      riskLevel: operation.riskLevel,
      applyContext,
      catalogDraft: operation.catalogDraft,
      policyDraft: operation.policyDraft,
    });
    return operationResult({
      operation,
      status: 'applied',
      catalogItemId: created.id,
      reason: 'Created remote MCP catalog draft with runtime execution blocked.',
      afterHash: created.catalogHash ?? operation.specHash,
    });
  }

  if (operation.type === 'update_tool_draft') {
    if (!current) {
      return operationResult({ operation, status: 'failed', reason: 'Update operation could not find an existing catalog item.' });
    }
    if (!operation.catalogDraft) {
      return operationResult({ operation, status: 'failed', reason: 'Update operation is missing catalogDraft.' });
    }
    const updated = await transaction.updateToolDraft({
      id: current.id,
      tenantId: plan.tenantId,
      workspaceId: plan.workspaceId,
      serverId: plan.serverId,
      externalName: operation.externalName,
      displayName: operation.displayName,
      description: operation.catalogDraft.description,
      specHash: operation.specHash,
      riskLevel: operation.riskLevel,
      expectedRevision: current.revision,
      applyContext,
      catalogDraft: operation.catalogDraft,
      policyDraft: operation.policyDraft,
    });
    return operationResult({
      operation,
      status: 'applied',
      catalogItemId: updated.id,
      reason: 'Updated remote MCP catalog draft with runtime execution blocked.',
      beforeHash: current.catalogHash ?? current.specHash,
      afterHash: updated.catalogHash ?? operation.specHash,
    });
  }

  if (operation.type === 'deprecate_tool_draft') {
    if (!current) {
      return operationResult({ operation, status: 'skipped', reason: 'Deprecate operation skipped because catalog item was not found.' });
    }
    const deprecated = await transaction.deprecateToolDraft({
      id: current.id,
      tenantId: plan.tenantId,
      workspaceId: plan.workspaceId,
      serverId: plan.serverId,
      externalName: operation.externalName,
      reason: operation.reason,
      expectedRevision: current.revision,
      applyContext,
    });
    return operationResult({
      operation,
      status: 'applied',
      catalogItemId: deprecated.id,
      reason: 'Deprecated remote MCP catalog draft without deleting the catalog item.',
      beforeHash: current.catalogHash ?? current.specHash,
      afterHash: deprecated.catalogHash ?? current.catalogHash ?? current.specHash,
    });
  }

  return operationResult({ operation, status: 'blocked', reason: 'Unsupported import operation type.' });
}

export class McpRemoteCatalogImportApplyService {
  constructor(private readonly repository: McpRemoteCatalogImportApplyRepository) {}

  async applyImportPlan(input: McpRemoteCatalogImportApplyInput): Promise<McpRemoteCatalogImportApplyResult> {
    const appliedAt = input.appliedAt ?? new Date().toISOString();
    const authReasons = validateAuthorization(input.authorization);
    const applyKey = idempotencyKey(input);
    const metadata = {
      source: 'mcp_remote_catalog_manual_apply',
      manualApproval: true,
      dryRun: input.options?.dryRun === true,
      noRuntimeEnablement: true,
      noRemoteToolExecution: true,
    };

    if (authReasons.length > 0) {
      return this.finalizeResult(baseResult({
        applyKey,
        appliedAt,
        approvedByUserId: input.authorization.approvedByUserId || 'unknown',
        plan: input.plan,
        status: 'blocked',
        operationResults: blockedOperationResults(input.plan.operations, authReasons.join(' ')),
        metadata,
      }), { saveIdempotency: false });
    }

    const existing = await this.repository.findApplyByIdempotencyKey?.({
      tenantId: input.plan.tenantId,
      workspaceId: input.plan.workspaceId,
      serverId: input.plan.serverId,
      idempotencyKey: applyKey,
    });
    if (existing) return existing;

    const planBlockReason = this.getPlanBlockReason(input);
    if (planBlockReason) {
      return this.finalizeResult(baseResult({
        applyKey,
        appliedAt,
        approvedByUserId: input.authorization.approvedByUserId,
        plan: input.plan,
        status: 'blocked',
        operationResults: blockedOperationResults(input.plan.operations, planBlockReason),
        metadata,
      }));
    }

    if (input.plan.status === 'no_changes') {
      return this.finalizeResult(baseResult({
        applyKey,
        appliedAt,
        approvedByUserId: input.authorization.approvedByUserId,
        plan: input.plan,
        status: 'no_changes',
        operationResults: input.plan.operations.map((operation) => operationResult({
          operation,
          status: 'noop',
          reason: 'Import plan has no catalog changes.',
        })),
        metadata,
      }));
    }

    if (input.options?.dryRun === true) {
      return this.finalizeResult(baseResult({
        applyKey,
        appliedAt,
        approvedByUserId: input.authorization.approvedByUserId,
        plan: input.plan,
        status: 'applied',
        operationResults: input.plan.operations.map((operation) => operationResult({
          operation,
          status: operation.type === 'noop' ? 'noop' : 'skipped',
          reason: 'Dry run: repository mutation was skipped.',
        })),
        metadata,
      }), { saveIdempotency: false });
    }

    const startedContext: McpRemoteCatalogApplyMutationContext = {
      planId: input.plan.planId,
      planHash: input.plan.planHash,
      snapshotId: input.plan.snapshotId,
      snapshotHash: input.plan.snapshotHash,
      applyId: applyId(applyKey),
      applyHash: startedApplyHash({
        idempotencyKey: applyKey,
        planHash: input.plan.planHash,
        snapshotHash: input.plan.snapshotHash,
        appliedAt,
        approvedByUserId: input.authorization.approvedByUserId,
      }),
      idempotencyKey: applyKey,
      approvedByUserId: input.authorization.approvedByUserId,
      approvedAt: input.authorization.approvedAt,
      appliedAt,
    };

    let result: McpRemoteCatalogImportApplyResult;
    try {
      result = await this.repository.withTransaction(async (transaction) => {
        await transaction.reserveApply?.({
          ...startedContext,
          tenantId: input.plan.tenantId,
          workspaceId: input.plan.workspaceId,
          serverId: input.plan.serverId,
          approvalReasonHash: sha256(input.authorization.approvalReason),
        });

        const operationResults: McpRemoteCatalogImportApplyOperationResult[] = [];
        for (const operation of input.plan.operations) {
          try {
            operationResults.push(await applyOperation(transaction, input.plan, operation, startedContext));
          } catch {
            operationResults.push(operationResult({
              operation,
              status: 'failed',
              reason: 'Repository operation failed while applying the governed import plan.',
            }));
          }
        }
        const appliedResult = baseResult({
          applyKey,
          appliedAt,
          approvedByUserId: input.authorization.approvedByUserId,
          plan: input.plan,
          status: statusFromResults(operationResults),
          operationResults,
          metadata,
        });

        await transaction.finalizeCatalogEntriesForApply?.({
          tenantId: input.plan.tenantId,
          workspaceId: input.plan.workspaceId,
          serverId: input.plan.serverId,
          applyId: appliedResult.applyId,
          applyHash: appliedResult.applyHash,
          operationResults,
        });
        await transaction.saveApplyResult?.({
          idempotencyKey: appliedResult.idempotencyKey,
          result: appliedResult,
        });
        return appliedResult;
      });
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
      if (code === 'MCP_REMOTE_CATALOG_APPLY_IN_PROGRESS' || code === 'MCP_REMOTE_CATALOG_APPLY_CONFLICT') {
        return this.finalizeResult(baseResult({
          applyKey,
          appliedAt,
          approvedByUserId: input.authorization.approvedByUserId,
          plan: input.plan,
          status: 'blocked',
          operationResults: blockedOperationResults(input.plan.operations, 'Apply idempotency ledger is already started or conflicted; manual reconciliation is required.'),
          metadata,
        }), { saveIdempotency: false });
      }
      throw error;
    }

    return this.finalizeResult(result, { saveIdempotency: false });
  }

  async applyPlan(input: McpRemoteCatalogImportApplyInput): Promise<McpRemoteCatalogImportApplyResult> {
    return this.applyImportPlan(input);
  }

  private getPlanBlockReason(input: McpRemoteCatalogImportApplyInput): string | null {
    if (input.plan.validation.valid === false) return 'Import plan validation is not valid.';
    if (input.plan.status === 'blocked') return 'Import plan is blocked.';
    if (input.plan.preflight.canApplyAutomatically !== false) return 'Import plan attempted automatic apply.';
    if (input.plan.operations.some((operation) => operation.canApplyAutomatically !== false || operation.canApply !== false)) {
      return 'Import operation attempted automatic or direct apply.';
    }
    if (input.plan.operations.some(operationOpensRuntime)) return 'Import operation attempted to open runtime execution.';
    if (input.plan.operations.some(operationHasSensitivePayload)) return 'Import operation contains sensitive payload.';
    if (input.plan.status === 'pending_approval' && input.options?.allowPendingApprovalApply !== true) {
      return 'Import plan is pending approval and explicit pending-approval apply was not enabled.';
    }
    if (input.plan.status === 'ready_for_manual_apply' && input.options?.allowReadyForManualApply === false) {
      return 'Manual apply was disabled for ready_for_manual_apply plan.';
    }
    return null;
  }

  private async finalizeResult(
    result: McpRemoteCatalogImportApplyResult,
    options: { saveIdempotency?: boolean } = {},
  ): Promise<McpRemoteCatalogImportApplyResult> {
    await this.repository.recordAuditEvent({
      type: result.auditEvent.type,
      tenantId: result.tenantId,
      workspaceId: result.workspaceId,
      serverId: result.serverId,
      event: result.auditEvent,
    });
    if (options.saveIdempotency !== false) {
      await this.repository.saveApplyResult?.({
        idempotencyKey: result.idempotencyKey,
        result,
      });
    }
    return result;
  }
}
