import { getEmbeddingsConfig } from '../embeddings.config';
import { embeddingReadinessError } from '../embeddings.errors';
import type {
  EmbedBatchInput,
  EmbeddingProvider,
  EmbeddingProviderStatus,
  EmbeddingReadiness,
  EmbeddingVectorResult,
  EmbedTextInput,
} from '../embeddings.types';

function openAiStatus(config = getEmbeddingsConfig()): EmbeddingProviderStatus {
  if (!config.enabled || config.provider !== 'openai') return 'disabled';
  if (!config.openaiApiKeyConfigured || !config.model || !config.dimension) return 'misconfigured';
  return 'configured_but_execution_disabled';
}

function reason(readiness: Pick<EmbeddingReadiness, 'status'>) {
  if (readiness.status === 'disabled') return 'OpenAI embeddings are disabled by backend configuration.';
  if (readiness.status === 'misconfigured') {
    return 'OpenAI embeddings require backend-only credential, model and dimension configuration.';
  }
  return 'OpenAI embeddings are configured, but real embedding execution remains disabled in this phase.';
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly provider = 'openai' as const;

  getReadiness(): EmbeddingReadiness {
    const config = getEmbeddingsConfig();
    const status = openAiStatus(config);
    const configured = status !== 'disabled' && status !== 'misconfigured';

    const readiness: EmbeddingReadiness = {
      enabled: config.enabled && config.provider === this.provider,
      configured,
      executionEnabled: false,
      provider: this.provider,
      status,
      failClosed: true,
      reason: '',
      model: config.model,
      dimension: config.dimension,
      secretsConfigured: config.openaiApiKeyConfigured,
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
    void input;
    throw embeddingReadinessError(this.getReadiness());
  }

  async embedBatch(input: EmbedBatchInput): Promise<EmbeddingVectorResult[]> {
    void input;
    throw embeddingReadinessError(this.getReadiness());
  }
}

export const openAiEmbeddingProvider = new OpenAiEmbeddingProvider();
