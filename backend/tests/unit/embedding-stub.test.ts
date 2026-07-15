import { describe, expect, it, vi } from 'vitest';
import { DeterministicStubEmbeddingProvider } from '../../src/modules/embeddings/providers/stub-embedding.provider';

const readyConfig = {
  enabled: true,
  provider: 'stub' as const,
  executionEnabled: true,
  model: 'stub-test-v1',
  dimension: 8,
  maxInputChars: 40,
  maxBatchSize: 2,
};

describe('deterministic stub embedding provider', () => {
  it('returns deterministic normalized vectors without calling external fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const provider = new DeterministicStubEmbeddingProvider(readyConfig);

    const first = await provider.embedText({ text: 'orchestra knowledge' });
    const second = await provider.embedText({ text: 'orchestra knowledge' });
    const other = await provider.embedText({ text: 'orchestra runtime' });

    expect(first).toMatchObject({
      provider: 'stub',
      model: 'stub-test-v1',
      dimension: 8,
      metadata: {
        externalProviderCalled: false,
        rawInputStored: false,
        rawOutputStored: false,
      },
    });
    expect(first.vector).toEqual(second.vector);
    expect(first.vector).not.toEqual(other.vector);
    expect(first.vector).toHaveLength(8);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('fails closed when configured but execution is disabled', async () => {
    const provider = new DeterministicStubEmbeddingProvider({
      ...readyConfig,
      executionEnabled: false,
    });

    expect(provider.getReadiness()).toMatchObject({
      provider: 'stub',
      status: 'configured_but_execution_disabled',
      failClosed: true,
      externalProviderCalled: false,
    });
    await expect(provider.embedText({ text: 'blocked' })).rejects.toMatchObject({
      status: 409,
      code: 'EMBEDDING_EXECUTION_DISABLED',
    });
  });

  it('enforces input and batch limits before returning vectors', async () => {
    const provider = new DeterministicStubEmbeddingProvider(readyConfig);

    await expect(provider.embedText({ text: 'x'.repeat(41) })).rejects.toMatchObject({
      status: 422,
      code: 'EMBEDDING_INPUT_TOO_LARGE',
    });
    await expect(provider.embedBatch({ texts: ['one', 'two', 'three'] })).rejects.toMatchObject({
      status: 422,
      code: 'EMBEDDING_BATCH_TOO_LARGE',
    });
  });
});
