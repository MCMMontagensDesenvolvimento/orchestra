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
  config?: McpRemoteFeatureConfig;
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
    inferredRiskLevel: 'low' | 'medium' | 'high' | 'critical';
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
