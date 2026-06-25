import { env } from '../../config/env';
import type { EmbeddingsConfig } from './embeddings.types';

export function getEmbeddingsConfig(): EmbeddingsConfig {
  return {
    enabled: env.EMBEDDINGS_ENABLED,
    provider: env.EMBEDDINGS_PROVIDER,
    model: env.EMBEDDINGS_MODEL ?? null,
    dimension: env.EMBEDDINGS_DIMENSION ?? null,
  };
}
