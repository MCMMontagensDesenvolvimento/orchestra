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
    findPublication: vi.fn(),
    listApprovals: vi.fn(),
    findApproval: vi.fn(),
    createApproval: vi.fn(),
    decideApproval: vi.fn(),
    cancelApproval: vi.fn(),
    findApprovedApproval: vi.fn(),
    countPendingApprovals: vi.fn(),
    getExecutionPolicy: vi.fn(),
    updateExecutionPolicy: vi.fn(),
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
    llmCapabilities: vi.fn(),
  };
});

vi.mock('../../src/modules/assistants/assistants.repository', () => ({
  assistantsRepository: mocks.assistantsRepository,
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

vi.mock('../../src/modules/llm/llm.service', () => ({
  llmService: {
    capabilities: mocks.llmCapabilities,
  },
}));

const workspaceId = '00000000-0000-0000-0000-000000000020';
const tenantId = '00000000-0000-0000-0000-000000000010';
const userId = '00000000-0000-0000-0000-000000000001';
const assistantId = '00000000-0000-0000-0000-000000000101';
const versionId = '00000000-0000-0000-0000-000000000201';
const publicationId = '00000000-0000-0000-0000-000000000301';
const approvalId = '00000000-0000-0000-0000-000000000601';

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
  'assistants.approval.request',
  'assistants.approval.approve',
  'assistants.approval.reject',
  'assistants.approval.cancel',
  'assistants.execution.configure',
  'assistants.execution.sandbox',
  'assistants.execution.enable',
  'assistants.publications.read',
  'assistants.publications.manage',
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

function approvalFixture(status = 'pending', action = 'publish') {
  return {
    id: approvalId,
    tenantId,
    workspaceId,
    assistantId,
    assistantVersionId: versionId,
    publicationId: null,
    requestedById: userId,
    decidedById: status === 'pending' ? null : userId,
    action,
    status,
    reason: 'Publish requires approval.',
    decisionReason: status === 'pending' ? null : 'Decision recorded.',
    metadata: null,
    createdAt: new Date('2026-06-10T10:40:00.000Z'),
    updatedAt: new Date('2026-06-10T10:40:00.000Z'),
    decidedAt: status === 'approved' || status === 'rejected' ? new Date('2026-06-10T10:50:00.000Z') : null,
    cancelledAt: status === 'cancelled' ? new Date('2026-06-10T10:55:00.000Z') : null,
  };
}

function executionPolicyFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000701',
    tenantId,
    workspaceId,
    assistantId,
    executionMode: 'draft_test',
    requiresApprovalToPublish: false,
    sandboxEnabled: true,
    sandboxRequiresAuth: true,
    sandboxAllowedForRoles: ['admin_platform'],
    sandboxBlocksExternalTools: true,
    sandboxBlocksRealProviders: true,
    sandboxLogsRequired: true,
    sandboxCostLimitPlaceholder: null,
    allowExternalLlmProviders: false,
    allowedLlmProviders: [],
    defaultLlmProvider: null,
    allowDraftTesting: true,
    allowPublishedExecution: false,
    isExecutionEnabled: false,
    updatedById: userId,
    createdAt: new Date('2026-06-10T10:40:00.000Z'),
    updatedAt: new Date('2026-06-10T10:40:00.000Z'),
    ...overrides,
  };
}

describe('assistant governance endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.assistantsRepository.getExecutionPolicy.mockResolvedValue(executionPolicyFixture());
    mocks.assistantsRepository.countPendingApprovals.mockResolvedValue(0);
    mocks.assistantsRepository.getActivePublication.mockResolvedValue(null);
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

  it('creates, lists and approves approval requests', async () => {
    mocks.assistantsRepository.findById.mockResolvedValue(assistantFixture('draft'));
    mocks.assistantsRepository.resolveVersion.mockResolvedValue(versionFixture('draft'));
    mocks.assistantsRepository.createApproval.mockResolvedValueOnce(approvalFixture('pending', 'publish'));
    mocks.assistantsRepository.listApprovals.mockResolvedValueOnce([approvalFixture('pending', 'publish')]);
    mocks.assistantsRepository.findApproval.mockResolvedValueOnce(approvalFixture('pending', 'publish'));
    mocks.assistantsRepository.decideApproval.mockResolvedValueOnce(approvalFixture('approved', 'publish'));

    await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/approvals`)
      .set('Cookie', [sessionCookie()])
      .send({ action: 'publish', assistantVersionId: versionId, reason: 'Approve publication.' })
      .expect(201);

    const listResponse = await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/approvals`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(listResponse.body.data[0].status).toBe('pending');

    const approveResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/approvals/${approvalId}/approve`)
      .set('Cookie', [sessionCookie()])
      .send({ decisionReason: 'Ready to publish.' })
      .expect(200);

    expect(approveResponse.body.data.status).toBe('approved');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_approval_requested' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_approval_approved' }));
  });

  it('rejects and cancels pending approval requests', async () => {
    mocks.assistantsRepository.findById.mockResolvedValue(assistantFixture('draft'));
    mocks.assistantsRepository.findApproval.mockResolvedValueOnce(approvalFixture('pending', 'publish'));
    mocks.assistantsRepository.decideApproval.mockResolvedValueOnce(approvalFixture('rejected', 'publish'));
    mocks.assistantsRepository.findApproval.mockResolvedValueOnce(approvalFixture('pending', 'restore'));
    mocks.assistantsRepository.cancelApproval.mockResolvedValueOnce(approvalFixture('cancelled', 'restore'));

    const rejectResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/approvals/${approvalId}/reject`)
      .set('Cookie', [sessionCookie()])
      .send({ decisionReason: 'Needs more testing.' })
      .expect(200);

    expect(rejectResponse.body.data.status).toBe('rejected');

    const cancelResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/approvals/${approvalId}/cancel`)
      .set('Cookie', [sessionCookie()])
      .send({ decisionReason: 'Request superseded.' })
      .expect(200);

    expect(cancelResponse.body.data.status).toBe('cancelled');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_approval_rejected' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_approval_cancelled' }));
  });

  it('does not approve or reject non-pending approval requests', async () => {
    mocks.assistantsRepository.findById.mockResolvedValue(assistantFixture('draft'));
    mocks.assistantsRepository.findApproval.mockResolvedValueOnce(approvalFixture('approved', 'publish'));

    const approveResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/approvals/${approvalId}/approve`)
      .set('Cookie', [sessionCookie()])
      .send({})
      .expect(409);

    expect(approveResponse.body.code).toBe('APPROVAL_ALREADY_DECIDED');

    mocks.assistantsRepository.findApproval.mockResolvedValueOnce(approvalFixture('cancelled', 'publish'));
    const rejectResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/approvals/${approvalId}/reject`)
      .set('Cookie', [sessionCookie()])
      .send({})
      .expect(409);

    expect(rejectResponse.body.code).toBe('APPROVAL_ALREADY_DECIDED');
    expect(mocks.assistantsRepository.decideApproval).not.toHaveBeenCalled();
  });

  it('blocks approval requests when permission is missing', async () => {
    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/approvals`)
      .set('Cookie', [sessionCookie({ ...testUser, permissions: ['assistants.read'] })])
      .send({ action: 'publish' })
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN');
    expect(mocks.assistantsRepository.createApproval).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'permission_denied' }));
  });

  it('blocks publish when approval is required and absent', async () => {
    mocks.assistantsRepository.findById.mockResolvedValueOnce(assistantFixture('draft'));
    mocks.assistantsRepository.getExecutionPolicy.mockResolvedValueOnce(executionPolicyFixture({ requiresApprovalToPublish: true }));

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/publish`)
      .set('Cookie', [sessionCookie()])
      .send({ versionId })
      .expect(409);

    expect(response.body.code).toBe('APPROVAL_REQUIRED');
    expect(mocks.assistantsRepository.publish).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_publish_blocked_by_approval' }));
  });

  it('reads and updates execution policy', async () => {
    mocks.assistantsRepository.findById.mockResolvedValue(assistantFixture('draft'));
    mocks.assistantsRepository.getExecutionPolicy.mockResolvedValueOnce(executionPolicyFixture());
    mocks.assistantsRepository.updateExecutionPolicy.mockResolvedValueOnce(executionPolicyFixture({
      requiresApprovalToPublish: true,
      sandboxCostLimitPlaceholder: decimal,
    }));

    const getResponse = await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/execution-policy`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(getResponse.body.data.executionMode).toBe('draft_test');

    const patchResponse = await request(createApp())
      .patch(`/api/v1/assistants/${assistantId}/execution-policy`)
      .set('Cookie', [sessionCookie()])
      .send({
        requiresApprovalToPublish: true,
        sandboxEnabled: true,
        sandboxBlocksExternalTools: true,
        sandboxBlocksRealProviders: true,
        sandboxLogsRequired: true,
        sandboxCostLimitPlaceholder: 25,
      })
      .expect(200);

    expect(patchResponse.body.data.requiresApprovalToPublish).toBe(true);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_execution_policy_updated' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_sandbox_policy_updated' }));
  });

  it('allows read-only policy access but rejects policy updates without configure permission', async () => {
    mocks.assistantsRepository.findById.mockResolvedValue(assistantFixture('draft'));

    const readOnlyUser = {
      ...testUser,
      permissions: ['assistants.read'],
    };

    const getResponse = await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/execution-policy`)
      .set('Cookie', [sessionCookie(readOnlyUser)])
      .expect(200);

    expect(getResponse.body.data.executionMode).toBe('draft_test');

    const patchResponse = await request(createApp())
      .patch(`/api/v1/assistants/${assistantId}/execution-policy`)
      .set('Cookie', [sessionCookie(readOnlyUser)])
      .send({
        allowExternalLlmProviders: true,
        allowedLlmProviders: ['openai'],
        defaultLlmProvider: 'openai',
      })
      .expect(403);

    expect(patchResponse.body.code).toBe('FORBIDDEN');
    expect(mocks.assistantsRepository.updateExecutionPolicy).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'permission_denied',
      metadata: expect.objectContaining({
        permission: 'assistants.execution.configure',
      }),
    }));
  });

  it('updates OpenAI opt-in policy with sanitized audit metadata', async () => {
    mocks.assistantsRepository.findById.mockResolvedValue(assistantFixture('draft'));
    mocks.assistantsRepository.getExecutionPolicy.mockResolvedValueOnce(executionPolicyFixture());
    mocks.assistantsRepository.updateExecutionPolicy.mockResolvedValueOnce(executionPolicyFixture({
      allowExternalLlmProviders: true,
      allowedLlmProviders: ['openai'],
      defaultLlmProvider: 'openai',
    }));

    const response = await request(createApp())
      .patch(`/api/v1/assistants/${assistantId}/execution-policy`)
      .set('Cookie', [sessionCookie()])
      .send({
        allowExternalLlmProviders: true,
        allowedLlmProviders: ['openai'],
        defaultLlmProvider: 'openai',
      })
      .expect(200);

    expect(response.body.data.allowExternalLlmProviders).toBe(true);
    expect(response.body.data.allowedLlmProviders).toEqual(['openai']);
    expect(response.body.data.defaultLlmProvider).toBe('openai');
    expect(mocks.assistantsRepository.updateExecutionPolicy).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        allowExternalLlmProviders: true,
        allowedLlmProviders: ['openai'],
        defaultLlmProvider: 'openai',
      }),
      updatedById: userId,
    }));

    const auditCall = mocks.recordAuditEvent.mock.calls.find(
      ([input]) => input.action === 'assistant_execution_policy_updated',
    )?.[0];
    expect(auditCall).toEqual(expect.objectContaining({
      metadata: expect.objectContaining({
        assistantId,
        allowExternalLlmProviders: true,
        defaultLlmProvider: 'openai',
      }),
    }));
    expect(JSON.stringify(auditCall).toLowerCase()).not.toContain('api_key');
    expect(JSON.stringify(auditCall).toLowerCase()).not.toContain('authorization');
    expect(JSON.stringify(auditCall).toLowerCase()).not.toContain('prompt');
    expect(JSON.stringify(auditCall).toLowerCase()).not.toContain('output');
  });

  it('requires execution enable permission separately from policy configure permission', async () => {
    mocks.assistantsRepository.findById.mockResolvedValue(assistantFixture('draft'));

    const configureOnlyUser = {
      ...testUser,
      permissions: ['assistants.read', 'assistants.execution.configure'],
    };

    const response = await request(createApp())
      .patch(`/api/v1/assistants/${assistantId}/execution-policy`)
      .set('Cookie', [sessionCookie(configureOnlyUser)])
      .send({ isExecutionEnabled: true })
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN');
    expect(mocks.assistantsRepository.updateExecutionPolicy).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'permission_denied',
      metadata: expect.objectContaining({ policy: 'canEnableExecution' }),
    }));
  });

  it('prechecks execution without running AI', async () => {
    mocks.assistantsRepository.findById.mockResolvedValueOnce(assistantFixture('archived'));
    mocks.assistantsRepository.getExecutionPolicy.mockResolvedValueOnce(executionPolicyFixture());
    mocks.assistantsRepository.getActivePublication.mockResolvedValueOnce(null);

    const archivedResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/execution-precheck`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'published' })
      .expect(200);

    expect(archivedResponse.body.canExecute).toBe(false);
    expect(archivedResponse.body.reasons.some((reason: { code: string }) => reason.code === 'ASSISTANT_ARCHIVED')).toBe(true);

    mocks.assistantsRepository.findById.mockResolvedValueOnce(assistantFixture('published'));
    mocks.assistantsRepository.getExecutionPolicy.mockResolvedValueOnce(executionPolicyFixture({
      allowPublishedExecution: true,
      isExecutionEnabled: true,
    }));
    mocks.assistantsRepository.getActivePublication.mockResolvedValueOnce(null);

    const noPublicationResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/execution-precheck`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'published' })
      .expect(200);

    expect(noPublicationResponse.body.canExecute).toBe(false);
    expect(noPublicationResponse.body.reasons.some((reason: { code: string }) => reason.code === 'NO_ACTIVE_PUBLICATION')).toBe(true);

    mocks.assistantsRepository.findById.mockResolvedValueOnce(assistantFixture('draft'));
    mocks.assistantsRepository.getExecutionPolicy.mockResolvedValueOnce(executionPolicyFixture());
    mocks.assistantsRepository.getActivePublication.mockResolvedValueOnce(null);

    const sandboxResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/execution-precheck`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'sandbox' })
      .expect(200);

    expect(sandboxResponse.body.canExecute).toBe(true);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'assistant_execution_blocked' }));
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

describe('assistant model catalog governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.llmCapabilities.mockResolvedValue({
      provider: 'openai',
      status: 'healthy',
      enabled: true,
      configured: true,
      executionEnabled: false,
      supportsChatCompletion: true,
      supportsStreaming: false,
      supportsToolCalling: false,
      supportsStructuredOutput: false,
      supportsEmbeddings: false,
      supportsRagContext: true,
      supportsMcpContext: true,
      secretsConfigured: true,
      models: ['gpt-4o-mini'],
      defaultModel: 'gpt-4o-mini',
      maxInputPreviewChars: 500,
      maxOutputPreviewChars: 800,
    });

    mocks.assistantsRepository.findById.mockResolvedValue(assistantFixture());
    mocks.assistantsRepository.create.mockResolvedValue(assistantFixture());
    mocks.assistantsRepository.createVersion.mockResolvedValue(
      versionFixture(),
    );
  });

  it('lists only the sanitized real Assistant model catalog without llm.providers.read', async () => {
    const creator: AuthenticatedUser = {
      ...testUser,
      permissions: ['assistants.create'],
    };

    const response = await request(createApp())
      .get('/api/v1/assistants/model-catalog')
      .set('Cookie', sessionCookie(creator));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        label: 'GPT-4o Mini',
        isDefault: true,
      },
    ]);

    expect(JSON.stringify(response.body)).not.toMatch(
      /secret|apiKey|health|executionEnabled|baseUrl/i,
    );
  });

  it.each([
    'assistants.read',
    'assistants.update',
  ])(
    'allows the sanitized model catalog with %s and without llm.providers.read',
    async (permission) => {
      const user: AuthenticatedUser = {
        ...testUser,
        permissions: [permission],
      };

      const response = await request(createApp())
        .get('/api/v1/assistants/model-catalog')
        .set('Cookie', sessionCookie(user));

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          label: 'GPT-4o Mini',
          isDefault: true,
        },
      ]);
    },
  );

  it('blocks model catalog for authenticated users outside the Assistant domain', async () => {
    const user: AuthenticatedUser = {
      ...testUser,
      permissions: [],
    };

    const response = await request(createApp())
      .get('/api/v1/assistants/model-catalog')
      .set('Cookie', sessionCookie(user));

    expect(response.status).toBe(403);
    expect(response.body.error?.code ?? response.body.code).toBe(
      'ASSISTANT_MODEL_CATALOG_FORBIDDEN',
    );
  });

  it('accepts the real configured GPT-4o Mini when creating an Assistant', async () => {
    const response = await request(createApp())
      .post('/api/v1/assistants')
      .set('Cookie', sessionCookie())
      .send({
        workspaceId,
        name: 'Corporate Readonly Assistant',
        status: 'draft',
        version: {
          displayName: 'Initial draft',
          modelProvider: 'openai',
          modelName: 'gpt-4o-mini',
          temperature: 0.3,
        },
      });

    expect(response.status).toBe(201);
    expect(mocks.assistantsRepository.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an OpenAI model that is not available in the real catalog', async () => {
    const response = await request(createApp())
      .post('/api/v1/assistants')
      .set('Cookie', sessionCookie())
      .send({
        workspaceId,
        name: 'Invalid Model Assistant',
        status: 'draft',
        version: {
          displayName: 'Initial draft',
          modelProvider: 'openai',
          modelName: 'gpt-4o',
        },
      });

    expect(response.status).toBe(422);
    expect(response.body.error?.code ?? response.body.code).toBe(
      'MODEL_NOT_AVAILABLE',
    );
    expect(mocks.assistantsRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an unsupported provider', async () => {
    const response = await request(createApp())
      .post('/api/v1/assistants')
      .set('Cookie', sessionCookie())
      .send({
        workspaceId,
        name: 'Invalid Provider Assistant',
        status: 'draft',
        version: {
          displayName: 'Initial draft',
          modelProvider: 'anthropic',
          modelName: 'claude-3.5-sonnet',
        },
      });

    expect(response.status).toBe(422);
    expect(response.body.error?.code ?? response.body.code).toBe(
      'MODEL_PROVIDER_NOT_AVAILABLE',
    );
    expect(mocks.assistantsRepository.create).not.toHaveBeenCalled();
  });

  it('rejects incomplete provider/model configuration', async () => {
    const response = await request(createApp())
      .post('/api/v1/assistants')
      .set('Cookie', sessionCookie())
      .send({
        workspaceId,
        name: 'Incomplete Model Assistant',
        status: 'draft',
        version: {
          displayName: 'Initial draft',
          modelProvider: 'openai',
        },
      });

    expect(response.status).toBe(422);
    expect(response.body.error?.code ?? response.body.code).toBe(
      'MODEL_CONFIGURATION_INCOMPLETE',
    );
    expect(mocks.assistantsRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an unavailable model before creating a new Assistant version', async () => {
    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/versions`)
      .set('Cookie', sessionCookie())
      .send({
        displayName: 'Invalid model version',
        modelProvider: 'openai',
        modelName: 'gpt-4o',
      });

    expect(response.status).toBe(422);
    expect(response.body.error?.code ?? response.body.code).toBe(
      'MODEL_NOT_AVAILABLE',
    );
    expect(mocks.assistantsRepository.createVersion).not.toHaveBeenCalled();
  });
});
