import { createHash } from 'crypto';
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
    findActiveTestSetForRun: vi.fn(),
    listTestCases: vi.fn(),
    findTestCase: vi.fn(),
    listEvaluationRuns: vi.fn(),
    findEvaluationRun: vi.fn(),
    listEvaluationResults: vi.fn(),
    listEvaluationResultsForRun: vi.fn(),
    createEvaluationRunWithResults: vi.fn(),
    isAssistantAccessible: vi.fn(),
    findAssistantForRun: vi.fn(),
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
const testCaseIdA = '00000000-0000-0000-0000-000000001302';
const testCaseIdB = '00000000-0000-0000-0000-000000001303';
const runId = '00000000-0000-0000-0000-000000001304';
const resultIdA = '00000000-0000-0000-0000-000000001305';
const resultIdB = '00000000-0000-0000-0000-000000001306';
const now = new Date('2026-06-30T16:00:00.000Z');

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
  permissions: ['ai.quality.read', 'ai.quality.write'],
};

function sessionCookie(user: AuthenticatedUser = adminUser) {
  const token = signSession({ sub: user.id, user });
  return `${env.COOKIE_NAME}=${token}`;
}

function testSetForRunFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: testSetId,
    workspaceId,
    assistantId,
    name: 'Assistant quality smoke set',
    status: 'active',
    deletedAt: null,
    assistant: {
      id: assistantId,
      workspaceId,
      name: 'Quality Assistant',
      status: 'published',
    },
    testCases: [
      {
        id: testCaseIdA,
        assistantId,
        name: 'Contains quality',
        inputText: 'Explain deterministic quality.',
        assertions: [{ type: 'contains_any', values: ['quality'], severity: 'required', caseSensitive: false }],
        status: 'active',
        sortOrder: 1,
        deletedAt: null,
      },
      {
        id: testCaseIdB,
        assistantId,
        name: 'Avoid forbidden',
        inputText: 'Avoid restricted terms.',
        assertions: [{ type: 'not_contains_any', values: ['forbidden'], severity: 'warning', caseSensitive: false }],
        status: 'active',
        sortOrder: 2,
        deletedAt: null,
      },
    ],
    _count: { testCases: 2 },
    ...overrides,
  };
}

function runRecordFromCreateInput(input: any) {
  const resultIds = [resultIdA, resultIdB];
  return {
    id: runId,
    workspaceId: input.workspaceId,
    assistantId: input.assistantId,
    testSetId: input.testSetId,
    status: 'completed',
    mode: 'deterministic',
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    totalCases: input.summary.totalCases,
    passedCases: input.summary.passedCases,
    failedCases: input.summary.failedCases,
    warningCases: input.summary.warningCases,
    errorCases: input.summary.errorCases,
    skippedCases: input.summary.skippedCases,
    scoreBasisPoints: input.summary.scoreBasisPoints,
    metadata: input.metadata,
    createdByUserId: userId,
    assistantSnapshotHash: input.assistantSnapshotHash,
    assistantSnapshotSummary: input.assistantSnapshotSummary,
    testSetSnapshotHash: input.testSetSnapshotHash,
    testSetSnapshotSummary: input.testSetSnapshotSummary,
    createdAt: input.completedAt,
    updatedAt: input.completedAt,
    deletedAt: null,
    results: input.results.map((result: any, index: number) => ({
      id: resultIds[index],
      runId,
      testCaseId: result.testCaseId,
      status: result.status,
      scoreBasisPoints: result.scoreBasisPoints,
      assertionResults: result.assertionResults,
      candidateOutputHash: result.candidateOutputHash,
      candidateOutputExcerpt: result.candidateOutputExcerpt,
      errorCode: result.errorCode ?? null,
      errorMessageHash: result.errorMessageHash ?? null,
      metadata: result.metadata,
      createdAt: input.completedAt,
      updatedAt: input.completedAt,
    })),
  };
}

describe('AI quality deterministic evaluation runs admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repository.findActiveTestSetForRun.mockResolvedValue(testSetForRunFixture());
    mocks.repository.findAssistantForRun.mockResolvedValue({
      id: assistantId,
      workspaceId,
      name: 'Quality Assistant',
      status: 'published',
    });
    mocks.repository.createEvaluationRunWithResults.mockImplementation(async (input) => runRecordFromCreateInput(input));
    mocks.repository.findEvaluationRun.mockResolvedValue({
      ...runRecordFromCreateInput({
        workspaceId,
        assistantId,
        testSetId,
        summary: {
          totalCases: 2,
          passedCases: 2,
          failedCases: 0,
          warningCases: 0,
          errorCases: 0,
          skippedCases: 0,
          scoreBasisPoints: 10000,
        },
        startedAt: now,
        completedAt: now,
        assistantSnapshotHash: 'a'.repeat(64),
        assistantSnapshotSummary: { assistantId, workspaceId, capturedAt: now.toISOString() },
        testSetSnapshotHash: 'b'.repeat(64),
        testSetSnapshotSummary: { testSetId, workspaceId, assistantId, testCaseCount: 2, activeTestCaseCount: 2, capturedAt: now.toISOString() },
        results: [],
      }),
      results: undefined,
    });
    mocks.repository.listEvaluationResultsForRun.mockResolvedValue({
      data: runRecordFromCreateInput({
        workspaceId,
        assistantId,
        testSetId,
        summary: {
          totalCases: 2,
          passedCases: 2,
          failedCases: 0,
          warningCases: 0,
          errorCases: 0,
          skippedCases: 0,
          scoreBasisPoints: 10000,
        },
        startedAt: now,
        completedAt: now,
        results: [
          {
            testCaseId: testCaseIdA,
            status: 'passed',
            scoreBasisPoints: 10000,
            assertionResults: [],
            candidateOutputHash: 'a'.repeat(64),
            candidateOutputExcerpt: 'Quality answer',
          },
        ],
      }).results,
      total: 2,
    });
  });

  it('requires authentication and ai.quality.write while read is insufficient', async () => {
    const app = createApp();
    await request(app).post('/api/v1/ai-quality/evaluation-runs/deterministic').send({}).expect(401);

    await request(app)
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', sessionCookie({ ...adminUser, permissions: ['ai.quality.read'] }))
      .send({ testSetId, caseOutputs: [] })
      .expect(403);

    expect(mocks.repository.findActiveTestSetForRun).not.toHaveBeenCalled();
  });

  it('rejects out-of-scope workspace before repository access', async () => {
    await request(createApp())
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', sessionCookie())
      .send({
        workspaceId: otherWorkspaceId,
        testSetId,
        caseOutputs: [{ testCaseId: testCaseIdA, candidateOutput: 'quality' }],
      })
      .expect(403);

    expect(mocks.repository.findActiveTestSetForRun).not.toHaveBeenCalled();
  });

  it('rejects tenantId, sensitive fields and arbitrary fields in the body', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    await request(app)
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', cookie)
      .send({ tenantId, testSetId, caseOutputs: [{ testCaseId: testCaseIdA, candidateOutput: 'quality' }] })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', cookie)
      .send({ testSetId, providerApiKey: 'secret', caseOutputs: [{ testCaseId: testCaseIdA, candidateOutput: 'quality' }] })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', cookie)
      .send({ testSetId, arbitrary: true, caseOutputs: [{ testCaseId: testCaseIdA, candidateOutput: 'quality' }] })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', cookie)
      .send({
        testSetId,
        metadata: { token: 'must-not-enter' },
        caseOutputs: [{ testCaseId: testCaseIdA, candidateOutput: 'quality' }],
      })
      .expect(422);
  });

  it('returns 404 for missing test set and inaccessible assistant', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    mocks.repository.findActiveTestSetForRun.mockResolvedValueOnce(null);
    await request(app)
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', cookie)
      .send({
        workspaceId,
        testSetId,
        caseOutputs: [
          { testCaseId: testCaseIdA, candidateOutput: 'quality' },
          { testCaseId: testCaseIdB, candidateOutput: 'safe' },
        ],
      })
      .expect(404);

    mocks.repository.findActiveTestSetForRun.mockResolvedValueOnce(testSetForRunFixture({
      assistantId: null,
      assistant: null,
    }));
    mocks.repository.findAssistantForRun.mockResolvedValueOnce(null);
    await request(app)
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', cookie)
      .send({
        workspaceId,
        assistantId,
        testSetId,
        caseOutputs: [
          { testCaseId: testCaseIdA, candidateOutput: 'quality' },
          { testCaseId: testCaseIdB, candidateOutput: 'safe' },
        ],
      })
      .expect(404);
  });

  it('rejects duplicate, missing, out-of-test-set and oversized case outputs', async () => {
    const app = createApp();
    const cookie = sessionCookie();
    await request(app)
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', cookie)
      .send({
        testSetId,
        caseOutputs: [
          { testCaseId: testCaseIdA, candidateOutput: 'quality' },
          { testCaseId: testCaseIdA, candidateOutput: 'quality again' },
        ],
      })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', cookie)
      .send({
        testSetId,
        caseOutputs: [{ testCaseId: testCaseIdA, candidateOutput: 'quality' }],
      })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', cookie)
      .send({
        testSetId,
        caseOutputs: [
          { testCaseId: testCaseIdA, candidateOutput: 'quality' },
          { testCaseId: '00000000-0000-0000-0000-000000009999', candidateOutput: 'safe' },
        ],
      })
      .expect(422);
    await request(app)
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', cookie)
      .send({
        testSetId,
        caseOutputs: [
          { testCaseId: testCaseIdA, candidateOutput: 'x'.repeat(16001) },
          { testCaseId: testCaseIdB, candidateOutput: 'safe' },
        ],
      })
      .expect(422);
  });

  it('creates a completed run and results transactionally without persisting full candidate output', async () => {
    const candidateOutput = `${'quality answer '.repeat(40)}TAIL_FULL_OUTPUT_SHOULD_NOT_PERSIST`;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await request(createApp())
      .post('/api/v1/ai-quality/evaluation-runs/deterministic')
      .set('Cookie', sessionCookie())
      .send({
        workspaceId,
        testSetId,
        metadata: { safe: true },
        caseOutputs: [
          { testCaseId: testCaseIdA, candidateOutput, metadata: { safeCase: true } },
          { testCaseId: testCaseIdB, candidateOutput: 'safe answer' },
        ],
      })
      .expect(201);

    expect(mocks.repository.createEvaluationRunWithResults).toHaveBeenCalledTimes(1);
    const createInput = mocks.repository.createEvaluationRunWithResults.mock.calls[0][0];
    expect(createInput).toMatchObject({
      tenantId,
      workspaceId,
      assistantId,
      testSetId,
      summary: {
        totalCases: 2,
        passedCases: 2,
        failedCases: 0,
        warningCases: 0,
        errorCases: 0,
        skippedCases: 0,
        scoreBasisPoints: 10000,
      },
    });
    expect(createInput.results).toHaveLength(2);
    expect(createInput.results[0].candidateOutputHash).toBe(createHash('sha256').update(candidateOutput).digest('hex'));
    expect(createInput.results[0]).not.toHaveProperty('candidateOutput');
    expect(JSON.stringify(createInput)).not.toContain(candidateOutput);
    expect(createInput.assistantSnapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createInput.testSetSnapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(createInput.assistantSnapshotSummary)).not.toMatch(/secret|credential|headers|baseUrl|rawDocuments/i);
    expect(JSON.stringify(createInput.testSetSnapshotSummary)).not.toMatch(/secret|credential|headers|baseUrl|rawDocuments/i);

    expect(response.body.data).toMatchObject({
      id: runId,
      status: 'completed',
      mode: 'deterministic',
      totalCases: 2,
      passedCases: 2,
      scoreBasisPoints: 10000,
    });
    expect(response.body.data.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        testCaseId: testCaseIdA,
        status: 'passed',
        candidateOutputHash: createHash('sha256').update(candidateOutput).digest('hex'),
      }),
    ]));
    expect(JSON.stringify(response.body)).not.toContain(candidateOutput);
    expect(JSON.stringify(response.body)).not.toContain('TAIL_FULL_OUTPUT_SHOULD_NOT_PERSIST');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ai_quality_evaluation_run_created',
      entityId: runId,
      metadata: expect.objectContaining({ totalCases: 2, scoreBasisPoints: 10000 }),
    }));
    expect(JSON.stringify(mocks.recordAuditEvent.mock.calls)).not.toContain(candidateOutput);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('lists results for a run with scoping and returns 404 for scoped misses', async () => {
    const app = createApp();
    const response = await request(app)
      .get(`/api/v1/ai-quality/evaluation-runs/${runId}/results`)
      .query({ status: 'passed', page: '1', perPage: '20' })
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(mocks.repository.findEvaluationRun).toHaveBeenCalledWith(runId, tenantId, [workspaceId]);
    expect(mocks.repository.listEvaluationResultsForRun).toHaveBeenCalledWith(
      tenantId,
      [workspaceId],
      runId,
      expect.objectContaining({ status: 'passed', page: 1, perPage: 20 }),
    );
    expect(response.body.data[0]).toMatchObject({ runId, candidateOutputHash: 'a'.repeat(64) });

    mocks.repository.findEvaluationRun.mockResolvedValueOnce(null);
    await request(app)
      .get(`/api/v1/ai-quality/evaluation-runs/${runId}/results`)
      .set('Cookie', sessionCookie())
      .expect(404);
  });
});
