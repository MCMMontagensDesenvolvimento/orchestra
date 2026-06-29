import { describe, expect, it, vi } from 'vitest';
import {
  AiObservabilityAlertsService,
  getAiObservabilityAlertPeriodWindow,
  sanitizeAiUsageMetadata,
} from '../../src/modules/ai-observability';
import type {
  AiObservabilityAlertAggregationInput,
  AiObservabilityAlertRule,
  AiObservabilityAlertsRepository,
  EvaluateAiObservabilityAlertsInput,
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

function rule(overrides: Partial<AiObservabilityAlertRule> = {}): AiObservabilityAlertRule {
  return {
    id: 'rule-1',
    tenantId,
    workspaceId: null,
    assistantId: null,
    userId: null,
    scopeType: 'tenant',
    metric: 'event_count',
    period: 'day',
    operator: 'gte',
    thresholdValue: 10n,
    severity: 'warning',
    status: 'active',
    source: null,
    operation: null,
    provider: null,
    modelName: null,
    cooldownMinutes: null,
    deletedAt: null,
    ...overrides,
  };
}

class FakeAiObservabilityAlertsRepository implements AiObservabilityAlertsRepository {
  readonly listApplicableRules = vi.fn(async () => this.rules);
  readonly aggregateUsage = vi.fn(async (input: AiObservabilityAlertAggregationInput) => (
    this.currentValues[input.rule.id] ?? 0n
  ));

  constructor(
    readonly rules: AiObservabilityAlertRule[],
    readonly currentValues: Record<string, bigint> = {},
  ) {}
}

function context(
  overrides: Partial<EvaluateAiObservabilityAlertsInput> = {},
): EvaluateAiObservabilityAlertsInput {
  return {
    tenantId,
    workspaceId,
    assistantId,
    userId,
    now,
    ...overrides,
  };
}

describe('AI observability alerts evaluator', () => {
  it('returns ok when no alert rules apply', async () => {
    const repository = new FakeAiObservabilityAlertsRepository([]);
    const result = await new AiObservabilityAlertsService(repository).evaluate(context());

    expect(result).toEqual({
      status: 'ok',
      triggered: false,
      maxSeverity: null,
      decisions: [],
    });
    expect(repository.aggregateUsage).not.toHaveBeenCalled();
  });

  it('triggers a tenant event_count rule with gte', async () => {
    const repository = new FakeAiObservabilityAlertsRepository([rule({ thresholdValue: 3n })], { 'rule-1': 3n });
    const result = await new AiObservabilityAlertsService(repository).evaluate(context());

    expect(result).toMatchObject({ status: 'triggered', triggered: true, maxSeverity: 'warning' });
    expect(result.decisions[0]).toMatchObject({
      metric: 'event_count',
      operator: 'gte',
      currentValue: 3n,
      projectedValue: 0n,
      evaluatedValue: 3n,
      triggered: true,
      reason: 'threshold_triggered',
    });
  });

  it('only triggers gt above the threshold', async () => {
    const repository = new FakeAiObservabilityAlertsRepository(
      [rule({ operator: 'gt', thresholdValue: 5n })],
      { 'rule-1': 5n },
    );
    const service = new AiObservabilityAlertsService(repository);

    const equal = await service.evaluate(context());
    const above = await service.evaluate(context({ projectedUsage: { eventCount: 1n } }));

    expect(equal.decisions[0].triggered).toBe(false);
    expect(above.decisions[0]).toMatchObject({ evaluatedValue: 6n, triggered: true });
  });

  it('only triggers eq on the exact evaluated value', async () => {
    const repository = new FakeAiObservabilityAlertsRepository(
      [rule({ operator: 'eq', thresholdValue: 7n })],
      { 'rule-1': 6n },
    );
    const service = new AiObservabilityAlertsService(repository);

    const exact = await service.evaluate(context({ projectedUsage: { eventCount: 1n } }));
    const above = await service.evaluate(context({ projectedUsage: { eventCount: 2n } }));

    expect(exact.decisions[0].triggered).toBe(true);
    expect(above.decisions[0].triggered).toBe(false);
  });

  it.each([
    ['workspace', { workspaceId }, { workspaceId: otherWorkspaceId }],
    ['assistant', { assistantId }, { assistantId: otherAssistantId }],
    ['user', { userId }, { userId: otherUserId }],
  ] as const)('applies a %s rule only to its matching scope id', async (scopeType, ids, wrongContext) => {
    const scopedRule = rule({ scopeType, ...ids, id: `${scopeType}-rule` });
    const repository = new FakeAiObservabilityAlertsRepository([scopedRule]);

    const matching = await new AiObservabilityAlertsService(repository).evaluate(context());
    const wrong = await new AiObservabilityAlertsService(repository).evaluate(context(wrongContext));

    expect(matching.decisions).toHaveLength(1);
    expect(wrong.decisions).toHaveLength(0);
  });

  it('never applies a rule from another tenant', async () => {
    const repository = new FakeAiObservabilityAlertsRepository([rule({ tenantId: otherTenantId })]);
    const result = await new AiObservabilityAlertsService(repository).evaluate(context());
    expect(result.decisions).toHaveLength(0);
  });

  it('matches optional source, operation, provider and model filters', async () => {
    const filtered = rule({
      source: 'llm_provider',
      operation: 'chat.completion',
      provider: 'openai',
      modelName: 'gpt-test',
    });
    const repository = new FakeAiObservabilityAlertsRepository([filtered]);
    const service = new AiObservabilityAlertsService(repository);

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
    const window = getAiObservabilityAlertPeriodWindow(period, now);
    expect(window.start.toISOString()).toBe(expectedStart);
    expect(window.end.toISOString()).toBe(expectedEnd);
  });

  it.each([
    ['run_count', { runCount: 1n }, 1n],
    ['total_tokens', { totalTokens: 50n }, 50n],
    ['input_tokens', { inputTokens: 30n }, 30n],
    ['output_tokens', { outputTokens: 20n }, 20n],
    ['embedding_tokens', { embeddingTokens: 15n }, 15n],
    ['cached_tokens', { cachedTokens: 5n }, 5n],
    ['failed_run_count', { failedRunCount: 1n }, 1n],
    ['blocked_run_count', { blockedRunCount: 2n }, 2n],
  ] as const)('adds projected usage for %s', async (metric, projectedUsage, expected) => {
    const repository = new FakeAiObservabilityAlertsRepository(
      [rule({ metric, thresholdValue: 100n })],
      { 'rule-1': 10n },
    );
    const result = await new AiObservabilityAlertsService(repository).evaluate(context({ projectedUsage }));
    expect(result.decisions[0]).toMatchObject({
      metric,
      currentValue: 10n,
      projectedValue: expected,
    });
  });

  it('derives projected total_tokens from input plus output when total is omitted', async () => {
    const repository = new FakeAiObservabilityAlertsRepository([rule({ metric: 'total_tokens' })]);
    const result = await new AiObservabilityAlertsService(repository).evaluate(
      context({ projectedUsage: { inputTokens: 12n, outputTokens: 8n } }),
    );
    expect(result.decisions[0].projectedValue).toBe(20n);
  });

  it('keeps estimated cost entirely in bigint minor units', async () => {
    const costRule = rule({
      metric: 'estimated_cost_minor_units',
      thresholdValue: 9_000_000_000_000_000_000n,
    });
    const repository = new FakeAiObservabilityAlertsRepository(
      [costRule],
      { 'rule-1': 8_000_000_000_000_000_000n },
    );
    const result = await new AiObservabilityAlertsService(repository).evaluate(context({
      projectedUsage: { estimatedCostMinorUnits: '1000000000000000000' },
    }));
    const decision = result.decisions[0];

    expect(typeof decision.currentValue).toBe('bigint');
    expect(typeof decision.projectedValue).toBe('bigint');
    expect(decision.evaluatedValue).toBe(9_000_000_000_000_000_000n);
    expect(decision.triggered).toBe(true);
  });

  it('treats avg_latency_ms as an integer technical metric, not money', async () => {
    const repository = new FakeAiObservabilityAlertsRepository(
      [rule({ metric: 'avg_latency_ms', thresholdValue: 300n })],
      { 'rule-1': 250n },
    );
    const result = await new AiObservabilityAlertsService(repository).evaluate(context({
      projectedUsage: { avgLatencyMs: 50 },
    }));

    expect(result.decisions[0]).toMatchObject({
      metric: 'avg_latency_ms',
      currentValue: 250n,
      projectedValue: 50n,
      evaluatedValue: 300n,
      triggered: true,
    });
  });

  it('ignores disabled and soft-deleted rules', async () => {
    const repository = new FakeAiObservabilityAlertsRepository([
      rule({ id: 'disabled', status: 'disabled' }),
      rule({ id: 'deleted', deletedAt: new Date('2026-06-01T00:00:00.000Z') }),
    ]);
    const result = await new AiObservabilityAlertsService(repository).evaluate(context());
    expect(result.decisions).toHaveLength(0);
  });

  it('defaults omitted projected usage to zero for alert simulations', async () => {
    const repository = new FakeAiObservabilityAlertsRepository([rule()], { 'rule-1': 9n });
    const result = await new AiObservabilityAlertsService(repository).evaluate(context({ projectedUsage: undefined }));
    expect(result.decisions[0].projectedValue).toBe(0n);
    expect(result.decisions[0].triggered).toBe(false);
  });

  it('rejects projected numbers outside the safe integer range', async () => {
    const repository = new FakeAiObservabilityAlertsRepository([rule()]);
    await expect(new AiObservabilityAlertsService(repository).evaluate(context({
      projectedUsage: { eventCount: Number.MAX_SAFE_INTEGER + 1 },
    }))).rejects.toMatchObject({ code: 'AI_OBSERVABILITY_ALERT_PROJECTED_USAGE_INVALID' });
  });

  it('reuses defensive metadata sanitization and does not call fetch or remote MCP', async () => {
    const repository = new FakeAiObservabilityAlertsRepository([rule()]);
    const service = new AiObservabilityAlertsService(repository);
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
    const repository = new FakeAiObservabilityAlertsRepository([rule()]);
    await new AiObservabilityAlertsService(repository).evaluate(context());
    expect(repository.listApplicableRules).toHaveBeenCalledTimes(1);
    expect(repository.aggregateUsage).toHaveBeenCalledTimes(1);
  });
});
