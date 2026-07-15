import { createHash } from 'node:crypto';
import { getEmbeddingsConfig } from '../embeddings.config';
import { embeddingInputError, embeddingReadinessError } from '../embeddings.errors';
import type {
  EmbedBatchInput,
  EmbeddingProvider,
  EmbeddingReadiness,
  EmbeddingVectorResult,
  EmbedTextInput,
  EmbeddingsConfig,
} from '../embeddings.types';

type StubEmbeddingConfig = Pick<
  EmbeddingsConfig,
  'enabled' | 'provider' | 'executionEnabled' | 'model' | 'dimension' | 'maxInputChars' | 'maxBatchSize'
>;

function deterministicVector(text: string, dimension: number) {
  const vector: number[] = [];
  let counter = 0;
  while (vector.length < dimension) {
    const digest = createHash('sha256').update(`orchestra-stub-v1:${counter}:${text}`, 'utf8').digest();
    for (let offset = 0; offset + 3 < digest.length && vector.length < dimension; offset += 4) {
      const unsigned = digest.readUInt32BE(offset);
      vector.push((unsigned / 0xffffffff) * 2 - 1);
    }
    counter += 1;
  }
  const magnitude = Math.sqrt(vector.reduce((total, item) => total + item * item, 0)) || 1;
  return vector.map((item) => Number((item / magnitude).toFixed(12)));
}

export class DeterministicStubEmbeddingProvider implements EmbeddingProvider {
  readonly provider = 'stub' as const;

  constructor(private readonly configOverride?: StubEmbeddingConfig) {}

  private config(): StubEmbeddingConfig {
    const config = this.configOverride ?? getEmbeddingsConfig();
    return {
      ...config,
      model: config.model ?? 'stub-sha256-v1',
      dimension: config.dimension ?? 32,
    };
  }

  getReadiness(): EmbeddingReadiness {
    const config = this.config();
    const enabled = config.enabled && config.provider === this.provider;
    const executionEnabled = enabled && config.executionEnabled;
    const status = !enabled ? 'disabled' : executionEnabled ? 'ready' : 'configured_but_execution_disabled';
    return {
      enabled,
      configured: enabled,
      executionEnabled,
      provider: this.provider,
      status,
      failClosed: status !== 'ready',
      reason: status === 'ready'
        ? 'Deterministic offline embedding stub is enabled for local or test execution.'
        : status === 'disabled'
          ? 'Deterministic embedding stub is disabled.'
          : 'Deterministic embedding stub is configured, but execution is disabled.',
      model: config.model,
      dimension: config.dimension,
      secretsConfigured: false,
      externalProviderCalled: false,
      rawInputStored: false,
      rawOutputStored: false,
    };
  }

  async embedText(input: EmbedTextInput): Promise<EmbeddingVectorResult> {
    const [result] = await this.embedBatch({
      texts: [input.text],
      requestId: input.requestId,
      model: input.model,
      metadata: input.metadata,
    });
    return result;
  }

  async embedBatch(input: EmbedBatchInput): Promise<EmbeddingVectorResult[]> {
    const readiness = this.getReadiness();
    if (readiness.status !== 'ready' || !readiness.dimension || !readiness.model) {
      throw embeddingReadinessError(readiness);
    }
    const dimension = readiness.dimension;
    const model = readiness.model;
    const config = this.config();
    if (input.texts.length === 0) {
      throw embeddingInputError('EMBEDDING_INPUT_EMPTY', 'Embedding batch must contain at least one text item.');
    }
    if (input.texts.length > config.maxBatchSize) {
      throw embeddingInputError('EMBEDDING_BATCH_TOO_LARGE', 'Embedding batch exceeds the configured item limit.');
    }

    return input.texts.map((rawText) => {
      const text = rawText.trim();
      if (!text) throw embeddingInputError('EMBEDDING_INPUT_EMPTY', 'Embedding input text must not be empty.');
      if (text.length > config.maxInputChars) {
        throw embeddingInputError('EMBEDDING_INPUT_TOO_LARGE', 'Embedding input text exceeds the configured character limit.');
      }
      return {
        provider: this.provider,
        model: input.model ?? model,
        dimension,
        vector: deterministicVector(text, dimension),
        usage: { inputTokens: Math.max(1, Math.ceil(text.length / 4)) },
        metadata: {
          externalProviderCalled: false,
          rawInputStored: false,
          rawOutputStored: false,
          estimatedCost: null,
        },
      };
    });
  }
}

export const deterministicStubEmbeddingProvider = new DeterministicStubEmbeddingProvider();
