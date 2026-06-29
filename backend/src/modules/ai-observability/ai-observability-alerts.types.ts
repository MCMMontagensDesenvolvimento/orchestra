export const aiObservabilityAlertScopeValues = ['tenant', 'workspace', 'assistant', 'user'] as const;
export const aiObservabilityAlertMetricValues = [
  'event_count',
  'run_count',
  'total_tokens',
  'input_tokens',
  'output_tokens',
  'embedding_tokens',
  'cached_tokens',
  'estimated_cost_minor_units',
  'avg_latency_ms',
  'failed_run_count',
  'blocked_run_count',
] as const;
export const aiObservabilityAlertPeriodValues = ['minute', 'hour', 'day', 'month'] as const;
export const aiObservabilityAlertOperatorValues = ['gt', 'gte', 'eq'] as const;
export const aiObservabilityAlertSeverityValues = ['info', 'warning', 'critical'] as const;
export const aiObservabilityAlertRuleStatusValues = ['active', 'disabled'] as const;

export type AiObservabilityAlertScope = typeof aiObservabilityAlertScopeValues[number];
export type AiObservabilityAlertMetric = typeof aiObservabilityAlertMetricValues[number];
export type AiObservabilityAlertPeriod = typeof aiObservabilityAlertPeriodValues[number];
export type AiObservabilityAlertOperator = typeof aiObservabilityAlertOperatorValues[number];
export type AiObservabilityAlertSeverity = typeof aiObservabilityAlertSeverityValues[number];
export type AiObservabilityAlertRuleStatus = typeof aiObservabilityAlertRuleStatusValues[number];
export type AiObservabilityAlertEvaluationStatus = 'ok' | 'triggered';
export type AiObservabilityAlertValueInput = bigint | number | string;

export interface AiObservabilityAlertRule {
  id: string;
  tenantId: string;
  workspaceId: string | null;
  assistantId: string | null;
  userId: string | null;
  scopeType: AiObservabilityAlertScope;
  metric: AiObservabilityAlertMetric;
  period: AiObservabilityAlertPeriod;
  operator: AiObservabilityAlertOperator;
  thresholdValue: bigint;
  severity: AiObservabilityAlertSeverity;
  status: AiObservabilityAlertRuleStatus;
  source: string | null;
  operation: string | null;
  provider: string | null;
  modelName: string | null;
  cooldownMinutes: number | null;
  deletedAt: Date | null;
}

export interface AiObservabilityAlertProjectedUsage {
  eventCount?: AiObservabilityAlertValueInput | null;
  runCount?: AiObservabilityAlertValueInput | null;
  inputTokens?: AiObservabilityAlertValueInput | null;
  outputTokens?: AiObservabilityAlertValueInput | null;
  totalTokens?: AiObservabilityAlertValueInput | null;
  embeddingTokens?: AiObservabilityAlertValueInput | null;
  cachedTokens?: AiObservabilityAlertValueInput | null;
  estimatedCostMinorUnits?: AiObservabilityAlertValueInput | null;
  avgLatencyMs?: AiObservabilityAlertValueInput | null;
  failedRunCount?: AiObservabilityAlertValueInput | null;
  blockedRunCount?: AiObservabilityAlertValueInput | null;
}

export interface EvaluateAiObservabilityAlertsInput {
  tenantId: string;
  workspaceId: string;
  assistantId?: string | null;
  userId?: string | null;
  source?: string | null;
  operation?: string | null;
  provider?: string | null;
  model?: string | null;
  now?: Date;
  projectedUsage?: AiObservabilityAlertProjectedUsage | null;
}

export interface AiObservabilityAlertAggregationInput {
  rule: AiObservabilityAlertRule;
  windowStart: Date;
  windowEnd: Date;
}

export interface AiObservabilityAlertsRepository {
  listApplicableRules(input: EvaluateAiObservabilityAlertsInput): Promise<AiObservabilityAlertRule[]>;
  aggregateUsage(input: AiObservabilityAlertAggregationInput): Promise<bigint>;
}

export interface AiObservabilityAlertDecision {
  ruleId: string;
  scopeType: AiObservabilityAlertScope;
  metric: AiObservabilityAlertMetric;
  period: AiObservabilityAlertPeriod;
  operator: AiObservabilityAlertOperator;
  severity: AiObservabilityAlertSeverity;
  status: AiObservabilityAlertRuleStatus;
  thresholdValue: bigint;
  currentValue: bigint;
  projectedValue: bigint;
  evaluatedValue: bigint;
  triggered: boolean;
  reason: 'within_threshold' | 'threshold_triggered';
  windowStart: Date;
  windowEnd: Date;
}

export interface AiObservabilityAlertEvaluation {
  status: AiObservabilityAlertEvaluationStatus;
  triggered: boolean;
  maxSeverity: AiObservabilityAlertSeverity | null;
  decisions: AiObservabilityAlertDecision[];
}
