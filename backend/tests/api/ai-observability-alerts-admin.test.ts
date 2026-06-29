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
    listAlertRules: vi.fn(),
    findAlertRule: vi.fn(),
    isEvaluationContextAccessible: vi.fn(),
  },
  evaluateAiUsageLimits: vi.fn(),
  evaluateAiObservabilityAlerts: vi.fn(),
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/modules/ai-observability/ai-observability-admin.repository', () => ({
  aiObservabilityAdminRepository: mocks.repository,
}));

vi.mock('../../src/modules/ai-observability/ai-usage-limits.service', () => ({
  evaluateAiUsageLimits: mocks.evaluateAiUsageLimits,
}));

vi.mock('../../src/modules/ai-observability/ai-observability-alerts.service', () => ({
  evaluateAiObservabilityAlerts: mocks.evaluateAiObservabilityAlerts,
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const otherWorkspaceId = '00000000-0000-0000-0000-000000000021';
const userId = '00000000-0000-0000-0000-000000000001';
const assistantId = '00000000-0000-0000-0000-000000000101';
const alertRuleId = '00000000-0000-0000-0000-000000001203';
const now = new Date('2026-06-29T18:30:00.000Z');

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

function alertRuleFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: alertRuleId,
    workspaceId,
    assistantId: null,
    userId: null,
    scopeType: 'workspace',
    metric: 'estimated_cost_minor_units',
    period: 'month',
    operator: 'gte',
    thresholdValue: 9_000_000_000_000_000_000n,
    severity: 'critical',
    status: 'active',
    source: null,
    operation: null,
    provider: null,
    modelName: null,
    description: 'Monthly estimated cost alert simulation.',
    cooldownMinutes: 60,
    createdByUserId: userId,
    updatedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    metadata: {
      safeCounter: 3,
      prompt: 'raw prompt must not leak',
      response: 'raw response must not leak',
      rawDocuments: ['raw document must not leak'],
      headers: { Authorization: 'Bearer must-not-leak' },
      apiKey: 'secret-value',
      nested: { note: 'safe-note' },
    },
    ...overrides,
  };
}

function alertEvaluationFixture() {
  return {
    status: 'triggered',
    triggered: true,
    maxSeverity: 'critical',
    decisions: [{
      ruleId: alertRuleId,
      scopeType: 'workspace',
      metric: 'estimated_cost_minor_units',
      period: 'month',
      operator: 'gte',
      severity: 'critical',
      status: 'active',
      thresholdValue: 9_000_000_000_000_000_000n,
      currentValue: 8_000_000_000_000_000_000n,
      projectedValue: 1_000_000_000_000_000_000n,
      evaluatedValue: 9_000_000_000_000_000_000n,
      triggered: true,
      reason: 'threshold_triggered',
      windowStart: new Date('2026-06-01T00:00:00.000Z'),
      windowEnd: new Date('2026-07-01T00:00:00.000Z'),
    }],
  };
}

describe('AI observability alerts admin read API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repository.listAlertRules.mockResolvedValue({ data: [alertRuleFixture()], total: 1 });
    mocks.repository.findAlertRule.mockResolvedValue(alertRuleFixture());
    mocks.repository.isEvaluationContextAccessible.mockResolvedValue(true);
    mocks.evaluateAiObservabilityAlerts.mockResolvedValue(alertEvaluationFixture());
  });

  it('requires authentication and audit.read permission', async () => {
    const app = createApp();
    await request(app).get('/api/v1/ai-observability/alert-rules').expect(401);

    await request(app)
      .get('/api/v1/ai-observability/alert-rules')
      .set('Cookie', sessionCookie({ ...adminUser, permissions: ['assistants.read'] }))
      .expect(403);

    expect(mocks.repository.listAlertRules).not.toHaveBeenCalled();
  });

  it('lists alert rules scoped by session tenant and allowed workspace without metadata', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/ai-observability/alert-rules')
      .query({
        workspaceId,
        scopeType: 'workspace',
        metric: 'estimated_cost_minor_units',
        period: 'month',
        operator: 'gte',
        severity: 'critical',
        status: 'active',
        includeDeleted: 'false',
        sort: 'updatedAt:asc',
      })
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(mocks.repository.listAlertRules).toHaveBeenCalledWith(
      tenantId,
      [workspaceId],
      expect.objectContaining({ includeDeleted: false, sort: 'updatedAt:asc' }),
    );
    expect(response.body.data[0]).toMatchObject({
      id: alertRuleId,
      thresholdValue: '9000000000000000000',
      severity: 'critical',
      cooldownMinutes: 60,
    });
    expect(response.body.data[0]).not.toHaveProperty('metadata');
  });

  it('rejects an out-of-scope workspace before repository access', async () => {
    const app = createApp();
    await request(app)
      .get('/api/v1/ai-observability/alert-rules')
      .query({ workspaceId: otherWorkspaceId })
      .set('Cookie', sessionCookie())
      .expect(403);

    expect(mocks.repository.listAlertRules).not.toHaveBeenCalled();
  });

  it('returns sanitized alert rule detail and 404 for scoped misses', async () => {
    const app = createApp();
    const response = await request(app)
      .get(`/api/v1/ai-observability/alert-rules/${alertRuleId}`)
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(response.body.data.metadata).toMatchObject({
      safeCounter: 3,
      nested: { note: 'safe-note' },
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/raw prompt|raw response|raw document|Bearer must-not-leak|secret-value/);

    mocks.repository.findAlertRule.mockResolvedValueOnce(null);
    await request(app)
      .get(`/api/v1/ai-observability/alert-rules/${alertRuleId}`)
      .set('Cookie', sessionCookie())
      .expect(404);
    expect(mocks.repository.findAlertRule).toHaveBeenCalledWith(alertRuleId, tenantId, [workspaceId]);
  });

  it('evaluates alerts read-only with tenant from session and stringifies bigint', async () => {
    const app = createApp();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await request(app)
      .post('/api/v1/ai-observability/alert-evaluation')
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
          eventCount: '1',
          estimatedCostMinorUnits: '1000000000000000000',
          avgLatencyMs: 250,
        },
      })
      .expect(200);

    expect(mocks.repository.isEvaluationContextAccessible).toHaveBeenCalledWith({
      tenantId,
      workspaceId,
      assistantId,
      userId,
    });
    expect(mocks.evaluateAiObservabilityAlerts).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      workspaceId,
      assistantId,
      projectedUsage: expect.objectContaining({ estimatedCostMinorUnits: '1000000000000000000' }),
    }));
    expect(response.body.data).toMatchObject({
      status: 'triggered',
      triggered: true,
      maxSeverity: 'critical',
      decisions: [{
        thresholdValue: '9000000000000000000',
        currentValue: '8000000000000000000',
        projectedValue: '1000000000000000000',
        evaluatedValue: '9000000000000000000',
      }],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('rejects tenantId, sensitive fields and inaccessible evaluation contexts', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    await request(app)
      .post('/api/v1/ai-observability/alert-evaluation')
      .set('Cookie', cookie)
      .send({ workspaceId, tenantId })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-observability/alert-evaluation')
      .set('Cookie', cookie)
      .send({ workspaceId, prompt: 'must be rejected' })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-observability/alert-evaluation')
      .set('Cookie', cookie)
      .send({ workspaceId: otherWorkspaceId })
      .expect(403);

    mocks.repository.isEvaluationContextAccessible.mockResolvedValueOnce(false);
    await request(app)
      .post('/api/v1/ai-observability/alert-evaluation')
      .set('Cookie', cookie)
      .send({ workspaceId, assistantId })
      .expect(404);
    expect(mocks.evaluateAiObservabilityAlerts).not.toHaveBeenCalled();
  });

  it('rejects unknown queries, invalid sort and arbitrary body fields', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    await request(app)
      .get('/api/v1/ai-observability/alert-rules')
      .query({ arbitrary: 'field' })
      .set('Cookie', cookie)
      .expect(422);
    await request(app)
      .get('/api/v1/ai-observability/alert-rules')
      .query({ sort: 'severity:desc' })
      .set('Cookie', cookie)
      .expect(422);
    await request(app)
      .post('/api/v1/ai-observability/alert-evaluation')
      .set('Cookie', cookie)
      .send({ workspaceId, metadata: { safeCounter: 1 } })
      .expect(422);
  });

  it('does not register alert rule create, update or delete routes', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    const paths = [
      '/api/v1/ai-observability/alert-rules',
      `/api/v1/ai-observability/alert-rules/${alertRuleId}`,
    ];
    for (const path of paths) {
      await request(app).post(path).set('Cookie', cookie).send({}).expect(404);
      await request(app).put(path).set('Cookie', cookie).send({}).expect(404);
      await request(app).patch(path).set('Cookie', cookie).send({}).expect(404);
      await request(app).delete(path).set('Cookie', cookie).expect(404);
    }
  });
});
