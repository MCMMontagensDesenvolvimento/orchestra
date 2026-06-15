import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => {
  const agentRunsRepository = {
    findAssistantForRun: vi.fn(),
    getExecutionPolicy: vi.fn(),
    countPendingApprovals: vi.fn(),
    getRuntimeContextSummary: vi.fn(),
    createRun: vi.fn(),
    appendEvents: vi.fn(),
    updateRun: vi.fn(),
    listByAssistant: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    listEvents: vi.fn(),
  };

  return {
    agentRunsRepository,
    recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../src/modules/agent-runs/agent-runs.repository', () => ({
  agentRunsRepository: mocks.agentRunsRepository,
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
const runId = '00000000-0000-0000-0000-000000000401';

const agentRunPermissions = [
  'assistants.read',
  'agent_runs.read',
  'agent_runs.create',
  'agent_runs.cancel',
  'agent_runs.audit',
  'execution.precheck',
  'execution.run_sandbox',
  'execution.run_published',
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
  permissions: agentRunPermissions,
};

function sessionCookie(user: AuthenticatedUser = testUser) {
  const token = signSession({ sub: user.id, user });
  return `${env.COOKIE_NAME}=${token}`;
}

function assistantFixture(status = 'draft') {
  return {
    id: assistantId,
    tenantId,
    workspaceId,
    name: 'Runtime Governed Assistant',
    description: 'Assistant under runtime governance tests.',
    status,
    createdById: userId,
    createdAt: new Date('2026-06-11T10:00:00.000Z'),
    updatedAt: new Date('2026-06-11T10:00:00.000Z'),
    deletedAt: null,
    versions: [versionFixture(status === 'published' ? 'published' : 'draft')],
    publications: status === 'published' ? [publicationFixture()] : [],
    executionPolicy: null,
  };
}

function versionFixture(status = 'draft') {
  return {
    id: versionId,
    assistantId,
    version: '0.3.0',
    status,
    displayName: 'Runtime governed version',
    description: null,
    instructions: 'Controlled test instructions.',
    modelProvider: 'none',
    modelName: 'not-configured',
    temperature: { toNumber: () => 0.2, toString: () => '0.2' },
    configuration: null,
    createdById: userId,
    createdAt: new Date('2026-06-11T10:00:00.000Z'),
    publishedAt: status === 'published' ? new Date('2026-06-11T10:10:00.000Z') : null,
    archivedAt: null,
  };
}

function publicationFixture() {
  return {
    id: publicationId,
    tenantId,
    workspaceId,
    assistantId,
    assistantVersionId: versionId,
    status: 'active',
    publishedById: userId,
    publishedAt: new Date('2026-06-11T10:10:00.000Z'),
    unpublishedById: null,
    unpublishedAt: null,
    rollbackFromPublicationId: null,
    rollbackReason: null,
    createdAt: new Date('2026-06-11T10:10:00.000Z'),
    updatedAt: new Date('2026-06-11T10:10:00.000Z'),
  };
}

function executionPolicyFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000701',
    tenantId,
    workspaceId,
    assistantId,
    executionMode: 'sandbox',
    requiresApprovalToPublish: false,
    sandboxEnabled: true,
    sandboxRequiresAuth: true,
    sandboxAllowedForRoles: ['admin_platform'],
    sandboxBlocksExternalTools: true,
    sandboxBlocksRealProviders: true,
    sandboxLogsRequired: true,
    sandboxCostLimitPlaceholder: null,
    allowDraftTesting: true,
    allowPublishedExecution: true,
    isExecutionEnabled: true,
    updatedById: userId,
    createdAt: new Date('2026-06-11T10:40:00.000Z'),
    updatedAt: new Date('2026-06-11T10:40:00.000Z'),
    ...overrides,
  };
}

function eventFixture(type = 'run.completed', sequence = 1, status = 'completed') {
  return {
    id: `00000000-0000-0000-0000-00000000050${sequence}`,
    agentRunId: runId,
    tenantId,
    workspaceId,
    type,
    sequence,
    status,
    message: 'Event recorded.',
    metadata: { traceId: 'trace_test' },
    createdAt: new Date('2026-06-11T11:00:00.000Z'),
  };
}

function runFixture(overrides: Record<string, unknown> = {}) {
  const createdAt = new Date('2026-06-11T11:00:00.000Z');
  return {
    id: runId,
    tenantId,
    workspaceId,
    assistantId,
    assistantVersionId: versionId,
    assistantPublicationId: null,
    conversationId: null,
    requestedById: userId,
    status: 'completed',
    mode: 'sandbox',
    source: 'api',
    inputSummary: 'Execute a controlled test.',
    requestId: 'req_test',
    traceId: 'trace_test',
    startedAt: createdAt,
    completedAt: createdAt,
    failedAt: null,
    cancelledAt: null,
    blockedAt: null,
    errorCode: null,
    errorMessage: null,
    precheckSnapshot: { canExecute: true, mode: 'sandbox', reasons: [], requestId: 'req_test' },
    metadata: null,
    createdAt,
    updatedAt: createdAt,
    events: [eventFixture('run.completed', 1, 'completed')],
    ...overrides,
  };
}

function eventInputsToFixtures(events: Array<{ type: string; status?: string; message?: string; metadata?: unknown }>) {
  return events.map((event, index) => ({
    ...eventFixture(event.type, index + 1, event.status ?? 'queued'),
    message: event.message ?? null,
    metadata: event.metadata ?? null,
  }));
}

describe('agent run governance endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.agentRunsRepository.findAssistantForRun.mockResolvedValue(assistantFixture('draft'));
    mocks.agentRunsRepository.getExecutionPolicy.mockResolvedValue(executionPolicyFixture());
    mocks.agentRunsRepository.countPendingApprovals.mockResolvedValue(0);
    mocks.agentRunsRepository.getRuntimeContextSummary.mockResolvedValue({
      knowledgeBindingsCount: 1,
      chunkCount: 2,
      sourceReferenceCount: 2,
      lastRagQuery: { id: '00000000-0000-0000-0000-000000000931', status: 'completed', resultCount: 1 },
      sourceReferences: [
        {
          id: '00000000-0000-0000-0000-000000000932',
          label: 'Fonte 1',
          sourceUri: 'manual://runtime-test',
          document: { title: 'Runtime test document' },
          chunk: { content: 'Runtime test governed excerpt.' },
        },
      ],
      mcpBindings: [
        {
          id: '00000000-0000-0000-0000-000000000933',
          mode: 'sandbox_only',
          tool: {
            id: '00000000-0000-0000-0000-000000000934',
            name: 'runtime.lookup',
            riskLevel: 'low',
            requiresApproval: false,
            isEnabled: true,
            deletedAt: null,
          },
          server: {
            id: '00000000-0000-0000-0000-000000000935',
            name: 'Runtime MCP',
            status: 'active',
            deletedAt: null,
          },
        },
      ],
      lastToolCallIds: ['00000000-0000-0000-0000-000000000936'],
    });
    mocks.agentRunsRepository.createRun.mockImplementation(async (input) =>
      runFixture({
        id: input.id ?? runId,
        status: input.status,
        mode: input.mode,
        source: input.source,
        assistantVersionId: input.assistantVersionId ?? null,
        assistantPublicationId: input.assistantPublicationId ?? null,
        requestedById: input.requestedById,
        inputSummary: input.inputSummary,
        requestId: input.requestId,
        traceId: input.traceId,
        startedAt: input.startedAt ?? null,
        completedAt: input.completedAt ?? null,
        failedAt: input.failedAt ?? null,
        cancelledAt: input.cancelledAt ?? null,
        blockedAt: input.blockedAt ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        precheckSnapshot: input.precheckSnapshot,
        metadata: input.metadata ?? null,
        events: eventInputsToFixtures(input.events),
      }),
    );
    mocks.agentRunsRepository.listByAssistant.mockResolvedValue({ data: [runFixture()], total: 1 });
    mocks.agentRunsRepository.list.mockResolvedValue({ data: [runFixture()], total: 1 });
    mocks.agentRunsRepository.findById.mockResolvedValue(runFixture());
    mocks.agentRunsRepository.listEvents.mockResolvedValue([eventFixture('run.requested', 1, 'queued'), eventFixture('run.completed', 2, 'completed')]);
    mocks.agentRunsRepository.updateRun.mockResolvedValue(runFixture({ status: 'cancelled', cancelledAt: new Date('2026-06-11T11:05:00.000Z') }));
    mocks.agentRunsRepository.appendEvents.mockResolvedValue([eventFixture('run.cancelled', 2, 'cancelled')]);
  });

  it('creates a sandbox run through the local runtime adapter boundary', async () => {
    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie()])
      .send({
        mode: 'sandbox',
        input: 'Execute a controlled test.',
        source: 'api-test',
        metadata: { prompt: 'do not store', ui: { token: 'secret', label: 'detail' } },
      })
      .expect(201);

    expect(response.body.data.status).toBe('completed');
    expect(response.body.data.events.map((event: { type: string }) => event.type)).toContain('runtime.run_completed');
    expect(response.body.data.metadata.runtime.provider).toBe('local');
    expect(response.body.data.metadata.runtime.rag.chunkCount).toBe(2);
    expect(mocks.agentRunsRepository.createRun).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        prompt: '[redacted]',
        ui: expect.objectContaining({ token: '[redacted]', label: 'detail' }),
        runtime: expect.objectContaining({
          provider: 'local',
          status: 'completed',
        }),
      }),
    }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'runtime_adapter_resolved' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'runtime_execution_completed' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'agent_run_completed' }));
  });

  it('creates a blocked run when precheck rejects execution', async () => {
    mocks.agentRunsRepository.getExecutionPolicy.mockResolvedValueOnce(executionPolicyFixture({ sandboxEnabled: false }));

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'sandbox', input: 'Try to run while sandbox is disabled.' })
      .expect(201);

    expect(response.body.data.status).toBe('blocked');
    expect(response.body.data.errorCode).toBe('SANDBOX_DISABLED');
    expect(response.body.data.precheckSnapshot.canExecute).toBe(false);
    expect(mocks.agentRunsRepository.getRuntimeContextSummary).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'runtime_execution_blocked' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'agent_run_blocked' }));
  });

  it('records published mode as blocked when there is no active publication', async () => {
    mocks.agentRunsRepository.findAssistantForRun.mockResolvedValueOnce(assistantFixture('draft'));

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'published', input: 'Run the published version.' })
      .expect(201);

    expect(response.body.data.status).toBe('blocked');
    expect(response.body.data.precheckSnapshot.reasons.map((reason: { code: string }) => reason.code)).toContain('ASSISTANT_NOT_PUBLISHED');
  });

  it('lists runs for an assistant with pagination metadata', async () => {
    const response = await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/runs?page=1&perPage=10`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.total).toBe(1);
    expect(mocks.agentRunsRepository.listByAssistant).toHaveBeenCalled();
  });

  it('lists runs across accessible workspaces', async () => {
    const response = await request(createApp())
      .get('/api/v1/agent-runs?status=completed')
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].status).toBe('completed');
    expect(mocks.agentRunsRepository.list).toHaveBeenCalled();
  });

  it('returns run detail and events', async () => {
    const detailResponse = await request(createApp())
      .get(`/api/v1/agent-runs/${runId}`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const eventsResponse = await request(createApp())
      .get(`/api/v1/agent-runs/${runId}/events`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(detailResponse.body.data.id).toBe(runId);
    expect(eventsResponse.body.data.map((event: { type: string }) => event.type)).toEqual(['run.requested', 'run.completed']);
  });

  it('cancels a cancellable run', async () => {
    mocks.agentRunsRepository.findById
      .mockResolvedValueOnce(runFixture({ status: 'running', completedAt: null }))
      .mockResolvedValueOnce(runFixture({ status: 'cancelled', completedAt: null, cancelledAt: new Date('2026-06-11T11:05:00.000Z') }));

    const response = await request(createApp())
      .post(`/api/v1/agent-runs/${runId}/cancel`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data.status).toBe('cancelled');
    expect(mocks.agentRunsRepository.updateRun).toHaveBeenCalledWith(runId, expect.objectContaining({ status: 'cancelled' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'agent_run_cancelled' }));
  });

  it('rejects cancellation once the run is terminal', async () => {
    mocks.agentRunsRepository.findById.mockResolvedValueOnce(runFixture({ status: 'completed' }));

    const response = await request(createApp())
      .post(`/api/v1/agent-runs/${runId}/cancel`)
      .set('Cookie', [sessionCookie()])
      .expect(409);

    expect(response.body.code).toBe('RUN_NOT_CANCELLABLE');
  });

  it('protects create, validates payloads and returns structured 404', async () => {
    await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .send({ mode: 'sandbox', input: 'No session.' })
      .expect(401);

    await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie({ ...testUser, permissions: ['assistants.read'] })])
      .send({ mode: 'sandbox', input: 'No permission.' })
      .expect(403);

    await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'sandbox', input: '' })
      .expect(422);

    mocks.agentRunsRepository.findById.mockResolvedValueOnce(null);
    const response = await request(createApp())
      .get(`/api/v1/agent-runs/${runId}`)
      .set('Cookie', [sessionCookie()])
      .expect(404);

    expect(response.body.code).toBe('AGENT_RUN_NOT_FOUND');
  });
});
