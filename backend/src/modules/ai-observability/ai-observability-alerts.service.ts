import { AppError } from '../../shared/errors/app-error';
import { aiObservabilityAlertsRepository } from './ai-observability-alerts.repository';
import type {
  AiObservabilityAlertDecision,
  AiObservabilityAlertEvaluation,
  AiObservabilityAlertMetric,
  AiObservabilityAlertPeriod,
  AiObservabilityAlertRule,
  AiObservabilityAlertSeverity,
  AiObservabilityAlertsRepository,
  AiObservabilityAlertValueInput,
  EvaluateAiObservabilityAlertsInput,
} from './ai-observability-alerts.types';

function nonNegativeBigInt(
  value: AiObservabilityAlertValueInput | null | undefined,
  fallback = 0n,
) {
  if (value === null || typeof value === 'undefined') return fallback;
  try {
    if (typeof value === 'bigint') {
      if (value >= 0n) return value;
    } else if (typeof value === 'number') {
      if (Number.isSafeInteger(value) && value >= 0) return BigInt(value);
    } else if (/^\d+$/.test(value.trim())) {
      return BigInt(value.trim());
    }
  } catch {
    // The controlled validation error below is intentionally shared by all invalid inputs.
  }
  throw new AppError(422, 'AI_OBSERVABILITY_ALERT_PROJECTED_USAGE_INVALID', 'Projected usage deve conter apenas inteiros nao negativos e seguros.');
}

export function getAiObservabilityAlertPeriodWindow(period: AiObservabilityAlertPeriod, now = new Date()) {
  if (!Number.isFinite(now.getTime())) {
    throw new AppError(422, 'AI_OBSERVABILITY_ALERT_NOW_INVALID', 'now deve ser uma data valida.');
  }

  const start = new Date(now.getTime());
  if (period === 'minute') start.setUTCSeconds(0, 0);
  if (period === 'hour') start.setUTCMinutes(0, 0, 0);
  if (period === 'day') start.setUTCHours(0, 0, 0, 0);
  if (period === 'month') {
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
  }

  const end = new Date(start.getTime());
  if (period === 'minute') end.setUTCMinutes(end.getUTCMinutes() + 1);
  if (period === 'hour') end.setUTCHours(end.getUTCHours() + 1);
  if (period === 'day') end.setUTCDate(end.getUTCDate() + 1);
  if (period === 'month') end.setUTCMonth(end.getUTCMonth() + 1);

  return { start, end };
}

function ruleMatchesContext(rule: AiObservabilityAlertRule, input: EvaluateAiObservabilityAlertsInput) {
  if (rule.tenantId !== input.tenantId || rule.status !== 'active' || rule.deletedAt !== null) return false;
  if (rule.scopeType === 'workspace' && rule.workspaceId !== input.workspaceId) return false;
  if (rule.scopeType === 'assistant' && rule.assistantId !== (input.assistantId ?? null)) return false;
  if (rule.scopeType === 'user' && rule.userId !== (input.userId ?? null)) return false;
  if (rule.source !== null && rule.source !== (input.source ?? null)) return false;
  if (rule.operation !== null && rule.operation !== (input.operation ?? null)) return false;
  if (rule.provider !== null && rule.provider !== (input.provider ?? null)) return false;
  if (rule.modelName !== null && rule.modelName !== (input.model ?? null)) return false;
  return true;
}

function projectedValue(metric: AiObservabilityAlertMetric, input: EvaluateAiObservabilityAlertsInput) {
  const projected = input.projectedUsage;
  if (metric === 'event_count') return nonNegativeBigInt(projected?.eventCount);
  if (metric === 'run_count') return nonNegativeBigInt(projected?.runCount);
  if (metric === 'input_tokens') return nonNegativeBigInt(projected?.inputTokens);
  if (metric === 'output_tokens') return nonNegativeBigInt(projected?.outputTokens);
  if (metric === 'embedding_tokens') return nonNegativeBigInt(projected?.embeddingTokens);
  if (metric === 'cached_tokens') return nonNegativeBigInt(projected?.cachedTokens);
  if (metric === 'estimated_cost_minor_units') return nonNegativeBigInt(projected?.estimatedCostMinorUnits);
  if (metric === 'avg_latency_ms') return nonNegativeBigInt(projected?.avgLatencyMs);
  if (metric === 'failed_run_count') return nonNegativeBigInt(projected?.failedRunCount);
  if (metric === 'blocked_run_count') return nonNegativeBigInt(projected?.blockedRunCount);
  if (projected?.totalTokens !== null && typeof projected?.totalTokens !== 'undefined') {
    return nonNegativeBigInt(projected.totalTokens);
  }
  return nonNegativeBigInt(projected?.inputTokens) + nonNegativeBigInt(projected?.outputTokens);
}

function isTriggered(rule: AiObservabilityAlertRule, evaluatedValue: bigint) {
  if (rule.operator === 'gt') return evaluatedValue > rule.thresholdValue;
  if (rule.operator === 'gte') return evaluatedValue >= rule.thresholdValue;
  return evaluatedValue === rule.thresholdValue;
}

function decisionFor(
  rule: AiObservabilityAlertRule,
  currentValue: bigint,
  projected: bigint,
  windowStart: Date,
  windowEnd: Date,
): AiObservabilityAlertDecision {
  const evaluatedValue = currentValue + projected;
  const triggered = isTriggered(rule, evaluatedValue);

  return {
    ruleId: rule.id,
    scopeType: rule.scopeType,
    metric: rule.metric,
    period: rule.period,
    operator: rule.operator,
    severity: rule.severity,
    status: rule.status,
    thresholdValue: rule.thresholdValue,
    currentValue,
    projectedValue: projected,
    evaluatedValue,
    triggered,
    reason: triggered ? 'threshold_triggered' : 'within_threshold',
    windowStart,
    windowEnd,
  };
}

const severityRank: Record<AiObservabilityAlertSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

function maxTriggeredSeverity(decisions: AiObservabilityAlertDecision[]) {
  return decisions.reduce<AiObservabilityAlertSeverity | null>((maxSeverity, decision) => {
    if (!decision.triggered) return maxSeverity;
    if (!maxSeverity || severityRank[decision.severity] > severityRank[maxSeverity]) {
      return decision.severity;
    }
    return maxSeverity;
  }, null);
}

export class AiObservabilityAlertsService {
  constructor(private readonly repository: AiObservabilityAlertsRepository = aiObservabilityAlertsRepository) {}

  async evaluate(input: EvaluateAiObservabilityAlertsInput): Promise<AiObservabilityAlertEvaluation> {
    const rules = (await this.repository.listApplicableRules(input))
      .filter((rule) => ruleMatchesContext(rule, input));

    const decisions = await Promise.all(rules.map(async (rule) => {
      const window = getAiObservabilityAlertPeriodWindow(rule.period, input.now);
      const currentValue = await this.repository.aggregateUsage({
        rule,
        windowStart: window.start,
        windowEnd: window.end,
      });
      return decisionFor(
        rule,
        currentValue,
        projectedValue(rule.metric, input),
        window.start,
        window.end,
      );
    }));

    const maxSeverity = maxTriggeredSeverity(decisions);
    const triggered = maxSeverity !== null;
    return {
      status: triggered ? 'triggered' : 'ok',
      triggered,
      maxSeverity,
      decisions,
    };
  }
}

export const aiObservabilityAlertsService = new AiObservabilityAlertsService();

export function evaluateAiObservabilityAlerts(input: EvaluateAiObservabilityAlertsInput) {
  return aiObservabilityAlertsService.evaluate(input);
}
