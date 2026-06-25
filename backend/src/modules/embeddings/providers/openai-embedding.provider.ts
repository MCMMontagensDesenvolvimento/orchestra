import { getEmbeddingsConfig } from '../embeddings.config';
import {
  embeddingInputError,
  embeddingProviderError,
  embeddingProviderTimeoutError,
  embeddingReadinessError,
} from '../embeddings.errors';
import {
  EmbeddingHttpTimeoutError,
  fetchEmbeddingHttpClient,
  type EmbeddingHttpClient,
} from '../embeddings.http-client';
import type {
  EmbedBatchInput,
  EmbeddingProvider,
  EmbeddingProviderStatus,
  EmbeddingReadiness,
  EmbeddingVectorResult,
  EmbedTextInput,
} from '../embeddings.types';

interface OpenAiEmbeddingProviderOptions {
  httpClient?: EmbeddingHttpClient;
}

interface OpenAiEmbeddingBody {
  data?: Array<{
    embedding?: unknown;
    index?: number;
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
  };
}

function openAiStatus(config = getEmbeddingsConfig()): EmbeddingProviderStatus {
  if (!config.enabled || config.provider !== 'openai') return 'disabled';
  if (!config.openaiCredentialConfigured || !config.model || !config.dimension) return 'misconfigured';
  if (!config.executionEnabled) return 'configured_but_execution_disabled';
  return 'ready';
}

function reason(readiness: Pick<EmbeddingReadiness, 'status'>) {
  if (readiness.status === 'disabled') return 'OpenAI embeddings are disabled by backend configuration.';
  if (readiness.status === 'misconfigured') {
    return 'OpenAI embeddings require backend-only credential, model and dimension configuration.';
  }
  if (readiness.status === 'configured_but_execution_disabled') {
    return 'OpenAI embeddings are configured, but embedding execution is disabled by configuration.';
  }
  return 'OpenAI embeddings are configured and execution is explicitly enabled.';
}

function normalizeText(value: string, maxInputChars: number) {
  const text = value.trim();
  if (!text) {
    throw embeddingInputError('EMBEDDING_INPUT_EMPTY', 'Embedding input text must not be empty.');
  }
  if (text.length > maxInputChars) {
    throw embeddingInputError('EMBEDDING_INPUT_TOO_LARGE', 'Embedding input text exceeds the configured character limit.');
  }
  return text;
}

function assertVector(value: unknown, expectedDimension: number) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'number' && Number.isFinite(item))) {
    throw embeddingProviderError('EMBEDDING_PROVIDER_INVALID_RESPONSE', 'Embedding provider returned an invalid vector.');
  }

  if (value.length !== expectedDimension) {
    throw embeddingProviderError('EMBEDDING_DIMENSION_MISMATCH', 'Embedding provider returned a vector with unexpected dimension.');
  }

  return value;
}

function endpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, '')}/embeddings`;
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly provider = 'openai' as const;
  private readonly httpClient: EmbeddingHttpClient;

  constructor(options: OpenAiEmbeddingProviderOptions = {}) {
    this.httpClient = options.httpClient ?? fetchEmbeddingHttpClient;
  }

  getReadiness(): EmbeddingReadiness {
    const config = getEmbeddingsConfig();
    const status = openAiStatus(config);
    const configured = status === 'configured_but_execution_disabled' || status === 'ready';
    const executionEnabled = status === 'ready';

    const readiness: EmbeddingReadiness = {
      enabled: config.enabled && config.provider === this.provider,
      configured,
      executionEnabled,
      provider: this.provider,
      status,
      failClosed: status !== 'ready',
      reason: '',
      model: config.model,
      dimension: config.dimension,
      secretsConfigured: config.openaiCredentialConfigured,
      externalProviderCalled: false,
      rawInputStored: false,
      rawOutputStored: false,
    };

    return {
      ...readiness,
      reason: reason(readiness),
    };
  }

  async embedText(input: EmbedTextInput): Promise<EmbeddingVectorResult> {
    const [result] = await this.embedBatch({ texts: [input.text], requestId: input.requestId, model: input.model, metadata: input.metadata });
    return result;
  }

  async embedBatch(input: EmbedBatchInput): Promise<EmbeddingVectorResult[]> {
    const readiness = this.getReadiness();
    if (readiness.status !== 'ready') {
      throw embeddingReadinessError(readiness);
    }

    const config = getEmbeddingsConfig();
    if (!config.model || !config.dimension || !config.openaiCredential) {
      throw embeddingReadinessError({ ...readiness, status: 'misconfigured', reason: reason({ status: 'misconfigured' }) });
    }
    const configuredModel = config.model;
    const configuredDimension = config.dimension;

    if (input.texts.length === 0) {
      throw embeddingInputError('EMBEDDING_INPUT_EMPTY', 'Embedding batch must contain at least one text item.');
    }
    if (input.texts.length > config.maxBatchSize) {
      throw embeddingInputError('EMBEDDING_BATCH_TOO_LARGE', 'Embedding batch exceeds the configured item limit.');
    }

    const texts = input.texts.map((text) => normalizeText(text, config.maxInputChars));
    const model = input.model ?? configuredModel;

    let body: OpenAiEmbeddingBody;
    try {
      const response = await this.httpClient.postJson({
        url: endpoint(config.openaiBaseUrl),
        timeoutMs: config.timeoutMs,
        headers: {
          authorization: `Bearer ${config.openaiCredential}`,
          'content-type': 'application/json',
        },
        body: {
          model,
          input: texts.length === 1 ? texts[0] : texts,
          encoding_format: 'float',
        },
      });

      if (!response.ok) {
        throw embeddingProviderError('EMBEDDING_PROVIDER_REQUEST_FAILED', `Embedding provider request failed with status ${response.status}.`);
      }

      body = response.body as OpenAiEmbeddingBody;
    } catch (error) {
      if (error instanceof EmbeddingHttpTimeoutError) {
        throw embeddingProviderTimeoutError();
      }
      if (error instanceof Error && error.name === 'AppError') {
        throw error;
      }
      throw embeddingProviderError('EMBEDDING_PROVIDER_REQUEST_FAILED', 'Embedding provider request failed.');
    }

    const data = [...(body.data ?? [])].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
    if (data.length !== texts.length) {
      throw embeddingProviderError('EMBEDDING_PROVIDER_INVALID_RESPONSE', 'Embedding provider returned an unexpected number of vectors.');
    }

    return data.map((item) => ({
      provider: this.provider,
      model: body.model ?? model,
      dimension: configuredDimension,
      vector: assertVector(item.embedding, configuredDimension),
      usage: {
        inputTokens: body.usage?.prompt_tokens ?? null,
      },
      metadata: {
        externalProviderCalled: true,
        rawInputStored: false,
        rawOutputStored: false,
        estimatedCost: null,
      },
    }));
  }
}

export const openAiEmbeddingProvider = new OpenAiEmbeddingProvider();
