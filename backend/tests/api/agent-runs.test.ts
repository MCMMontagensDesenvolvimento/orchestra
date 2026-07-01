import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { llmService } from '../../src/modules/llm/llm.service';
import {
  assistantRuntimeSpecVersionV1,
  runtimeExecuteRequestV1Schema,
  runtimeExecuteResponseSpecVersionV1,
} from '../../src/modules/runtime';
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

const originalRuntimeEnv = {
  RUNTIME_PROVIDER: env.RUNTIME_PROVIDER,
  RUNTIME_ADAPTER_ENABLED: env.RUNTIME_ADAPTER_ENABLED,
  AGNO_RUNTIME_HTTP_ENABLED: env.AGNO_RUNTIME_HTTP_ENABLED,
  AGNO_RUNTIME_HTTP_BASE_URL: env.AGNO_RUNTIME_HTTP_BASE_URL,
  AGNO_RUNTIME_HTTP_SECURITY_KEY: env.AGNO_RUNTIME_HTTP_SECURITY_KEY,
  AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED: env.AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED,
  AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES: env.AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES,
  AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS: env.AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS,
  AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS: env.AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS,
};

function configureRuntime(overrides: Partial<typeof originalRuntimeEnv> = {}) {
  Object.assign(env, {
    ...originalRuntimeEnv,
    RUNTIME_PROVIDER: 'local',
    RUNTIME_ADAPTER_ENABLED: true,
    AGNO_RUNTIME_HTTP_ENABLED: false,
    AGNO_RUNTIME_HTTP_BASE_URL: undefined,
    AGNO_RUNTIME_HTTP_SECURITY_KEY: undefined,
    AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED: false,
    AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES: 5,
    AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS: 1200,
    AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS: 6000,
    ...overrides,
  });
}

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
    allowExternalLlmProviders: false,
    allowedLlmProviders: [],
    defaultLlmProvider: null,
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
    vi.unstubAllGlobals();
    configureRuntime();
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
          documentId: '00000000-0000-0000-0000-000000000942',
          chunkId: '00000000-0000-0000-0000-000000000943',
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

  afterAll(() => {
    configureRuntime(originalRuntimeEnv);
    vi.unstubAllGlobals();
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
    expect(response.body.data.metadata.runtime.adapterMetadata).toEqual(expect.objectContaining({
      llmProvider: 'local_deterministic',
      externalProviderCalled: false,
      llmSelectionReason: 'sandbox_blocks_real_providers',
    }));
    expect(response.body.data.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'llm.provider_selected',
        metadata: expect.objectContaining({
          llmProvider: 'local_deterministic',
          externalProviderCalled: false,
          reason: 'sandbox_blocks_real_providers',
        }),
      }),
    ]));
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

  it('routes an authorized AgentRun through agno_http and returns only sanitized runtime output', async () => {
    configureRuntime({
      RUNTIME_PROVIDER: 'agno_http',
      AGNO_RUNTIME_HTTP_ENABLED: true,
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
      AGNO_RUNTIME_HTTP_SECURITY_KEY: 'runtime-test-security-key',
    });
    const assistant = assistantFixture('draft');
    assistant.versions[0].modelProvider = 'governed-provider';
    assistant.versions[0].modelName = 'governed-chat-model';
    mocks.agentRunsRepository.findAssistantForRun.mockResolvedValueOnce(assistant);
    const calls: Array<{ url: string; init?: RequestInit; body?: unknown }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined;
      calls.push({ url, init, body });
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify(runtimeHealthResponse()), { status: 200 });
      }
      return new Response(JSON.stringify(runtimeExecuteResponse(body)), { status: 200 });
    }));

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'sandbox', input: 'Use the governed HTTP runtime.', source: 'api-test' })
      .expect(201);

    const executeCall = calls.find((call) => call.url.endsWith('/execute'));
    expect(executeCall).toBeDefined();
    const parsedRequest = runtimeExecuteRequestV1Schema.parse(executeCall?.body);
    expect(parsedRequest.assistantRuntimeSpec.model).toEqual(expect.objectContaining({
      provider: 'governed-provider',
      model: 'governed-chat-model',
    }));
    expect(parsedRequest.assistantRuntimeSpec.rag).toEqual({ enabled: false, mode: 'none', sources: [] });
    expect(parsedRequest.assistantRuntimeSpec.tools).toEqual({ enabled: false, mode: 'none', descriptors: [] });
    expect(executeCall?.init?.headers).toEqual(expect.objectContaining({
      Authorization: 'Bearer runtime-test-security-key',
    }));
    expect(JSON.stringify(executeCall?.body)).not.toMatch(/runtime-test-security-key|Authorization|baseUrl|headers/i);
    expect(response.body.data.status).toBe('completed');
    expect(response.body.data.metadata.runtime).toEqual(expect.objectContaining({
      provider: 'agno_http',
      outputPreview: 'Runtime HTTP response through the Orchestra control plane.',
      adapterMetadata: expect.objectContaining({
        responseStatus: 'succeeded',
        usage: expect.objectContaining({ totalTokens: 10 }),
      }),
    }));
    expect(response.body.data.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'agno.request_completed' }),
      expect.objectContaining({ type: 'runtime.run_completed' }),
    ]));
    expect(JSON.stringify(response.body)).not.toMatch(/runtime-test-security-key|127\.0\.0\.1:8091|Authorization|baseUrl|headers/i);
  });

  it('sends governed RAG resolved_context through AgentRun when explicitly enabled', async () => {
    configureRuntime({
      RUNTIME_PROVIDER: 'agno_http',
      AGNO_RUNTIME_HTTP_ENABLED: true,
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
      AGNO_RUNTIME_HTTP_SECURITY_KEY: 'runtime-test-security-key',
      AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED: true,
      AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES: 2,
      AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS: 24,
      AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS: 48,
    });
    mocks.agentRunsRepository.getRuntimeContextSummary.mockResolvedValueOnce({
      knowledgeBindingsCount: 1,
      chunkCount: 2,
      sourceReferenceCount: 2,
      lastRagQuery: { id: '00000000-0000-0000-0000-000000000951', status: 'completed', resultCount: 2 },
      sourceReferences: [
        {
          id: '00000000-0000-0000-0000-000000000952',
          label: 'Fonte segura',
          sourceUri: 'internal://must-not-leak',
          documentId: '00000000-0000-0000-0000-000000000953',
          chunkId: '00000000-0000-0000-0000-000000000954',
          document: { title: 'Governed Runtime Policy' },
          chunk: { content: 'Resolved governed context excerpt with more than twenty four chars.' },
        },
        {
          id: '00000000-0000-0000-0000-000000000955',
          label: 'Fonte insegura',
          sourceUri: 'internal://must-not-leak-unsafe',
          documentId: '00000000-0000-0000-0000-000000000956',
          chunkId: '00000000-0000-0000-0000-000000000957',
          document: { title: 'Unsafe Runtime Policy' },
          chunk: { content: 'Bearer must-not-leak' },
        },
      ],
      mcpBindings: [],
      lastToolCallIds: [],
    });
    const calls: Array<{ url: string; init?: RequestInit; body?: unknown }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined;
      calls.push({ url, init, body });
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify(runtimeHealthResponse()), { status: 200 });
      }
      return new Response(JSON.stringify(runtimeExecuteResponse(body)), { status: 200 });
    }));

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'sandbox', input: 'Use governed RAG context.', source: 'api-test' })
      .expect(201);

    const executeCall = calls.find((call) => call.url.endsWith('/execute'));
    const parsedRequest = runtimeExecuteRequestV1Schema.parse(executeCall?.body);
    expect(parsedRequest.assistantRuntimeSpec.rag.mode).toBe('resolved_context');
    expect(parsedRequest.assistantRuntimeSpec.rag.sources).toEqual([
      expect.objectContaining({
        sourceId: '00000000-0000-0000-0000-000000000952',
        documentId: '00000000-0000-0000-0000-000000000953',
        chunkId: '00000000-0000-0000-0000-000000000954',
        title: 'Governed Runtime Policy',
        excerpt: 'Resolved governed contex',
      }),
    ]);
    expect(parsedRequest.assistantRuntimeSpec.tools).toEqual({ enabled: false, mode: 'none', descriptors: [] });
    expect(executeCall?.init?.headers).toEqual(expect.objectContaining({
      Authorization: 'Bearer runtime-test-security-key',
    }));
    expect(response.body.data.status).toBe('completed');
    expect(response.body.data.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'runtime.rag_context_attached',
        metadata: expect.objectContaining({
          ragMode: 'resolved_context',
          ragSourceCount: 1,
          ragContextChars: 24,
        }),
      }),
    ]));
    expect(JSON.stringify(executeCall?.body)).not.toMatch(/must-not-leak|internal:\/\/|rawDocuments|rawPrompt|rawResponse|rawProviderResponse|headers|apiKey|token|secret|baseUrl|providerApiKey/i);
    expect(JSON.stringify(response.body)).not.toMatch(/runtime-test-security-key|must-not-leak|internal:\/\/|Authorization|headers|baseUrl|rawDocuments|rawPrompt|rawResponse|rawProviderResponse/i);
  });

  it('fails closed without an HTTP call when agno_http is selected but disabled', async () => {
    configureRuntime({
      RUNTIME_PROVIDER: 'agno_http',
      AGNO_RUNTIME_HTTP_ENABLED: false,
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'sandbox', input: 'Do not fall back to another runtime.' })
      .expect(201);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.body.data.status).toBe('failed');
    expect(response.body.data.errorCode).toBe('RUNTIME_UNAVAILABLE');
    expect(response.body.data.metadata.runtime.provider).toBe('agno_http');
  });

  it('persists a safe failure when the selected HTTP runtime is unavailable', async () => {
    configureRuntime({
      RUNTIME_PROVIDER: 'agno_http',
      AGNO_RUNTIME_HTTP_ENABLED: true,
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
    });
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('connection details must not escape');
    }));

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'sandbox', input: 'Fail closed on network errors.' })
      .expect(201);

    expect(response.body.data.status).toBe('failed');
    expect(response.body.data.errorCode).toBe('RUNTIME_UNAVAILABLE');
    expect(response.body.data.errorMessage).toBe('Agno HTTP runtime is unavailable.');
    expect(JSON.stringify(response.body)).not.toMatch(/connection details|127\.0\.0\.1:8091|baseUrl|stack/i);
  });

  it('fails closed when the HTTP runtime returns an invalid response', async () => {
    configureRuntime({
      RUNTIME_PROVIDER: 'agno_http',
      AGNO_RUNTIME_HTTP_ENABLED: true,
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
      url.endsWith('/health') ? runtimeHealthResponse() : { rawResponse: 'must not be persisted' },
    ), { status: 200 })));

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'sandbox', input: 'Reject an invalid runtime response.' })
      .expect(201);

    expect(response.body.data.status).toBe('failed');
    expect(response.body.data.errorCode).toBe('RUNTIME_INVALID_RESPONSE');
    expect(JSON.stringify(response.body)).not.toContain('must not be persisted');
  });

  it('maps a runtime policy block to a controlled blocked AgentRun', async () => {
    configureRuntime({
      RUNTIME_PROVIDER: 'agno_http',
      AGNO_RUNTIME_HTTP_ENABLED: true,
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify(runtimeHealthResponse()), { status: 200 });
      }
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined;
      return new Response(JSON.stringify(runtimeExecuteResponse(body, 'blocked')), { status: 403 });
    }));

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie()])
      .send({ mode: 'sandbox', input: 'Respect runtime policy.' })
      .expect(201);

    expect(response.body.data.status).toBe('blocked');
    expect(response.body.data.blockedAt).toBeTruthy();
    expect(response.body.data.errorCode).toBe('RUNTIME_POLICY_BLOCKED');
    expect(response.body.data.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'agno.request_failed', status: 'blocked' }),
      expect.objectContaining({ type: 'runtime.run_failed', status: 'blocked' }),
    ]));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'runtime_execution_blocked' }));
  });
  it('fails closed without an external call when OpenAI is allowed by policy but disabled globally', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(llmService, 'generateForRuntime').mockResolvedValueOnce({
      provider: 'openai',
      status: 'blocked',
      message: 'OpenAI provider is disabled by configuration.',
      model: 'gpt-4o-mini',
      inputHash: 'a'.repeat(64),
      latencyMs: 0,
      errorCode: 'LLM_PROVIDER_EXECUTION_BLOCKED',
      errorMessage: 'OpenAI provider is disabled by configuration.',
      metadata: {
        provider: 'openai',
        providerStatus: 'disabled',
        externalProviderCalled: false,
        failedClosed: true,
      },
    });
    mocks.agentRunsRepository.getExecutionPolicy.mockResolvedValueOnce(executionPolicyFixture({
      executionMode: 'draft_test',
      allowExternalLlmProviders: true,
      allowedLlmProviders: ['openai'],
      defaultLlmProvider: 'openai',
      allowDraftTesting: true,
    }));

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/runs`)
      .set('Cookie', [sessionCookie()])
      .send({
        mode: 'draft_test',
        input: 'Validate governed OpenAI fail-closed behavior.',
        source: 'api-test',
      })
      .expect(201);

    expect(response.body.data.status).toBe('blocked');
    expect(response.body.data.completedAt).toBeNull();
    expect(response.body.data.blockedAt).toBeTruthy();
    expect(response.body.data.metadata.runtime.adapterMetadata).toEqual(expect.objectContaining({
      llmProvider: 'openai',
      externalProviderCalled: false,
      llmSelectionReason: 'assistant_policy_opt_in',
      llm: expect.objectContaining({
        provider: 'openai',
        externalProviderCalled: false,
        failedClosed: true,
      }),
    }));
    expect(response.body.data.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'llm.generation_blocked',
        status: 'blocked',
        metadata: expect.objectContaining({
          llmProvider: 'openai',
          externalProviderCalled: false,
          reason: 'assistant_policy_opt_in',
        }),
      }),
    ]));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'runtime_execution_blocked' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'agent_run_blocked' }));
    expect(mocks.recordAuditEvent).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'agent_run_completed' }));
    expect(fetchSpy).not.toHaveBeenCalled();
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

function runtimeHealthResponse() {
  return {
    provider: 'agno',
    protocolVersion: assistantRuntimeSpecVersionV1,
    status: 'healthy',
    checkedAt: '2026-07-01T12:00:00.000Z',
    message: 'Runtime ready.',
  };
}

function runtimeExecuteResponse(
  requestBody: unknown,
  status: 'succeeded' | 'blocked' = 'succeeded',
) {
  const request = runtimeExecuteRequestV1Schema.parse(requestBody);
  const trace = request.assistantRuntimeSpec.trace;
  return {
    specVersion: runtimeExecuteResponseSpecVersionV1,
    trace: {
      traceId: trace.traceId,
      runId: trace.runId,
    },
    status,
    output: status === 'succeeded'
      ? {
        text: 'Runtime HTTP response through the Orchestra control plane.',
        format: 'text',
        metadata: { mode: 'sandbox', externalProviderCalled: false },
      }
      : undefined,
    usage: status === 'succeeded'
      ? { inputTokens: 3, outputTokens: 7, totalTokens: 10, latencyMs: 2 }
      : undefined,
    events: [
      ...(request.assistantRuntimeSpec.rag.sources.length > 0
        ? [{
          eventId: 'runtime-event-rag-1',
          traceId: trace.traceId,
          runId: trace.runId,
          type: 'rag.context.attached' as const,
          timestamp: '2026-07-01T12:00:00.000Z',
          status: 'completed' as const,
          metadata: {
            ragMode: request.assistantRuntimeSpec.rag.mode,
            ragSourceCount: request.assistantRuntimeSpec.rag.sources.length,
          },
        }]
        : []),
      {
        eventId: 'runtime-event-1',
        traceId: trace.traceId,
        runId: trace.runId,
        type: status === 'succeeded' ? 'run.completed' : 'run.failed',
        timestamp: '2026-07-01T12:00:00.000Z',
        status: status === 'succeeded' ? 'completed' : 'blocked',
        metadata: { mode: 'sandbox' },
      },
    ],
    error: status === 'blocked'
      ? {
        code: 'RUNTIME_POLICY_BLOCKED',
        message: 'Runtime policy blocked this execution.',
        retryable: false,
        httpStatus: 403,
      }
      : undefined,
  };
}
