import type { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../src/config/env';
import { llmService } from '../../src/modules/llm/llm.service';
import { LocalDeterministicRuntimeAdapter } from '../../src/modules/runtime/runtime.local-adapter';
import type { RuntimeExecutionContext } from '../../src/modules/runtime/runtime.types';

const originalRuntimeEnv = {
  RUNTIME_ADAPTER_ENABLED: env.RUNTIME_ADAPTER_ENABLED,
  RUNTIME_REQUEST_TIMEOUT_MS: env.RUNTIME_REQUEST_TIMEOUT_MS,
};

function context(overrides: Partial<RuntimeExecutionContext> = {}): RuntimeExecutionContext {
  return {
    requestId: 'req-local-provider-context',
    traceId: 'trace-local-provider-context',
    runId: 'run-local-provider-context',
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    assistantId: 'assistant-1',
    assistantVersionId: 'version-1',
    assistantPublicationId: null,
    executionMode: 'draft_test',
    provider: 'local',
    assistant: {
      id: 'assistant-1',
      name: 'Provider Context Assistant',
      status: 'draft',
      description: 'Assistant for provider context tests.',
      objective: 'Validate provider context.',
    },
    compiledPrompt: {
      mode: 'placeholder',
      assistantVersionId: 'version-1',
      instructionChars: 35,
      instructionsPreview: 'Use only governed conversation context.',
      modelProvider: 'openai',
      modelName: 'gpt-governed-context',
      temperature: 0.2,
    },
    executionPolicySnapshot: {
      executionMode: 'draft_test',
      allowExternalLlmProviders: true,
      allowedLlmProviders: ['openai'],
      defaultLlmProvider: 'openai',
    } as Prisma.InputJsonValue,
    llmPolicySnapshot: {
      allowExternalLlmProviders: true,
      allowedLlmProviders: ['openai'],
      defaultLlmProvider: 'openai',
    },
    precheckSnapshot: {
      canExecute: true,
      mode: 'draft_test',
      reasons: [],
      requestId: 'req-local-provider-context',
    },
    responseScope: {
      mode: 'knowledge_first',
      ragIntentDetected: false,
      ragSkippedReason: 'no_knowledge_intent_detected',
      fallbackOutsideKnowledgeUsed: true,
      rawContentLogged: false,
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
    conversationContext: {
      messages: [
        {
          messageId: 'message-previous-user',
          role: 'user',
          content: 'Primeira fala governada.',
          createdAt: '2026-07-09T10:00:00.000Z',
        },
        {
          messageId: 'message-previous-assistant',
          role: 'assistant',
          content: 'Resposta anterior governada.',
          createdAt: '2026-07-09T10:00:01.000Z',
        },
      ],
      summary: {
        enabled: true,
        included: true,
        messageCount: 2,
        totalChars: 'Primeira fala governada.'.length + 'Resposta anterior governada.'.length,
        truncated: false,
        maxMessages: 12,
        maxMessageChars: 1200,
        maxTotalChars: 6000,
      },
    },
    input: {
      hash: 'input-hash-local-provider-context',
      preview: 'Mensagem atual separada.',
      raw: 'Mensagem atual separada.',
    },
    ...overrides,
  };
}

describe('local runtime governed external provider context', () => {
  beforeEach(() => {
    Object.assign(env, {
      RUNTIME_ADAPTER_ENABLED: true,
      RUNTIME_REQUEST_TIMEOUT_MS: 15000,
    });
  });

  afterEach(() => {
    Object.assign(env, originalRuntimeEnv);
    vi.restoreAllMocks();
  });

  it('passes governed conversation context to the external provider request without message ids', async () => {
    const adapter = new LocalDeterministicRuntimeAdapter();
    const generateForRuntime = vi.spyOn(llmService, 'generateForRuntime').mockResolvedValueOnce({
      provider: 'openai',
      status: 'completed',
      message: 'Fake external provider completed.',
      model: 'gpt-governed-context',
      outputPreview: 'Resposta externa fake.',
      outputHash: 'output-hash',
      inputHash: 'input-hash-local-provider-context',
      latencyMs: 3,
      metadata: {
        externalProviderCalled: true,
        conversationContextIncluded: true,
        conversationContextMessageCount: 2,
        conversationContextChars: 'Primeira fala governada.'.length + 'Resposta anterior governada.'.length,
        conversationContextTruncated: false,
      },
    });

    const result = await adapter.execute(context());

    expect(result.status).toBe('completed');
    expect(generateForRuntime).toHaveBeenCalledTimes(1);

    const request = generateForRuntime.mock.calls[0][0];
    expect(request.provider).toBe('openai');
    expect(request.model).toBe('gpt-governed-context');
    expect(request.input.raw).toBe('Mensagem atual separada.');
    expect(request.conversationContext?.messages).toEqual([
      { role: 'user', content: 'Primeira fala governada.' },
      { role: 'assistant', content: 'Resposta anterior governada.' },
    ]);
    expect(request.conversationContext?.summary).toEqual(expect.objectContaining({
      included: true,
      messageCount: 2,
      totalChars: 'Primeira fala governada.'.length + 'Resposta anterior governada.'.length,
      truncated: false,
    }));
    expect(JSON.stringify(request.conversationContext)).not.toMatch(/message-previous|messageId|createdAt/);

    expect(result.metadata).toEqual(expect.objectContaining({
      llmProvider: 'openai',
      externalProviderCalled: true,
      conversationContextIncluded: true,
      conversationContextMessageCount: 2,
      conversationContextChars: 'Primeira fala governada.'.length + 'Resposta anterior governada.'.length,
      conversationContextTruncated: false,
    }));
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'runtime_llm_context_attached',
        metadata: expect.objectContaining({
          conversationContextIncluded: true,
          conversationContextMessageCount: 2,
        }),
      }),
      expect.objectContaining({
        type: 'llm_generation_started',
        metadata: expect.objectContaining({
          llmProvider: 'openai',
          externalProviderCalled: true,
          conversationContextIncluded: true,
        }),
      }),
    ]));
    expect(JSON.stringify(result.events)).not.toContain('Primeira fala governada.');
    expect(JSON.stringify(result.events)).not.toContain('Resposta anterior governada.');
    expect(JSON.stringify(result.events)).not.toContain('message-previous-user');
    expect(JSON.stringify(result.events)).not.toContain('message-previous-assistant');
  });
});
