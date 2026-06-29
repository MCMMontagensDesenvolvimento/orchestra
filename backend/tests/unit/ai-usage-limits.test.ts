import { describe, expect, it, vi } from 'vitest';
import {
  AiUsageLimitsService,
  getAiUsagePeriodWindow,
  sanitizeAiUsageMetadata,
} from '../../src/modules/ai-observability';
import type {
  AiUsageAggregationInput,
  AiUsageLimitPolicy,
  AiUsageLimitsRepository,
  EvaluateAiUsageLimitsInput,
} from '../../src/modules/ai-observability';

const tenantId = '00000000-0000-0000-0000-000000000010';
const otherTenantId = '00000000-0000-0000-0000-000000000011';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const otherWorkspaceId = '00000000-0000-0000-0000-000000000021';
const assistantId = '00000000-0000-0000-0000-000000000101';
const otherAssistantId = '00000000-0000-0000-0000-000000000102';
const userId = '00000000-0000-0000-0000-000000000001';
const otherUserId = '00000000-0000-0000-0000-000000000002';
const now = new Date('2026-06-29T23:45:37.321-03:00');

function policy(overrides: Partial<AiUsageLimitPolicy> = {}): AiUsageLimitPolicy {
  return {
    id: 'policy-1',
    tenantId,
    workspaceId: null,
    assistantId: null,
    userId: null,
    scopeType: 'tenant',
    metric: 'run_count',
    period: 'day',
    mode: 'monitor_only',
    status: 'active',
    limitValue: 10n,
    warnThresholdValue: null,
    source: null,
    operation: null,
    provider: null,
    modelName: null,
    deletedAt: null,
    ...overrides,
  };
}

class FakeAiUsageLimitsRepository implements AiUsageLimitsRepository {
  readonly listApplicablePolicies = vi.fn(async () => this.policies);
  readonly aggregateUsage = vi.fn(async (input: AiUsageAggregationInput) => this.currentValues[input.policy.id] ?? 0n);

  constructor(
    readonly policies: AiUsageLimitPolicy[],
    readonly currentValues: Record<string, bigint> = {},
  ) {}
}

function context(overrides: Partial<EvaluateAiUsageLimitsInput> = {}): EvaluateAiUsageLimitsInput {
  return {
    tenantId,
    workspaceId,
    assistantId,
    userId,
    now,
    projectedUsage: { runCount: 1n },
    ...overrides,
  };
}

describe('AI usage limits evaluator', () => {
  it('allows usage when no policies apply', async () => {
    const repository = new FakeAiUsageLimitsRepository([]);
    const result = await new AiUsageLimitsService(repository).evaluate(context());

    expect(result).toEqual({
      allowed: true,
      status: 'allowed',
      mode: 'monitor_only',
      decisions: [],
    });
    expect(repository.aggregateUsage).not.toHaveBeenCalled();
  });

  it('warns but never blocks when a monitor_only run policy is exceeded', async () => {
    const repository = new FakeAiUsageLimitsRepository([policy({ limitValue: 5n })], { 'policy-1': 5n });
    const result = await new AiUsageLimitsService(repository).evaluate(context());

    expect(result).toMatchObject({ allowed: true, status: 'warn', mode: 'monitor_only' });
    expect(result.decisions[0]).toMatchObject({
      currentValue: 5n,
      projectedValue: 1n,
      remainingValue: 0n,
      wouldExceed: true,
      wouldWarn: true,
      status: 'warn',
      reason: 'limit_exceeded',
    });
  });

  it('blocks when an enforce policy would be exceeded', async () => {
    const repository = new FakeAiUsageLimitsRepository(
      [policy({ mode: 'enforce', limitValue: 5n })],
      { 'policy-1': 5n },
    );
    const result = await new AiUsageLimitsService(repository).evaluate(context());

    expect(result).toMatchObject({ allowed: false, status: 'blocked', mode: 'enforce' });
    expect(result.decisions[0].status).toBe('blocked');
  });

  it.each([
    ['workspace', { workspaceId }, { workspaceId: otherWorkspaceId }],
    ['assistant', { assistantId }, { assistantId: otherAssistantId }],
    ['user', { userId }, { userId: otherUserId }],
  ] as const)('applies a %s policy only to its matching scope id', async (scopeType, ids, wrongContext) => {
    const scopedPolicy = policy({ scopeType, ...ids, id: `${scopeType}-policy` });
    const repository = new FakeAiUsageLimitsRepository([scopedPolicy]);

    const matching = await new AiUsageLimitsService(repository).evaluate(context());
    const wrong = await new AiUsageLimitsService(repository).evaluate(context(wrongContext));

    expect(matching.decisions).toHaveLength(1);
    expect(wrong.decisions).toHaveLength(0);
  });

  it('never applies a policy from another tenant', async () => {
    const repository = new FakeAiUsageLimitsRepository([policy({ tenantId: otherTenantId })]);
    const result = await new AiUsageLimitsService(repository).evaluate(context());
    expect(result.decisions).toHaveLength(0);
  });

  it('matches optional source, operation, provider and model filters', async () => {
    const filtered = policy({
      source: 'llm_provider',
      operation: 'chat.completion',
      provider: 'openai',
      modelName: 'gpt-test',
    });
    const repository = new FakeAiUsageLimitsRepository([filtered]);
    const service = new AiUsageLimitsService(repository);

    const matching = await service.evaluate(context({
      source: 'llm_provider',
      operation: 'chat.completion',
      provider: 'openai',
      model: 'gpt-test',
    }));
    const wrongModel = await service.evaluate(context({
      source: 'llm_provider',
      operation: 'chat.completion',
      provider: 'openai',
      model: 'other',
    }));

    expect(matching.decisions).toHaveLength(1);
    expect(wrongModel.decisions).toHaveLength(0);
  });

  it.each([
    ['minute', '2026-06-30T02:45:00.000Z', '2026-06-30T02:46:00.000Z'],
    ['hour', '2026-06-30T02:00:00.000Z', '2026-06-30T03:00:00.000Z'],
    ['day', '2026-06-30T00:00:00.000Z', '2026-07-01T00:00:00.000Z'],
    ['month', '2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'],
  ] as const)('calculates the %s window in UTC', (period, expectedStart, expectedEnd) => {
    const window = getAiUsagePeriodWindow(period, now);
    expect(window.start.toISOString()).toBe(expectedStart);
    expect(window.end.toISOString()).toBe(expectedEnd);
  });

  it.each([
    ['total_tokens', { totalTokens: 50n }, 50n],
    ['input_tokens', { inputTokens: 30n }, 30n],
    ['output_tokens', { outputTokens: 20n }, 20n],
    ['embedding_tokens', { embeddingTokens: 15n }, 15n],
    ['cached_tokens', { cachedTokens: 5n }, 5n],
    ['failed_run_count', { failedRunCount: 1n }, 1n],
    ['blocked_run_count', { blockedRunCount: 2n }, 2n],
  ] as const)('adds projected usage for %s', async (metric, projectedUsage, expected) => {
    const repository = new FakeAiUsageLimitsRepository([policy({ metric, limitValue: 100n })], { 'policy-1': 10n });
    const result = await new AiUsageLimitsService(repository).evaluate(context({ projectedUsage }));
    expect(result.decisions[0]).toMatchObject({
      metric,
      currentValue: 10n,
      projectedValue: expected,
    });
  });

  it('derives projected total_tokens from input plus output when total is omitted', async () => {
    const repository = new FakeAiUsageLimitsRepository([policy({ metric: 'total_tokens' })]);
    const result = await new AiUsageLimitsService(repository).evaluate(
      context({ projectedUsage: { inputTokens: 12n, outputTokens: 8n } }),
    );
    expect(result.decisions[0].projectedValue).toBe(20n);
  });

  it('keeps estimated cost entirely in bigint minor units', async () => {
    const costPolicy = policy({
      metric: 'estimated_cost_minor_units',
      limitValue: 9_000_000_000_000_000_000n,
    });
    const repository = new FakeAiUsageLimitsRepository(
      [costPolicy],
      { 'policy-1': 8_000_000_000_000_000_000n },
    );
    const result = await new AiUsageLimitsService(repository).evaluate(context({
      projectedUsage: { estimatedCostMinorUnits: '500000000000000000' },
    }));
    const decision = result.decisions[0];

    expect(typeof decision.currentValue).toBe('bigint');
    expect(typeof decision.projectedValue).toBe('bigint');
    expect(decision.remainingValue).toBe(500_000_000_000_000_000n);
  });

  it('warns at warnThresholdValue before reaching the limit', async () => {
    const repository = new FakeAiUsageLimitsRepository(
      [policy({ mode: 'enforce', limitValue: 10n, warnThresholdValue: 8n })],
      { 'policy-1': 7n },
    );
    const result = await new AiUsageLimitsService(repository).evaluate(context());

    expect(result).toMatchObject({ allowed: true, status: 'warn' });
    expect(result.decisions[0]).toMatchObject({
      status: 'warn',
      wouldExceed: false,
      wouldWarn: true,
      reason: 'warning_threshold_reached',
    });
  });

  it('ignores disabled and soft-deleted policies', async () => {
    const repository = new FakeAiUsageLimitsRepository([
      policy({ id: 'disabled', status: 'disabled' }),
      policy({ id: 'deleted', deletedAt: new Date('2026-06-01T00:00:00.000Z') }),
    ]);
    const result = await new AiUsageLimitsService(repository).evaluate(context());
    expect(result.decisions).toHaveLength(0);
  });

  it('defaults an omitted projected usage to one run for preflight checks', async () => {
    const repository = new FakeAiUsageLimitsRepository([policy()]);
    const result = await new AiUsageLimitsService(repository).evaluate(context({ projectedUsage: undefined }));
    expect(result.decisions[0].projectedValue).toBe(1n);
  });

  it('rejects projected numbers outside the safe integer range', async () => {
    const repository = new FakeAiUsageLimitsRepository([policy()]);
    await expect(new AiUsageLimitsService(repository).evaluate(context({
      projectedUsage: { runCount: Number.MAX_SAFE_INTEGER + 1 },
    }))).rejects.toMatchObject({ code: 'AI_USAGE_LIMIT_PROJECTED_USAGE_INVALID' });
  });

  it('reuses defensive metadata sanitization and does not call fetch or remote MCP', async () => {
    const repository = new FakeAiUsageLimitsRepository([policy()]);
    const service = new AiUsageLimitsService(repository);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const sanitized = sanitizeAiUsageMetadata({
      safeCounter: 1,
      prompt: 'raw prompt',
      response: 'raw response',
      rawDocuments: ['raw document'],
      headers: { Authorization: 'Bearer value' },
      apiKey: 'secret-value',
    });
    await service.evaluate(context());

    const serialized = JSON.stringify(sanitized);
    expect(serialized).toContain('safeCounter');
    expect(serialized).not.toMatch(/raw prompt|raw response|raw document|secret-value|Bearer value/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('has no runtime, provider or MCP execution dependency', async () => {
    const repository = new FakeAiUsageLimitsRepository([policy()]);
    await new AiUsageLimitsService(repository).evaluate(context());
    expect(repository.listApplicablePolicies).toHaveBeenCalledTimes(1);
    expect(repository.aggregateUsage).toHaveBeenCalledTimes(1);
  });
});
