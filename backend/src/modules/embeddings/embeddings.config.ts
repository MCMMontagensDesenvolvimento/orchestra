import { env } from '../../config/env';
import { resolveOpenAiEmbeddingCredential } from './embeddings.credential';
import type { EmbeddingsConfig } from './embeddings.types';

export function getEmbeddingsConfig(): EmbeddingsConfig {
  const openAiCredential = resolveOpenAiEmbeddingCredential({
    filePath: env.OPENAI_EMBEDDINGS_API_KEY_FILE,
    fallbackValue: env.OPENAI_API_KEY,
  });

  return {
    enabled: env.EMBEDDINGS_ENABLED,
    provider: env.EMBEDDINGS_PROVIDER,
    executionEnabled: env.EMBEDDINGS_EXECUTION_ENABLED,
    model: env.EMBEDDINGS_MODEL ?? null,
    dimension: env.EMBEDDINGS_DIMENSION ?? null,
    timeoutMs: env.EMBEDDINGS_TIMEOUT_MS,
    maxInputChars: env.EMBEDDINGS_MAX_INPUT_CHARS,
    maxBatchSize: env.EMBEDDINGS_MAX_BATCH_SIZE,
    storeRawInputs: env.EMBEDDINGS_STORE_RAW_INPUTS,
    storeRawOutputs: env.EMBEDDINGS_STORE_RAW_OUTPUTS,
    openaiCredential: openAiCredential ?? null,
    openaiCredentialConfigured: Boolean(openAiCredential),
    openaiBaseUrl: env.OPENAI_BASE_URL,
  };
}
