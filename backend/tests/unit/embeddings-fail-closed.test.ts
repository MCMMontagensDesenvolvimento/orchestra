import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };
const credentialEnvName = 'OPENAI_API_KEY';

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
    EMBEDDINGS_TIMEOUT_MS: undefined,
    EMBEDDINGS_MAX_INPUT_CHARS: undefined,
    EMBEDDINGS_MAX_BATCH_SIZE: undefined,
    EMBEDDINGS_STORE_RAW_INPUTS: undefined,
    EMBEDDINGS_STORE_RAW_OUTPUTS: undefined,
    [credentialEnvName]: undefined,
    ...overrides,
  };

  return import('../../src/modules/embeddings');
}

function readyEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    EMBEDDINGS_ENABLED: 'true',
    EMBEDDINGS_PROVIDER: 'openai',
    EMBEDDINGS_EXECUTION_ENABLED: 'true',
    EMBEDDINGS_MODEL: 'text-embedding-3-small',
    EMBEDDINGS_DIMENSION: '3',
    EMBEDDINGS_TIMEOUT_MS: '1000',
    EMBEDDINGS_MAX_INPUT_CHARS: '40',
    EMBEDDINGS_MAX_BATCH_SIZE: '2',
    [credentialEnvName]: 'openai-placeholder-key',
    ...overrides,
  };
}

function mockEmbeddingFetch(vectors: number[][], status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify({
      model: 'text-embedding-3-small',
      data: vectors.map((embedding, index) => ({ embedding, index })),
      usage: { prompt_tokens: 7 },
    })),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
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
    const { embeddingsService } = await loadEmbeddings(readyEnv({
      EMBEDDINGS_EXECUTION_ENABLED: 'false',
    }));

    const serialized = JSON.stringify(embeddingsService.getEmbeddingReadiness());

    expect(serialized).not.toContain('openai-placeholder-key');
    expect(serialized).not.toContain(credentialEnvName);
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
      [credentialEnvName]: '',
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

  it('recognizes configured OpenAI embeddings but blocks execution when disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { embeddingsService } = await loadEmbeddings(readyEnv({ EMBEDDINGS_EXECUTION_ENABLED: 'false' }));

    expect(embeddingsService.getEmbeddingReadiness()).toMatchObject({
      enabled: true,
      configured: true,
      executionEnabled: false,
      provider: 'openai',
      status: 'configured_but_execution_disabled',
      failClosed: true,
      model: 'text-embedding-3-small',
      dimension: 3,
      secretsConfigured: true,
      externalProviderCalled: false,
      rawInputStored: false,
      rawOutputStored: false,
    });

    await expect(embeddingsService.embedText({ text: 'must not leave backend while disabled' })).rejects.toMatchObject({
      status: 409,
      code: 'EMBEDDING_EXECUTION_DISABLED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks OpenAI embeddings ready only when execution is explicitly enabled', async () => {
    const { embeddingsService } = await loadEmbeddings(readyEnv());

    expect(embeddingsService.getEmbeddingReadiness()).toMatchObject({
      enabled: true,
      configured: true,
      executionEnabled: true,
      provider: 'openai',
      status: 'ready',
      failClosed: false,
      secretsConfigured: true,
    });
  });

  it('embedText uses mocked HTTP client and returns a vector when ready', async () => {
    const fetchMock = mockEmbeddingFetch([[0.1, 0.2, 0.3]]);
    const { embeddingsService } = await loadEmbeddings(readyEnv());

    const result = await embeddingsService.embedText({ text: 'governed embedding input' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimension: 3,
      vector: [0.1, 0.2, 0.3],
      usage: { inputTokens: 7 },
      metadata: {
        externalProviderCalled: true,
        rawInputStored: false,
        rawOutputStored: false,
        estimatedCost: null,
      },
    });
    expect(JSON.stringify(result)).not.toContain('governed embedding input');
  });

  it('embedBatch uses mocked HTTP client and returns multiple vectors when ready', async () => {
    const fetchMock = mockEmbeddingFetch([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
    const { embeddingsService } = await loadEmbeddings(readyEnv());

    const results = await embeddingsService.embedBatch({ texts: ['first', 'second'] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.map((result) => result.vector)).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
  });

  it('rejects empty text, oversized text and oversized batches before calling the provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { embeddingsService } = await loadEmbeddings(readyEnv());

    await expect(embeddingsService.embedText({ text: '   ' })).rejects.toMatchObject({
      code: 'EMBEDDING_INPUT_EMPTY',
    });
    await expect(embeddingsService.embedText({ text: 'x'.repeat(41) })).rejects.toMatchObject({
      code: 'EMBEDDING_INPUT_TOO_LARGE',
    });
    await expect(embeddingsService.embedBatch({ texts: ['one', 'two', 'three'] })).rejects.toMatchObject({
      code: 'EMBEDDING_BATCH_TOO_LARGE',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails controlled when provider vector dimension differs from configuration', async () => {
    mockEmbeddingFetch([[0.1, 0.2]]);
    const { embeddingsService } = await loadEmbeddings(readyEnv());

    await expect(embeddingsService.embedText({ text: 'dimension mismatch' })).rejects.toMatchObject({
      status: 502,
      code: 'EMBEDDING_DIMENSION_MISMATCH',
    });
  });

  it('converts provider HTTP errors without leaking credentials', async () => {
    mockEmbeddingFetch([], 429);
    const { embeddingsService } = await loadEmbeddings(readyEnv());

    await expect(embeddingsService.embedText({ text: 'rate limit scenario' })).rejects.toMatchObject({
      status: 502,
      code: 'EMBEDDING_PROVIDER_REQUEST_FAILED',
    });
  });

  it('converts provider timeouts without network dependency', async () => {
    const { EmbeddingHttpTimeoutError, OpenAiEmbeddingProvider } = await loadEmbeddings(readyEnv());
    const provider = new OpenAiEmbeddingProvider({
      httpClient: {
        postJson: vi.fn().mockRejectedValue(new EmbeddingHttpTimeoutError()),
      },
    });

    await expect(provider.embedText({ text: 'timeout scenario' })).rejects.toMatchObject({
      status: 504,
      code: 'EMBEDDING_PROVIDER_TIMEOUT',
    });
  });
});
