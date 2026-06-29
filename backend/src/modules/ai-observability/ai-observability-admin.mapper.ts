import type { AiUsageLimitEvaluation } from './ai-usage-limits.types';
import { sanitizeAiUsageMetadata } from './ai-observability.service';
import type {
  AiUsageEventDetailRecord,
  AiUsageEventListRecord,
  AiUsageLimitPolicyRecord,
  AiUsageSummaryRecord,
} from './ai-observability-admin.repository';
import type { AiUsageSummaryGroupBy } from './ai-observability-admin.schema';

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function mapUsageEventBase(event: AiUsageEventListRecord) {
  return {
    id: event.id,
    workspaceId: event.workspaceId,
    assistantId: event.assistantId,
    userId: event.userId,
    runId: event.runId,
    traceId: event.traceId,
    source: event.source,
    operation: event.operation,
    provider: event.provider,
    model: event.modelName,
    status: event.status,
    blockedReason: event.blockedReason,
    errorCode: event.errorCode,
    inputTokens: event.inputTokens,
    outputTokens: event.outputTokens,
    totalTokens: event.totalTokens,
    embeddingTokens: event.embeddingTokens,
    cachedTokens: event.cachedTokens,
    latencyMs: event.latencyMs,
    costCurrency: event.costCurrency,
    estimatedCostMinorUnits: event.estimatedCostMinorUnits?.toString() ?? null,
    startedAt: event.startedAt.toISOString(),
    completedAt: iso(event.completedAt),
    createdAt: event.createdAt.toISOString(),
  };
}

export function mapAiUsageEventList(event: AiUsageEventListRecord) {
  return mapUsageEventBase(event);
}

export function mapAiUsageEventDetail(event: AiUsageEventDetailRecord) {
  return {
    ...mapUsageEventBase(event),
    metadata: sanitizeAiUsageMetadata(event.metadata) ?? null,
  };
}

export function mapAiUsageSummary(
  row: AiUsageSummaryRecord,
  groupBy: AiUsageSummaryGroupBy,
) {
  return {
    group: groupBy === 'none' ? null : { type: groupBy, value: row.groupKey },
    eventCount: row.eventCount,
    runCount: row.runCount,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    embeddingTokens: row.embeddingTokens,
    cachedTokens: row.cachedTokens,
    estimatedCostMinorUnits: row.estimatedCostMinorUnits,
    avgLatencyMs: row.avgLatencyMs,
    failedRunCount: row.failedRunCount,
    blockedRunCount: row.blockedRunCount,
  };
}

export function mapAiUsageLimitPolicy(policy: AiUsageLimitPolicyRecord) {
  return {
    id: policy.id,
    workspaceId: policy.workspaceId,
    assistantId: policy.assistantId,
    userId: policy.userId,
    scopeType: policy.scopeType,
    metric: policy.metric,
    period: policy.period,
    mode: policy.mode,
    status: policy.status,
    limitValue: policy.limitValue.toString(),
    warnThresholdValue: policy.warnThresholdValue?.toString() ?? null,
    source: policy.source,
    operation: policy.operation,
    provider: policy.provider,
    model: policy.modelName,
    description: policy.description,
    createdByUserId: policy.createdByUserId,
    updatedByUserId: policy.updatedByUserId,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
    deletedAt: iso(policy.deletedAt),
  };
}

export function mapAiUsageLimitEvaluation(evaluation: AiUsageLimitEvaluation) {
  return {
    allowed: evaluation.allowed,
    status: evaluation.status,
    mode: evaluation.mode,
    decisions: evaluation.decisions.map((decision) => ({
      policyId: decision.policyId,
      scopeType: decision.scopeType,
      metric: decision.metric,
      period: decision.period,
      mode: decision.mode,
      status: decision.status,
      limitValue: decision.limitValue.toString(),
      warnThresholdValue: decision.warnThresholdValue?.toString() ?? null,
      currentValue: decision.currentValue.toString(),
      projectedValue: decision.projectedValue.toString(),
      remainingValue: decision.remainingValue.toString(),
      wouldExceed: decision.wouldExceed,
      wouldWarn: decision.wouldWarn,
      reason: decision.reason,
      windowStart: decision.windowStart.toISOString(),
      windowEnd: decision.windowEnd.toISOString(),
    })),
  };
}
