import type { Prisma } from '@prisma/client';

export const llmProviderNameValues = ['local_deterministic', 'agno_local', 'openai', 'azure_openai', 'anthropic'] as const;
export const llmProviderStatusValues = ['healthy', 'disabled', 'misconfigured', 'configured_but_execution_disabled', 'unavailable'] as const;
export const llmGenerationStatusValues = ['completed', 'blocked', 'failed'] as const;

export type LlmProviderName = typeof llmProviderNameValues[number];
export type LlmProviderStatus = typeof llmProviderStatusValues[number];
export type LlmGenerationStatus = typeof llmGenerationStatusValues[number];
export type LlmCapabilityMode = boolean | 'simulated' | 'planned' | 'planned_but_disabled';

export interface LlmProviderCapabilities {
  provider: LlmProviderName;
  status: LlmProviderStatus;
  enabled: boolean;
  configured: boolean;
  executionEnabled: boolean;
  supportsChatCompletion: LlmCapabilityMode;
  supportsStreaming: LlmCapabilityMode;
  supportsToolCalling: LlmCapabilityMode;
  supportsStructuredOutput: LlmCapabilityMode;
  supportsEmbeddings: LlmCapabilityMode;
  supportsRagContext: LlmCapabilityMode;
  supportsMcpContext: LlmCapabilityMode;
  secretsConfigured: boolean;
  models: string[];
  defaultModel?: string | null;
  maxInputPreviewChars: number;
  maxOutputPreviewChars: number;
}

export interface LlmProviderHealth {
  provider: LlmProviderName;
  status: LlmProviderStatus;
  message: string;
  checkedAt: string;
  details?: Record<string, unknown>;
}

export interface LlmGenerateTextRequest {
  requestId: string;
  traceId?: string;
  runId?: string;
  provider: LlmProviderName;
  input: {
    hash: string;
    preview: string;
    raw?: string;
  };
  prompt?: {
    instructionsPreview?: string | null;
    instructionChars?: number;
    modelProvider?: string | null;
    modelName?: string | null;
    temperature?: number | null;
  };
  context?: {
    assistantName?: string | null;
    executionMode?: string;
    ragReady?: boolean;
    ragSourceCount?: number;
    mcpToolDescriptorCount?: number;
  };
  model?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface LlmGenerateTextResult {
  provider: LlmProviderName;
  status: LlmGenerationStatus;
  message: string;
  model?: string | null;
  outputPreview?: string;
  outputHash?: string;
  inputHash: string;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface LlmProviderSummary {
  provider: LlmProviderName;
  current: boolean;
  health: LlmProviderHealth;
  capabilities: LlmProviderCapabilities;
}

export interface LlmProvider {
  readonly provider: LlmProviderName;
  getCapabilities(): LlmProviderCapabilities;
  healthCheck(): Promise<LlmProviderHealth>;
  generateText(request: LlmGenerateTextRequest): Promise<LlmGenerateTextResult>;
}
