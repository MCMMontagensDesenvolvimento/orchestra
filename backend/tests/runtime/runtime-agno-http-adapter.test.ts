import type { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeExecutionContext } from '../../src/modules/runtime/runtime.types';

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.resetModules();
}

function applyBaseEnv(overrides: Record<string, string | undefined> = {}) {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://orchestra:orchestra@localhost:5432/orchestra',
    JWT_SECRET: 'test-secret',
    RUNTIME_ADAPTER_ENABLED: 'true',
    RUNTIME_DEFAULT_TIMEOUT_MS: '15000',
    RUNTIME_REQUIRE_PRECHECK: 'true',
    RUNTIME_ALLOW_PROVIDER_FALLBACK: 'false',
    RUNTIME_ALLOW_EXTERNAL_TOOLS: 'false',
    AGNO_ENABLED: 'false',
    AGNO_EXECUTION_ENABLED: 'false',
    AGNO_BASE_URL: '',
    AGNO_API_KEY: '',
    AGNO_HEALTHCHECK_ENABLED: 'false',
    AGNO_RUNTIME_HTTP_ENABLED: 'false',
    AGNO_RUNTIME_HTTP_BASE_URL: '',
    AGNO_RUNTIME_HTTP_TIMEOUT_MS: '15000',
    AGNO_RUNTIME_HTTP_SECURITY_KEY: '',
    ...overrides,
  };
}

async function agnoHttpAdapter(overrides: Record<string, string | undefined> = {}) {
  restoreEnv();
  applyBaseEnv({
    RUNTIME_PROVIDER: 'agno_http',
    ...overrides,
  });
  vi.resetModules();
  const { AgnoHttpRuntimeAdapter } = await import('../../src/modules/runtime/runtime.agno-http-adapter');
  return new AgnoHttpRuntimeAdapter();
}

function context(overrides: Partial<RuntimeExecutionContext> = {}): RuntimeExecutionContext {
  return {
    requestId: 'req-adapter-1',
    traceId: 'trace-adapter-1',
    runId: 'run-adapter-1',
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    assistantId: 'assistant-1',
    assistantVersionId: 'version-1',
    assistantPublicationId: null,
    executionMode: 'sandbox',
    provider: 'agno_http',
    assistant: {
      id: 'assistant-1',
      name: 'Adapter Assistant',
      status: 'draft',
      description: 'Adapter test assistant',
      objective: 'Test adapter',
    },
    compiledPrompt: {
      mode: 'placeholder',
      assistantVersionId: 'version-1',
      instructionChars: 32,
      instructionsPreview: 'Use only governed adapter context.',
      modelProvider: 'local',
      modelName: 'adapter-selected-model',
      temperature: 0.2,
    },
    executionPolicySnapshot: {
      executionMode: 'sandbox',
      sandboxEnabled: true,
      sandboxBlocksExternalTools: true,
      sandboxBlocksRealProviders: true,
      sandboxLogsRequired: true,
    } as Prisma.InputJsonValue,
    llmPolicySnapshot: {
      allowExternalLlmProviders: false,
      allowedLlmProviders: [],
      defaultLlmProvider: null,
    },
    precheckSnapshot: {
      canExecute: true,
      mode: 'sandbox',
      reasons: [],
      requestId: 'req-adapter-1',
    },
    rag: {
      ragReady: false,
      knowledgeBindingsCount: 0,
      chunkCount: 0,
      sourceReferenceCount: 0,
      lastRagQueryId: null,
      sourceReferences: [],
    },
    mcp: {
      mcpBindingsCount: 0,
      allowedSandboxTools: [],
      blockedTools: [],
      requiresApproval: [],
      lastToolCallIds: [],
    },
    input: {
      hash: 'input-hash',
      preview: 'Run the adapter against the minimal runtime.',
      raw: 'Run the adapter against the minimal runtime.',
    },
    ...overrides,
  };
}

function runtimeResponse() {
  return {
    specVersion: 'orchestra.runtime.response.v1',
    trace: {
      traceId: 'trace-adapter-1',
      runId: 'run-adapter-1',
    },
    status: 'succeeded',
    output: {
      text: 'Resposta sandbox do runtime Agno-compatible minimo. Nenhum provider externo foi chamado.',
      format: 'text',
      metadata: {
        mode: 'sandbox',
        inputChars: 42,
        ragSourceCount: 0,
        toolDescriptorCount: 0,
      },
    },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      latencyMs: 1,
      estimatedCostMinorUnits: '0',
      costCurrency: 'BRL',
    },
    events: [
      {
        eventId: 'event-1',
        traceId: 'trace-adapter-1',
        runId: 'run-adapter-1',
        type: 'run.started',
        timestamp: '2026-07-01T12:00:00.000Z',
        status: 'running',
        metadata: {
          mode: 'sandbox',
        },
      },
      {
        eventId: 'event-2',
        traceId: 'trace-adapter-1',
        runId: 'run-adapter-1',
        type: 'run.completed',
        timestamp: '2026-07-01T12:00:00.000Z',
        status: 'completed',
      },
    ],
  };
}

describe('Agno HTTP runtime adapter', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('keeps default runtime provider local and registers agno_http as disabled', async () => {
    restoreEnv();
    applyBaseEnv();
    delete process.env.RUNTIME_PROVIDER;
    vi.resetModules();
    const { runtimeAdapterRegistry } = await import('../../src/modules/runtime/runtime.registry');

    expect(runtimeAdapterRegistry.currentProvider()).toBe('local');
    expect(runtimeAdapterRegistry.get('agno_http').provider).toBe('agno_http');
    const providers = await runtimeAdapterRegistry.listProviders();
    expect(providers.map((provider) => provider.provider)).toEqual(['local', 'agno_stub', 'agno', 'agno_http']);
    expect(providers.find((provider) => provider.provider === 'agno_http')?.health.status).toBe('disabled');
  });

  it('does not call runtime HTTP when disabled', async () => {
    const adapter = await agnoHttpAdapter({ AGNO_RUNTIME_HTTP_ENABLED: 'false' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await adapter.execute(context());

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('RUNTIME_UNAVAILABLE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when enabled without a valid base URL', async () => {
    const adapter = await agnoHttpAdapter({ AGNO_RUNTIME_HTTP_ENABLED: 'true', AGNO_RUNTIME_HTTP_BASE_URL: '' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const health = await adapter.healthCheck();
    const result = await adapter.execute(context());

    expect(health.status).toBe('misconfigured');
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('RUNTIME_BAD_REQUEST');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls /execute when enabled and sends a RuntimeExecuteRequestV1 body', async () => {
    const adapter = await agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
    });
    const calls: Array<{ url: string; init?: RequestInit; body?: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        init,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined,
      });
      return new Response(JSON.stringify(runtimeResponse()), { status: 200 });
    }));

    const result = await adapter.execute(context());

    expect(result.status).toBe('completed');
    expect(result.provider).toBe('agno_http');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://127.0.0.1:8091/execute');
    expect(calls[0].body?.specVersion).toBe('orchestra.runtime.execute.v1');
    const body = calls[0].body as { assistantRuntimeSpec: { model: { model: string }; rag: { mode: string }; tools: { mode: string } } };
    expect(body.assistantRuntimeSpec.model.model).toBe('adapter-selected-model');
    expect(body.assistantRuntimeSpec.rag.mode).toBe('none');
    expect(body.assistantRuntimeSpec.tools.mode).toBe('none');
    expect(JSON.stringify(calls[0].body)).not.toMatch(/Authorization|apiKey|secret|token|headers|baseUrl|providerApiKey|secretRef|rawPrompt|rawResponse/i);
  });

  it('keeps security key in Authorization header and out of body', async () => {
    const adapter = await agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
      AGNO_RUNTIME_HTTP_SECURITY_KEY: 'server-secret-key',
    });
    const calls: Array<{ init?: RequestInit; body?: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push({ init, body: typeof init?.body === 'string' ? init.body : undefined });
      return new Response(JSON.stringify(runtimeResponse()), { status: 200 });
    }));

    await adapter.execute(context());

    expect(calls[0].init?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer server-secret-key' }));
    expect(calls[0].body).not.toContain('server-secret-key');
    expect(calls[0].body).not.toContain('Authorization');
  });

  it('fails closed when runtime returns a payload outside the contract', async () => {
    const adapter = await agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 })));

    const result = await adapter.execute(context());

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('RUNTIME_INVALID_RESPONSE');
    expect(JSON.stringify(result)).not.toContain('unexpected');
  });
});
