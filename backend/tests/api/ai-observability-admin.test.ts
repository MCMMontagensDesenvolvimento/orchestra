import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => ({
  repository: {
    listUsageEvents: vi.fn(),
    findUsageEvent: vi.fn(),
    summarizeUsage: vi.fn(),
    listLimitPolicies: vi.fn(),
    findLimitPolicy: vi.fn(),
    isEvaluationContextAccessible: vi.fn(),
  },
  evaluateAiUsageLimits: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/modules/ai-observability/ai-observability-admin.repository', () => ({
  aiObservabilityAdminRepository: mocks.repository,
}));

vi.mock('../../src/modules/ai-observability/ai-usage-limits.service', () => ({
  evaluateAiUsageLimits: mocks.evaluateAiUsageLimits,
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const otherWorkspaceId = '00000000-0000-0000-0000-000000000021';
const userId = '00000000-0000-0000-0000-000000000001';
const assistantId = '00000000-0000-0000-0000-000000000101';
const eventId = '00000000-0000-0000-0000-000000001201';
const policyId = '00000000-0000-0000-0000-000000001202';
const now = new Date('2026-06-29T18:30:00.000Z');
const completedAt = new Date('2026-06-29T18:30:02.000Z');

const adminUser: AuthenticatedUser = {
  id: userId,
  email: 'admin.dev@orchestra.local',
  name: 'Development Admin',
  tenant: {
    id: tenantId,
    name: 'Orchestra Dev Tenant',
    slug: 'orchestra-dev',
  },
  workspaces: [{
    id: workspaceId,
    name: 'Default Workspace',
    slug: 'default',
    role: 'admin',
  }],
  roles: ['admin_platform'],
  permissions: ['audit.read'],
};

function sessionCookie(user: AuthenticatedUser = adminUser) {
  const token = signSession({ sub: user.id, user });
  return `${env.COOKIE_NAME}=${token}`;
}

function usageEventFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: eventId,
    workspaceId,
    assistantId,
    userId,
    runId: 'run_12c',
    traceId: 'trace_12c',
    source: 'llm_provider',
    operation: 'chat.completion',
    provider: 'openai',
    modelName: 'gpt-test',
    status: 'succeeded',
    blockedReason: null,
    errorCode: null,
    inputTokens: 120,
    outputTokens: 30,
    totalTokens: 150,
    embeddingTokens: null,
    cachedTokens: 20,
    latencyMs: 2000,
    costCurrency: 'USD',
    estimatedCostMinorUnits: 9_000_000_000_000_000_000n,
    metadata: {
      safeCounter: 3,
      prompt: 'raw prompt must not leak',
      response: 'raw response must not leak',
      rawDocuments: ['raw document must not leak'],
      headers: { Authorization: 'Bearer must-not-leak' },
      apiKey: 'secret-value',
      nested: { note: 'safe-note' },
    },
    startedAt: now,
    completedAt,
    createdAt: now,
    ...overrides,
  };
}

function policyFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: policyId,
    workspaceId,
    assistantId: null,
    userId: null,
    scopeType: 'workspace',
    metric: 'estimated_cost_minor_units',
    period: 'month',
    mode: 'monitor_only',
    status: 'active',
    limitValue: 9_000_000_000_000_000_000n,
    warnThresholdValue: 8_000_000_000_000_000_000n,
    source: null,
    operation: null,
    provider: null,
    modelName: null,
    description: 'Monthly estimated cost monitor.',
    createdByUserId: userId,
    updatedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    metadata: { secret: 'not selected by repository' },
    ...overrides,
  };
}

function evaluationFixture(mode: 'monitor_only' | 'enforce' = 'monitor_only') {
  const blocked = mode === 'enforce';
  return {
    allowed: !blocked,
    status: blocked ? 'blocked' : 'warn',
    mode,
    decisions: [{
      policyId,
      scopeType: 'workspace',
      metric: 'run_count',
      period: 'day',
      mode,
      status: blocked ? 'blocked' : 'warn',
      limitValue: 10n,
      warnThresholdValue: 8n,
      currentValue: 10n,
      projectedValue: 1n,
      remainingValue: 0n,
      wouldExceed: true,
      wouldWarn: true,
      reason: 'limit_exceeded',
      windowStart: new Date('2026-06-29T00:00:00.000Z'),
      windowEnd: new Date('2026-06-30T00:00:00.000Z'),
    }],
  };
}

describe('AI observability admin read API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repository.listUsageEvents.mockResolvedValue({ data: [usageEventFixture()], total: 1 });
    mocks.repository.findUsageEvent.mockResolvedValue(usageEventFixture());
    mocks.repository.summarizeUsage.mockResolvedValue([{
      groupKey: workspaceId,
      eventCount: '3',
      runCount: '2',
      inputTokens: '9007199254740993000',
      outputTokens: '300',
      totalTokens: '9007199254740993300',
      embeddingTokens: '40',
      cachedTokens: '20',
      estimatedCostMinorUnits: '9000000000000000000',
      avgLatencyMs: 1234.5,
      failedRunCount: '1',
      blockedRunCount: '1',
    }]);
    mocks.repository.listLimitPolicies.mockResolvedValue({ data: [policyFixture()], total: 1 });
    mocks.repository.findLimitPolicy.mockResolvedValue(policyFixture());
    mocks.repository.isEvaluationContextAccessible.mockResolvedValue(true);
    mocks.evaluateAiUsageLimits.mockResolvedValue(evaluationFixture());
  });

  it('requires authentication and audit.read permission', async () => {
    const app = createApp();
    await request(app).get('/api/v1/ai-observability/usage-events').expect(401);

    await request(app)
      .get('/api/v1/ai-observability/usage-events')
      .set('Cookie', sessionCookie({ ...adminUser, permissions: ['assistants.read'] }))
      .expect(403);

    expect(mocks.repository.listUsageEvents).not.toHaveBeenCalled();
  });

  it('lists usage events scoped by session tenant and allowed workspace without metadata', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/ai-observability/usage-events')
      .query({
        workspaceId,
        assistantId,
        userId,
        runId: 'run_12c',
        traceId: 'trace_12c',
        source: 'llm_provider',
        operation: 'chat.completion',
        provider: 'openai',
        model: 'gpt-test',
        status: 'succeeded',
        startedAtFrom: '2026-06-01T00:00:00.000Z',
        startedAtTo: '2026-06-30T00:00:00.000Z',
        createdAtFrom: '2026-06-01T00:00:00.000Z',
        createdAtTo: '2026-06-30T00:00:00.000Z',
        page: '1',
        perPage: '50',
        sort: 'createdAt:asc',
      })
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(mocks.repository.listUsageEvents).toHaveBeenCalledWith(
      tenantId,
      [workspaceId],
      expect.objectContaining({ workspaceId, assistantId, perPage: 50, sort: 'createdAt:asc' }),
    );
    expect(response.body.data[0]).toMatchObject({
      id: eventId,
      model: 'gpt-test',
      estimatedCostMinorUnits: '9000000000000000000',
    });
    expect(response.body.data[0]).not.toHaveProperty('metadata');
    expect(JSON.stringify(response.body)).not.toContain('raw prompt must not leak');
  });

  it('rejects an out-of-scope workspace before repository access', async () => {
    const app = createApp();
    await request(app)
      .get('/api/v1/ai-observability/usage-events')
      .query({ workspaceId: otherWorkspaceId })
      .set('Cookie', sessionCookie())
      .expect(403);

    expect(mocks.repository.listUsageEvents).not.toHaveBeenCalled();
  });

  it('returns sanitized usage event detail and 404 for scoped misses', async () => {
    const app = createApp();
    const response = await request(app)
      .get(`/api/v1/ai-observability/usage-events/${eventId}`)
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(response.body.data.metadata).toMatchObject({
      safeCounter: 3,
      nested: { note: 'safe-note' },
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/raw prompt|raw response|raw document|Bearer must-not-leak|secret-value/);

    mocks.repository.findUsageEvent.mockResolvedValueOnce(null);
    await request(app)
      .get(`/api/v1/ai-observability/usage-events/${eventId}`)
      .set('Cookie', sessionCookie())
      .expect(404);
    expect(mocks.repository.findUsageEvent).toHaveBeenCalledWith(eventId, tenantId, [workspaceId]);
  });

  it('returns bigint-safe usage summary with allowlisted grouping', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/ai-observability/usage-summary')
      .query({ workspaceId, groupBy: 'workspace', source: 'llm_provider' })
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(mocks.repository.summarizeUsage).toHaveBeenCalledWith(
      tenantId,
      [workspaceId],
      expect.objectContaining({ workspaceId, groupBy: 'workspace' }),
    );
    expect(response.body).toMatchObject({
      groupBy: 'workspace',
      data: [{
        group: { type: 'workspace', value: workspaceId },
        inputTokens: '9007199254740993000',
        estimatedCostMinorUnits: '9000000000000000000',
        avgLatencyMs: 1234.5,
      }],
    });
    expect(typeof response.body.data[0].estimatedCostMinorUnits).toBe('string');
  });

  it('rejects unknown queries, invalid sort, groupBy and excessive pagination', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    await request(app)
      .get('/api/v1/ai-observability/usage-events')
      .query({ arbitrary: 'field' })
      .set('Cookie', cookie)
      .expect(422);
    await request(app)
      .get('/api/v1/ai-observability/usage-events')
      .query({ sort: 'runId:desc' })
      .set('Cookie', cookie)
      .expect(422);
    await request(app)
      .get('/api/v1/ai-observability/usage-events')
      .query({ perPage: '101' })
      .set('Cookie', cookie)
      .expect(422);
    await request(app)
      .get('/api/v1/ai-observability/usage-summary')
      .query({ groupBy: 'prompt' })
      .set('Cookie', cookie)
      .expect(422);
  });

  it('lists and reads limit policies as serialized read-only DTOs', async () => {
    const app = createApp();
    const list = await request(app)
      .get('/api/v1/ai-observability/limit-policies')
      .query({
        workspaceId,
        scopeType: 'workspace',
        metric: 'estimated_cost_minor_units',
        period: 'month',
        mode: 'monitor_only',
        status: 'active',
        includeDeleted: 'false',
        sort: 'updatedAt:desc',
      })
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(mocks.repository.listLimitPolicies).toHaveBeenCalledWith(
      tenantId,
      [workspaceId],
      expect.objectContaining({ includeDeleted: false, sort: 'updatedAt:desc' }),
    );
    expect(list.body.data[0]).toMatchObject({
      id: policyId,
      limitValue: '9000000000000000000',
      warnThresholdValue: '8000000000000000000',
    });
    expect(list.body.data[0]).not.toHaveProperty('metadata');

    const detail = await request(app)
      .get(`/api/v1/ai-observability/limit-policies/${policyId}`)
      .set('Cookie', sessionCookie())
      .expect(200);
    expect(detail.body.data.id).toBe(policyId);

    mocks.repository.findLimitPolicy.mockResolvedValueOnce(null);
    await request(app)
      .get(`/api/v1/ai-observability/limit-policies/${policyId}`)
      .set('Cookie', sessionCookie())
      .expect(404);
  });

  it('does not register policy create, update or delete routes', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    const paths = [
      '/api/v1/ai-observability/limit-policies',
      `/api/v1/ai-observability/limit-policies/${policyId}`,
    ];
    for (const path of paths) {
      await request(app).post(path).set('Cookie', cookie).send({}).expect(404);
      await request(app).put(path).set('Cookie', cookie).send({}).expect(404);
      await request(app).patch(path).set('Cookie', cookie).send({}).expect(404);
      await request(app).delete(path).set('Cookie', cookie).expect(404);
    }
  });

  it('evaluates limits read-only with tenant from session and stringifies bigint', async () => {
    const app = createApp();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await request(app)
      .post('/api/v1/ai-observability/limit-evaluation')
      .set('Cookie', sessionCookie())
      .send({
        workspaceId,
        assistantId,
        userId,
        source: 'llm_provider',
        operation: 'chat.completion',
        provider: 'openai',
        model: 'gpt-test',
        now: '2026-06-29T18:30:00.000Z',
        projectedUsage: {
          runCount: '1',
          totalTokens: '150',
          estimatedCostMinorUnits: '9000000000000000000',
        },
      })
      .expect(200);

    expect(mocks.repository.isEvaluationContextAccessible).toHaveBeenCalledWith({
      tenantId,
      workspaceId,
      assistantId,
      userId,
    });
    expect(mocks.evaluateAiUsageLimits).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      workspaceId,
      assistantId,
      projectedUsage: expect.objectContaining({ runCount: '1' }),
    }));
    expect(response.body.data).toMatchObject({
      allowed: true,
      status: 'warn',
      mode: 'monitor_only',
      decisions: [{
        limitValue: '10',
        currentValue: '10',
        projectedValue: '1',
        remainingValue: '0',
      }],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('returns an enforce blocked simulation without changing runtime', async () => {
    mocks.evaluateAiUsageLimits.mockResolvedValueOnce(evaluationFixture('enforce'));
    const response = await request(createApp())
      .post('/api/v1/ai-observability/limit-evaluation')
      .set('Cookie', sessionCookie())
      .send({ workspaceId, projectedUsage: { runCount: 1 } })
      .expect(200);

    expect(response.body.data).toMatchObject({ allowed: false, status: 'blocked', mode: 'enforce' });
    expect(mocks.evaluateAiUsageLimits).toHaveBeenCalledTimes(1);
  });

  it('rejects tenantId, sensitive fields and inaccessible evaluation contexts', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    await request(app)
      .post('/api/v1/ai-observability/limit-evaluation')
      .set('Cookie', cookie)
      .send({ workspaceId, tenantId })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-observability/limit-evaluation')
      .set('Cookie', cookie)
      .send({ workspaceId, prompt: 'must be rejected' })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-observability/limit-evaluation')
      .set('Cookie', cookie)
      .send({ workspaceId: otherWorkspaceId })
      .expect(403);

    mocks.repository.isEvaluationContextAccessible.mockResolvedValueOnce(false);
    await request(app)
      .post('/api/v1/ai-observability/limit-evaluation')
      .set('Cookie', cookie)
      .send({ workspaceId, assistantId })
      .expect(404);
    expect(mocks.evaluateAiUsageLimits).not.toHaveBeenCalled();
  });
});
