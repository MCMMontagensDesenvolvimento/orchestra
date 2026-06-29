export const aiUsageEventSourceValues = [
  'llm_provider',
  'rag',
  'mcp',
  'runtime_adapter',
  'embedding',
  'unknown',
] as const;

export const aiUsageEventStatusValues = [
  'started',
  'succeeded',
  'failed',
  'blocked',
  'cancelled',
] as const;

export type AiUsageEventSource = typeof aiUsageEventSourceValues[number];
export type AiUsageEventStatus = typeof aiUsageEventStatusValues[number];

export interface AiUsageCostInput {
  currency?: string | null;
  minorUnits?: bigint | number | string | null;
}

export interface AiUsageEventInput {
  tenantId: string;
  workspaceId: string;
  assistantId?: string | null;
  userId?: string | null;
  runId: string;
  traceId?: string | null;
  source?: AiUsageEventSource | string | null;
  operation: string;
  provider?: string | null;
  model?: string | null;
  status?: AiUsageEventStatus | string | null;
  blockedReason?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  errorMessageHash?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  embeddingTokens?: number | null;
  cachedTokens?: number | null;
  latencyMs?: number | null;
  cost?: AiUsageCostInput | null;
  costCurrency?: string | null;
  estimatedCostMinorUnits?: bigint | number | string | null;
  metadata?: unknown;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
}

export interface NormalizedAiUsageEventInput {
  tenantId: string;
  workspaceId: string;
  assistantId?: string | null;
  userId?: string | null;
  runId: string;
  traceId?: string | null;
  source: AiUsageEventSource;
  operation: string;
  provider?: string | null;
  model?: string | null;
  status: AiUsageEventStatus;
  blockedReason?: string | null;
  errorCode?: string | null;
  errorMessageHash?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  embeddingTokens?: number | null;
  cachedTokens?: number | null;
  latencyMs?: number | null;
  costCurrency?: string | null;
  estimatedCostMinorUnits?: bigint | null;
  metadata?: unknown;
  startedAt: Date;
  completedAt?: Date | null;
}

export interface AiObservabilityRepository {
  createUsageEvent(input: NormalizedAiUsageEventInput): Promise<unknown>;
}
