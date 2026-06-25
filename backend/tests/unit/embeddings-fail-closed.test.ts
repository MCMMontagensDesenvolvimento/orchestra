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
    EMBEDDINGS_EXECUTION_ENABLED: undefined,
    EMBEDDINGS_MODEL: undefined,
    EMBEDDINGS_DIMENSION: undefined,
    EMBEDDINGS_STORE_RAW_INPUTS: undefined,
    EMBEDDINGS_STORE_RAW_OUTPUTS: undefined,
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
      secretsConfigured: false,
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

  it('marks OpenAI embeddings misconfigured when required backend-only config is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { embeddingsService } = await loadEmbeddings({
      EMBEDDINGS_ENABLED: 'true',
      EMBEDDINGS_PROVIDER: 'openai',
      EMBEDDINGS_MODEL: '',
      EMBEDDINGS_DIMENSION: '',
      OPENAI_API_KEY: '',
    });

    const readiness = embeddingsService.getEmbeddingReadiness();
    expect(readiness).toMatchObject({
      enabled: true,
      configured: false,
      executionEnabled: false,
      provider: 'openai',
      status: 'misconfigured',
      failClosed: true,
      secretsConfigured: false,
      externalProviderCalled: false,
    });

    await expect(embeddingsService.embedBatch({ texts: ['one', 'two'] })).rejects.toMatchObject({
      status: 409,
      code: 'EMBEDDING_PROVIDER_NOT_CONFIGURED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recognizes configured OpenAI embeddings but blocks execution by default', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { embeddingsService } = await loadEmbeddings({
      EMBEDDINGS_ENABLED: 'true',
      EMBEDDINGS_PROVIDER: 'openai',
      EMBEDDINGS_EXECUTION_ENABLED: 'false',
      EMBEDDINGS_MODEL: 'text-embedding-3-small',
      EMBEDDINGS_DIMENSION: '1536',
      OPENAI_API_KEY: 'openai-placeholder-key',
    });

    expect(embeddingsService.getEmbeddingReadiness()).toMatchObject({
      enabled: true,
      configured: true,
      executionEnabled: false,
      provider: 'openai',
      status: 'configured_but_execution_disabled',
      failClosed: true,
      model: 'text-embedding-3-small',
      dimension: 1536,
      secretsConfigured: true,
      externalProviderCalled: false,
      rawInputStored: false,
      rawOutputStored: false,
    });

    await expect(embeddingsService.embedText({ text: 'must not leave backend during 10E' })).rejects.toMatchObject({
      status: 409,
      code: 'EMBEDDING_EXECUTION_DISABLED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps OpenAI execution blocked even when the execution flag is explicitly requested in 10E', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { embeddingsService } = await loadEmbeddings({
      EMBEDDINGS_ENABLED: 'true',
      EMBEDDINGS_PROVIDER: 'openai',
      EMBEDDINGS_EXECUTION_ENABLED: 'true',
      EMBEDDINGS_MODEL: 'text-embedding-3-small',
      EMBEDDINGS_DIMENSION: '1536',
      OPENAI_API_KEY: 'openai-placeholder-key',
    });

    expect(embeddingsService.getEmbeddingReadiness()).toMatchObject({
      configured: true,
      executionEnabled: false,
      status: 'configured_but_execution_disabled',
      failClosed: true,
    });

    await expect(embeddingsService.embedBatch({ texts: ['one', 'two'] })).rejects.toMatchObject({
      status: 409,
      code: 'EMBEDDING_EXECUTION_DISABLED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
