export const mcpRemoteReadinessStatusValues = [
  'disabled',
  'ready',
  'misconfigured',
  'blocked',
  'auth_required',
  'execution_disabled',
  'discovery_disabled',
] as const;

export const mcpRemoteReadinessCheckNameValues = [
  'feature_flag',
  'server_status',
  'transport',
  'auth',
  'policy',
  'discovery',
  'execution',
] as const;

export const mcpRemoteReadinessCheckStatusValues = ['pass', 'fail', 'skipped'] as const;

export const mcpRemoteClientErrorCodeValues = [
  'MCP_REMOTE_DISABLED',
  'MCP_REMOTE_DISCOVERY_DISABLED',
  'MCP_REMOTE_EXECUTION_DISABLED',
  'MCP_REMOTE_NOT_IMPLEMENTED',
] as const;

export const mcpRemoteToolExecutionStatusValues = [
  'completed',
  'failed',
  'blocked',
  'cancelled',
  'timeout',
] as const;

export type McpRemoteReadinessStatus = typeof mcpRemoteReadinessStatusValues[number];
export type McpRemoteReadinessCheckName = typeof mcpRemoteReadinessCheckNameValues[number];
export type McpRemoteReadinessCheckStatus = typeof mcpRemoteReadinessCheckStatusValues[number];
export type McpRemoteClientErrorCode = typeof mcpRemoteClientErrorCodeValues[number];
export type McpRemoteToolExecutionStatus = typeof mcpRemoteToolExecutionStatusValues[number];

export interface McpRemoteFeatureConfig {
  remoteEnabled: boolean;
  discoveryEnabled: boolean;
  executionEnabled: boolean;
  defaultTimeoutMs: number;
}

export interface McpRemoteOperationalLimits {
  timeoutMs: number;
  maxInputBytes: number;
  maxOutputBytes: number;
  maxConcurrency: number;
  rateLimitPerMinute: number;
}

export interface GovernedMcpPolicyDecision {
  status: 'allowed' | 'blocked' | 'approval_required';
  reasons: string[];
  allowRuntimeExecution: boolean;
  sandboxOnly: boolean;
  blockedByDefault: boolean;
  approvalSatisfied: boolean;
}

export interface McpRemoteReadinessCheck {
  name: McpRemoteReadinessCheckName;
  status: McpRemoteReadinessCheckStatus;
  message?: string;
}

export interface McpRemoteReadiness {
  status: McpRemoteReadinessStatus;
  failClosed: boolean;
  remoteEnabled: boolean;
  discoveryEnabled: boolean;
  executionEnabled: boolean;
  serverId?: string;
  reason: string;
  checks: McpRemoteReadinessCheck[];
  credentialsConfigured: boolean;
  authType?: string;
  timeoutMs: number;
}

export interface GovernedMcpRemoteServer {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  name?: string;
  status: string;
  deletedAt?: Date | string | null;
  serverType?: string | null;
  baseUrl?: string | null;
  authType?: string | null;
  trustLevel?: string | null;
  riskLevel?: string | null;
}

export interface GovernedMcpRemotePolicy {
  allowDiscovery?: boolean | null;
  allowRuntimeExecution?: boolean | null;
  sandboxOnly?: boolean | null;
  blockedByDefault?: boolean | null;
  requiresApproval?: boolean | null;
}

export interface McpRemoteReadinessInput {
  server?: GovernedMcpRemoteServer | null;
  policy?: GovernedMcpRemotePolicy | null;
  credentialsConfigured?: boolean;
  requiresBaseUrl?: boolean;
  purpose?: 'execution' | 'discovery';
  config?: McpRemoteFeatureConfig;
}

export type McpRemoteDiscoveredToolRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface McpRemoteExistingToolSpec {
  externalName: string;
  specHash?: string | null;
}

export interface McpRemoteDiscoveryInput {
  tenantId: string;
  workspaceId: string;
  server: GovernedMcpRemoteServer;
  policy: GovernedMcpRemotePolicy;
  credentialsConfigured: boolean;
  requestedByUserId: string;
  requestId: string;
  existingTools?: McpRemoteExistingToolSpec[];
}

export interface McpRemoteDiscoveredTool {
  externalName: string;
  displayName: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  specHash: string;
  inferredRiskLevel: McpRemoteDiscoveredToolRiskLevel;
  requiresApproval: boolean;
  defaultPolicy: {
    allowRuntimeExecution: false;
    sandboxOnly: true;
    blockedByDefault: true;
  };
}

export interface McpRemoteDiscoveryOutput {
  serverId: string;
  status: 'completed' | 'blocked' | 'failed';
  discoveredAt: string;
  protocolVersion?: string;
  specHash?: string;
  tools: McpRemoteDiscoveredTool[];
  diff: {
    added: string[];
    changed: string[];
    removed: string[];
  };
  warnings: Array<{ code: string; message: string }>;
  readiness: McpRemoteReadiness;
  sanitizedMetadata: Record<string, unknown>;
}

export type McpRemoteDiscoveryApprovalDecisionStatus =
  | 'blocked'
  | 'pending_human_review'
  | 'approved_for_future_import'
  | 'rejected'
  | 'no_changes';

export type McpRemoteDiscoveryProposedActionType =
  | 'propose_add'
  | 'propose_update'
  | 'propose_remove'
  | 'keep_existing'
  | 'blocked';

export interface McpRemoteDiscoveryApprovalPolicy {
  allowAutoApproveLowRisk?: boolean;
  allowAutoApproveMediumRisk?: boolean;
  requireHumanReviewForHighRisk?: boolean;
  requireHumanReviewForCriticalRisk?: boolean;
  requireHumanReviewForChangedTools?: boolean;
  requireHumanReviewForRemovedTools?: boolean;
  blockedByDefault?: boolean;
}

export interface McpRemoteDiscoveryProposedAction {
  type: McpRemoteDiscoveryProposedActionType;
  externalName: string;
  specHash?: string;
  previousSpecHash?: string | null;
  riskLevel?: McpRemoteDiscoveredToolRiskLevel;
  requiresApproval: boolean;
  canApplyAutomatically: boolean;
  reason: string;
  defaultPolicy?: {
    allowRuntimeExecution: false;
    sandboxOnly: true;
    blockedByDefault: true;
  };
}

export interface McpRemoteDiscoveryApprovalDecision {
  status: McpRemoteDiscoveryApprovalDecisionStatus;
  requiresHumanReview: boolean;
  reasons: string[];
}

export interface McpRemoteDiscoveryHumanReviewRequirement {
  required: boolean;
  reasons: string[];
  riskLevels: McpRemoteDiscoveredToolRiskLevel[];
  actionTypes: McpRemoteDiscoveryProposedActionType[];
}

export interface McpRemoteDiscoveryApplyPlan {
  status: 'blocked';
  canApply: false;
  reason: string;
  proposedActions: McpRemoteDiscoveryProposedAction[];
}

export interface McpRemoteDiscoveryAuditEvent {
  type: 'mcp.remote.discovery.review_package_created';
  tenantId: string;
  workspaceId: string;
  serverId: string;
  requestId: string;
  snapshotHash: string;
  decisionStatus: McpRemoteDiscoveryApprovalDecisionStatus;
  counts: Record<string, number>;
  diff: {
    added: string[];
    changed: string[];
    removed: string[];
  };
  riskSummary: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  metadata: Record<string, unknown>;
}

export interface McpRemoteDiscoveryReviewPackage {
  snapshotId: string;
  serverId: string;
  tenantId: string;
  workspaceId: string;
  requestedByUserId: string;
  requestId: string;
  discoveredAt: string;
  discoverySpecHash?: string;
  snapshotHash: string;
  summary: {
    status: 'completed' | 'blocked' | 'failed';
    totalTools: number;
    added: number;
    changed: number;
    removed: number;
    warnings: number;
  };
  riskSummary: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  diff: {
    added: string[];
    changed: string[];
    removed: string[];
  };
  proposedActions: McpRemoteDiscoveryProposedAction[];
  decision: McpRemoteDiscoveryApprovalDecision;
  humanReview: McpRemoteDiscoveryHumanReviewRequirement;
  applyPlan: McpRemoteDiscoveryApplyPlan;
  auditEvent: McpRemoteDiscoveryAuditEvent;
  sanitizedMetadata: Record<string, unknown>;
}

export interface McpRemoteDiscoveryReviewInput {
  tenantId: string;
  workspaceId: string;
  requestedByUserId: string;
  requestId: string;
  discovery: McpRemoteDiscoveryOutput;
  approvalPolicy?: McpRemoteDiscoveryApprovalPolicy;
  existingTools?: McpRemoteExistingToolSpec[];
}

export type McpRemoteCatalogImportPlanStatus =
  | 'blocked'
  | 'pending_approval'
  | 'ready_for_manual_apply'
  | 'no_changes';

export type McpRemoteCatalogImportOperationType =
  | 'create_tool_draft'
  | 'update_tool_draft'
  | 'deprecate_tool_draft'
  | 'noop'
  | 'blocked';

export interface McpRemoteCatalogImportPolicy {
  allowPlanForPendingReview?: boolean;
  allowPlanForApprovedFutureImport?: boolean;
  allowHighRiskPlan?: boolean;
  allowCriticalRiskPlan?: boolean;
  blockedByDefault?: boolean;
}

export interface McpRemoteCatalogToolDraft {
  externalName: string;
  displayName: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  specHash?: string;
  source: 'remote_discovery';
  remote: {
    serverId: string;
    importedFromSnapshotId: string;
    importedFromSnapshotHash: string;
  };
  metadata: Record<string, unknown>;
}

export interface McpRemoteCatalogPolicyDraft {
  allowRuntimeExecution: false;
  sandboxOnly: true;
  blockedByDefault: true;
  requiresApproval: true;
  approvalMode: 'manual';
  runtimeEnabled: false;
  remoteExecutionEnabled: false;
}

export interface McpRemoteCatalogImportValidationMessage {
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

export interface McpRemoteCatalogImportOperation {
  operationId: string;
  type: McpRemoteCatalogImportOperationType;
  externalName: string;
  displayName?: string;
  specHash?: string;
  previousSpecHash?: string | null;
  riskLevel?: McpRemoteDiscoveredToolRiskLevel;
  requiresApproval: boolean;
  canApply: false;
  canApplyAutomatically: false;
  reason: string;
  catalogDraft?: McpRemoteCatalogToolDraft;
  policyDraft: McpRemoteCatalogPolicyDraft;
  validationMessages: McpRemoteCatalogImportValidationMessage[];
}

export interface McpRemoteCatalogImportPlanValidation {
  valid: boolean;
  errors: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
}

export type McpRemoteCatalogImportPreflightCheckName =
  | 'snapshot'
  | 'decision'
  | 'operations'
  | 'risk'
  | 'policy'
  | 'security'
  | 'runtime_block';

export interface McpRemoteCatalogImportPreflight {
  canApply: false;
  canApplyAutomatically: false;
  requiresManualApproval: boolean;
  checks: Array<{
    name: McpRemoteCatalogImportPreflightCheckName;
    status: 'pass' | 'fail' | 'warning' | 'skipped';
    message: string;
  }>;
}

export interface McpRemoteCatalogImportPlanAuditEvent {
  type: 'mcp.remote.catalog_import_plan.created';
  tenantId: string;
  workspaceId: string;
  serverId: string;
  requestId: string;
  snapshotHash: string;
  planHash: string;
  status: McpRemoteCatalogImportPlanStatus;
  counts: Record<string, number>;
  riskSummary: Record<string, number>;
  operationTypes: string[];
  metadata: Record<string, unknown>;
}

export interface McpRemoteCatalogImportPlan {
  planId: string;
  planHash: string;
  snapshotId: string;
  snapshotHash: string;
  serverId: string;
  tenantId: string;
  workspaceId: string;
  requestedByUserId: string;
  requestId: string;
  createdAt: string;
  sourceDecisionStatus: McpRemoteDiscoveryApprovalDecisionStatus;
  status: McpRemoteCatalogImportPlanStatus;
  operations: McpRemoteCatalogImportOperation[];
  summary: {
    totalOperations: number;
    create: number;
    update: number;
    deprecate: number;
    noop: number;
    blocked: number;
  };
  riskSummary: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  validation: McpRemoteCatalogImportPlanValidation;
  preflight: McpRemoteCatalogImportPreflight;
  auditEvent: McpRemoteCatalogImportPlanAuditEvent;
  sanitizedMetadata: Record<string, unknown>;
}

export interface McpRemoteCatalogImportPlanInput {
  reviewPackage: McpRemoteDiscoveryReviewPackage;
  importPolicy?: McpRemoteCatalogImportPolicy;
  existingCatalogTools?: Array<{
    externalName: string;
    specHash?: string | null;
    status?: string | null;
  }>;
  createdAt?: string;
}

export type McpRemoteCatalogImportApplyStatus =
  | 'applied'
  | 'blocked'
  | 'no_changes'
  | 'partially_applied'
  | 'failed';

export type McpRemoteCatalogImportApplyOperationStatus =
  | 'applied'
  | 'blocked'
  | 'skipped'
  | 'failed'
  | 'noop'
  | 'idempotent';

export interface McpRemoteCatalogImportApplyAuthorization {
  approvedByUserId: string;
  approvalReason: string;
  confirmManualApply: boolean;
  approvedAt?: string;
  approvalTicketId?: string;
}

export interface McpRemoteCatalogImportApplyOptions {
  allowPendingApprovalApply?: boolean;
  allowReadyForManualApply?: boolean;
  dryRun?: boolean;
}

export interface McpRemoteCatalogImportApplyInput {
  plan: McpRemoteCatalogImportPlan;
  authorization: McpRemoteCatalogImportApplyAuthorization;
  options?: McpRemoteCatalogImportApplyOptions;
  appliedAt?: string;
}

export interface McpRemoteCatalogImportApplyOperationResult {
  operationId: string;
  type: McpRemoteCatalogImportOperationType;
  externalName: string;
  status: McpRemoteCatalogImportApplyOperationStatus;
  catalogItemId?: string;
  reason: string;
  beforeHash?: string;
  afterHash?: string;
  runtimeEnabled: false;
  remoteExecutionEnabled: false;
}

export interface McpRemoteCatalogImportApplyRollbackNote {
  operationId?: string;
  externalName?: string;
  note: string;
}

export interface McpRemoteCatalogImportApplyAuditEvent {
  type: 'mcp.remote.catalog_import_apply.executed';
  tenantId: string;
  workspaceId: string;
  serverId: string;
  planHash: string;
  applyHash: string;
  approvedByUserId: string;
  status: McpRemoteCatalogImportApplyStatus;
  counts: Record<string, number>;
  operationTypes: string[];
  metadata: Record<string, unknown>;
}

export interface McpRemoteCatalogImportApplyResult {
  applyId: string;
  applyHash: string;
  idempotencyKey: string;
  planId: string;
  planHash: string;
  snapshotHash: string;
  serverId: string;
  tenantId: string;
  workspaceId: string;
  approvedByUserId: string;
  appliedAt: string;
  status: McpRemoteCatalogImportApplyStatus;
  operationResults: McpRemoteCatalogImportApplyOperationResult[];
  summary: {
    total: number;
    applied: number;
    blocked: number;
    skipped: number;
    failed: number;
    noop: number;
    idempotent: number;
  };
  auditEvent: McpRemoteCatalogImportApplyAuditEvent;
  sanitizedMetadata: Record<string, unknown>;
  rollbackNotes: McpRemoteCatalogImportApplyRollbackNote[];
}

export interface McpRemoteCatalogImportApplyCatalogItem {
  id: string;
  externalName: string;
  displayName?: string | null;
  description?: string | null;
  specHash?: string | null;
  status?: string | null;
  lifecycleStatus?: string | null;
  riskLevel?: McpRemoteDiscoveredToolRiskLevel | null;
  requiresApproval?: boolean | null;
  catalogHash?: string | null;
  revision?: number | null;
  metadata?: Record<string, unknown>;
}

export interface McpRemoteCatalogApplyMutationContext {
  planId: string;
  planHash: string;
  snapshotId: string;
  snapshotHash: string;
  applyId: string;
  applyHash: string;
  idempotencyKey: string;
  approvedByUserId: string;
  approvedAt?: string;
  appliedAt: string;
}

export interface McpRemoteCatalogApplyReservationInput extends McpRemoteCatalogApplyMutationContext {
  tenantId: string;
  workspaceId: string;
  serverId: string;
  approvalReasonHash?: string;
}

export interface McpRemoteCatalogImportApplyTransaction {
  findByExternalName(input: {
    tenantId: string;
    workspaceId: string;
    serverId: string;
    externalName: string;
  }): Promise<McpRemoteCatalogImportApplyCatalogItem | null>;

  createToolDraft(input: {
    tenantId: string;
    workspaceId: string;
    serverId: string;
    externalName: string;
    displayName?: string;
    description?: string;
    specHash?: string;
    riskLevel?: McpRemoteDiscoveredToolRiskLevel;
    applyContext?: McpRemoteCatalogApplyMutationContext;
    catalogDraft: McpRemoteCatalogToolDraft;
    policyDraft: McpRemoteCatalogPolicyDraft;
  }): Promise<{ id: string; catalogHash?: string | null }>;

  updateToolDraft(input: {
    id: string;
    tenantId: string;
    workspaceId: string;
    serverId: string;
    externalName: string;
    displayName?: string;
    description?: string;
    specHash?: string;
    riskLevel?: McpRemoteDiscoveredToolRiskLevel;
    expectedRevision?: number | null;
    applyContext?: McpRemoteCatalogApplyMutationContext;
    catalogDraft: McpRemoteCatalogToolDraft;
    policyDraft: McpRemoteCatalogPolicyDraft;
  }): Promise<{ id: string; catalogHash?: string | null }>;

  deprecateToolDraft(input: {
    id: string;
    tenantId: string;
    workspaceId: string;
    serverId: string;
    externalName: string;
    reason: string;
    expectedRevision?: number | null;
    applyContext?: McpRemoteCatalogApplyMutationContext;
  }): Promise<{ id: string; catalogHash?: string | null }>;

  reserveApply?(input: McpRemoteCatalogApplyReservationInput): Promise<void>;

  finalizeCatalogEntriesForApply?(input: {
    tenantId: string;
    workspaceId: string;
    serverId: string;
    applyId: string;
    applyHash: string;
    operationResults: McpRemoteCatalogImportApplyOperationResult[];
  }): Promise<void>;

  saveApplyResult?(input: {
    idempotencyKey: string;
    result: McpRemoteCatalogImportApplyResult;
  }): Promise<void>;
}

export interface McpRemoteCatalogImportApplyRepository extends McpRemoteCatalogImportApplyTransaction {
  withTransaction<T>(fn: (transaction: McpRemoteCatalogImportApplyTransaction) => Promise<T>): Promise<T>;

  recordAuditEvent(input: {
    type: string;
    tenantId: string;
    workspaceId: string;
    serverId: string;
    event: McpRemoteCatalogImportApplyAuditEvent;
  }): Promise<void>;

  findApplyByIdempotencyKey?(input: {
    tenantId: string;
    workspaceId: string;
    serverId: string;
    idempotencyKey: string;
  }): Promise<McpRemoteCatalogImportApplyResult | null>;

  saveApplyResult?(input: {
    idempotencyKey: string;
    result: McpRemoteCatalogImportApplyResult;
  }): Promise<void>;
}

export interface McpToolDiscoveryRequest {
  tenantId: string;
  workspaceId: string;
  serverId: string;
  requestedByUserId: string;
  requestId: string;
  mode: 'dry_run' | 'apply_after_approval';
  timeoutMs: number;
}

export interface McpToolDiscoveryResult {
  serverId: string;
  status: 'completed' | 'failed' | 'blocked';
  protocolVersion?: string;
  discoveredAt: string;
  specHash?: string;
  tools: Array<{
    externalName: string;
    displayName: string;
    description?: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
    inferredRiskLevel: McpRemoteDiscoveredToolRiskLevel;
    requiresApproval: boolean;
    defaultPolicy: {
      allowRuntimeExecution: false;
      sandboxOnly: true;
      blockedByDefault: true;
    };
  }>;
  diff: {
    added: string[];
    changed: string[];
    removed: string[];
  };
  warnings: Array<{ code: string; message: string }>;
}

export interface GovernedMcpToolExecutionSpec {
  executionId: string;
  tenantId: string;
  workspaceId: string;
  assistantId: string;
  assistantVersionId?: string | null;
  agentRunId?: string | null;
  mcpServerId: string;
  mcpToolId: string;
  assistantMcpBindingId: string;
  requestedByUserId: string;
  mode: 'remote_controlled';
  requestId: string;
  traceId: string;
  tool: {
    externalName: string;
    displayName: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    requiresApproval: boolean;
  };
  policyDecision: GovernedMcpPolicyDecision & { status: 'allowed' };
  limits: Pick<McpRemoteOperationalLimits, 'timeoutMs' | 'maxInputBytes' | 'maxOutputBytes'>;
  input: {
    hash: string;
    preview?: string;
    value: unknown;
  };
}

export interface GovernedMcpToolExecutionResult {
  executionId: string;
  status: McpRemoteToolExecutionStatus;
  outputPreview?: string;
  outputHash?: string;
  errorCode?: McpRemoteClientErrorCode | string;
  errorMessage?: string;
  durationMs: number;
  events: Array<{
    type: string;
    status?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }>;
  sanitizedMetadata?: Record<string, unknown>;
}

export interface McpRemoteClientOptions {
  serverId: string;
  baseUrl?: string | null;
  authType?: string | null;
  credentialsConfigured?: boolean;
  timeoutMs: number;
}
