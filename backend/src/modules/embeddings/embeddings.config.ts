import { env } from '../../config/env';
import type { EmbeddingsConfig } from './embeddings.types';

export function getEmbeddingsConfig(): EmbeddingsConfig {
  return {
    enabled: env.EMBEDDINGS_ENABLED,
    provider: env.EMBEDDINGS_PROVIDER,
    executionEnabled: env.EMBEDDINGS_EXECUTION_ENABLED,
    model: env.EMBEDDINGS_MODEL ?? null,
    dimension: env.EMBEDDINGS_DIMENSION ?? null,
    storeRawInputs: env.EMBEDDINGS_STORE_RAW_INPUTS,
    storeRawOutputs: env.EMBEDDINGS_STORE_RAW_OUTPUTS,
    openaiApiKeyConfigured: Boolean(env.OPENAI_API_KEY),
  };
}
