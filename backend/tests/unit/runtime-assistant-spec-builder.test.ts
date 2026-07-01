import type { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assistantRuntimeSpecV1Schema,
  buildAssistantRuntimeSpecV1,
} from '../../src/modules/runtime';
import type { RuntimeExecutionContext } from '../../src/modules/runtime/runtime.types';

function context(overrides: Partial<RuntimeExecutionContext> = {}): RuntimeExecutionContext {
  return {
    requestId: 'req-builder-1',
    traceId: 'trace-builder-1',
    runId: 'run-builder-1',
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
      name: 'Builder Assistant',
      status: 'draft',
      description: 'Builds safe specs.',
      objective: 'Validate runtime contract.',
    },
    compiledPrompt: {
      mode: 'placeholder',
      assistantVersionId: 'version-1',
      instructionChars: 31,
      instructionsPreview: 'Use only governed instructions.',
      modelProvider: 'openai',
      modelName: 'tenant-selected-model',
      temperature: 0.3,
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
      requestId: 'req-builder-1',
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
          excerpt: 'Governed excerpt that must not be sent by default in 14C.',
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
          name: 'lookup_policy',
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
      preview: 'Summarize governed context.',
      raw: 'Summarize governed context with a complete user message.',
    },
    metadata: {
      safe: 'value',
    } as Prisma.InputJsonValue,
    ...overrides,
  };
}

describe('AssistantRuntimeSpecV1 builder for Agno HTTP', () => {
  it('builds a minimal valid runtime spec', () => {
    const spec = buildAssistantRuntimeSpecV1({ context: context(), timeoutMs: 15000 });

    expect(assistantRuntimeSpecV1Schema.safeParse(spec).success).toBe(true);
    expect(spec.trace).toEqual({
      traceId: 'trace-builder-1',
      runId: 'run-builder-1',
      requestId: 'req-builder-1',
    });
    expect(spec.policy).toEqual(expect.objectContaining({
      executionMode: 'sync',
      streaming: false,
      failClosed: true,
      timeoutMs: 15000,
    }));
  });

  it('sanitizes dangerous metadata before building the spec', () => {
    const spec = buildAssistantRuntimeSpecV1({
      context: context({
        metadata: {
          apiKey: 'must-not-leak',
          secret: 'must-not-leak',
          token: 'must-not-leak',
          headers: { Authorization: 'Bearer must-not-leak' },
          baseUrl: 'https://internal.example.invalid',
          providerApiKey: 'must-not-leak',
          secretRef: 'must-not-leak',
          rawPrompt: 'must-not-leak',
          rawResponse: 'must-not-leak',
          rawProviderResponse: 'must-not-leak',
          rawDocuments: ['must-not-leak'],
          safe: 'kept',
        } as Prisma.InputJsonValue,
      }),
      timeoutMs: 15000,
    });
    const serialized = JSON.stringify(spec);

    expect(serialized).toContain('kept');
    expect(serialized).not.toMatch(/must-not-leak|apiKey|secretRef|rawPrompt|rawResponse|rawProviderResponse|rawDocuments|Authorization|baseUrl|providerApiKey/);
  });

  it('keeps RAG and tools disabled by default in 14C', () => {
    const spec = buildAssistantRuntimeSpecV1({ context: context(), timeoutMs: 15000 });

    expect(spec.rag).toEqual({ enabled: false, mode: 'none', sources: [] });
    expect(spec.tools).toEqual({ enabled: false, mode: 'none', descriptors: [] });
  });

  it('uses provider and model from authorized context without hardcoded defaults', () => {
    const spec = buildAssistantRuntimeSpecV1({
      context: context({
        compiledPrompt: {
          ...context().compiledPrompt,
          modelProvider: 'openai',
          modelName: 'tenant-workspace-model',
        },
      }),
      timeoutMs: 15000,
    });

    expect(spec.model.provider).toBe('openai');
    expect(spec.model.model).toBe('tenant-workspace-model');
    expect(JSON.stringify(spec)).not.toContain('gpt-4o-mini');
  });

  it('falls back to local deterministic model without provider secrets', () => {
    const spec = buildAssistantRuntimeSpecV1({
      context: context({
        compiledPrompt: {
          ...context().compiledPrompt,
          modelProvider: null,
          modelName: null,
        },
      }),
      timeoutMs: 15000,
    });
    const serialized = JSON.stringify(spec);

    expect(spec.model.provider).toBe('local');
    expect(spec.model.model).toBe('deterministic-sandbox');
    expect(serialized).not.toMatch(/apiKey|secret|token|headers|baseUrl|providerApiKey|secretRef/i);
  });
});
