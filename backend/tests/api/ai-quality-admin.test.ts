import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => ({
  repository: {
    listTestSets: vi.fn(),
    findTestSet: vi.fn(),
    listTestCases: vi.fn(),
    findTestCase: vi.fn(),
    listEvaluationRuns: vi.fn(),
    findEvaluationRun: vi.fn(),
    listEvaluationResults: vi.fn(),
    isAssistantAccessible: vi.fn(),
  },
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/modules/ai-quality/ai-quality.repository', () => ({
  aiQualityRepository: mocks.repository,
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const otherWorkspaceId = '00000000-0000-0000-0000-000000000021';
const userId = '00000000-0000-0000-0000-000000000001';
const assistantId = '00000000-0000-0000-0000-000000000101';
const testSetId = '00000000-0000-0000-0000-000000001301';
const testCaseId = '00000000-0000-0000-0000-000000001302';
const runId = '00000000-0000-0000-0000-000000001303';
const resultId = '00000000-0000-0000-0000-000000001304';
const now = new Date('2026-06-30T12:00:00.000Z');

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

function testSetFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: testSetId,
    workspaceId,
    assistantId,
    name: 'Assistant quality smoke set',
    description: 'Controlled deterministic checks.',
    status: 'active',
    metadata: {
      safeCounter: 1,
      prompt: 'raw prompt must not leak',
      response: 'raw response must not leak',
      headers: { Authorization: 'Bearer must-not-leak' },
      nested: { note: 'safe-note' },
    },
    createdByUserId: userId,
    updatedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function testCaseFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: testCaseId,
    testSetId,
    assistantId,
    name: 'Contains safe answer',
    description: 'Uses controlled input text.',
    inputText: 'Explain deterministic quality evaluation.',
    expectedOutput: 'Mentions assertions.',
    assertions: [
      { type: 'contains_any', values: ['assertions'], severity: 'required', caseSensitive: false },
      { type: 'not_contains_any', values: ['secret'], severity: 'warning', caseSensitive: false },
    ],
    tags: ['quality', 'deterministic'],
    status: 'active',
    sortOrder: 10,
    metadata: {
      safe: true,
      rawDocuments: ['must not leak'],
      token: 'must-not-leak',
    },
    testSet: {
      id: testSetId,
      workspaceId,
      assistantId,
      status: 'active',
      deletedAt: null,
    },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function evaluationRunFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: runId,
    workspaceId,
    assistantId,
    testSetId,
    status: 'completed',
    mode: 'deterministic',
    startedAt: now,
    completedAt: new Date('2026-06-30T12:00:01.000Z'),
    totalCases: 1,
    passedCases: 1,
    failedCases: 0,
    warningCases: 0,
    errorCases: 0,
    skippedCases: 0,
    scoreBasisPoints: 10000,
    metadata: { safe: true, secret: 'must-not-leak' },
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function evaluationResultFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: resultId,
    runId,
    testCaseId,
    status: 'passed',
    scoreBasisPoints: 10000,
    assertionResults: [{
      type: 'contains_any',
      passed: true,
      severity: 'required',
      reason: 'at_least_one_expected_term_found',
      expected: { values: ['assertions'] },
      actualSummary: 'matchedTerms=1',
    }],
    candidateOutputHash: 'a'.repeat(64),
    candidateOutputExcerpt: 'Short sanitized excerpt',
    errorCode: null,
    errorMessageHash: null,
    metadata: { safe: true, prompt: 'must not leak' },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AI quality admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repository.listTestSets.mockResolvedValue({ data: [testSetFixture()], total: 1 });
    mocks.repository.findTestSet.mockResolvedValue(testSetFixture());
    mocks.repository.listTestCases.mockResolvedValue({ data: [testCaseFixture()], total: 1 });
    mocks.repository.findTestCase.mockResolvedValue(testCaseFixture());
    mocks.repository.listEvaluationRuns.mockResolvedValue({ data: [evaluationRunFixture()], total: 1 });
    mocks.repository.findEvaluationRun.mockResolvedValue(evaluationRunFixture());
    mocks.repository.listEvaluationResults.mockResolvedValue({ data: [evaluationResultFixture()], total: 1 });
    mocks.repository.isAssistantAccessible.mockResolvedValue(true);
  });

  it('requires authentication and audit.read permission', async () => {
    const app = createApp();
    await request(app).get('/api/v1/ai-quality/test-sets').expect(401);

    await request(app)
      .get('/api/v1/ai-quality/test-sets')
      .set('Cookie', sessionCookie({ ...adminUser, permissions: ['assistants.read'] }))
      .expect(403);

    expect(mocks.repository.listTestSets).not.toHaveBeenCalled();
  });

  it('lists test sets scoped by session tenant and workspace without metadata', async () => {
    const response = await request(createApp())
      .get('/api/v1/ai-quality/test-sets')
      .query({
        workspaceId,
        assistantId,
        status: 'active',
        includeDeleted: 'false',
        page: '1',
        perPage: '50',
        sort: 'name:asc',
      })
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(mocks.repository.listTestSets).toHaveBeenCalledWith(
      tenantId,
      [workspaceId],
      expect.objectContaining({ workspaceId, assistantId, perPage: 50, sort: 'name:asc' }),
    );
    expect(response.body.data[0]).toMatchObject({ id: testSetId, name: 'Assistant quality smoke set' });
    expect(response.body.data[0]).not.toHaveProperty('metadata');
    expect(JSON.stringify(response.body)).not.toContain('raw prompt must not leak');
  });

  it('rejects an out-of-scope workspace before repository access', async () => {
    await request(createApp())
      .get('/api/v1/ai-quality/test-sets')
      .query({ workspaceId: otherWorkspaceId })
      .set('Cookie', sessionCookie())
      .expect(403);

    expect(mocks.repository.listTestSets).not.toHaveBeenCalled();
  });

  it('returns sanitized test set detail and 404 for scoped misses', async () => {
    const response = await request(createApp())
      .get(`/api/v1/ai-quality/test-sets/${testSetId}`)
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(response.body.data.metadata).toMatchObject({
      safeCounter: 1,
      nested: { note: 'safe-note' },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/raw prompt|raw response|Bearer must-not-leak/);

    mocks.repository.findTestSet.mockResolvedValueOnce(null);
    await request(createApp())
      .get(`/api/v1/ai-quality/test-sets/${testSetId}`)
      .set('Cookie', sessionCookie())
      .expect(404);
  });

  it('lists and reads test cases with controlled content and sanitized metadata', async () => {
    const list = await request(createApp())
      .get('/api/v1/ai-quality/test-cases')
      .query({ workspaceId, testSetId, status: 'active', sort: 'sortOrder:asc' })
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(mocks.repository.listTestCases).toHaveBeenCalledWith(
      tenantId,
      [workspaceId],
      expect.objectContaining({ workspaceId, testSetId }),
    );
    expect(list.body.data[0]).not.toHaveProperty('metadata');
    expect(list.body.data[0]).not.toHaveProperty('inputText');

    const detail = await request(createApp())
      .get(`/api/v1/ai-quality/test-cases/${testCaseId}`)
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(detail.body.data.inputText).toBe('Explain deterministic quality evaluation.');
    expect(detail.body.data.assertions).toHaveLength(2);
    expect(detail.body.data.metadata).toEqual({ safe: true });
    expect(JSON.stringify(detail.body)).not.toMatch(/must not leak/);
  });

  it('lists evaluation runs and results with sanitized DTOs', async () => {
    const run = await request(createApp())
      .get('/api/v1/ai-quality/evaluation-runs')
      .query({ workspaceId, testSetId, status: 'completed', mode: 'deterministic' })
      .set('Cookie', sessionCookie())
      .expect(200);
    expect(run.body.data[0]).toMatchObject({ id: runId, scoreBasisPoints: 10000 });
    expect(run.body.data[0]).not.toHaveProperty('metadata');

    const runDetail = await request(createApp())
      .get(`/api/v1/ai-quality/evaluation-runs/${runId}`)
      .set('Cookie', sessionCookie())
      .expect(200);
    expect(runDetail.body.data.metadata).toEqual({ safe: true });

    const results = await request(createApp())
      .get('/api/v1/ai-quality/evaluation-results')
      .query({ workspaceId, runId, status: 'passed' })
      .set('Cookie', sessionCookie())
      .expect(200);
    expect(results.body.data[0]).toMatchObject({
      id: resultId,
      candidateOutputHash: 'a'.repeat(64),
      candidateOutputExcerpt: 'Short sanitized excerpt',
    });
    expect(JSON.stringify(results.body)).not.toMatch(/candidateOutput":|must not leak/);
  });

  it('rejects unknown queries, invalid sort and excessive pagination', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    await request(app)
      .get('/api/v1/ai-quality/test-sets')
      .query({ arbitrary: 'field' })
      .set('Cookie', cookie)
      .expect(422);
    await request(app)
      .get('/api/v1/ai-quality/test-sets')
      .query({ sort: 'status:desc' })
      .set('Cookie', cookie)
      .expect(422);
    await request(app)
      .get('/api/v1/ai-quality/test-cases')
      .query({ perPage: '101' })
      .set('Cookie', cookie)
      .expect(422);
  });

  it('evaluates a provided test case deterministically without persistence or external calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await request(createApp())
      .post('/api/v1/ai-quality/evaluate-test-case')
      .set('Cookie', sessionCookie())
      .send({
        workspaceId,
        candidateOutput: 'This answer mentions deterministic assertions.',
        assertions: [
          { type: 'contains_all', values: ['deterministic', 'assertions'] },
          { type: 'not_contains_any', values: ['credential'], severity: 'warning' },
        ],
      })
      .expect(200);

    expect(mocks.repository.isAssistantAccessible).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      workspaceIds: [workspaceId],
      workspaceId,
    }));
    expect(response.body.data).toMatchObject({
      status: 'passed',
      scoreBasisPoints: 10000,
    });
    expect(response.body.data.candidateOutputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(response.body.data).not.toHaveProperty('candidateOutput');
    expect(mocks.repository.findTestCase).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('evaluates an existing testCaseId without requiring assertions in the body', async () => {
    const response = await request(createApp())
      .post('/api/v1/ai-quality/evaluate-test-case')
      .set('Cookie', sessionCookie())
      .send({
        workspaceId,
        testCaseId,
        candidateOutput: 'This answer mentions assertions and contains no blocked term.',
      })
      .expect(200);

    expect(mocks.repository.findTestCase).toHaveBeenCalledWith(testCaseId, tenantId, [workspaceId], workspaceId);
    expect(response.body.data.status).toBe('passed');
  });

  it('rejects tenantId, arbitrary fields, sensitive body fields and unsafe metadata', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    await request(app)
      .post('/api/v1/ai-quality/evaluate-test-case')
      .set('Cookie', cookie)
      .send({ tenantId, candidateOutput: 'ok', assertions: [{ type: 'contains_any', values: ['ok'] }] })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-quality/evaluate-test-case')
      .set('Cookie', cookie)
      .send({ candidateOutput: 'ok', assertions: [{ type: 'contains_any', values: ['ok'] }], arbitrary: true })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-quality/evaluate-test-case')
      .set('Cookie', cookie)
      .send({ candidateOutput: 'ok', assertions: [{ type: 'contains_any', values: ['ok'] }], providerApiKey: 'secret' })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-quality/evaluate-test-case')
      .set('Cookie', cookie)
      .send({
        candidateOutput: 'ok',
        assertions: [{ type: 'contains_any', values: ['ok'] }],
        metadata: { token: 'must-not-enter' },
      })
      .expect(422);
  });

  it('returns 403 for workspace scope misses and 404 for inaccessible details/evaluation contexts', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    await request(app)
      .post('/api/v1/ai-quality/evaluate-test-case')
      .set('Cookie', cookie)
      .send({
        workspaceId: otherWorkspaceId,
        candidateOutput: 'ok',
        assertions: [{ type: 'contains_any', values: ['ok'] }],
      })
      .expect(403);

    mocks.repository.findTestCase.mockResolvedValueOnce(null);
    await request(app)
      .post('/api/v1/ai-quality/evaluate-test-case')
      .set('Cookie', cookie)
      .send({ workspaceId, testCaseId, candidateOutput: 'ok' })
      .expect(404);

    mocks.repository.isAssistantAccessible.mockResolvedValueOnce(false);
    await request(app)
      .post('/api/v1/ai-quality/evaluate-test-case')
      .set('Cookie', cookie)
      .send({
        workspaceId,
        assistantId,
        candidateOutput: 'ok',
        assertions: [{ type: 'contains_any', values: ['ok'] }],
      })
      .expect(404);
  });

  it('does not register CRUD routes for test sets, cases, runs or results', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    const paths = [
      '/api/v1/ai-quality/test-sets',
      `/api/v1/ai-quality/test-sets/${testSetId}`,
      '/api/v1/ai-quality/test-cases',
      `/api/v1/ai-quality/test-cases/${testCaseId}`,
      '/api/v1/ai-quality/evaluation-runs',
      `/api/v1/ai-quality/evaluation-runs/${runId}`,
      '/api/v1/ai-quality/evaluation-results',
    ];

    for (const path of paths) {
      await request(app).post(path).set('Cookie', cookie).send({}).expect(404);
      await request(app).put(path).set('Cookie', cookie).send({}).expect(404);
      await request(app).patch(path).set('Cookie', cookie).send({}).expect(404);
      await request(app).delete(path).set('Cookie', cookie).expect(404);
    }
  });
});
