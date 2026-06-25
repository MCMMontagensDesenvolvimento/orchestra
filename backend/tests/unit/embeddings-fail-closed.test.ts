import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

async function loadEmbeddings(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();

  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    DATABASE_URL: originalEnv.DATABASE_URL ?? 'postgresql://orchestra:orchestra@localhost:5432/orchestra',
    JWT_SECRET: 'test-secret',
    EMBEDDINGS_ENABLED: undefined,
    EMBEDDINGS_PROVIDER: undefined,
    EMBEDDINGS_MODEL: undefined,
    EMBEDDINGS_DIMENSION: undefined,
    ...overrides,
  };

  return import('../../src/modules/embeddings');
}

describe('embeddings fail-closed service', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('is disabled and unconfigured by default', async () => {
    const { embeddingsService } = await loadEmbeddings();

    expect(embeddingsService.getEmbeddingReadiness()).toMatchObject({
      enabled: false,
      configured: false,
      executionEnabled: false,
      provider: 'disabled',
      status: 'disabled',
      failClosed: true,
      externalProviderCalled: false,
      rawInputStored: false,
      rawOutputStored: false,
    });
  });

  it('does not expose credential values in readiness', async () => {
    const { embeddingsService } = await loadEmbeddings({
      OPENAI_API_KEY: 'openai-placeholder-key',
      AZURE_OPENAI_API_KEY: 'azure-secret-value',
      EMBEDDINGS_ENABLED: 'true',
      EMBEDDINGS_PROVIDER: 'openai',
      EMBEDDINGS_MODEL: 'text-embedding-3-small',
      EMBEDDINGS_DIMENSION: '1536',
    });

    const serialized = JSON.stringify(embeddingsService.getEmbeddingReadiness());

    expect(serialized).not.toContain('openai-placeholder-key');
    expect(serialized).not.toContain('azure-secret-value');
    expect(serialized).not.toContain('OPENAI_API_KEY');
    expect(serialized.toLowerCase()).not.toContain('authorization');
  });

  it('fails controlled attempts to generate embeddings when disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { embeddingsService } = await loadEmbeddings();

    await expect(embeddingsService.embedText({ text: 'raw text must not be sent externally' })).rejects.toMatchObject({
      status: 409,
      code: 'EMBEDDINGS_DISABLED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed for planned external providers without network calls', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { embeddingsService } = await loadEmbeddings({
      EMBEDDINGS_ENABLED: 'true',
      EMBEDDINGS_PROVIDER: 'openai',
      EMBEDDINGS_MODEL: 'text-embedding-3-small',
      EMBEDDINGS_DIMENSION: '1536',
    });

    const readiness = embeddingsService.getEmbeddingReadiness();
    expect(readiness).toMatchObject({
      enabled: true,
      configured: false,
      executionEnabled: false,
      provider: 'openai',
      status: 'misconfigured',
      failClosed: true,
      externalProviderCalled: false,
    });

    await expect(embeddingsService.embedBatch({ texts: ['one', 'two'] })).rejects.toMatchObject({
      status: 409,
      code: 'EMBEDDING_PROVIDER_NOT_CONFIGURED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
