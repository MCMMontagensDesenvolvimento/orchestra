export const embeddingProviderNameValues = [
  'disabled',
  'stub',
  'openai',
  'azure_openai',
  'ollama',
  'huggingface',
] as const;

export const embeddingProviderStatusValues = [
  'disabled',
  'misconfigured',
  'configured_but_execution_disabled',
  'ready',
] as const;

export type EmbeddingProviderName = typeof embeddingProviderNameValues[number];
export type EmbeddingProviderStatus = typeof embeddingProviderStatusValues[number];

export interface EmbeddingsConfig {
  enabled: boolean;
  provider: EmbeddingProviderName;
  executionEnabled: boolean;
  model: string | null;
  dimension: number | null;
  timeoutMs: number;
  maxInputChars: number;
  maxBatchSize: number;
  storeRawInputs: boolean;
  storeRawOutputs: boolean;
  openaiCredential: string | null;
  openaiCredentialConfigured: boolean;
  openaiBaseUrl: string;
}

export interface EmbeddingReadiness {
  enabled: boolean;
  configured: boolean;
  executionEnabled: boolean;
  provider: EmbeddingProviderName;
  status: EmbeddingProviderStatus;
  failClosed: boolean;
  reason: string;
  model: string | null;
  dimension: number | null;
  secretsConfigured: boolean;
  externalProviderCalled: false;
  rawInputStored: false;
  rawOutputStored: false;
}

export interface EmbedTextInput {
  text: string;
  requestId?: string;
  model?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EmbedBatchInput {
  texts: string[];
  requestId?: string;
  model?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingVectorResult {
  provider: EmbeddingProviderName;
  model: string | null;
  dimension: number | null;
  vector: number[];
  usage?: {
    inputTokens?: number | null;
  };
  metadata?: {
    externalProviderCalled: boolean;
    rawInputStored: boolean;
    rawOutputStored: boolean;
    estimatedCost?: null;
  };
}

export interface EmbeddingProvider {
  readonly provider: EmbeddingProviderName;
  getReadiness(): EmbeddingReadiness;
  embedText(input: EmbedTextInput): Promise<EmbeddingVectorResult>;
  embedBatch(input: EmbedBatchInput): Promise<EmbeddingVectorResult[]>;
}
