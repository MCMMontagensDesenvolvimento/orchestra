import { embeddingReadinessError } from './embeddings.errors';
import { disabledEmbeddingProvider } from './embeddings.provider';
import type { EmbedBatchInput, EmbedTextInput } from './embeddings.types';

export const embeddingsService = {
  getEmbeddingReadiness() {
    return disabledEmbeddingProvider.getReadiness();
  },

  assertEmbeddingReady() {
    const readiness = this.getEmbeddingReadiness();
    throw embeddingReadinessError(readiness);
  },

  async embedText(input: EmbedTextInput) {
    this.assertEmbeddingReady();
    return disabledEmbeddingProvider.embedText(input);
  },

  async embedBatch(input: EmbedBatchInput) {
    this.assertEmbeddingReady();
    return disabledEmbeddingProvider.embedBatch(input);
  },
};
