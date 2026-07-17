import { describe, expect, it, vi } from 'vitest';
import {
  AiObservabilityService,
  normalizeAiUsageEventInput,
  sanitizeAiUsageMetadata,
} from '../../src/modules/ai-observability';
import type { AiObservabilityRepository, NormalizedAiUsageEventInput } from '../../src/modules/ai-observability';

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const assistantId = '00000000-0000-0000-0000-000000000101';
const userId = '00000000-0000-0000-0000-000000000001';
const startedAt = '2026-06-29T12:00:00.000Z';
const completedAt = '2026-06-29T12:00:02.500Z';

class FakeAiObservabilityRepository implements AiObservabilityRepository {
  readonly createUsageEvent = vi.fn(async (input: NormalizedAiUsageEventInput) => ({
    id: 'usage_event_1',
    ...input,
  }));
}

describe('ai observability usage service', () => {
  it('records a minimal event with tenant, workspace, run and status', async () => {
    const repository = new FakeAiObservabilityRepository();
    const service = new AiObservabilityService(repository);

    await service.recordAiUsageEvent({
      tenantId,
      workspaceId,
      runId: 'agent_run_1',
      operation: 'agent_run.started',
    });

    expect(repository.createUsageEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      workspaceId,
      runId: 'agent_run_1',
      source: 'unknown',
      operation: 'agent_run.started',
      status: 'started',
    }));
  });

  it('records provider, model, tokens, latency and total token fallback', async () => {
    const normalized = normalizeAiUsageEventInput({
      tenantId,
      workspaceId,
      assistantId,
      userId,
      runId: 'run_tokenized',
      traceId: 'trace_123',
      source: 'llm_provider',
      operation: 'chat.completion',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      status: 'succeeded',
      inputTokens: 120,
      outputTokens: 35,
      cachedTokens: 10,
      latencyMs: 1500,
      startedAt,
      completedAt,
    });

    expect(normalized).toMatchObject({
      assistantId,
      userId,
      traceId: 'trace_123',
      source: 'llm_provider',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      status: 'succeeded',
      inputTokens: 120,
      outputTokens: 35,
      totalTokens: 155,
      cachedTokens: 10,
      latencyMs: 1500,
    });
    expect(normalized.startedAt.toISOString()).toBe(startedAt);
    expect(normalized.completedAt?.toISOString()).toBe(completedAt);
  });

  it('uses explicit total tokens and records embedding tokens', () => {
    const normalized = normalizeAiUsageEventInput({
      tenantId,
      workspaceId,
      runId: 'embedding_run',
      source: 'embedding',
      operation: 'embedding.batch',
      status: 'succeeded',
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 999,
      embeddingTokens: 42,
    });

    expect(normalized.totalTokens).toBe(999);
    expect(normalized.embeddingTokens).toBe(42);
  });

  it('records estimated cost in minor units without float money', () => {
    const normalized = normalizeAiUsageEventInput({
      tenantId,
      workspaceId,
      runId: 'costed_run',
      source: 'llm_provider',
      operation: 'chat.completion',
      status: 'succeeded',
      cost: {
        currency: 'usd',
        minorUnits: '123456',
      },
    });

    expect(normalized.costCurrency).toBe('USD');
    expect(normalized.estimatedCostMinorUnits).toBe(123456n);
  });

  it('omits incomplete cost when currency or minor units are not both reliable', () => {
    const missingCurrency = normalizeAiUsageEventInput({
      tenantId,
      workspaceId,
      runId: 'cost_without_currency',
      operation: 'chat.completion',
      estimatedCostMinorUnits: '123',
    });
    const missingValue = normalizeAiUsageEventInput({
      tenantId,
      workspaceId,
      runId: 'currency_without_cost',
      operation: 'chat.completion',
      costCurrency: 'USD',
    });

    expect(missingCurrency.costCurrency).toBeUndefined();
    expect(missingCurrency.estimatedCostMinorUnits).toBeUndefined();
    expect(missingValue.costCurrency).toBeUndefined();
    expect(missingValue.estimatedCostMinorUnits).toBeUndefined();
  });

  it('supports failed and blocked statuses with hashed error message', () => {
    const failed = normalizeAiUsageEventInput({
      tenantId,
      workspaceId,
      runId: 'failed_run',
      source: 'runtime_adapter',
      operation: 'runtime.invoke',
      status: 'failed',
      errorCode: 'RUNTIME_TIMEOUT',
      errorMessage: 'Provider timed out with sensitive body omitted.',
    });
    const blocked = normalizeAiUsageEventInput({
      tenantId,
      workspaceId,
      runId: 'blocked_run',
      source: 'mcp',
      operation: 'mcp.precheck',
      status: 'blocked',
      blockedReason: 'policy_denied',
    });

    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('RUNTIME_TIMEOUT');
    expect(failed.errorMessageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(blocked.status).toBe('blocked');
    expect(blocked.blockedReason).toBe('policy_denied');
  });

  it('sanitizes metadata by removing sensitive keys and redacting sensitive text', () => {
    const sanitized = sanitizeAiUsageMetadata({
      safeCounter: 3,
      token: 'abc',
      apiKey: 'abc',
      secret: 'abc',
      password: 'abc',
      credential: 'abc',
      Authorization: 'Bearer secret-token',
      cookie: 'session=abc',
      secretRef: 'vault://secret',
      baseUrl: 'https://internal.example.test',
      prompt: 'full prompt',
      response: 'full response',
      rawDocuments: ['full document'],
      headers: { Authorization: 'Bearer abc' },
      nested: {
        note: 'safe',
        unsafeText: 'Bearer abcdef123456',
      },
    }) as Record<string, unknown>;

    const serialized = JSON.stringify(sanitized);
    expect(sanitized.safeCounter).toBe(3);
    expect(serialized).toContain('safe');
    expect(serialized).not.toContain('full prompt');
    expect(serialized).not.toContain('full response');
    expect(serialized).not.toContain('full document');
    expect(serialized).not.toContain('vault://secret');
    expect(serialized).not.toContain('internal.example.test');
    expect(serialized).not.toContain('session=abc');
    expect(serialized).not.toContain('abcdef123456');
    expect(serialized).toContain('[redacted]');
  });

  it('truncates large metadata strings and limits arrays, objects and depth', () => {
    const sanitized = sanitizeAiUsageMetadata({
      long: 'x'.repeat(900),
      list: Array.from({ length: 40 }, (_, index) => ({ index })),
      deep: { a: { b: { c: { d: { e: 'too deep' } } } } },
      manyKeys: Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`key_${index}`, index])),
    }) as Record<string, unknown>;

    expect((sanitized.long as string).length).toBe(500);
    expect(sanitized.list).toHaveLength(25);
    expect(JSON.stringify(sanitized.deep)).toContain('[truncated]');
    expect(Object.keys(sanitized.manyKeys as Record<string, unknown>)).toHaveLength(40);
  });

  it('accepts provider and model as null', () => {
    const normalized = normalizeAiUsageEventInput({
      tenantId,
      workspaceId,
      runId: 'unknown_provider',
      source: 'rag',
      operation: 'rag.query',
      provider: null,
      model: null,
    });

    expect(normalized.provider).toBeUndefined();
    expect(normalized.model).toBeUndefined();
  });

  it('does not execute MCP remote or call external network when recording', async () => {
    const repository = new FakeAiObservabilityRepository();
    const service = new AiObservabilityService(repository);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await service.recordAiUsageEvent({
      tenantId,
      workspaceId,
      runId: 'mcp_sandbox_precheck',
      source: 'mcp',
      operation: 'mcp.precheck',
      status: 'blocked',
      metadata: {
        externalMcpCall: false,
      },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(repository.createUsageEvent).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });
});
