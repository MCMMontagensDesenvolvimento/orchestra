import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAgnoRuntimeHttpApp } from '../../src/modules/runtime/agno-runtime-http.app';
import {
  assistantRuntimeSpecVersionV1,
  runtimeCapabilitiesResponseV1Schema,
  runtimeExecuteRequestSpecVersionV1,
  runtimeExecuteResponseV1Schema,
  runtimeHealthResponseV1Schema,
} from '../../src/modules/runtime/runtime-contract.schema';
import type { AssistantRuntimeSpecV1, RuntimeExecuteRequestV1 } from '../../src/modules/runtime/runtime-contract.types';

const originalEnv = { ...process.env };

function validSpec(overrides: Partial<AssistantRuntimeSpecV1> = {}): AssistantRuntimeSpecV1 {
  return {
    specVersion: assistantRuntimeSpecVersionV1,
    trace: {
      traceId: 'trace-runtime-http',
      runId: 'run-runtime-http',
      requestId: 'req-runtime-http',
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
      name: 'Runtime HTTP Assistant',
      status: 'draft',
      locale: 'pt-BR',
    },
    input: {
      message: 'Summarize only the governed context.',
      metadata: {
        source: 'runtime-http-test',
      },
    },
    model: {
      provider: 'local',
      model: 'deterministic-sandbox',
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
      system: 'Use only governed context.',
      developer: 'Do not request secrets.',
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
      contract: '14B',
    },
    ...overrides,
  };
}

function validExecuteRequest(spec = validSpec()): RuntimeExecuteRequestV1 {
  return {
    specVersion: runtimeExecuteRequestSpecVersionV1,
    assistantRuntimeSpec: spec,
  };
}

function app(securityKey: string | null = null) {
  return createAgnoRuntimeHttpApp({ securityKey, requireSecurityKey: false });
}

describe('Agno-compatible minimal runtime HTTP service', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('returns a contract-valid health payload', async () => {
    const response = await request(app()).get('/health').expect(200);

    expect(runtimeHealthResponseV1Schema.safeParse(response.body).success).toBe(true);
    expect(response.body.provider).toBe('agno');
    expect(response.text).not.toContain('OPENAI_API_KEY');
  });

  it('returns a contract-valid capabilities payload', async () => {
    const response = await request(app()).get('/capabilities').expect(200);

    const parsed = runtimeCapabilitiesResponseV1Schema.safeParse(response.body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.supportsStreaming).toBe(false);
      expect(parsed.data.supportsTools).toBe(true);
      expect(parsed.data.supportsRagContext).toBe(true);
      expect(parsed.data.supportsExternalProviders).toBe(false);
      expect(parsed.data.supportsFileInputs).toBe(false);
    }
  });

  it('requires the configured credential on health, capabilities, and execute without echoing it', async () => {
    const fakeCredential = 'phase-16d-runtime-auth-key';
    const protectedApp = app(fakeCredential);

    const unauthorizedHealth = await request(protectedApp).get('/health').expect(401);
    const unauthorizedCapabilities = await request(protectedApp).get('/capabilities').expect(401);
    const unauthorizedExecute = await request(protectedApp)
      .post('/execute')
      .send(validExecuteRequest())
      .expect(401);

    await request(protectedApp)
      .get('/health')
      .set('Authorization', `Bearer ${fakeCredential}`)
      .expect(200);
    await request(protectedApp)
      .get('/capabilities')
      .set('Authorization', `Bearer ${fakeCredential}`)
      .expect(200);
    await request(protectedApp)
      .post('/execute')
      .set('Authorization', `Bearer ${fakeCredential}`)
      .send(validExecuteRequest())
      .expect(200);

    expect(`${unauthorizedHealth.text}${unauthorizedCapabilities.text}${unauthorizedExecute.text}`).not.toContain(fakeCredential);
  });

  it('refuses to start when authentication is required without a configured credential', () => {
    expect(() => createAgnoRuntimeHttpApp({ securityKey: null, requireSecurityKey: true })).toThrow(
      'Agno runtime HTTP authentication is required but not configured.',
    );
  });

  it('returns a contract-valid response for a valid execute request', async () => {
    const response = await request(app())
      .post('/execute')
      .send(validExecuteRequest())
      .expect(200);

    const parsed = runtimeExecuteResponseV1Schema.safeParse(response.body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe('succeeded');
      expect(parsed.data.output?.metadata).toEqual(expect.objectContaining({
        mode: 'sandbox',
        runtimeLatencyMs: 0,
        ragSourceCount: 0,
        ragContextChars: 0,
        toolDescriptorCount: 0,
        externalProviderCalled: false,
        externalMcpCalled: false,
        toolCallsExecuted: 0,
      }));
      expect(parsed.data.usage?.latencyMs).toBe(0);
      expect(parsed.data.output?.text).toContain('runtime Agno-compatible minimo');
    }
  });

  it('accepts governed conversation context and returns only safe quantitative metadata', async () => {
    const previousUser = 'Pergunta anterior';
    const previousAssistant = 'Resposta anterior';
    const response = await request(app())
      .post('/execute')
      .send(validExecuteRequest(validSpec({
        conversationContext: {
          messages: [
            {
              role: 'user',
              content: previousUser,
            },
            {
              role: 'assistant',
              content: previousAssistant,
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
      })))
      .expect(200);

    expect(runtimeExecuteResponseV1Schema.safeParse(response.body).success).toBe(true);
    expect(response.body.output.metadata).toEqual(expect.objectContaining({
      conversationContextIncluded: true,
      conversationContextMessageCount: 2,
      conversationContextChars: previousUser.length + previousAssistant.length,
      conversationContextTruncated: false,
    }));
    expect(response.body.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'run.started',
        metadata: expect.objectContaining({
          conversationContextIncluded: true,
          conversationContextMessageCount: 2,
        }),
      }),
    ]));
    expect(response.text).not.toContain(previousUser);
    expect(response.text).not.toContain(previousAssistant);
  });

  it('preserves traceId and runId on execute', async () => {
    const response = await request(app())
      .post('/execute')
      .send(validExecuteRequest())
      .expect(200);

    expect(response.body.trace).toEqual({
      traceId: 'trace-runtime-http',
      runId: 'run-runtime-http',
    });
  });

  it('does not call external providers during execute', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await request(app())
      .post('/execute')
      .send(validExecuteRequest())
      .expect(200);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns normalized error for invalid payload without echoing raw body', async () => {
    const response = await request(app())
      .post('/execute')
      .send({
        unsafe: {
          rawPrompt: 'must-not-leak',
        },
      })
      .expect(400);

    expect(runtimeExecuteResponseV1Schema.safeParse(response.body).success).toBe(true);
    expect(response.body.error.code).toBe('RUNTIME_BAD_REQUEST');
    expect(response.text).not.toContain('rawPrompt');
    expect(response.text).not.toContain('must-not-leak');
  });

  it.each(['accessToken', 'apiKey'] as const)('rejects dangerous field %s on execute', async (field) => {
    const response = await request(app())
      .post('/execute')
      .send(validExecuteRequest(validSpec({
        metadata: {
          [field]: 'must-not-leak',
        },
      })))
      .expect(400);

    expect(response.body.error.code).toBe('RUNTIME_BAD_REQUEST');
    expect(response.text).not.toContain(field);
    expect(response.text).not.toContain('must-not-leak');
  });

  it('rejects streaming=true because the 14A contract requires false', async () => {
    const payload = validExecuteRequest() as unknown as Record<string, unknown>;
    const spec = payload.assistantRuntimeSpec as Record<string, unknown>;
    spec.policy = {
      ...(spec.policy as Record<string, unknown>),
      streaming: true,
    };

    const response = await request(app())
      .post('/execute')
      .send(payload)
      .expect(400);

    expect(response.body.error.code).toBe('RUNTIME_BAD_REQUEST');
    expect(response.body.status).toBe('failed');
  });

  it('accepts governed tool descriptors without executing external MCP', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app())
      .post('/execute')
      .send(validExecuteRequest(validSpec({
        policy: {
          ...validSpec().policy,
          maxToolCalls: 0,
        },
        tools: {
          enabled: true,
          mode: 'gateway',
          descriptors: [
            {
              toolId: 'tool-1',
              name: 'lookup_policy',
              riskLevel: 'low',
              approvalRequired: false,
              inputSchema: {
                type: 'object',
                properties: { query: { type: 'string' } },
              },
              gatewayRef: {
                type: 'orchestra_tool_gateway',
                action: 'mcp.tool.execute',
              },
            },
          ],
        },
      })))
      .expect(200);

    expect(runtimeExecuteResponseV1Schema.safeParse(response.body).success).toBe(true);
    expect(response.body.status).toBe('succeeded');
    expect(response.body.output.metadata).toEqual(expect.objectContaining({
      toolDescriptorCount: 1,
      externalMcpCalled: false,
      toolCallsExecuted: 0,
    }));
    expect(response.body.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'tool.descriptors.attached',
        metadata: expect.objectContaining({ toolDescriptorCount: 1, toolMode: 'gateway', maxToolCalls: 0 }),
      }),
      expect.objectContaining({
        type: 'tool.blocked',
        metadata: expect.objectContaining({ reason: 'max_tool_calls_zero', externalMcpCalled: false, toolCallsExecuted: 0 }),
      }),
    ]));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.text).not.toMatch(
      /rawToolManifest|rawMcpServerConfig|Authorization|"headers"|"apiKey"|"token"|"secret"|"baseUrl"|"endpoint"|"providerApiKey"|"secretRef"/i,
    );
  });

  it.each([
    { label: 'medium-risk', riskLevel: 'medium' as const, approvalRequired: false },
    { label: 'approval-required', riskLevel: 'high' as const, approvalRequired: true },
  ])('blocks $label descriptors quantitatively without calling a tool', async ({ riskLevel, approvalRequired }) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app())
      .post('/execute')
      .send(validExecuteRequest(validSpec({
        policy: {
          ...validSpec().policy,
          maxToolCalls: 5,
        },
        tools: {
          enabled: true,
          mode: 'gateway',
          descriptors: [{
            toolId: 'tool-governed-blocked',
            name: 'governed_blocked_operation',
            riskLevel,
            approvalRequired,
            gatewayRef: {
              type: 'orchestra_tool_gateway',
              action: 'mcp.tool.execute',
            },
          }],
        },
      })))
      .expect(200);

    expect(response.body.output.metadata).toEqual(expect.objectContaining({
      toolDescriptorCount: 1,
      approvalRequiredCount: 1,
      maxToolCalls: 5,
      toolCallsExecuted: 0,
      externalMcpCalled: false,
    }));
    expect(response.body.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'tool.blocked',
        metadata: expect.objectContaining({
          reason: 'approval_required',
          approvalRequiredCount: 1,
          toolCallsExecuted: 0,
          externalMcpCalled: false,
        }),
      }),
    ]));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.text).not.toMatch(/tool-governed-blocked|governed_blocked_operation/);
  });


  it('rejects unsafe governed tool descriptors without leaking raw MCP payloads', async () => {
    const response = await request(app())
      .post('/execute')
      .send({
        ...validExecuteRequest(),
        assistantRuntimeSpec: {
          ...validSpec(),
        tools: {
          enabled: true,
          mode: 'gateway',
          descriptors: [
            {
              toolId: 'tool-1',
              name: 'lookup_policy',
              riskLevel: 'low',
              approvalRequired: false,
              metadata: {
                rawToolManifest: 'must-not-leak',
                rawMcpServerConfig: 'must-not-leak',
              },
              gatewayRef: {
                type: 'orchestra_tool_gateway',
                action: 'mcp.tool.execute',
              },
            },
          ],
        },
        },
      })
      .expect(400);

    expect(response.body.error.code).toBe('RUNTIME_BAD_REQUEST');
    expect(response.text).not.toContain('rawToolManifest');
    expect(response.text).not.toContain('rawMcpServerConfig');
    expect(response.text).not.toContain('must-not-leak');
  });

  it('accepts safe RAG resolved_context without doing retrieval', async () => {
    const response = await request(app())
      .post('/execute')
      .send(validExecuteRequest(validSpec({
        rag: {
          enabled: true,
          mode: 'resolved_context',
          sources: [
            {
              sourceId: 'source-1',
              documentId: 'document-1',
              chunkId: 'chunk-1',
              title: 'Local Policy',
              excerpt: 'Governed excerpt already resolved by Orquestra.',
              score: 0.9,
            },
          ],
        },
      })))
      .expect(200);

    expect(response.body.output.metadata.ragSourceCount).toBe(1);
    expect(response.body.output.metadata.ragContextChars).toBe('Governed excerpt already resolved by Orquestra.'.length);
    expect(response.body.output.metadata.ragMode).toBe('resolved_context');
    expect(response.body.output.metadata.maxRagResults).toBe(5);
    expect(response.body.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'rag.context.attached',
        metadata: expect.objectContaining({
          ragSourceCount: 1,
          ragContextChars: 'Governed excerpt already resolved by Orquestra.'.length,
          ragMode: 'resolved_context',
          maxRagResults: 5,
        }),
      }),
    ]));
    expect(JSON.stringify(response.body.events)).not.toContain('Governed excerpt already resolved by Orquestra.');
  });

  it('rejects rawDocuments in RAG payloads', async () => {
    const response = await request(app())
      .post('/execute')
      .send(validExecuteRequest(validSpec({
        rag: {
          enabled: true,
          mode: 'resolved_context',
          sources: [
            {
              sourceId: 'source-1',
              excerpt: 'Safe excerpt.',
              metadata: {
                rawDocuments: ['must-not-leak'],
              },
            },
          ],
        },
      })))
      .expect(400);

    expect(response.body.error.code).toBe('RUNTIME_BAD_REQUEST');
    expect(response.text).not.toContain('rawDocuments');
    expect(response.text).not.toContain('must-not-leak');
  });

  it('returns a safe 404 for unknown routes', async () => {
    const response = await request(app()).get('/missing-route').expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
      },
    });
    expect(response.text).not.toContain('process.env');
  });

  it('does not expose envs or secrets through health and capabilities', async () => {
    process.env.OPENAI_API_KEY = 'secret-value';
    process.env.MCP_PRIVATE_TOKEN = 'secret-value';

    const health = await request(app()).get('/health').expect(200);
    const capabilities = await request(app()).get('/capabilities').expect(200);
    const serialized = `${health.text}\n${capabilities.text}`;

    expect(serialized).not.toContain('OPENAI_API_KEY');
    expect(serialized).not.toContain('MCP_PRIVATE_TOKEN');
    expect(serialized).not.toContain('secret-value');
  });

  it('rejects non-json execute payloads', async () => {
    const response = await request(app())
      .post('/execute')
      .set('Content-Type', 'text/plain')
      .send('plain text')
      .expect(415);

    expect(runtimeExecuteResponseV1Schema.safeParse(response.body).success).toBe(true);
    expect(response.body.error.code).toBe('RUNTIME_BAD_REQUEST');
  });
});
