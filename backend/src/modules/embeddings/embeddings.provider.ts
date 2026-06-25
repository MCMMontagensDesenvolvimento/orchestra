import { getEmbeddingsConfig } from './embeddings.config';
import { embeddingReadinessError } from './embeddings.errors';
import type {
  EmbedBatchInput,
  EmbeddingProvider,
  EmbeddingProviderStatus,
  EmbeddingReadiness,
  EmbeddingVectorResult,
  EmbedTextInput,
} from './embeddings.types';

function providerStatus(config = getEmbeddingsConfig()): EmbeddingProviderStatus {
  if (!config.enabled || config.provider === 'disabled') return 'disabled';
  return 'misconfigured';
}

function readinessReason(readiness: Pick<EmbeddingReadiness, 'provider' | 'status'>) {
  if (readiness.status === 'disabled') {
    return 'Embeddings are disabled by backend configuration.';
  }
  return `Embedding provider "${readiness.provider}" is planned, but no real embedding provider is configured in this phase.`;
}

export class DisabledEmbeddingProvider implements EmbeddingProvider {
  readonly provider = 'disabled' as const;

  getReadiness(): EmbeddingReadiness {
    const config = getEmbeddingsConfig();
    const status = providerStatus(config);
    const provider = config.enabled ? config.provider : 'disabled';
    const readiness: EmbeddingReadiness = {
      enabled: config.enabled,
      configured: false,
      executionEnabled: false,
      provider,
      status,
      failClosed: true,
      reason: '',
      model: config.model,
      dimension: config.dimension,
      externalProviderCalled: false,
      rawInputStored: false,
      rawOutputStored: false,
    };

    return {
      ...readiness,
      reason: readinessReason(readiness),
    };
  }

  async embedText(input: EmbedTextInput): Promise<EmbeddingVectorResult> {
    void input;
    throw embeddingReadinessError(this.getReadiness());
  }

  async embedBatch(input: EmbedBatchInput): Promise<EmbeddingVectorResult[]> {
    void input;
    throw embeddingReadinessError(this.getReadiness());
  }
}

export const disabledEmbeddingProvider = new DisabledEmbeddingProvider();
