import { getEmbeddingsConfig } from './embeddings.config';
import { embeddingReadinessError } from './embeddings.errors';
import { disabledEmbeddingProvider } from './embeddings.provider';
import { openAiEmbeddingProvider } from './providers/openai-embedding.provider';
import type { EmbedBatchInput, EmbeddingProvider, EmbedTextInput } from './embeddings.types';

function currentProvider(): EmbeddingProvider {
  const config = getEmbeddingsConfig();
  if (config.enabled && config.provider === 'openai') return openAiEmbeddingProvider;
  return disabledEmbeddingProvider;
}

export const embeddingsService = {
  getEmbeddingReadiness() {
    return currentProvider().getReadiness();
  },

  assertEmbeddingReady() {
    const provider = currentProvider();
    const readiness = provider.getReadiness();
    throw embeddingReadinessError(readiness);
  },

  async embedText(input: EmbedTextInput) {
    return currentProvider().embedText(input);
  },

  async embedBatch(input: EmbedBatchInput) {
    return currentProvider().embedBatch(input);
  },
};
