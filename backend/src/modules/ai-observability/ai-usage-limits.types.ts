export const aiUsageLimitScopeValues = ['tenant', 'workspace', 'assistant', 'user'] as const;
export const aiUsageLimitMetricValues = [
  'run_count',
  'total_tokens',
  'input_tokens',
  'output_tokens',
  'embedding_tokens',
  'cached_tokens',
  'estimated_cost_minor_units',
  'failed_run_count',
  'blocked_run_count',
] as const;
export const aiUsageLimitPeriodValues = ['minute', 'hour', 'day', 'month'] as const;
export const aiUsageLimitModeValues = ['monitor_only', 'enforce'] as const;
export const aiUsageLimitPolicyStatusValues = ['active', 'disabled'] as const;

export type AiUsageLimitScope = typeof aiUsageLimitScopeValues[number];
export type AiUsageLimitMetric = typeof aiUsageLimitMetricValues[number];
export type AiUsageLimitPeriod = typeof aiUsageLimitPeriodValues[number];
export type AiUsageLimitMode = typeof aiUsageLimitModeValues[number];
export type AiUsageLimitPolicyStatus = typeof aiUsageLimitPolicyStatusValues[number];
export type AiUsageLimitDecisionStatus = 'allowed' | 'warn' | 'blocked';
export type AiUsageLimitValueInput = bigint | number | string;

export interface AiUsageLimitPolicy {
  id: string;
  tenantId: string;
  workspaceId: string | null;
  assistantId: string | null;
  userId: string | null;
  scopeType: AiUsageLimitScope;
  metric: AiUsageLimitMetric;
  period: AiUsageLimitPeriod;
  mode: AiUsageLimitMode;
  status: AiUsageLimitPolicyStatus;
  limitValue: bigint;
  warnThresholdValue: bigint | null;
  source: string | null;
  operation: string | null;
  provider: string | null;
  modelName: string | null;
  deletedAt: Date | null;
}

export interface AiUsageLimitProjectedUsage {
  runCount?: AiUsageLimitValueInput | null;
  inputTokens?: AiUsageLimitValueInput | null;
  outputTokens?: AiUsageLimitValueInput | null;
  totalTokens?: AiUsageLimitValueInput | null;
  embeddingTokens?: AiUsageLimitValueInput | null;
  cachedTokens?: AiUsageLimitValueInput | null;
  estimatedCostMinorUnits?: AiUsageLimitValueInput | null;
  failedRunCount?: AiUsageLimitValueInput | null;
  blockedRunCount?: AiUsageLimitValueInput | null;
}

export interface EvaluateAiUsageLimitsInput {
  tenantId: string;
  workspaceId: string;
  assistantId?: string | null;
  userId?: string | null;
  source?: string | null;
  operation?: string | null;
  provider?: string | null;
  model?: string | null;
  now?: Date;
  projectedUsage?: AiUsageLimitProjectedUsage | null;
}

export interface AiUsageAggregationInput {
  policy: AiUsageLimitPolicy;
  windowStart: Date;
  windowEnd: Date;
}

export interface AiUsageLimitsRepository {
  listApplicablePolicies(input: EvaluateAiUsageLimitsInput): Promise<AiUsageLimitPolicy[]>;
  aggregateUsage(input: AiUsageAggregationInput): Promise<bigint>;
}

export interface AiUsageLimitDecision {
  policyId: string;
  scopeType: AiUsageLimitScope;
  metric: AiUsageLimitMetric;
  period: AiUsageLimitPeriod;
  mode: AiUsageLimitMode;
  status: AiUsageLimitDecisionStatus;
  limitValue: bigint;
  warnThresholdValue: bigint | null;
  currentValue: bigint;
  projectedValue: bigint;
  remainingValue: bigint;
  wouldExceed: boolean;
  wouldWarn: boolean;
  reason: 'within_limit' | 'warning_threshold_reached' | 'limit_exceeded';
  windowStart: Date;
  windowEnd: Date;
}

export interface AiUsageLimitEvaluation {
  allowed: boolean;
  status: AiUsageLimitDecisionStatus;
  mode: AiUsageLimitMode;
  decisions: AiUsageLimitDecision[];
}
