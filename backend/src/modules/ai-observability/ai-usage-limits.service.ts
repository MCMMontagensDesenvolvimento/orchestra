import { AppError } from '../../shared/errors/app-error';
import { aiUsageLimitsRepository } from './ai-usage-limits.repository';
import type {
  AiUsageLimitDecision,
  AiUsageLimitEvaluation,
  AiUsageLimitMetric,
  AiUsageLimitPeriod,
  AiUsageLimitPolicy,
  AiUsageLimitsRepository,
  AiUsageLimitValueInput,
  EvaluateAiUsageLimitsInput,
} from './ai-usage-limits.types';

function nonNegativeBigInt(value: AiUsageLimitValueInput | null | undefined, fallback = 0n) {
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
  throw new AppError(422, 'AI_USAGE_LIMIT_PROJECTED_USAGE_INVALID', 'Projected usage deve conter apenas inteiros nao negativos e seguros.');
}

export function getAiUsagePeriodWindow(period: AiUsageLimitPeriod, now = new Date()) {
  if (!Number.isFinite(now.getTime())) {
    throw new AppError(422, 'AI_USAGE_LIMIT_NOW_INVALID', 'now deve ser uma data valida.');
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

function policyMatchesContext(policy: AiUsageLimitPolicy, input: EvaluateAiUsageLimitsInput) {
  if (policy.tenantId !== input.tenantId || policy.status !== 'active' || policy.deletedAt !== null) return false;
  if (policy.scopeType === 'workspace' && policy.workspaceId !== input.workspaceId) return false;
  if (policy.scopeType === 'assistant' && policy.assistantId !== (input.assistantId ?? null)) return false;
  if (policy.scopeType === 'user' && policy.userId !== (input.userId ?? null)) return false;
  if (policy.source !== null && policy.source !== (input.source ?? null)) return false;
  if (policy.operation !== null && policy.operation !== (input.operation ?? null)) return false;
  if (policy.provider !== null && policy.provider !== (input.provider ?? null)) return false;
  if (policy.modelName !== null && policy.modelName !== (input.model ?? null)) return false;
  return true;
}

function projectedValue(metric: AiUsageLimitMetric, input: EvaluateAiUsageLimitsInput) {
  const projected = input.projectedUsage;
  if (metric === 'run_count') return nonNegativeBigInt(projected?.runCount, projected ? 0n : 1n);
  if (metric === 'input_tokens') return nonNegativeBigInt(projected?.inputTokens);
  if (metric === 'output_tokens') return nonNegativeBigInt(projected?.outputTokens);
  if (metric === 'embedding_tokens') return nonNegativeBigInt(projected?.embeddingTokens);
  if (metric === 'cached_tokens') return nonNegativeBigInt(projected?.cachedTokens);
  if (metric === 'estimated_cost_minor_units') return nonNegativeBigInt(projected?.estimatedCostMinorUnits);
  if (metric === 'failed_run_count') return nonNegativeBigInt(projected?.failedRunCount);
  if (metric === 'blocked_run_count') return nonNegativeBigInt(projected?.blockedRunCount);
  if (projected?.totalTokens !== null && typeof projected?.totalTokens !== 'undefined') {
    return nonNegativeBigInt(projected.totalTokens);
  }
  return nonNegativeBigInt(projected?.inputTokens) + nonNegativeBigInt(projected?.outputTokens);
}

function decisionFor(
  policy: AiUsageLimitPolicy,
  currentValue: bigint,
  projected: bigint,
  windowStart: Date,
  windowEnd: Date,
): AiUsageLimitDecision {
  const evaluatedValue = currentValue + projected;
  const wouldExceed = evaluatedValue > policy.limitValue;
  const wouldWarn = wouldExceed || (
    policy.warnThresholdValue !== null && evaluatedValue >= policy.warnThresholdValue
  );
  const status = wouldExceed && policy.mode === 'enforce'
    ? 'blocked'
    : wouldWarn
      ? 'warn'
      : 'allowed';

  return {
    policyId: policy.id,
    scopeType: policy.scopeType,
    metric: policy.metric,
    period: policy.period,
    mode: policy.mode,
    status,
    limitValue: policy.limitValue,
    warnThresholdValue: policy.warnThresholdValue,
    currentValue,
    projectedValue: projected,
    remainingValue: evaluatedValue < policy.limitValue ? policy.limitValue - evaluatedValue : 0n,
    wouldExceed,
    wouldWarn,
    reason: wouldExceed
      ? 'limit_exceeded'
      : wouldWarn
        ? 'warning_threshold_reached'
        : 'within_limit',
    windowStart,
    windowEnd,
  };
}

export class AiUsageLimitsService {
  constructor(private readonly repository: AiUsageLimitsRepository = aiUsageLimitsRepository) {}

  async evaluate(input: EvaluateAiUsageLimitsInput): Promise<AiUsageLimitEvaluation> {
    const policies = (await this.repository.listApplicablePolicies(input))
      .filter((policy) => policyMatchesContext(policy, input));

    const decisions = await Promise.all(policies.map(async (policy) => {
      const window = getAiUsagePeriodWindow(policy.period, input.now);
      const currentValue = await this.repository.aggregateUsage({
        policy,
        windowStart: window.start,
        windowEnd: window.end,
      });
      return decisionFor(
        policy,
        currentValue,
        projectedValue(policy.metric, input),
        window.start,
        window.end,
      );
    }));

    const blocked = decisions.some((decision) => decision.status === 'blocked');
    const warned = decisions.some((decision) => decision.status === 'warn');
    return {
      allowed: !blocked,
      status: blocked ? 'blocked' : warned ? 'warn' : 'allowed',
      mode: decisions.some((decision) => decision.mode === 'enforce') ? 'enforce' : 'monitor_only',
      decisions,
    };
  }
}

export const aiUsageLimitsService = new AiUsageLimitsService();

export function evaluateAiUsageLimits(input: EvaluateAiUsageLimitsInput) {
  return aiUsageLimitsService.evaluate(input);
}
