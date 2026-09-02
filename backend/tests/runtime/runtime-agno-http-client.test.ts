import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  AgnoHttpRuntimeClient,
  AgnoHttpRuntimeClientError,
  assistantRuntimeSpecVersionV1,
  runtimeExecuteRequestSpecVersionV1,
  runtimeExecuteResponseSpecVersionV1,
} from '../../src/modules/runtime';
import type { RuntimeExecuteRequestV1, RuntimeExecuteResponseV1 } from '../../src/modules/runtime';

function executeRequest(): RuntimeExecuteRequestV1 {
  return {
    specVersion: runtimeExecuteRequestSpecVersionV1,
    assistantRuntimeSpec: {
      specVersion: assistantRuntimeSpecVersionV1,
      trace: {
        traceId: 'trace-client-1',
        runId: 'run-client-1',
      },
      tenant: {
        id: 'tenant-1',
      },
      workspace: {
        id: 'workspace-1',
      },
      actor: {
        userId: 'user-1',
      },
      assistant: {
        id: 'assistant-1',
      },
      input: {
        message: 'Safe user message.',
      },
      model: {
        provider: 'local',
        model: 'deterministic-sandbox',
      },
      policy: {
        executionMode: 'sync',
        streaming: false,
        timeoutMs: 15000,
        maxToolCalls: 0,
        maxRagResults: 0,
        maxContextChars: 16000,
        failClosed: true,
      },
      instructions: {},
      rag: {
        enabled: false,
        mode: 'none',
        sources: [],
      },
      tools: {
        enabled: false,
        mode: 'none',
        descriptors: [],
      },
      observability: {
        usageEventEnabled: true,
        auditEnabled: true,
        qualityEvaluationEnabled: false,
      },
      limits: {
        enforce: true,
      },
    },
  };
}

function executeResponse(status: RuntimeExecuteResponseV1['status'] = 'succeeded'): RuntimeExecuteResponseV1 {
  return {
    specVersion: runtimeExecuteResponseSpecVersionV1,
    trace: {
      traceId: 'trace-client-1',
      runId: 'run-client-1',
    },
    status,
    output: status === 'succeeded'
      ? {
        text: 'Sandbox response.',
        format: 'text',
        metadata: {
          mode: 'sandbox',
        },
      }
      : undefined,
    error: status === 'failed' || status === 'blocked'
      ? {
        code: status === 'blocked' ? 'RUNTIME_POLICY_BLOCKED' : 'RUNTIME_BAD_REQUEST',
        message: status === 'blocked' ? 'Policy blocked.' : 'Bad request.',
        retryable: false,
        httpStatus: status === 'blocked' ? 403 : 400,
      }
      : undefined,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe('Agno HTTP runtime client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates health payloads', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      provider: 'agno',
      protocolVersion: assistantRuntimeSpecVersionV1,
      status: 'healthy',
      checkedAt: '2026-07-01T12:00:00.000Z',
      message: 'healthy',
    })));

    const client = new AgnoHttpRuntimeClient({ baseUrl: 'http://127.0.0.1:8091', timeoutMs: 15000 });

    await expect(client.getHealth()).resolves.toEqual(expect.objectContaining({ provider: 'agno', status: 'healthy' }));
  });

  it('validates capabilities payloads', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      provider: 'agno',
      protocolVersion: assistantRuntimeSpecVersionV1,
      supportsStreaming: false,
      supportsTools: false,
      supportsRagContext: true,
      supportsFileInputs: false,
      maxInputChars: 16000,
      maxToolCalls: 0,
    })));

    const client = new AgnoHttpRuntimeClient({ baseUrl: 'http://127.0.0.1:8091', timeoutMs: 15000 });

    await expect(client.getCapabilities()).resolves.toEqual(expect.objectContaining({ supportsStreaming: false }));
  });

  it('accepts a governed model catalog in capabilities', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      provider: 'agno',
      protocolVersion: assistantRuntimeSpecVersionV1,
      supportsStreaming: false,
      supportsTools: false,
      supportsRagContext: true,
      supportsExternalProviders: true,
      supportsFileInputs: false,
      maxInputChars: 16000,
      maxToolCalls: 0,
      modelCatalog: {
        provider: 'openai',
        models: ['gpt-4o-mini'],
        defaultModel: 'gpt-4o-mini',
      },
    })));

    const client = new AgnoHttpRuntimeClient({
      baseUrl: 'http://127.0.0.1:8091',
      timeoutMs: 15000,
    });

    await expect(client.getCapabilities()).resolves.toEqual(
      expect.objectContaining({
        supportsExternalProviders: true,
        modelCatalog: {
          provider: 'openai',
          models: ['gpt-4o-mini'],
          defaultModel: 'gpt-4o-mini',
        },
      }),
    );
  });

  it('rejects a capabilities model catalog whose default model is not allowlisted', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      provider: 'agno',
      protocolVersion: assistantRuntimeSpecVersionV1,
      supportsStreaming: false,
      supportsTools: false,
      supportsRagContext: true,
      supportsExternalProviders: true,
      supportsFileInputs: false,
      maxInputChars: 16000,
      maxToolCalls: 0,
      modelCatalog: {
        provider: 'openai',
        models: ['gpt-4o-mini'],
        defaultModel: 'gpt-4o',
      },
    })));

    const client = new AgnoHttpRuntimeClient({
      baseUrl: 'http://127.0.0.1:8091',
      timeoutMs: 15000,
    });

    await expect(client.getCapabilities()).rejects.toMatchObject({
      code: 'RUNTIME_INVALID_RESPONSE',
    });
  });

  it('accepts a dynamic model catalog larger than the former static limit', async () => {
    const models = Array.from(
      { length: 40 },
      (_, index) => `gpt-dynamic-test-${index + 1}`,
    );

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      provider: 'agno',
      protocolVersion: assistantRuntimeSpecVersionV1,
      supportsStreaming: false,
      supportsTools: false,
      supportsRagContext: true,
      supportsExternalProviders: true,
      supportsFileInputs: false,
      maxInputChars: 16000,
      maxToolCalls: 0,
      modelCatalog: {
        provider: 'openai',
        models,
        defaultModel: models[0],
      },
    })));

    const client = new AgnoHttpRuntimeClient({
      baseUrl: 'http://127.0.0.1:8091',
      timeoutMs: 15000,
    });

    const capabilities = await client.getCapabilities();

    expect(capabilities.modelCatalog?.models).toHaveLength(40);
    expect(capabilities.modelCatalog?.defaultModel).toBe(models[0]);
  });

  it('sends RuntimeExecuteRequestV1 and validates RuntimeExecuteResponseV1', async () => {
    const calls: Array<{ url: string; init?: RequestInit; body?: unknown }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        init,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined,
      });
      return jsonResponse(executeResponse());
    }));
    const client = new AgnoHttpRuntimeClient({ baseUrl: 'http://127.0.0.1:8091///', timeoutMs: 15000 });

    const response = await client.execute(executeRequest());

    expect(response.trace).toEqual({ traceId: 'trace-client-1', runId: 'run-client-1' });
    expect(calls[0].url).toBe('http://127.0.0.1:8091/execute');
    expect(calls[0].body).toEqual(expect.objectContaining({ specVersion: runtimeExecuteRequestSpecVersionV1 }));
  });

  it('does not send Authorization when security key is absent', async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push(init ?? {});
      return jsonResponse(executeResponse());
    }));
    const client = new AgnoHttpRuntimeClient({ baseUrl: 'http://127.0.0.1:8091', timeoutMs: 15000 });

    await client.execute(executeRequest());

    expect(calls[0].headers).not.toEqual(expect.objectContaining({ Authorization: expect.any(String) }));
  });

  it('sends Authorization server-to-server when security key is configured without adding it to the body', async () => {
    const calls: Array<{ init?: RequestInit; body?: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push({ init, body: typeof init?.body === 'string' ? init.body : undefined });
      return jsonResponse(executeResponse());
    }));
    const client = new AgnoHttpRuntimeClient({
      baseUrl: 'http://127.0.0.1:8091',
      timeoutMs: 15000,
      securityKey: 'server-to-server-key',
    });

    await client.execute(executeRequest());

    expect(calls[0].init?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer server-to-server-key' }));
    expect(calls[0].body).not.toContain('server-to-server-key');
    expect(calls[0].body).not.toContain('Authorization');
  });

  it('authenticates health, capabilities, and execute with the same server-to-server credential', async () => {
    const fakeCredential = 'phase-16d-fake-runtime-key';
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/health')) {
        return jsonResponse({
          provider: 'agno',
          protocolVersion: assistantRuntimeSpecVersionV1,
          status: 'healthy',
          checkedAt: '2026-07-01T12:00:00.000Z',
        });
      }
      if (url.endsWith('/capabilities')) {
        return jsonResponse({
          provider: 'agno',
          protocolVersion: assistantRuntimeSpecVersionV1,
          supportsStreaming: false,
          supportsTools: false,
          supportsRagContext: true,
          supportsFileInputs: false,
          maxInputChars: 16000,
          maxToolCalls: 0,
        });
      }
      return jsonResponse(executeResponse());
    }));
    const client = new AgnoHttpRuntimeClient({
      baseUrl: 'https://runtime.example.test/orchestra/',
      timeoutMs: 15000,
      securityKey: fakeCredential,
    });

    await client.getHealth();
    await client.getCapabilities();
    await client.execute(executeRequest());

    expect(calls.map((call) => call.url)).toEqual([
      'https://runtime.example.test/orchestra/health',
      'https://runtime.example.test/orchestra/capabilities',
      'https://runtime.example.test/orchestra/execute',
    ]);
    for (const call of calls) {
      expect(call.init?.headers).toEqual(expect.objectContaining({ Authorization: `Bearer ${fakeCredential}` }));
    }
    expect(JSON.stringify(calls.map((call) => call.init?.body))).not.toContain(fakeCredential);
  });

  it.each([
    'ftp://runtime.example.test',
    'https://user:password@runtime.example.test',
    'https://runtime.example.test?mode=unsafe',
    'https://runtime.example.test#unsafe',
  ])('rejects unsafe base URL %s before making a request', (baseUrl) => {
    expect(() => new AgnoHttpRuntimeClient({ baseUrl, timeoutMs: 15000 })).toThrow();
  });

  it('rejects a response that echoes private transport configuration without leaking it in the error', async () => {
    const fakeCredential = 'phase-16d-private-runtime-key';
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      ...executeResponse('failed'),
      error: {
        code: 'RUNTIME_BAD_REQUEST',
        message: `unexpected echo ${fakeCredential}`,
        retryable: false,
      },
    }, 400)));
    const client = new AgnoHttpRuntimeClient({
      baseUrl: 'https://runtime.example.test',
      timeoutMs: 15000,
      securityKey: fakeCredential,
    });

    const error = await client.execute(executeRequest()).catch((caught: unknown) => caught);
    const serialized = error instanceof Error ? `${error.name}:${error.message}:${JSON.stringify(error)}` : JSON.stringify(error);

    expect(error).toMatchObject({ code: 'RUNTIME_INVALID_RESPONSE' });
    expect(serialized).not.toContain(fakeCredential);
    expect(serialized).not.toContain('Authorization');
  });

  it('maps runtime HTTP 400 and 403 to normalized errors', async () => {
    const badRequestClient = new AgnoHttpRuntimeClient({ baseUrl: 'http://127.0.0.1:8091', timeoutMs: 15000 });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(executeResponse('failed'), 400)));
    await expect(badRequestClient.execute(executeRequest())).rejects.toMatchObject({ code: 'RUNTIME_BAD_REQUEST' });

    const policyClient = new AgnoHttpRuntimeClient({ baseUrl: 'http://127.0.0.1:8091', timeoutMs: 15000 });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(executeResponse('blocked'), 403)));
    await expect(policyClient.execute(executeRequest())).rejects.toMatchObject({ code: 'RUNTIME_POLICY_BLOCKED' });
  });

  it('maps invalid responses to RUNTIME_INVALID_RESPONSE', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ unexpected: true })));
    const client = new AgnoHttpRuntimeClient({ baseUrl: 'http://127.0.0.1:8091', timeoutMs: 15000 });

    await expect(client.execute(executeRequest())).rejects.toMatchObject({ code: 'RUNTIME_INVALID_RESPONSE' });
  });

  it('maps runtime unavailability to RUNTIME_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('connect failed');
    }));
    const client = new AgnoHttpRuntimeClient({ baseUrl: 'http://127.0.0.1:8091', timeoutMs: 15000 });

    await expect(client.getHealth()).rejects.toMatchObject({ code: 'RUNTIME_UNAVAILABLE' });
  });

  it('applies timeout and maps it to RUNTIME_TIMEOUT', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    })));
    const client = new AgnoHttpRuntimeClient({ baseUrl: 'http://127.0.0.1:8091', timeoutMs: 1 });

    const error = await client.getHealth().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AgnoHttpRuntimeClientError);
    expect(error).toMatchObject({ code: 'RUNTIME_TIMEOUT' });
  });
});
