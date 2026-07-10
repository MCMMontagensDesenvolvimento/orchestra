import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRuntimeExecutionContext } from '../../src/modules/runtime/runtime.context';

const mocks = vi.hoisted(() => ({
  getRuntimeContextSummary: vi.fn(),
}));

vi.mock('../../src/modules/agent-runs/agent-runs.repository', () => ({
  agentRunsRepository: {
    getRuntimeContextSummary: mocks.getRuntimeContextSummary,
  },
}));

function input() {
  return {
    requestId: 'req-rag-context-1',
    traceId: 'trace-rag-context-1',
    runId: 'run-rag-context-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    assistant: {
      id: 'assistant-1',
      name: 'Governed RAG Assistant',
      description: 'Uses only resolved Orchestra context.',
      status: 'published',
      versions: [{
        id: 'version-1',
        instructions: 'Answer with governed evidence.',
        modelProvider: 'openai',
        modelName: 'test-model',
        temperature: 0.2,
      }],
    },
    assistantVersionId: 'version-1',
    assistantPublicationId: 'publication-1',
    executionMode: 'published' as const,
    provider: 'agno_http' as const,
    input: 'Current governed question.',
    executionPolicy: {
      allowExternalLlmProviders: true,
      allowedLlmProviders: ['openai'],
      defaultLlmProvider: 'openai',
    },
    precheckSnapshot: {
      canExecute: true,
      mode: 'published' as const,
      reasons: [],
      requestId: 'req-rag-context-1',
    },
  };
}

describe('governed RAG runtime context', () => {
  beforeEach(() => {
    mocks.getRuntimeContextSummary.mockResolvedValue({
      knowledgeBindingsCount: 1,
      chunkCount: 3,
      sourceReferenceCount: 3,
      lastRagQuery: { id: 'old-query', status: 'completed', resultCount: 1 },
      sourceReferences: [{
        id: 'old-source',
        label: 'Old source',
        sourceUri: 'internal://old-source',
        documentId: 'old-document',
        chunkId: 'old-chunk',
        document: { title: 'Old document' },
        chunk: { content: 'Old content must not be reused.' },
      }],
      mcpBindings: [],
      lastToolCallIds: [],
    });
  });

  it('uses only the resolved results from the current Orchestra retrieval', async () => {
    const context = await buildRuntimeExecutionContext({
      ...input(),
      resolvedRag: {
        queryId: 'current-query',
        status: 'completed',
        sourceReferences: [{
          id: 'current-source',
          label: '[1]',
          documentId: 'current-document',
          chunkId: 'current-chunk',
          documentTitle: 'Current document',
          excerpt: 'Current governed excerpt.',
          score: 0.91,
        }],
      },
    });

    expect(context.rag).toEqual(expect.objectContaining({
      ragReady: true,
      lastRagQueryId: 'current-query',
      sourceReferences: [expect.objectContaining({ id: 'current-source' })],
    }));
    expect(JSON.stringify(context.rag.sourceReferences)).not.toMatch(/old-source|old-document|Old content|internal:\/\//);
  });

  it('does not reuse older sources when the current retrieval is blocked', async () => {
    const context = await buildRuntimeExecutionContext({
      ...input(),
      resolvedRag: {
        queryId: 'blocked-query',
        status: 'blocked',
        sourceReferences: [],
      },
    });

    expect(context.rag.ragReady).toBe(false);
    expect(context.rag.lastRagQueryId).toBe('blocked-query');
    expect(context.rag.sourceReferences).toEqual([]);
  });
});
