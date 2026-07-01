import { describe, expect, it } from 'vitest';
import {
  assistantRuntimeSpecV1Schema,
  assistantRuntimeSpecVersionV1,
  runtimeCapabilitiesResponseV1Schema,
  runtimeExecuteRequestSpecVersionV1,
  runtimeExecuteRequestV1Schema,
  runtimeExecuteResponseSpecVersionV1,
  runtimeExecuteResponseV1Schema,
  runtimeHealthResponseV1Schema,
  runtimeNormalizedErrorV1Schema,
  sanitizeRuntimeContractMetadata,
} from '../../src/modules/runtime';
import type { AssistantRuntimeSpecV1 } from '../../src/modules/runtime';

function validSpec(overrides: Partial<AssistantRuntimeSpecV1> = {}): AssistantRuntimeSpecV1 {
  return {
    specVersion: assistantRuntimeSpecVersionV1,
    trace: {
      traceId: 'trace-runtime-contract',
      runId: 'run-runtime-contract',
      requestId: 'req-runtime-contract',
    },
    tenant: {
      id: 'tenant-1',
    },
    workspace: {
      id: 'workspace-1',
    },
    actor: {
      userId: 'user-1',
      roleIds: ['role-admin'],
      permissionHints: ['agent_runs.create'],
    },
    assistant: {
      id: 'assistant-1',
      versionId: 'version-1',
      name: 'Finance Assistant',
      status: 'draft',
      locale: 'pt-BR',
    },
    input: {
      message: 'Responda usando apenas o contexto governado.',
      metadata: {
        source: 'unit-test',
      },
    },
    model: {
      provider: 'local',
      model: 'deterministic-contract',
      temperature: 0.2,
      maxTokens: 512,
      topP: 0.8,
    },
    policy: {
      executionMode: 'sync',
      streaming: false,
      timeoutMs: 15000,
      maxToolCalls: 3,
      maxRagResults: 5,
      maxContextChars: 12000,
      failClosed: true,
    },
    instructions: {
      system: 'Use somente dados autorizados pelo Orquestra.',
      developer: 'Nunca solicite segredos ao runtime.',
      responseFormat: 'text',
    },
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
      limitEvaluationId: 'limit-evaluation-1',
      blockedBeforeRuntime: false,
    },
    metadata: {
      contract: '14A',
    },
    ...overrides,
  };
}

function validEvent() {
  return {
    eventId: 'event-1',
    traceId: 'trace-runtime-contract',
    runId: 'run-runtime-contract',
    type: 'run.started',
    timestamp: '2026-06-30T18:00:00.000Z',
    status: 'running',
    metadata: {
      phase: 'runtime-contract',
    },
  };
}

describe('runtime contract schemas', () => {
  it('accepts a minimal valid AssistantRuntimeSpec v1', () => {
    const result = assistantRuntimeSpecV1Schema.safeParse(validSpec());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.specVersion).toBe(assistantRuntimeSpecVersionV1);
      expect(result.data.policy.failClosed).toBe(true);
      expect(result.data.policy.streaming).toBe(false);
    }
  });

  it('rejects an extra top-level field', () => {
    const result = assistantRuntimeSpecV1Schema.safeParse({
      ...validSpec(),
      unexpected: true,
    });

    expect(result.success).toBe(false);
  });

  it('rejects dangerous metadata before runtime validation can pass', () => {
    const result = assistantRuntimeSpecV1Schema.safeParse(validSpec({
      metadata: {
        token: 'must-not-enter-runtime',
      },
    }));

    expect(result.success).toBe(false);
    expect(sanitizeRuntimeContractMetadata({ token: 'hidden', safe: 'ok' })).toEqual({ safe: 'ok' });
  });

  it('rejects accessToken in metadata', () => {
    const result = assistantRuntimeSpecV1Schema.safeParse(validSpec({
      metadata: {
        accessToken: 'must-not-enter-runtime',
      },
    }));

    expect(result.success).toBe(false);
  });

  it('rejects openaiApiKey in metadata', () => {
    const result = assistantRuntimeSpecV1Schema.safeParse(validSpec({
      metadata: {
        openaiApiKey: 'must-not-enter-runtime',
      },
    }));

    expect(result.success).toBe(false);
  });

  it('rejects secretKey and clientSecret in metadata', () => {
    const result = assistantRuntimeSpecV1Schema.safeParse(validSpec({
      metadata: {
        secretKey: 'must-not-enter-runtime',
        clientSecret: 'must-not-enter-runtime',
      },
    }));

    expect(result.success).toBe(false);
  });

  it('keeps maxTokens valid in model payloads', () => {
    const result = assistantRuntimeSpecV1Schema.safeParse(validSpec({
      model: {
        provider: 'local',
        model: 'deterministic-contract',
        maxTokens: 1024,
      },
    }));

    expect(result.success).toBe(true);
  });

  it.each(['apiKey', 'secret', 'Authorization', 'headers', 'baseUrl'] as const)(
    'rejects dangerous field %s anywhere in the spec payload',
    (field) => {
      const result = assistantRuntimeSpecV1Schema.safeParse(validSpec({
        input: {
          message: 'safe message',
          metadata: {
            [field]: 'must-not-pass',
          },
        },
      }));

      expect(result.success).toBe(false);
    },
  );

  it('accepts RAG resolved_context with safe excerpts', () => {
    const result = assistantRuntimeSpecV1Schema.safeParse(validSpec({
      rag: {
        enabled: true,
        mode: 'resolved_context',
        sources: [
          {
            sourceId: 'source-1',
            documentId: 'document-1',
            chunkId: 'chunk-1',
            title: 'Politica interna',
            excerpt: 'Trecho curto ja resolvido e autorizado pelo Orquestra.',
            score: 0.91,
            metadata: {
              citationLabel: '[1]',
            },
          },
        ],
      },
    }));

    expect(result.success).toBe(true);
  });

  it('rejects raw RAG documents and oversized excerpts', () => {
    const withRawDocuments = assistantRuntimeSpecV1Schema.safeParse(validSpec({
      rag: {
        enabled: true,
        mode: 'resolved_context',
        sources: [
          {
            sourceId: 'source-1',
            excerpt: 'safe excerpt',
            metadata: {
              rawDocuments: ['full document'],
            },
          },
        ],
      },
    }));
    const withHugeExcerpt = assistantRuntimeSpecV1Schema.safeParse(validSpec({
      rag: {
        enabled: true,
        mode: 'resolved_context',
        sources: [
          {
            sourceId: 'source-1',
            excerpt: 'x'.repeat(4001),
          },
        ],
      },
    }));

    expect(withRawDocuments.success).toBe(false);
    expect(withHugeExcerpt.success).toBe(false);
  });

  it('accepts a safe tool descriptor for the Orquestra gateway', () => {
    const result = assistantRuntimeSpecV1Schema.safeParse(validSpec({
      tools: {
        enabled: true,
        mode: 'gateway',
        descriptors: [
          {
            toolId: 'tool-1',
            name: 'lookup_policy',
            description: 'Consulta governada via gateway.',
            riskLevel: 'low',
            approvalRequired: false,
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
            },
            gatewayRef: {
              type: 'orchestra_tool_gateway',
              action: 'mcp.tool.execute',
            },
          },
        ],
      },
    }));

    expect(result.success).toBe(true);
  });


  it('accepts governed descriptors with maxToolCalls zero for context only', () => {
    const result = assistantRuntimeSpecV1Schema.safeParse(validSpec({
      policy: {
        ...validSpec().policy,
        maxToolCalls: 0,
      },
      tools: {
        enabled: true,
        mode: 'gateway',
        descriptors: [
          {
            toolId: 'tool-context-only',
            name: 'lookup_policy',
            riskLevel: 'low',
            approvalRequired: false,
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
            },
            metadata: {
              source: 'orchestra_mcp_catalog',
            },
            gatewayRef: {
              type: 'orchestra_tool_gateway',
              action: 'mcp.tool.execute',
            },
          },
        ],
      },
    }));

    expect(result.success).toBe(true);
  });

  it.each([
    { url: 'https://mcp.example.invalid' },
    { inputSchema: { headers: { Authorization: 'Bearer forbidden' } } },
    { inputSchema: { token: 'forbidden' } },
    { inputSchema: { baseUrl: 'https://mcp.example.invalid' } },
    { inputSchema: { endpoint: 'https://mcp.example.invalid/execute' } },
    { metadata: { rawToolManifest: 'full manifest' } },
    { metadata: { rawMcpServerConfig: 'server config' } },
  ])('rejects unsafe tool descriptor payload %#', (descriptorPatch) => {
    const spec = validSpec() as unknown as Record<string, unknown>;
    spec.tools = {
      enabled: true,
      mode: 'gateway',
      descriptors: [
        {
          toolId: 'tool-1',
          name: 'lookup_policy',
          riskLevel: 'low',
          approvalRequired: false,
          gatewayRef: {
            type: 'orchestra_tool_gateway',
            action: 'mcp.tool.execute',
          },
          ...descriptorPatch,
        },
      ],
    };
    const result = assistantRuntimeSpecV1Schema.safeParse(spec);

    expect(result.success).toBe(false);
  });

  it('keeps inputTokens, outputTokens, and totalTokens valid in usage payloads', () => {
    const result = runtimeExecuteResponseV1Schema.safeParse({
      specVersion: runtimeExecuteResponseSpecVersionV1,
      trace: {
        traceId: 'trace-runtime-contract',
        runId: 'run-runtime-contract',
      },
      status: 'succeeded',
      usage: {
        inputTokens: 12,
        outputTokens: 24,
        totalTokens: 36,
      },
    });

    expect(result.success).toBe(true);
  });


  it('accepts the tool.descriptors.attached normalized runtime event', () => {
    const result = runtimeExecuteResponseV1Schema.safeParse({
      specVersion: runtimeExecuteResponseSpecVersionV1,
      trace: {
        traceId: 'trace-runtime-contract',
        runId: 'run-runtime-contract',
      },
      status: 'succeeded',
      events: [{
        ...validEvent(),
        type: 'tool.descriptors.attached',
        metadata: {
          toolDescriptorCount: 1,
          toolMode: 'gateway',
          maxToolCalls: 0,
        },
      }],
    });

    expect(result.success).toBe(true);
  });

  it('accepts a valid runtime execute response', () => {
    const result = runtimeExecuteResponseV1Schema.safeParse({
      specVersion: runtimeExecuteResponseSpecVersionV1,
      trace: {
        traceId: 'trace-runtime-contract',
        runId: 'run-runtime-contract',
      },
      status: 'succeeded',
      output: {
        text: 'Resposta controlada do runtime.',
        format: 'text',
        metadata: {
          outputHash: 'abc123',
        },
      },
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        latencyMs: 125,
        estimatedCostMinorUnits: '0',
        costCurrency: 'BRL',
      },
      events: [validEvent()],
    });

    expect(result.success).toBe(true);
  });

  it('rejects runtime response output metadata with raw provider response', () => {
    const result = runtimeExecuteResponseV1Schema.safeParse({
      specVersion: runtimeExecuteResponseSpecVersionV1,
      trace: {
        traceId: 'trace-runtime-contract',
        runId: 'run-runtime-contract',
      },
      status: 'succeeded',
      output: {
        text: 'Resposta controlada do runtime.',
        metadata: {
          rawProviderResponse: { text: 'must not pass' },
        },
      },
    });

    expect(result.success).toBe(false);
  });

  it('accepts known normalized error codes', () => {
    const result = runtimeNormalizedErrorV1Schema.safeParse({
      code: 'RUNTIME_TIMEOUT',
      message: 'Runtime excedeu timeout.',
      retryable: true,
      httpStatus: 504,
      details: {
        timeoutMs: 15000,
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown normalized error codes', () => {
    const result = runtimeNormalizedErrorV1Schema.safeParse({
      code: 'RUNTIME_NEW_UNKNOWN_CODE',
      message: 'Unknown code.',
      retryable: false,
    });

    expect(result.success).toBe(false);
  });

  it('accepts valid capabilities and health payloads', () => {
    const capabilities = runtimeCapabilitiesResponseV1Schema.safeParse({
      provider: 'agno',
      protocolVersion: assistantRuntimeSpecVersionV1,
      supportsStreaming: false,
      supportsTools: true,
      supportsRagContext: true,
      supportsFileInputs: false,
      maxInputChars: 16000,
      maxToolCalls: 3,
    });
    const health = runtimeHealthResponseV1Schema.safeParse({
      provider: 'agno',
      protocolVersion: assistantRuntimeSpecVersionV1,
      status: 'healthy',
      checkedAt: '2026-06-30T18:00:00.000Z',
      message: 'Runtime contract endpoint healthy.',
    });

    expect(capabilities.success).toBe(true);
    expect(health.success).toBe(true);
  });

  it('rejects capabilities with incompatible protocol version', () => {
    const result = runtimeCapabilitiesResponseV1Schema.safeParse({
      provider: 'agno',
      protocolVersion: 'orchestra.runtime.assistant.v0',
      supportsStreaming: false,
      supportsTools: true,
      supportsRagContext: true,
      supportsFileInputs: false,
    });

    expect(result.success).toBe(false);
  });

  it('keeps execute request and nested schemas strict', () => {
    const executeRequest = runtimeExecuteRequestV1Schema.safeParse({
      specVersion: runtimeExecuteRequestSpecVersionV1,
      assistantRuntimeSpec: validSpec(),
      extra: 'not-allowed',
    });
    const nestedExtra = assistantRuntimeSpecV1Schema.safeParse(validSpec({
      policy: {
        ...validSpec().policy,
        streaming: false,
        failClosed: true,
        passthrough: true,
      } as AssistantRuntimeSpecV1['policy'],
    }));

    expect(executeRequest.success).toBe(false);
    expect(nestedExtra.success).toBe(false);
  });
});
