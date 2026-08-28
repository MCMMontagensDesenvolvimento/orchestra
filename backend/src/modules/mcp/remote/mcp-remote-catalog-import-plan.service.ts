import { createHash } from 'crypto';
import type {
  McpRemoteCatalogImportOperation,
  McpRemoteCatalogImportOperationType,
  McpRemoteCatalogImportPlan,
  McpRemoteCatalogImportPlanInput,
  McpRemoteCatalogImportPlanStatus,
  McpRemoteCatalogImportPlanValidation,
  McpRemoteCatalogImportPolicy,
  McpRemoteCatalogImportPreflight,
  McpRemoteCatalogImportPreflightCheckName,
  McpRemoteCatalogPolicyDraft,
  McpRemoteCatalogToolDraft,
  McpRemoteDiscoveryApprovalDecisionStatus,
  McpRemoteDiscoveryProposedAction,
  McpRemoteDiscoveryReviewPackage,
} from './mcp-remote.types';

const maxExternalNameChars = 128;
const maxDisplayNameChars = 160;
const maxDescriptionChars = 1000;
const unsafeKeyFragments = ['authorization', 'baseurl', 'cookie', 'credential', 'password', 'privatekey', 'secret', 'secretref', 'token', 'apikey'];

const closedPolicyDraft: McpRemoteCatalogPolicyDraft = {
  allowRuntimeExecution: false,
  sandboxOnly: true,
  blockedByDefault: true,
  requiresApproval: true,
  approvalMode: 'manual',
  runtimeEnabled: false,
  remoteExecutionEnabled: false,
};

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

export type McpRemoteCatalogImportPlanHashInput = Pick<
  McpRemoteCatalogImportPlan,
  | 'snapshotId'
  | 'snapshotHash'
  | 'serverId'
  | 'tenantId'
  | 'workspaceId'
  | 'requestedByUserId'
  | 'requestId'
  | 'createdAt'
  | 'sourceDecisionStatus'
  | 'status'
  | 'operations'
  | 'summary'
  | 'riskSummary'
  | 'validation'
  | 'preflight'
  | 'sanitizedMetadata'
>;

export function computeMcpRemoteCatalogImportPlanHash(
  plan: McpRemoteCatalogImportPlanHashInput,
) {
  return sha256({
    snapshotId: plan.snapshotId,
    snapshotHash: plan.snapshotHash,
    serverId: plan.serverId,
    tenantId: plan.tenantId,
    workspaceId: plan.workspaceId,
    requestedByUserId: plan.requestedByUserId,
    requestId: plan.requestId,
    createdAt: plan.createdAt,
    sourceDecisionStatus: plan.sourceDecisionStatus,
    status: plan.status,
    operations: plan.operations,
    summary: plan.summary,
    riskSummary: plan.riskSummary,
    validation: plan.validation,
    preflight: plan.preflight,
    sanitizedMetadata: plan.sanitizedMetadata,
  });
}

function safeString(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || containsUnsafeText(normalized)) return undefined;
  return normalized.length > maxChars ? normalized.slice(0, maxChars) : normalized;
}

function displayNameFromExternalName(externalName: string) {
  return externalName
    .replace(/[-_.]+/g, ' ')
    .trim()
    .split(/\s+/g)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ')
    .slice(0, maxDisplayNameChars);
}

function isUnsafeKey(key: string) {
  const normalized = key.replace(/[-_\s]/g, '').toLowerCase();
  return unsafeKeyFragments.some((fragment) => normalized.includes(fragment));
}

function containsUnsafeText(value: unknown) {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return unsafeKeyFragments.some((fragment) => normalized.includes(fragment));
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return containsUnsafeText(value) ? '[redacted]' : value.slice(0, 300);
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return undefined;
  if (depth > 5) return '[omitted]';
  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizeMetadata(item, depth + 1))
      .filter((item) => typeof item !== 'undefined');
  }
  if (!isRecord(value)) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (isUnsafeKey(key)) continue;
    const sanitizedValue = sanitizeMetadata(value[key], depth + 1);
    if (typeof sanitizedValue !== 'undefined') sanitized[key] = sanitizedValue;
  }
  return sanitized;
}

function planStatus(decision: McpRemoteDiscoveryApprovalDecisionStatus): McpRemoteCatalogImportPlanStatus {
  switch (decision) {
    case 'blocked':
    case 'rejected':
      return 'blocked';
    case 'pending_human_review':
      return 'pending_approval';
    case 'approved_for_future_import':
      return 'ready_for_manual_apply';
    case 'no_changes':
      return 'no_changes';
  }
}

function operationType(action: McpRemoteDiscoveryProposedAction, status: McpRemoteCatalogImportPlanStatus): McpRemoteCatalogImportOperationType {
  if (status === 'blocked' || action.type === 'blocked') return 'blocked';
  switch (action.type) {
    case 'propose_add':
      return 'create_tool_draft';
    case 'propose_update':
      return 'update_tool_draft';
    case 'propose_remove':
      return 'deprecate_tool_draft';
    case 'keep_existing':
      return 'noop';
  }
}

function existingToolMap(input: McpRemoteCatalogImportPlanInput) {
  return new Map((input.existingCatalogTools ?? []).map((tool) => [tool.externalName, tool]));
}

function operationId(input: {
  snapshotHash: string;
  type: McpRemoteCatalogImportOperationType;
  externalName: string;
  specHash?: string;
  previousSpecHash?: string | null;
}) {
  return `mcp_remote_catalog_op_${sha256(input).slice(0, 24)}`;
}

function catalogDraft(input: {
  reviewPackage: McpRemoteDiscoveryReviewPackage;
  action: McpRemoteDiscoveryProposedAction;
  type: McpRemoteCatalogImportOperationType;
  existingStatus?: string | null;
}): McpRemoteCatalogToolDraft | undefined {
  if (input.type === 'blocked') return undefined;
  const externalName = safeString(input.action.externalName, maxExternalNameChars);
  if (!externalName) return undefined;
  const displayName = displayNameFromExternalName(externalName);
  const description = safeString(input.action.reason, maxDescriptionChars);
  const metadata = sanitizeMetadata({
    actionType: input.action.type,
    operationType: input.type,
    riskLevel: input.action.riskLevel,
    existingStatus: input.existingStatus,
    sourceDecisionStatus: input.reviewPackage.decision.status,
  }) as Record<string, unknown>;

  return {
    externalName,
    displayName,
    ...(description ? { description } : {}),
    ...(input.action.specHash ? { specHash: input.action.specHash } : {}),
    source: 'remote_discovery',
    remote: {
      serverId: input.reviewPackage.serverId,
      importedFromSnapshotId: input.reviewPackage.snapshotId,
      importedFromSnapshotHash: input.reviewPackage.snapshotHash,
    },
    metadata,
  };
}

function actionValidationMessages(action: McpRemoteDiscoveryProposedAction, type: McpRemoteCatalogImportOperationType) {
  const messages: McpRemoteCatalogImportOperation['validationMessages'] = [{
    level: 'info',
    code: 'MCP_REMOTE_IMPORT_DRAFT_ONLY',
    message: 'Operation is a non-applicable catalog draft in phase 11E.',
  }];
  if (type === 'deprecate_tool_draft') {
    messages.push({
      level: 'warning',
      code: 'MCP_REMOTE_IMPORT_DEPRECATE_REQUIRES_REVIEW',
      message: 'Deprecating a catalog tool requires manual review in a future apply phase.',
    });
  }
  if (action.riskLevel === 'high' || action.riskLevel === 'critical') {
    messages.push({
      level: 'warning',
      code: 'MCP_REMOTE_IMPORT_HIGH_RISK_REQUIRES_REVIEW',
      message: 'High or critical risk remote tools require conservative preflight review.',
    });
  }
  return messages;
}

function operations(input: McpRemoteCatalogImportPlanInput, status: McpRemoteCatalogImportPlanStatus): McpRemoteCatalogImportOperation[] {
  const existing = existingToolMap(input);
  return input.reviewPackage.proposedActions
    .map((action) => {
      const type = operationType(action, status);
      const existingTool = existing.get(action.externalName);
      const previousSpecHash = action.previousSpecHash ?? existingTool?.specHash ?? null;
      const draft = catalogDraft({
        reviewPackage: input.reviewPackage,
        action,
        type,
        existingStatus: existingTool?.status ?? null,
      });
      const externalName = safeString(action.externalName, maxExternalNameChars) ?? 'invalid_external_name';
      const specHash = action.specHash;

      return {
        operationId: operationId({
          snapshotHash: input.reviewPackage.snapshotHash,
          type,
          externalName,
          specHash,
          previousSpecHash,
        }),
        type,
        externalName,
        ...(draft?.displayName ? { displayName: draft.displayName } : {}),
        ...(specHash ? { specHash } : {}),
        ...(typeof previousSpecHash !== 'undefined' ? { previousSpecHash } : {}),
        ...(action.riskLevel ? { riskLevel: action.riskLevel } : {}),
        requiresApproval: true,
        canApply: false,
        canApplyAutomatically: false,
        reason: safeString(action.reason, maxDescriptionChars) ?? 'Reason omitted by sanitizer.',
        ...(draft ? { catalogDraft: draft } : {}),
        policyDraft: closedPolicyDraft,
        validationMessages: actionValidationMessages(action, type),
      } satisfies McpRemoteCatalogImportOperation;
    })
    .sort((left, right) => {
      const byName = left.externalName.localeCompare(right.externalName);
      return byName === 0 ? left.type.localeCompare(right.type) : byName;
    });
}

function summary(ops: McpRemoteCatalogImportOperation[]) {
  return {
    totalOperations: ops.length,
    create: ops.filter((op) => op.type === 'create_tool_draft').length,
    update: ops.filter((op) => op.type === 'update_tool_draft').length,
    deprecate: ops.filter((op) => op.type === 'deprecate_tool_draft').length,
    noop: ops.filter((op) => op.type === 'noop').length,
    blocked: ops.filter((op) => op.type === 'blocked').length,
  };
}

function riskSummary(ops: McpRemoteCatalogImportOperation[]) {
  return ops.reduce(
    (summary, op) => {
      if (op.riskLevel) summary[op.riskLevel] += 1;
      return summary;
    },
    { low: 0, medium: 0, high: 0, critical: 0 },
  );
}

function operationTypes(ops: McpRemoteCatalogImportOperation[]) {
  return [...new Set(ops.map((op) => op.type))].sort();
}

function hasSensitiveDraftPayload(ops: McpRemoteCatalogImportOperation[]) {
  return ops.some((op) => {
    if (!op.catalogDraft) return false;
    const serialized = stableStringify(op.catalogDraft);
    return unsafeKeyFragments.some((fragment) => serialized.toLowerCase().includes(fragment));
  });
}

function hasDuplicateExternalNames(ops: McpRemoteCatalogImportOperation[]) {
  const names = new Set<string>();
  for (const op of ops) {
    if (names.has(op.externalName)) return true;
    names.add(op.externalName);
  }
  return false;
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

function validatePlan(input: {
  reviewPackage: McpRemoteDiscoveryReviewPackage;
  operations: McpRemoteCatalogImportOperation[];
  importPolicy?: McpRemoteCatalogImportPolicy;
}): McpRemoteCatalogImportPlanValidation {
  const errors: McpRemoteCatalogImportPlanValidation['errors'] = [];
  const warnings: McpRemoteCatalogImportPlanValidation['warnings'] = [];

  if (!input.reviewPackage.snapshotHash) {
    errors.push({ code: 'MCP_REMOTE_IMPORT_SNAPSHOT_HASH_REQUIRED', message: 'Review package snapshotHash is required.' });
  }
  if (!input.reviewPackage.serverId || !input.reviewPackage.tenantId || !input.reviewPackage.workspaceId) {
    errors.push({ code: 'MCP_REMOTE_IMPORT_CONTEXT_REQUIRED', message: 'serverId, tenantId and workspaceId are required.' });
  }
  if (hasDuplicateExternalNames(input.operations)) {
    errors.push({ code: 'MCP_REMOTE_IMPORT_DUPLICATE_TOOL', message: 'Import plan contains duplicate externalName values.' });
  }
  if (input.operations.some((op) => op.canApplyAutomatically !== false)) {
    errors.push({ code: 'MCP_REMOTE_IMPORT_AUTO_APPLY_BLOCKED', message: 'Import operations cannot apply automatically in phase 11E.' });
  }
  if (input.operations.some((op) => op.canApply !== false)) {
    errors.push({ code: 'MCP_REMOTE_IMPORT_APPLY_BLOCKED', message: 'Import operations cannot apply in phase 11E.' });
  }
  if (input.operations.some((op) => !policyIsClosed(op.policyDraft))) {
    errors.push({ code: 'MCP_REMOTE_IMPORT_POLICY_OPEN', message: 'Import operation attempted to open runtime execution policy.' });
  }
  if (hasSensitiveDraftPayload(input.operations)) {
    errors.push({ code: 'MCP_REMOTE_IMPORT_SENSITIVE_DRAFT', message: 'Import plan contains sensitive schema or metadata payload.' });
  }

  const highRisk = input.operations.some((op) => op.riskLevel === 'high');
  const criticalRisk = input.operations.some((op) => op.riskLevel === 'critical');
  if (highRisk && input.reviewPackage.humanReview.required !== true) {
    errors.push({ code: 'MCP_REMOTE_IMPORT_HIGH_RISK_REVIEW_REQUIRED', message: 'High risk import operations require human review.' });
  }
  if (criticalRisk && input.reviewPackage.humanReview.required !== true) {
    errors.push({ code: 'MCP_REMOTE_IMPORT_CRITICAL_RISK_REVIEW_REQUIRED', message: 'Critical risk import operations require human review.' });
  }
  if (highRisk && input.importPolicy?.allowHighRiskPlan !== true) {
    warnings.push({ code: 'MCP_REMOTE_IMPORT_HIGH_RISK_CONSERVATIVE', message: 'High risk operations remain draft-only and require conservative review.' });
  }
  if (criticalRisk && input.importPolicy?.allowCriticalRiskPlan !== true) {
    warnings.push({ code: 'MCP_REMOTE_IMPORT_CRITICAL_RISK_CONSERVATIVE', message: 'Critical risk operations remain draft-only and require conservative review.' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function check(name: McpRemoteCatalogImportPreflightCheckName, status: 'pass' | 'fail' | 'warning' | 'skipped', message: string) {
  return { name, status, message };
}

function preflight(input: {
  reviewPackage: McpRemoteDiscoveryReviewPackage;
  status: McpRemoteCatalogImportPlanStatus;
  operations: McpRemoteCatalogImportOperation[];
  validation: McpRemoteCatalogImportPlanValidation;
}): McpRemoteCatalogImportPreflight {
  const highOrCritical = input.operations.some((op) => op.riskLevel === 'high' || op.riskLevel === 'critical');
  const checks: McpRemoteCatalogImportPreflight['checks'] = [
    check('snapshot', input.reviewPackage.snapshotHash ? 'pass' : 'fail', input.reviewPackage.snapshotHash ? 'Review package snapshotHash is present.' : 'Review package snapshotHash is missing.'),
    check('decision', input.status === 'blocked' ? 'fail' : 'pass', `Source review decision maps to import plan status "${input.status}".`),
    check('operations', input.operations.length > 0 ? 'pass' : 'skipped', input.operations.length > 0 ? 'Import plan operations were generated as draft-only operations.' : 'No operations are needed for this import plan.'),
    check('risk', highOrCritical ? 'warning' : 'pass', highOrCritical ? 'High or critical risk operations require conservative manual review.' : 'No high or critical risk operations were found.'),
    check('policy', input.operations.every((op) => policyIsClosed(op.policyDraft)) ? 'pass' : 'fail', 'All operation policy drafts must keep runtime execution closed.'),
    check('security', input.validation.errors.some((error) => error.code === 'MCP_REMOTE_IMPORT_SENSITIVE_DRAFT') ? 'fail' : 'pass', 'Catalog drafts and audit metadata are sanitized.'),
    check('runtime_block', input.operations.every((op) => op.canApply === false && op.canApplyAutomatically === false) ? 'pass' : 'fail', 'Phase 11E cannot apply operations or enable runtime execution.'),
  ];

  return {
    canApply: false,
    canApplyAutomatically: false,
    requiresManualApproval: input.status === 'pending_approval'
      || input.status === 'ready_for_manual_apply'
      || input.operations.some((op) => op.requiresApproval && op.type !== 'noop'),
    checks,
  };
}

function sanitizedMetadata(input: {
  reviewPackage: McpRemoteDiscoveryReviewPackage;
  status: McpRemoteCatalogImportPlanStatus;
  operationTypes: string[];
}) {
  return sanitizeMetadata({
    source: 'mcp_remote_catalog_import_plan_11e',
    reviewSnapshotId: input.reviewPackage.snapshotId,
    sourceDecisionStatus: input.reviewPackage.decision.status,
    status: input.status,
    operationTypes: input.operationTypes,
    planPersistenceMode: 'server_side_immutable',
    noCatalogMutation: true,
    noRuntimePublish: true,
    noToolExecution: true,
    canApply: false,
    canApplyAutomatically: false,
  }) as Record<string, unknown>;
}

export class McpRemoteCatalogImportPlanService {
  createImportPlan(input: McpRemoteCatalogImportPlanInput): McpRemoteCatalogImportPlan {
    const sourceStatus = input.reviewPackage.decision.status;
    const status = planStatus(sourceStatus);
    const createdAt = input.createdAt ?? input.reviewPackage.discoveredAt;
    const ops = operations(input, status);
    const summaryValue = summary(ops);
    const riskSummaryValue = riskSummary(ops);
    const types = operationTypes(ops);
    const metadata = sanitizedMetadata({ reviewPackage: input.reviewPackage, status, operationTypes: types });
    const validation = validatePlan({
      reviewPackage: input.reviewPackage,
      operations: ops,
      importPolicy: input.importPolicy,
    });
    const preflightValue = preflight({
      reviewPackage: input.reviewPackage,
      status,
      operations: ops,
      validation,
    });
    const hashPayload = {
      snapshotId: input.reviewPackage.snapshotId,
      snapshotHash: input.reviewPackage.snapshotHash,
      serverId: input.reviewPackage.serverId,
      tenantId: input.reviewPackage.tenantId,
      workspaceId: input.reviewPackage.workspaceId,
      requestedByUserId: input.reviewPackage.requestedByUserId,
      requestId: input.reviewPackage.requestId,
      createdAt,
      sourceDecisionStatus: sourceStatus,
      status,
      operations: ops,
      summary: summaryValue,
      riskSummary: riskSummaryValue,
      validation,
      preflight: preflightValue,
      sanitizedMetadata: metadata,
    };
    const planHash = computeMcpRemoteCatalogImportPlanHash(hashPayload);

    return {
      planId: `mcp_remote_catalog_import_plan_${planHash.slice(0, 24)}`,
      planHash,
      snapshotId: input.reviewPackage.snapshotId,
      snapshotHash: input.reviewPackage.snapshotHash,
      serverId: input.reviewPackage.serverId,
      tenantId: input.reviewPackage.tenantId,
      workspaceId: input.reviewPackage.workspaceId,
      requestedByUserId: input.reviewPackage.requestedByUserId,
      requestId: input.reviewPackage.requestId,
      createdAt,
      sourceDecisionStatus: sourceStatus,
      status,
      operations: ops,
      summary: summaryValue,
      riskSummary: riskSummaryValue,
      validation,
      preflight: preflightValue,
      auditEvent: {
        type: 'mcp.remote.catalog_import_plan.created',
        tenantId: input.reviewPackage.tenantId,
        workspaceId: input.reviewPackage.workspaceId,
        serverId: input.reviewPackage.serverId,
        requestId: input.reviewPackage.requestId,
        snapshotHash: input.reviewPackage.snapshotHash,
        planHash,
        status,
        counts: {
          totalOperations: summaryValue.totalOperations,
          create: summaryValue.create,
          update: summaryValue.update,
          deprecate: summaryValue.deprecate,
          noop: summaryValue.noop,
          blocked: summaryValue.blocked,
        },
        riskSummary: riskSummaryValue,
        operationTypes: types,
        metadata: {
          noCatalogMutation: true,
          noRuntimePublish: true,
          noToolExecution: true,
        },
      },
      sanitizedMetadata: metadata,
    };
  }

  createPlan(input: McpRemoteCatalogImportPlanInput): McpRemoteCatalogImportPlan {
    return this.createImportPlan(input);
  }
}

export const mcpRemoteCatalogImportPlanService = new McpRemoteCatalogImportPlanService();
