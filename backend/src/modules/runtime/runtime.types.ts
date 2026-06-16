import type { Prisma } from '@prisma/client';
import type { AgentRunMode } from '../agent-runs/agent-runs.schema';
import type { AgentRunEventInput, AgentRunPrecheckSnapshot } from '../agent-runs/agent-runs.types';
import type { LlmProviderName } from '../llm/llm.types';

export const runtimeProviderValues = ['local', 'agno_stub', 'agno'] as const;
export const runtimeHealthStatusValues = ['healthy', 'degraded', 'disabled', 'misconfigured', 'unavailable'] as const;
export const runtimeExecutionStatusValues = ['completed', 'failed', 'blocked', 'cancelled'] as const;
export const runtimeEventTypeValues = [
  'provider_selected',
  'run_started',
  'prompt_compiled',
  'rag_context_attached',
  'mcp_tools_attached',
  'llm_provider_selected',
  'llm_generation_started',
  'llm_generation_completed',
  'llm_generation_failed',
  'llm_generation_blocked',
  'runtime_llm_context_attached',
  'agno_health_checked',
  'agno_request_started',
  'agno_request_completed',
  'agno_request_failed',
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
  defaultTimeoutMs: number;
  requestTimeoutMs: number;
  requirePrecheck: boolean;
  allowProviderFallback: boolean;
  externalToolsAllowed: boolean;
  agnoEnabled: boolean;
  agnoConfigured: boolean;
  agnoExecutionEnabled: boolean;
  agnoHealthcheckEnabled: boolean;
  agnoBaseUrlConfigured: boolean;
  agnoApiKeyConfigured: boolean;
  agnoTimeoutMs: number;
  agnoHealthPath: string;
  agnoCapabilitiesPath: string;
  agnoExecutePath: string;
  agnoRequireSandbox: boolean;
  agnoAllowExternalTools: boolean;
  agnoAllowRemoteMcp: boolean;
  agnoSendRagContext: boolean;
  agnoSendMcpToolDescriptors: boolean;
  agnoMaxInputPreviewChars: number;
  agnoMaxOutputPreviewChars: number;
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
    documentTitle?: string | null;
    excerpt?: string | null;
  }>;
}

export interface RuntimeMcpSummary {
  mcpBindingsCount: number;
  allowedSandboxTools: Array<{
    id: string;
    serverId: string;
    toolId: string;
    name: string;
    riskLevel: string;
    requiresApproval: boolean;
    executionMode: string;
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
    instructionsPreview?: string | null;
    modelProvider?: string | null;
    modelName?: string | null;
    temperature?: number | null;
  };
  executionPolicySnapshot: Prisma.InputJsonValue;
  llmPolicySnapshot: {
    allowExternalLlmProviders: boolean;
    allowedLlmProviders: LlmProviderName[];
    defaultLlmProvider: LlmProviderName | null;
  };
  precheckSnapshot: AgentRunPrecheckSnapshot;
  rag: RuntimeRagSummary;
  mcp: RuntimeMcpSummary;
  input: {
    hash: string;
    preview: string;
    raw?: string;
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
  outputHash?: string;
  message: string;
  events: RuntimeNormalizedEvent[];
  errorCode?: string;
  errorMessage?: string;
  metadata?: Prisma.InputJsonValue;
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
