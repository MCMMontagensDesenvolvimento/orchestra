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
    createTestSet: vi.fn(),
    updateTestSet: vi.fn(),
    setTestSetStatus: vi.fn(),
    listTestCases: vi.fn(),
    findTestCase: vi.fn(),
    createTestCase: vi.fn(),
    updateTestCase: vi.fn(),
    setTestCaseStatus: vi.fn(),
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
const now = new Date('2026-06-30T19:00:00.000Z');

const user: AuthenticatedUser = {
  id: userId,
  email: 'admin.dev@orchestra.local',
  name: 'Development Admin',
  tenant: { id: tenantId, name: 'Orchestra Dev Tenant', slug: 'orchestra-dev' },
  workspaces: [{ id: workspaceId, name: 'Default Workspace', slug: 'default', role: 'admin' }],
  roles: ['admin_platform'],
  permissions: ['ai.quality.read', 'ai.quality.write'],
};

function cookie(sessionUser: AuthenticatedUser = user) {
  return `${env.COOKIE_NAME}=${signSession({ sub: sessionUser.id, user: sessionUser })}`;
}

function testSet(overrides: Record<string, unknown> = {}) {
  return {
    id: testSetId,
    workspaceId,
    assistantId,
    name: 'Governed quality set',
    description: 'Controlled set',
    status: 'active',
    metadata: { safe: true },
    createdByUserId: userId,
    updatedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function testCase(overrides: Record<string, unknown> = {}) {
  return {
    id: testCaseId,
    testSetId,
    assistantId,
    name: 'Governed case',
    description: null,
    inputText: 'Explain governed quality.',
    expectedOutput: 'A controlled answer.',
    assertions: [{ type: 'contains_any', values: ['controlled'], severity: 'required', caseSensitive: false }],
    tags: ['governed'],
    status: 'active',
    sortOrder: 1,
    metadata: { safe: true },
    createdByUserId: userId,
    updatedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    testSet: { id: testSetId, workspaceId, assistantId, status: 'active', deletedAt: null },
    ...overrides,
  };
}

describe('AI quality dedicated RBAC and governed CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repository.listTestSets.mockResolvedValue({ data: [], total: 0 });
    mocks.repository.findTestSet.mockResolvedValue(testSet());
    mocks.repository.createTestSet.mockImplementation(async (input) => testSet(input));
    mocks.repository.updateTestSet.mockImplementation(async (_id, input) => testSet(input));
    mocks.repository.setTestSetStatus.mockImplementation(async (_id, status) => testSet({ status }));
    mocks.repository.findTestCase.mockResolvedValue(testCase());
    mocks.repository.createTestCase.mockImplementation(async (input) => testCase(input));
    mocks.repository.updateTestCase.mockImplementation(async (_id, input) => testCase(input));
    mocks.repository.setTestCaseStatus.mockImplementation(async (_id, status) => testCase({ status }));
    mocks.repository.isAssistantAccessible.mockResolvedValue(true);
  });

  it('does not let audit.read replace the dedicated read/write permissions', async () => {
    const app = createApp();
    const auditOnly = cookie({ ...user, permissions: ['audit.read'] });
    const readOnly = cookie({ ...user, permissions: ['ai.quality.read'] });

    await request(app).get('/api/v1/ai-quality/test-sets').set('Cookie', auditOnly).expect(403);
    await request(app).post('/api/v1/ai-quality/test-sets').set('Cookie', readOnly).send({ name: 'x' }).expect(403);
    await request(app).get('/api/v1/ai-quality/test-sets').set('Cookie', readOnly).expect(200);
    await request(app).post('/api/v1/ai-quality/test-sets').send({ name: 'x' }).expect(401);
  });

  it('creates tenant-global and workspace test sets with scoped assistants and sanitized audit', async () => {
    const app = createApp();
    const created = await request(app)
      .post('/api/v1/ai-quality/test-sets')
      .set('Cookie', cookie())
      .send({ workspaceId, assistantId, name: 'Governed quality set', metadata: { safe: true } })
      .expect(201);

    expect(mocks.repository.createTestSet).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      workspaceId,
      assistantId,
      userId,
    }));
    expect(created.body.data).not.toHaveProperty('tenantId');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ai_quality_test_set_created',
      entityId: testSetId,
    }));
    expect(JSON.stringify(mocks.recordAuditEvent.mock.calls)).not.toContain('Governed quality set');

    await request(app)
      .post('/api/v1/ai-quality/test-sets')
      .set('Cookie', cookie())
      .send({ name: 'Tenant global' })
      .expect(201);
    expect(mocks.repository.createTestSet).toHaveBeenLastCalledWith(expect.objectContaining({ tenantId }));
  });

  it('rejects unsafe/scoped test set writes and supports update, archive and restore', async () => {
    const app = createApp();
    const auth = cookie();
    await request(app).post('/api/v1/ai-quality/test-sets').set('Cookie', auth)
      .send({ workspaceId: otherWorkspaceId, name: 'Forbidden' }).expect(403);
    await request(app).post('/api/v1/ai-quality/test-sets').set('Cookie', auth)
      .send({ tenantId, name: 'Forbidden' }).expect(422);
    await request(app).post('/api/v1/ai-quality/test-sets').set('Cookie', auth)
      .send({ name: 'Forbidden', providerApiKey: 'not-accepted' }).expect(422);
    await request(app).post('/api/v1/ai-quality/test-sets').set('Cookie', auth)
      .send({ name: 'Forbidden', metadata: { headers: { Authorization: 'not-accepted' } } }).expect(422);

    mocks.repository.isAssistantAccessible.mockResolvedValueOnce(false);
    await request(app).post('/api/v1/ai-quality/test-sets').set('Cookie', auth)
      .send({ assistantId, name: 'Missing assistant' }).expect(404);

    await request(app).patch(`/api/v1/ai-quality/test-sets/${testSetId}`).set('Cookie', auth)
      .send({ name: 'Updated', status: 'disabled', metadata: { safe: 2 } }).expect(200);
    await request(app).post(`/api/v1/ai-quality/test-sets/${testSetId}/archive`).set('Cookie', auth).expect(200);
    await request(app).post(`/api/v1/ai-quality/test-sets/${testSetId}/restore`).set('Cookie', auth).expect(200);
    expect(mocks.repository.setTestSetStatus).toHaveBeenNthCalledWith(1, testSetId, 'archived', userId);
    expect(mocks.repository.setTestSetStatus).toHaveBeenNthCalledWith(2, testSetId, 'active', userId);
  });

  it('governs test case validation, authorship, updates and lifecycle', async () => {
    const app = createApp();
    const auth = cookie();
    const body = {
      testSetId,
      assistantId,
      name: 'Governed case',
      inputText: 'Explain governed quality.',
      expectedOutput: 'A controlled answer.',
      assertions: [{ type: 'contains_any', values: ['controlled'] }],
      tags: ['quality', 'governed'],
      sortOrder: 1,
      metadata: { safe: true },
    };
    const created = await request(app).post('/api/v1/ai-quality/test-cases').set('Cookie', auth)
      .send(body).expect(201);
    expect(mocks.repository.createTestCase).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      userId,
      testSetId,
    }));
    expect(created.body.data).toMatchObject({ createdByUserId: userId, updatedByUserId: userId });
    expect(JSON.stringify(mocks.recordAuditEvent.mock.calls)).not.toContain(body.inputText);
    expect(JSON.stringify(mocks.recordAuditEvent.mock.calls)).not.toContain(body.expectedOutput);

    await request(app).post('/api/v1/ai-quality/test-cases').set('Cookie', auth)
      .send({ ...body, assertions: [] }).expect(422);
    await request(app).post('/api/v1/ai-quality/test-cases').set('Cookie', auth)
      .send({ ...body, tags: ['x'.repeat(81)] }).expect(422);
    await request(app).post('/api/v1/ai-quality/test-cases').set('Cookie', auth)
      .send({ ...body, inputText: 'x'.repeat(8001) }).expect(422);
    await request(app).post('/api/v1/ai-quality/test-cases').set('Cookie', auth)
      .send({ ...body, expectedOutput: 'x'.repeat(8001) }).expect(422);
    await request(app).post('/api/v1/ai-quality/test-cases').set('Cookie', auth)
      .send({ ...body, rawDocuments: ['forbidden'] }).expect(422);

    await request(app).patch(`/api/v1/ai-quality/test-cases/${testCaseId}`).set('Cookie', auth)
      .send({ assertions: [{ type: 'json_valid' }], sortOrder: 20 }).expect(200);
    await request(app).post(`/api/v1/ai-quality/test-cases/${testCaseId}/archive`).set('Cookie', auth).expect(200);
    await request(app).post(`/api/v1/ai-quality/test-cases/${testCaseId}/restore`).set('Cookie', auth).expect(200);
    expect(mocks.repository.setTestCaseStatus).toHaveBeenNthCalledWith(1, testCaseId, 'archived', userId);
    expect(mocks.repository.setTestCaseStatus).toHaveBeenNthCalledWith(2, testCaseId, 'active', userId);
  });

  it('returns 404 before persistence when the parent test set is outside scope', async () => {
    mocks.repository.findTestSet.mockResolvedValueOnce(null);
    await request(createApp()).post('/api/v1/ai-quality/test-cases').set('Cookie', cookie()).send({
      testSetId,
      name: 'Out of scope',
      inputText: 'controlled',
      assertions: [{ type: 'json_valid' }],
    }).expect(404);
    expect(mocks.repository.createTestCase).not.toHaveBeenCalled();
  });
});
