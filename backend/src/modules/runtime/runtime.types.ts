import type { Prisma } from '@prisma/client';
import type { AgentRunMode } from '../agent-runs/agent-runs.schema';
import type { AgentRunEventInput, AgentRunPrecheckSnapshot } from '../agent-runs/agent-runs.types';

export const runtimeProviderValues = ['local', 'agno_stub', 'agno'] as const;
export const runtimeHealthStatusValues = ['healthy', 'degraded', 'disabled', 'misconfigured', 'unavailable'] as const;
export const runtimeExecutionStatusValues = ['completed', 'failed', 'blocked', 'cancelled'] as const;
export const runtimeEventTypeValues = [
  'run_started',
  'prompt_compiled',
  'rag_context_attached',
  'mcp_tools_attached',
  'model_started',
  'model_completed',
  'run_completed',
  'run_failed',
  'adapter_warning',
] as const;

export type RuntimeProvider = typeof runtimeProviderValues[number];
export type RuntimeHealthStatus = typeof runtimeHealthStatusValues[number];
export type RuntimeExecutionStatus = typeof runtimeExecutionStatusValues[number];
export type RuntimeEventType = typeof runtimeEventTypeValues[number];
export type RuntimeCapabilityMode = boolean | 'simulated' | 'planned';

export interface RuntimeCapabilities {
  provider: RuntimeProvider;
  status: RuntimeHealthStatus;
  supportsTextGeneration: RuntimeCapabilityMode;
  supportsStreaming: RuntimeCapabilityMode;
  supportsRagContext: RuntimeCapabilityMode;
  supportsMcpTools: RuntimeCapabilityMode;
  supportsToolCalling: RuntimeCapabilityMode;
  supportsSandbox: RuntimeCapabilityMode;
  supportsExternalProviders: RuntimeCapabilityMode;
  supportsCitations: RuntimeCapabilityMode;
  supportsTraceEvents: RuntimeCapabilityMode;
  maxInputPreviewChars: number;
  maxOutputPreviewChars: number;
}

export interface RuntimeHealth {
  provider: RuntimeProvider;
  status: RuntimeHealthStatus;
  message: string;
  checkedAt: string;
  details?: Record<string, unknown>;
}

export interface RuntimeFeatureConfig {
  provider: RuntimeProvider;
  adapterEnabled: boolean;
  requestTimeoutMs: number;
  requirePrecheck: boolean;
  externalToolsAllowed: boolean;
  agnoEnabled: boolean;
  agnoConfigured: boolean;
  agnoHealthcheckEnabled: boolean;
  agnoBaseUrlConfigured: boolean;
}

export interface RuntimeRagSummary {
  ragReady: boolean;
  knowledgeBindingsCount: number;
  chunkCount: number;
  sourceReferenceCount: number;
  lastRagQueryId: string | null;
  sourceReferences: Array<{
    id: string;
    label: string;
    sourceUri?: string | null;
  }>;
}

export interface RuntimeMcpSummary {
  mcpBindingsCount: number;
  allowedSandboxTools: Array<{
    id: string;
    name: string;
    riskLevel: string;
  }>;
  blockedTools: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
  requiresApproval: Array<{
    id: string;
    name: string;
    riskLevel: string;
  }>;
  lastToolCallIds: string[];
}

export interface RuntimeExecutionContext {
  requestId: string;
  traceId: string;
  runId: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  assistantId: string;
  assistantVersionId: string | null;
  assistantPublicationId: string | null;
  executionMode: AgentRunMode;
  provider: RuntimeProvider;
  assistant: {
    id: string;
    name: string;
    status: string;
    description?: string | null;
    objective?: string | null;
  };
  compiledPrompt: {
    mode: 'placeholder';
    assistantVersionId: string | null;
    instructionChars: number;
  };
  executionPolicySnapshot: Prisma.InputJsonValue;
  precheckSnapshot: AgentRunPrecheckSnapshot;
  rag: RuntimeRagSummary;
  mcp: RuntimeMcpSummary;
  input: {
    hash: string;
    preview: string;
  };
  metadata?: Prisma.InputJsonValue;
}

export interface RuntimeNormalizedEvent {
  type: RuntimeEventType;
  status?: RuntimeExecutionStatus | 'running' | 'queued' | 'prechecking';
  message?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface RuntimeExecutionResult {
  provider: RuntimeProvider;
  status: RuntimeExecutionStatus;
  outputPreview?: string;
  message: string;
  events: RuntimeNormalizedEvent[];
  errorCode?: string;
  errorMessage?: string;
}

export interface RuntimeAdapter {
  readonly provider: RuntimeProvider;
  getCapabilities(): Promise<RuntimeCapabilities> | RuntimeCapabilities;
  healthCheck(): Promise<RuntimeHealth>;
  execute(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult>;
  cancel?(input: { runId: string; traceId: string }): Promise<RuntimeExecutionResult>;
}

export interface RuntimeProviderSummary {
  provider: RuntimeProvider;
  current: boolean;
  health: RuntimeHealth;
  capabilities: RuntimeCapabilities;
}

export type RuntimeAgentRunEvent = AgentRunEventInput;
