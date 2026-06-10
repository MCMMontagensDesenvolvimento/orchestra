import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => {
  const assistantsRepository = {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    listVersions: vi.fn(),
    findVersion: vi.fn(),
    createVersion: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    rollback: vi.fn(),
    listPublications: vi.fn(),
    getActivePublication: vi.fn(),
    resolveVersion: vi.fn(),
    listFeedback: vi.fn(),
    createFeedback: vi.fn(),
    listTestResults: vi.fn(),
    createTestResult: vi.fn(),
    listShares: vi.fn(),
    createShare: vi.fn(),
    workspaceExists: vi.fn(),
    userExists: vi.fn(),
    roleExists: vi.fn(),
    deleteShare: vi.fn(),
  };

  return {
    assistantsRepository,
    recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../src/modules/assistants/assistants.repository', () => ({
  assistantsRepository: mocks.assistantsRepository,
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const workspaceId = '00000000-0000-0000-0000-000000000020';
const tenantId = '00000000-0000-0000-0000-000000000010';
const userId = '00000000-0000-0000-0000-000000000001';
const assistantId = '00000000-0000-0000-0000-000000000101';
const versionId = '00000000-0000-0000-0000-000000000201';
const publicationId = '00000000-0000-0000-0000-000000000301';

const allAssistantPermissions = [
  'assistants.read',
  'assistants.create',
  'assistants.update',
  'assistants.archive',
  'assistants.restore',
  'assistants.publish',
  'assistants.unpublish',
  'assistants.rollback',
  'assistants.share',
  'assistants.feedback.read',
  'assistants.feedback.create',
  'assistants.testResults.read',
  'assistants.testResults.create',
  'audit.read',
];

const testUser: AuthenticatedUser = {
  id: userId,
  email: 'admin.dev@orchestra.local',
  name: 'Development Admin',
  tenant: {
    id: tenantId,
    name: 'Orchestra Dev Tenant',
    slug: 'orchestra-dev',
  },
  workspaces: [
    {
      id: workspaceId,
      name: 'Default Workspace',
      slug: 'default',
      role: 'admin',
    },
  ],
  roles: ['admin_platform'],
  permissions: allAssistantPermissions,
};

const decimal = { toNumber: () => 0.2 };

function sessionCookie(user: AuthenticatedUser = testUser) {
  const token = signSession({ sub: user.id, user });
  return `${env.COOKIE_NAME}=${token}`;
}

function assistantFixture(status = 'draft') {
  return {
    id: assistantId,
    tenantId,
    workspaceId,
    name: 'Governed Assistant',
    description: 'Assistant under governance tests.',
    status,
    createdById: userId,
    createdAt: new Date('2026-06-10T10:00:00.000Z'),
    updatedAt: new Date('2026-06-10T10:00:00.000Z'),
    deletedAt: null,
    createdBy: { id: userId, name: 'Development Admin', email: 'admin.dev@orchestra.local' },
    versions: [versionFixture(status === 'published' ? 'published' : 'draft')],
    publications: status === 'published' ? [publicationFixture('active')] : [],
    shares: [],
  };
}

function versionFixture(status = 'draft') {
  return {
    id: versionId,
    assistantId,
    version: '0.2.0',
    status,
    displayName: 'Governed version',
    description: null,
    instructions: 'Safe test instructions.',
    modelProvider: 'none',
    modelName: 'not-configured',
    temperature: decimal,
    configuration: null,
    createdById: userId,
    createdAt: new Date('2026-06-10T10:00:00.000Z'),
    publishedAt: status === 'published' ? new Date('2026-06-10T10:10:00.000Z') : null,
    archivedAt: null,
  };
}

function publicationFixture(status = 'active') {
  return {
    id: publicationId,
    tenantId,
    workspaceId,
    assistantId,
    assistantVersionId: versionId,
    status,
    publishedById: userId,
    publishedAt: new Date('2026-06-10T10:10:00.000Z'),
    unpublishedById: null,
    unpublishedAt: null,
    rollbackFromPublicationId: null,
    rollbackReason: null,
    createdAt: new Date('2026-06-10T10:10:00.000Z'),
    updatedAt: new Date('2026-06-10T10:10:00.000Z'),
  };
}

describe('assistant governance endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it('publishes an assistant version with permission', async () => {
    mocks.assistantsRepository.findById.mockResolvedValueOnce(assistantFixture('draft'));
    mocks.assistantsRepository.publish.mockResolvedValueOnce({
      assistant: assistantFixture('published'),
      publication: publicationFixture('active'),
      previousPublication: null,
    });

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/publish`)
      .set('Cookie', [sessionCookie()])
      .send({ versionId })
      .expect(200);

    expect(response.body.data.status).toBe('published');
    expect(response.body.data.activePublication.assistantVersionId).toBe(versionId);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_published' }));
  });

  it('blocks publish when route permission is missing', async () => {
    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/publish`)
      .set('Cookie', [sessionCookie({ ...testUser, permissions: ['assistants.read'] })])
      .send({ versionId })
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN');
    expect(mocks.assistantsRepository.publish).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'permission_denied' }));
  });

  it('unpublishes an active assistant publication', async () => {
    mocks.assistantsRepository.findById.mockResolvedValueOnce(assistantFixture('published'));
    mocks.assistantsRepository.unpublish.mockResolvedValueOnce({
      assistant: assistantFixture('draft'),
      publication: publicationFixture('inactive'),
    });

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/unpublish`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data.status).toBe('draft');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_unpublished' }));
  });

  it('rolls back by promoting a previous version/publication', async () => {
    mocks.assistantsRepository.findById.mockResolvedValueOnce(assistantFixture('published'));
    mocks.assistantsRepository.rollback.mockResolvedValueOnce({
      assistant: assistantFixture('published'),
      publication: { ...publicationFixture('active'), rollbackFromPublicationId: '00000000-0000-0000-0000-000000000302' },
      previousPublication: { ...publicationFixture('inactive'), id: '00000000-0000-0000-0000-000000000302' },
    });

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/rollback`)
      .set('Cookie', [sessionCookie()])
      .send({ versionId, reason: 'Revertendo para versao aprovada.' })
      .expect(200);

    expect(response.body.data.status).toBe('published');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_rollback' }));
  });

  it('creates and lists manual test results', async () => {
    const testResult = {
      id: '00000000-0000-0000-0000-000000000401',
      tenantId,
      workspaceId,
      assistantId,
      assistantVersionId: versionId,
      testedById: userId,
      input: 'Pergunta de teste',
      expectedBehavior: 'Responder sem IA real',
      actualOutput: 'Resposta simulada',
      status: 'passed',
      score: 95,
      notes: 'Manual',
      createdAt: new Date('2026-06-10T10:20:00.000Z'),
    };
    mocks.assistantsRepository.findById.mockResolvedValue(assistantFixture('draft'));
    mocks.assistantsRepository.resolveVersion.mockResolvedValue(versionFixture('draft'));
    mocks.assistantsRepository.createTestResult.mockResolvedValueOnce(testResult);
    mocks.assistantsRepository.listTestResults.mockResolvedValueOnce([testResult]);

    await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/test-results`)
      .set('Cookie', [sessionCookie()])
      .send({
        input: testResult.input,
        expectedBehavior: testResult.expectedBehavior,
        actualOutput: testResult.actualOutput,
        status: 'passed',
        score: 95,
      })
      .expect(201);

    const listResponse = await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/test-results`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(listResponse.body.data[0].status).toBe('passed');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_test_result_created' }));
  });

  it('creates and lists assistant feedback', async () => {
    const feedback = {
      id: '00000000-0000-0000-0000-000000000501',
      tenantId,
      workspaceId,
      assistantId,
      assistantVersionId: versionId,
      conversationId: null,
      messageId: null,
      userId,
      rating: 'positive',
      comment: 'Resposta adequada.',
      createdAt: new Date('2026-06-10T10:30:00.000Z'),
    };
    mocks.assistantsRepository.findById.mockResolvedValue(assistantFixture('published'));
    mocks.assistantsRepository.resolveVersion.mockResolvedValue(versionFixture('published'));
    mocks.assistantsRepository.createFeedback.mockResolvedValueOnce(feedback);
    mocks.assistantsRepository.listFeedback.mockResolvedValueOnce([feedback]);

    await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/feedback`)
      .set('Cookie', [sessionCookie()])
      .send({ assistantVersionId: versionId, rating: 'positive', comment: 'Resposta adequada.' })
      .expect(201);

    const listResponse = await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/feedback`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(listResponse.body.data[0].rating).toBe('positive');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_feedback_created' }));
  });

  it('returns 422 with fieldErrors for invalid test result payload', async () => {
    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/test-results`)
      .set('Cookie', [sessionCookie()])
      .send({ status: 'passed' })
      .expect(422);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.fieldErrors.some((field: { field: string }) => field.field === 'input')).toBe(true);
  });
});
