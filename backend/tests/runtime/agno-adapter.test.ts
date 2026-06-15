import type { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeExecutionContext } from '../../src/modules/runtime/runtime.types';

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.resetModules();
}

async function agnoAdapter(overrides: Record<string, string | undefined>) {
  restoreEnv();
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://orchestra:orchestra@localhost:5432/orchestra',
    JWT_SECRET: 'test-secret',
    RUNTIME_PROVIDER: 'agno',
    RUNTIME_ADAPTER_ENABLED: 'true',
    RUNTIME_DEFAULT_TIMEOUT_MS: '15000',
    RUNTIME_REQUIRE_PRECHECK: 'true',
    RUNTIME_ALLOW_PROVIDER_FALLBACK: 'false',
    RUNTIME_ALLOW_EXTERNAL_TOOLS: 'false',
    AGNO_ENABLED: 'false',
    AGNO_EXECUTION_ENABLED: 'false',
    AGNO_BASE_URL: '',
    AGNO_API_KEY: '',
    AGNO_TIMEOUT_MS: '15000',
    AGNO_HEALTHCHECK_ENABLED: 'false',
    AGNO_HEALTH_PATH: '/health',
    AGNO_CAPABILITIES_PATH: '/capabilities',
    AGNO_EXECUTE_PATH: '/runs',
    AGNO_REQUIRE_SANDBOX: 'true',
    AGNO_ALLOW_EXTERNAL_TOOLS: 'false',
    AGNO_ALLOW_REMOTE_MCP: 'false',
    AGNO_SEND_RAG_CONTEXT: 'true',
    AGNO_SEND_MCP_TOOL_DESCRIPTORS: 'true',
    AGNO_MAX_INPUT_PREVIEW_CHARS: '500',
    AGNO_MAX_OUTPUT_PREVIEW_CHARS: '800',
    ...overrides,
  };
  vi.resetModules();
  const { AgnoRuntimeAdapter } = await import('../../src/modules/runtime/runtime.agno-adapter');
  return new AgnoRuntimeAdapter('agno');
}

function context(): RuntimeExecutionContext {
  return {
    requestId: 'req-1',
    traceId: 'trace-1',
    runId: 'run-1',
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    assistantId: 'assistant-1',
    assistantVersionId: 'version-1',
    assistantPublicationId: null,
    executionMode: 'sandbox',
    provider: 'agno',
    assistant: {
      id: 'assistant-1',
      name: 'Finance Assistant',
      status: 'testing',
      description: 'Controlled assistant',
      objective: 'Answer local checks',
    },
    compiledPrompt: {
      mode: 'placeholder',
      assistantVersionId: 'version-1',
      instructionChars: 42,
      instructionsPreview: 'Use only governed local context.',
      modelProvider: 'local',
      modelName: 'agno-compatible-mock',
      temperature: 0.2,
    },
    executionPolicySnapshot: {
      executionMode: 'sandbox',
      sandboxEnabled: true,
      sandboxBlocksExternalTools: true,
      sandboxBlocksRealProviders: true,
      sandboxLogsRequired: true,
      allowDraftTesting: true,
      allowPublishedExecution: false,
      isExecutionEnabled: true,
    } as Prisma.InputJsonValue,
    precheckSnapshot: {
      canExecute: true,
      mode: 'sandbox',
      reasons: [],
      requestId: 'req-1',
    },
    rag: {
      ragReady: true,
      knowledgeBindingsCount: 1,
      chunkCount: 2,
      sourceReferenceCount: 1,
      lastRagQueryId: 'rag-1',
      sourceReferences: [
        {
          id: 'source-1',
          label: '[1]',
          sourceUri: 'kb://source-1',
          documentTitle: 'Local Policy',
          excerpt: 'Governed excerpt for local runtime.',
        },
      ],
    },
    mcp: {
      mcpBindingsCount: 1,
      allowedSandboxTools: [
        {
          id: 'binding-1',
          serverId: 'server-1',
          toolId: 'tool-1',
          name: 'lookup_customer',
          riskLevel: 'low',
          requiresApproval: false,
          executionMode: 'sandbox_only',
        },
      ],
      blockedTools: [],
      requiresApproval: [],
      lastToolCallIds: [],
    },
    input: {
      hash: 'input-hash',
      preview: 'Summarize the governed local context.',
    },
  };
}

describe('AgnoRuntimeAdapter local HTTP integration', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('fails closed without HTTP when Agno is disabled', async () => {
    const adapter = await agnoAdapter({ AGNO_ENABLED: 'false', AGNO_EXECUTION_ENABLED: 'false' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await adapter.execute(context());

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('AGNO_ADAPTER_DISABLED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed without HTTP when Agno base URL is missing', async () => {
    const adapter = await agnoAdapter({ AGNO_ENABLED: 'true', AGNO_EXECUTION_ENABLED: 'true', AGNO_BASE_URL: '' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await adapter.execute(context());

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('AGNO_ADAPTER_MISCONFIGURED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('executes against a mocked Agno-compatible runtime and sends governed RAG/MCP context', async () => {
    const adapter = await agnoAdapter({
      AGNO_ENABLED: 'true',
      AGNO_EXECUTION_ENABLED: 'true',
      AGNO_BASE_URL: 'http://127.0.0.1:7777',
      AGNO_HEALTHCHECK_ENABLED: 'true',
    });
    const requests: Array<{ url: string; init?: RequestInit; body?: unknown }> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined;
      requests.push({ url, init, body });
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'healthy', provider: 'agno', version: 'mock' }), { status: 200 });
      }
      return new Response(JSON.stringify({
        status: 'completed',
        output: {
          preview: 'Resposta deterministica do runtime Agno local.',
        },
        events: [
          { type: 'model_started', status: 'running', message: 'Model started.' },
          { type: 'model_completed', status: 'completed', message: 'Model completed.' },
        ],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        metadata: { provider: 'agno', localRuntime: true },
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await adapter.execute(context());

    expect(result.status).toBe('completed');
    expect(result.outputPreview).toContain('Resposta deterministica');
    expect(requests.map((request) => request.url)).toEqual(['http://127.0.0.1:7777/health', 'http://127.0.0.1:7777/runs']);
    const runPayload = requests[1].body as Record<string, unknown>;
    expect(runPayload.input).toEqual(expect.objectContaining({ hash: 'input-hash' }));
    expect(runPayload.ragContext).toEqual(expect.objectContaining({ enabled: true }));
    expect(runPayload.mcpContext).toEqual(expect.objectContaining({ toolCallingEnabled: false }));
    expect(JSON.stringify(runPayload)).not.toContain('secret');
    expect(result.events.map((event) => event.type)).toEqual(expect.arrayContaining(['agno_request_started', 'agno_request_completed', 'run_completed']));
  });

  it('returns a controlled failure on timeout', async () => {
    const adapter = await agnoAdapter({
      AGNO_ENABLED: 'true',
      AGNO_EXECUTION_ENABLED: 'true',
      AGNO_BASE_URL: 'http://127.0.0.1:7777',
      AGNO_HEALTHCHECK_ENABLED: 'false',
      AGNO_TIMEOUT_MS: '1',
    });
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    })));

    const result = await adapter.execute(context());

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('AGNO_RUNTIME_TIMEOUT');
    expect(result.events.map((event) => event.type)).toContain('agno_request_failed');
  });

  it('returns a controlled failure on invalid response', async () => {
    const adapter = await agnoAdapter({
      AGNO_ENABLED: 'true',
      AGNO_EXECUTION_ENABLED: 'true',
      AGNO_BASE_URL: 'http://127.0.0.1:7777',
      AGNO_HEALTHCHECK_ENABLED: 'false',
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not-json', { status: 200 })));

    const result = await adapter.execute(context());

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('AGNO_RUNTIME_INVALID_RESPONSE');
    expect(result.events.map((event) => event.type)).toContain('run_failed');
  });
});
