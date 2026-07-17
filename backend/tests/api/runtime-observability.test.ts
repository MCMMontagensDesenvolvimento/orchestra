import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => ({
  repository: {
    listRuntimeRuns: vi.fn(),
    findRuntimeRun: vi.fn(),
    summarizeRuntime: vi.fn(),
  },
}));

vi.mock('../../src/modules/ai-observability/runtime-observability.repository', () => ({
  runtimeObservabilityRepository: mocks.repository,
}));

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const otherWorkspaceId = '00000000-0000-0000-0000-000000000021';
const userId = '00000000-0000-0000-0000-000000000001';
const assistantId = '00000000-0000-0000-0000-000000000101';
const assistantVersionId = '00000000-0000-0000-0000-000000000102';
const runId = '00000000-0000-0000-0000-00000000016d';
const now = new Date('2026-07-17T12:00:00.000Z');

const adminUser: AuthenticatedUser = {
  id: userId,
  email: 'admin.dev@orchestra.local',
  name: 'Development Admin',
  tenant: { id: tenantId, name: 'Orchestra Dev Tenant', slug: 'orchestra-dev' },
  workspaces: [{ id: workspaceId, name: 'Default Workspace', slug: 'default', role: 'admin' }],
  roles: ['admin_platform'],
  permissions: ['audit.read'],
};

function sessionCookie(user: AuthenticatedUser = adminUser) {
  return `${env.COOKIE_NAME}=${signSession({ sub: user.id, user })}`;
}

function runFixture() {
  return {
    id: runId,
    workspaceId,
    assistantId,
    assistantVersionId,
    status: 'completed',
    mode: 'sandbox',
    inputSummary: 'Resumo operacional seguro',
    requestId: 'req_16m',
    traceId: 'trace_16m',
    startedAt: now,
    completedAt: now,
    failedAt: null,
    cancelledAt: null,
    blockedAt: null,
    metadata: {
      runtime: {
        provider: 'local',
        responseScopeMode: 'knowledge_first',
        ragMode: 'local_keyword',
        ragSourceCount: 1,
        ragIntentDetected: true,
        ragSkippedReason: null,
        fallbackOutsideKnowledgeUsed: false,
        rawContentLogged: false,
        usageLimitEvaluationApplied: true,
        usageLimitMode: 'monitor_only',
        usageLimitExceeded: true,
        usageLimitEnforced: false,
        usageLimitBlocked: false,
        usageLimitMetric: 'run_count',
        usageLimitScope: 'assistant',
        usageLimitPolicyId: '00000000-0000-0000-0000-00000000016a',
        usageLimitWindow: 'day',
        usageLimitCurrentValue: '10',
        usageLimitThreshold: '10',
        usageLimitReason: 'limit_exceeded',
        externalProviderCalled: false,
        externalMcpCalled: false,
        toolCallsExecuted: 0,
        prompt: 'must-not-leak-prompt',
        providerPayload: 'must-not-leak-provider-payload',
        adapterMetadata: {
          llmProvider: 'local_deterministic',
          llmModel: 'local-deterministic-v1',
        },
      },
    },
    createdAt: now,
    assistant: { name: 'Assistente seguro' },
    assistantVersion: {
      version: '1.0.0',
      displayName: 'Assistente seguro',
      modelProvider: 'local_deterministic',
      modelName: 'local-deterministic-v1',
    },
  };
}

function usageFixture(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'local',
    modelName: 'local-deterministic-v1',
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    latencyMs: 18,
    costCurrency: null,
    estimatedCostMinorUnits: null,
    startedAt: now,
    ...overrides,
  };
}

function detailFixture() {
  return {
    run: {
      ...runFixture(),
      events: [{
        id: '00000000-0000-0000-0000-00000000016e',
        type: 'runtime.run_completed',
        sequence: 1,
        status: 'completed',
        metadata: {
          provider: 'local',
          latencyMs: 18,
          usageLimitMode: 'monitor_only',
          usageLimitExceeded: true,
          usageLimitBlocked: false,
          usageLimitMetric: 'run_count',
          prompt: 'must-not-leak-event-prompt',
        },
        createdAt: now,
      }],
    },
    usage: usageFixture(),
    ragQueries: [{
      id: '00000000-0000-0000-0000-00000000016f',
      mode: 'local_keyword',
      status: 'completed',
      resultCount: 1,
      createdAt: now,
      results: [{
        rank: 1,
        score: 0.9,
        matchType: 'content',
        excerpt: 'x'.repeat(500),
        citationLabel: 'Fonte 1',
        metadata: { sourceReferenceLabel: 'Manual', secret: 'must-not-leak-secret' },
        document: { title: 'Manual operacional' },
        sourceReference: { label: 'Capítulo seguro' },
      }],
    }],
  };
}

describe('runtime observability read API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repository.listRuntimeRuns.mockResolvedValue({
      data: [{ run: runFixture(), usage: usageFixture() }],
      total: 1,
    });
    mocks.repository.findRuntimeRun.mockResolvedValue(detailFixture());
    mocks.repository.summarizeRuntime.mockResolvedValue({
      totalRuns: 2,
      statusGroups: [
        { status: 'completed', _count: { _all: 1 } },
        { status: 'failed', _count: { _all: 1 } },
      ],
      usage: { _sum: { totalTokens: 15 }, _avg: { latencyMs: 18 } },
      usageLimitBlockedRuns: 1,
      monitorOnlyViolations: 2,
    });
  });

  it('requires authentication and audit.read', async () => {
    const app = createApp();
    await request(app).get('/api/v1/ai-observability/runtime-runs').expect(401);
    await request(app)
      .get('/api/v1/ai-observability/runtime-runs')
      .set('Cookie', sessionCookie({ ...adminUser, permissions: ['agent_runs.read'] }))
      .expect(403);
    expect(mocks.repository.listRuntimeRuns).not.toHaveBeenCalled();
  });

  it('lists tenant/workspace scoped runs with allowlisted filters and fields', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/ai-observability/runtime-runs')
      .query({
        workspaceId,
        status: 'completed',
        runtimeProvider: 'local',
        ragMode: 'local_keyword',
        responseScopeMode: 'knowledge_first',
        fallbackOutsideKnowledgeUsed: 'false',
        externalProviderCalled: 'false',
        externalMcpCalled: 'false',
        usageLimitBlocked: 'false',
        search: 'Resumo',
      })
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(mocks.repository.listRuntimeRuns).toHaveBeenCalledWith(
      tenantId,
      [workspaceId],
      expect.objectContaining({
        workspaceId,
        status: 'completed',
        fallbackOutsideKnowledgeUsed: false,
        externalProviderCalled: false,
        usageLimitBlocked: false,
      }),
    );
    expect(response.body.data[0]).toMatchObject({
      runId,
      runtimeProvider: 'local',
      llmProvider: 'local_deterministic',
      responseScopeMode: 'knowledge_first',
      rawContentLogged: false,
      totalTokens: 15,
      usageLimitEvaluationApplied: true,
      usageLimitMode: 'monitor_only',
      usageLimitExceeded: true,
      usageLimitBlocked: false,
      usageLimitMetric: 'run_count',
      usageLimitScope: 'assistant',
      usageLimitReason: 'limit_exceeded',
      costCurrency: null,
      costMinorUnits: null,
    });
    expect(JSON.stringify(response.body)).not.toContain('must-not-leak');
  });

  it('returns safe detail with truncated persisted RAG excerpt and event allowlist', async () => {
    const app = createApp();
    const response = await request(app)
      .get(`/api/v1/ai-observability/runtime-runs/${runId}`)
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(response.body.data.events[0]).toEqual(expect.objectContaining({
      type: 'runtime.run_completed',
      metadata: {
        runtimeProvider: 'local',
        latencyMs: 18,
        usageLimitMode: 'monitor_only',
        usageLimitExceeded: true,
        usageLimitBlocked: false,
        usageLimitMetric: 'run_count',
      },
    }));
    expect(response.body.data.ragSources[0].excerpt).toHaveLength(240);
    expect(response.body.data.ragSources[0]).toMatchObject({
      documentTitle: 'Manual operacional',
      sourceLabel: 'Capítulo seguro',
      matchType: 'content',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('must-not-leak');
    expect(response.body.data.events[0]).not.toHaveProperty('message');
  });

  it('exposes cost only when persisted currency and minor units are both present', async () => {
    mocks.repository.findRuntimeRun.mockResolvedValueOnce({
      ...detailFixture(),
      usage: usageFixture({ costCurrency: 'USD', estimatedCostMinorUnits: 37n }),
    });
    const costed = await request(createApp())
      .get(`/api/v1/ai-observability/runtime-runs/${runId}`)
      .set('Cookie', sessionCookie())
      .expect(200);
    expect(costed.body.data).toMatchObject({ costCurrency: 'USD', costMinorUnits: '37' });

    mocks.repository.findRuntimeRun.mockResolvedValueOnce({
      ...detailFixture(),
      usage: usageFixture({ costCurrency: null, estimatedCostMinorUnits: 37n }),
    });
    const incomplete = await request(createApp())
      .get(`/api/v1/ai-observability/runtime-runs/${runId}`)
      .set('Cookie', sessionCookie())
      .expect(200);
    expect(incomplete.body.data).toMatchObject({ costCurrency: null, costMinorUnits: null });
  });

  it('rejects out-of-scope workspace and reports the operational summary', async () => {
    const app = createApp();
    await request(app)
      .get('/api/v1/ai-observability/runtime-runs')
      .query({ workspaceId: otherWorkspaceId })
      .set('Cookie', sessionCookie())
      .expect(403);

    const summary = await request(app)
      .get('/api/v1/ai-observability/runtime-summary')
      .set('Cookie', sessionCookie())
      .expect(200);
    expect(summary.body.data).toEqual(expect.objectContaining({
      totalRuns: 2,
      completedRuns: 1,
      failedRuns: 1,
      usageLimitBlockedRuns: 1,
      monitorOnlyViolations: 2,
      successRate: 50,
      totalTokens: '15',
    }));
  });
});
