import type { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeExecutionContext, RuntimeProvider } from '../../src/modules/runtime/runtime.types';

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
    AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY: 'false',
    AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED: 'false',
    AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES: '5',
    AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS: '1200',
    AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS: '6000',
    AGNO_RUNTIME_HTTP_TOOLS_ENABLED: 'false',
    AGNO_RUNTIME_HTTP_MAX_TOOL_DESCRIPTORS: '8',
    AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: '0',
    AGNO_RUNTIME_HTTP_MAX_TOOL_SCHEMA_CHARS: '6000',
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

function runtimeResponse(overrides: {
  outputText?: string;
  outputMetadata?: Record<string, unknown>;
  usage?: Record<string, unknown>;
} = {}) {
  return {
    specVersion: 'orchestra.runtime.response.v1',
    trace: {
      traceId: 'trace-adapter-1',
      runId: 'run-adapter-1',
    },
    status: 'succeeded',
    output: {
      text: overrides.outputText ?? 'Resposta sandbox do runtime Agno-compatible minimo. Nenhum provider externo foi chamado.',
      format: 'text',
      metadata: {
        mode: 'sandbox',
        inputChars: 42,
        ragSourceCount: 0,
        toolDescriptorCount: 0,
        ...overrides.outputMetadata,
      },
    },
    usage: overrides.usage ?? {
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
    process.env.RUNTIME_PROVIDER = 'local';
    vi.resetModules();
    const { runtimeAdapterRegistry } = await import('../../src/modules/runtime/runtime.registry');

    expect(runtimeAdapterRegistry.currentProvider()).toBe('local');
    expect(runtimeAdapterRegistry.get('agno_http').provider).toBe('agno_http');
    const providers = await runtimeAdapterRegistry.listProviders();
    expect(providers.map((provider) => provider.provider)).toEqual(['local', 'agno_stub', 'agno', 'agno_http']);
    expect(providers.find((provider) => provider.provider === 'agno_http')?.health.status).toBe('disabled');
  }, 30000);

  it('does not silently fall back to local for an unregistered provider when fallback is disabled', async () => {
    restoreEnv();
    applyBaseEnv({ RUNTIME_ALLOW_PROVIDER_FALLBACK: 'false' });
    vi.resetModules();
    const { runtimeAdapterRegistry } = await import('../../src/modules/runtime/runtime.registry');

    expect(() => runtimeAdapterRegistry.get('unregistered' as RuntimeProvider)).toThrow(
      'automatic fallback is disabled',
    );
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

  it.each([
    '',
    'ftp://runtime.example.test',
    'https://user:password@runtime.example.test',
    'https://runtime.example.test?mode=unsafe',
    'https://runtime.example.test#unsafe',
  ])('rejects enabled runtime configuration with unsafe base URL %s', async (baseUrl) => {
    await expect(agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: baseUrl,
    })).rejects.toThrow();
  });

  it.each(['999', '120001'])('rejects unsafe runtime timeout %sms', async (timeoutMs) => {
    await expect(agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: 'https://runtime.example.test',
      AGNO_RUNTIME_HTTP_TIMEOUT_MS: timeoutMs,
    })).rejects.toThrow();
  });

  it('requires authentication material when the explicit security gate is enabled', async () => {
    await expect(agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: 'https://runtime.example.test',
      AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY: 'true',
      AGNO_RUNTIME_HTTP_SECURITY_KEY: '',
    })).rejects.toThrow();
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
    const body = calls[0].body as { assistantRuntimeSpec: { model: { provider: string; model: string }; rag: { mode: string }; tools: { mode: string } } };
    expect(body.assistantRuntimeSpec.model).toEqual({
      provider: 'local_deterministic',
      model: 'deterministic-sandbox',
      temperature: 0.2,
    });
    expect(body.assistantRuntimeSpec.rag.mode).toBe('none');
    expect(body.assistantRuntimeSpec.tools.mode).toBe('none');
    expect(JSON.stringify(calls[0].body)).not.toMatch(/Authorization|apiKey|secret|token|headers|baseUrl|providerApiKey|secretRef|rawPrompt|rawResponse/i);
  });

  it('normalizes a fake Agno real-LLM response with governed provider observability', async () => {
    const adapter = await agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
    });
    const calls: Array<{ body?: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push({
        body: typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined,
      });
      return new Response(JSON.stringify(runtimeResponse({
        outputText: 'Resposta simulada do LLM real via Agno.',
        outputMetadata: {
          provider: 'openai',
          model: 'gpt-test-agno',
          providerStatus: 'healthy',
          externalProviderCalled: true,
          simulated: false,
        },
        usage: {
          inputTokens: 21,
          outputTokens: 9,
          totalTokens: 30,
          latencyMs: 17,
        },
      })), { status: 200 });
    }));

    const result = await adapter.execute(context({
      executionMode: 'published',
      compiledPrompt: {
        ...context().compiledPrompt,
        modelProvider: 'openai',
        modelName: 'gpt-test-agno',
      },
      llmPolicySnapshot: {
        allowExternalLlmProviders: true,
        allowedLlmProviders: ['openai'],
        defaultLlmProvider: 'openai',
      },
    }));

    const body = calls[0].body as { assistantRuntimeSpec: { model: { provider: string; model: string } } };
    expect(body.assistantRuntimeSpec.model).toEqual(expect.objectContaining({
      provider: 'openai',
      model: 'gpt-test-agno',
    }));
    expect(result).toEqual(expect.objectContaining({
      provider: 'agno_http',
      status: 'completed',
      outputPreview: 'Resposta simulada do LLM real via Agno.',
      metadata: expect.objectContaining({
        llmProvider: 'openai',
        llmModel: 'gpt-test-agno',
        externalProviderCalled: true,
        totalTokens: 30,
        latencyMs: 17,
      }),
    }));
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'run_completed',
        metadata: expect.objectContaining({
          llmProvider: 'openai',
          model: 'gpt-test-agno',
          externalProviderCalled: true,
          simulated: false,
        }),
      }),
    ]));
    expect(JSON.stringify(result.events)).not.toContain('Resposta simulada do LLM real via Agno.');
  });

  it('fails closed before HTTP when external policy and assistant model do not match', async () => {
    const adapter = await agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await adapter.execute(context({
      executionMode: 'published',
      compiledPrompt: {
        ...context().compiledPrompt,
        modelProvider: 'local',
        modelName: 'wrong-provider-model',
      },
      llmPolicySnapshot: {
        allowExternalLlmProviders: true,
        allowedLlmProviders: ['openai'],
        defaultLlmProvider: 'openai',
      },
    }));
    const serialized = JSON.stringify(result);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('RUNTIME_BAD_REQUEST');
    expect(result.metadata).toEqual(expect.objectContaining({
      requestSent: false,
      failedClosed: true,
    }));
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'run_failed',
        status: 'failed',
        metadata: expect.objectContaining({
          errorCode: 'RUNTIME_BAD_REQUEST',
          requestSent: false,
          failedClosed: true,
        }),
      }),
    ]));
    expect(serialized).not.toContain('Assistant model provider and model must match the governed external LLM policy.');
    expect(serialized).not.toContain('http://127.0.0.1:8091');
    expect(serialized).not.toMatch(/AGNO_RUNTIME_HTTP_BASE_URL|Authorization|headers|secret|token|stack/i);
  });

  it('sends governed conversation context to /execute and exposes only safe summary metadata', async () => {
    const adapter = await agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
    });
    const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined,
      });
      return new Response(JSON.stringify(runtimeResponse()), { status: 200 });
    }));

    const previousUser = 'Pergunta anterior';
    const previousAssistant = 'Resposta anterior';
    const result = await adapter.execute(context({
      conversationContext: {
        messages: [
          {
            messageId: 'message-1',
            role: 'user',
            content: previousUser,
            createdAt: '2026-07-06T12:00:00.000Z',
          },
          {
            messageId: 'message-2',
            role: 'assistant',
            content: previousAssistant,
            createdAt: '2026-07-06T12:00:01.000Z',
          },
        ],
        summary: {
          enabled: true,
          included: true,
          messageCount: 2,
          totalChars: previousUser.length + previousAssistant.length,
          truncated: false,
          maxMessages: 12,
          maxMessageChars: 1200,
          maxTotalChars: 6000,
        },
      },
    }));

    const body = calls[0].body as {
      assistantRuntimeSpec: {
        input: { message: string };
        conversationContext: { messages: Array<{ role: string; content: string }>; summary: { messageCount: number } };
      };
    };
    expect(body.assistantRuntimeSpec.input.message).toBe('Run the adapter against the minimal runtime.');
    expect(body.assistantRuntimeSpec.conversationContext.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }))).toEqual([
      { role: 'user', content: previousUser },
      { role: 'assistant', content: previousAssistant },
    ]);
    expect(body.assistantRuntimeSpec.conversationContext.summary.messageCount).toBe(2);
    expect(JSON.stringify(body.assistantRuntimeSpec.conversationContext)).not.toMatch(/messageId|createdAt|message-1|message-2/);
    expect(result.metadata).toEqual(expect.objectContaining({
      conversationContextIncluded: true,
      conversationContextMessageCount: 2,
      conversationContextChars: previousUser.length + previousAssistant.length,
      conversationContextTruncated: false,
    }));
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'runtime_llm_context_attached',
        metadata: expect.objectContaining({
          conversationContextIncluded: true,
          conversationContextMessageCount: 2,
          conversationContextChars: previousUser.length + previousAssistant.length,
        }),
      }),
    ]));
    expect(JSON.stringify(result.events)).not.toContain(previousUser);
    expect(JSON.stringify(result.events)).not.toContain(previousAssistant);
    expect(JSON.stringify(result.events)).not.toContain('message-1');
    expect(JSON.stringify(result.events)).not.toContain('message-2');
  });

  it('sends governed RAG resolved_context to /execute when the 14E flag is enabled', async () => {
    const adapter = await agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
      AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES: '2',
      AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS: '20',
      AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS: '40',
    });
    const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined,
      });
      return new Response(JSON.stringify(runtimeResponse()), { status: 200 });
    }));

    const result = await adapter.execute(context({
      rag: {
        ragReady: true,
        knowledgeBindingsCount: 1,
        chunkCount: 2,
        sourceReferenceCount: 2,
        lastRagQueryId: 'rag-adapter-1',
        sourceReferences: [
          {
            id: 'source-1',
            label: '[1]',
            documentId: 'document-1',
            chunkId: 'chunk-1',
            sourceUri: 'internal://must-not-leak',
            documentTitle: 'Governed Policy',
            excerpt: '012345678901234567890123456789',
            score: 0.8,
          },
          {
            id: 'unsafe-source',
            label: '[unsafe]',
            documentTitle: 'Unsafe Source',
            excerpt: 'Bearer must-not-leak',
          },
        ],
      },
    }));

    const body = calls[0].body as { assistantRuntimeSpec: { rag: { mode: string; sources: Array<{ sourceId: string; excerpt: string }> } } };
    expect(body.assistantRuntimeSpec.rag.mode).toBe('resolved_context');
    expect(body.assistantRuntimeSpec.rag.sources).toEqual([
      expect.objectContaining({
        sourceId: 'source-1',
        excerpt: '01234567890123456789',
      }),
    ]);
    expect(JSON.stringify(calls[0].body)).not.toMatch(/must-not-leak|internal:\/\/|rawDocuments|Authorization|headers|secret|token|apiKey|baseUrl/i);
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'rag_context_attached',
        metadata: expect.objectContaining({
          ragMode: 'resolved_context',
          ragSourceCount: 1,
          ragContextChars: 20,
          maxRagResults: 2,
        }),
      }),
    ]));
    expect(JSON.stringify(result.events)).not.toContain('source-1');
    expect(JSON.stringify(result.events)).not.toContain('01234567890123456789');
  });


  it('sends governed tool descriptors to /execute when the 14F flag is enabled', async () => {
    const adapter = await agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
      AGNO_RUNTIME_HTTP_TOOLS_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_MAX_TOOL_DESCRIPTORS: '2',
      AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: '0',
      AGNO_RUNTIME_HTTP_MAX_TOOL_SCHEMA_CHARS: '6000',
    });
    const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined,
      });
      return new Response(JSON.stringify(runtimeResponse()), { status: 200 });
    }));

    const result = await adapter.execute(context({
      mcp: {
        mcpBindingsCount: 1,
        allowedSandboxTools: [
          {
            id: 'binding-1',
            serverId: 'server-1',
            toolId: 'tool-1',
            name: 'lookup_policy',
            description: 'Consulta politica autorizada.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
            },
            riskLevel: 'low',
            requiresApproval: false,
            executionMode: 'sandbox_only',
          },
        ],
        blockedTools: [],
        requiresApproval: [],
        lastToolCallIds: [],
      },
    }));

    const body = calls[0].body as { assistantRuntimeSpec: { policy: { maxToolCalls: number }; tools: { mode: string; descriptors: Array<{ toolId: string; inputSchema?: unknown }> } } };
    expect(body.assistantRuntimeSpec.tools.mode).toBe('gateway');
    expect(body.assistantRuntimeSpec.policy.maxToolCalls).toBe(0);
    expect(body.assistantRuntimeSpec.tools.descriptors).toEqual([
      expect.objectContaining({
        toolId: 'tool-1',
        inputSchema: expect.objectContaining({ type: 'object' }),
      }),
    ]);
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'mcp_tools_attached',
        metadata: expect.objectContaining({
          toolMode: 'gateway',
          toolDescriptorCount: 1,
          approvalRequiredCount: 0,
          maxToolCalls: 0,
        }),
      }),
    ]));
    expect(JSON.stringify(result.events)).not.toMatch(/toolIds|descriptorSchemaHashes|lookup_policy|tool-1|query/);
    expect(JSON.stringify(calls[0].body)).not.toMatch(/rawToolManifest|rawMcpServerConfig|Authorization|headers|credentials|apiKey|token|secret|baseUrl|endpoint|providerApiKey|secretRef/i);
    expect(JSON.stringify(result.events)).not.toContain('query');
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

    const result = await adapter.execute(context());

    expect(calls[0].init?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer server-secret-key' }));
    expect(calls[0].body).not.toContain('server-secret-key');
    expect(calls[0].body).not.toContain('Authorization');
    expect(JSON.stringify(result)).not.toContain('server-secret-key');
    expect(JSON.stringify(result)).not.toContain('Authorization');
  });

  it('normalizes agno_http trace, latency and invalid usage fields safely', async () => {
    const adapter = await agnoHttpAdapter({
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: 'http://127.0.0.1:8091',
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ...runtimeResponse(),
      usage: {
        inputTokens: -1,
        outputTokens: 'invalid',
        totalTokens: 10,
        latencyMs: Number.MAX_SAFE_INTEGER + 1,
        apiKey: 'must-not-leak',
      },
    }), { status: 200 })));

    const result = await adapter.execute(context());
    const metadata = result.metadata as Record<string, unknown>;

    expect(result.status).toBe('completed');
    expect(metadata).toEqual(expect.objectContaining({
      runtimeProvider: 'agno_http',
      runtimeStatus: 'completed',
      traceId: 'trace-adapter-1',
      runId: 'run-adapter-1',
      requestId: 'req-adapter-1',
      inputHash: 'input-hash',
      totalTokens: 10,
      latencyMs: expect.any(Number),
      externalMcpCalled: false,
      externalProviderCalled: false,
      toolCallsExecuted: 0,
    }));
    expect(metadata.usage).toEqual({ totalTokens: 10 });
    expect(JSON.stringify(result)).not.toMatch(/apiKey|must-not-leak|invalid/);
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
