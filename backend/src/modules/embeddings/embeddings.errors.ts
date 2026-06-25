import { AppError } from '../../shared/errors/app-error';
import type { EmbeddingReadiness } from './embeddings.types';

export function embeddingReadinessError(readiness: EmbeddingReadiness) {
  const code =
    readiness.status === 'disabled'
      ? 'EMBEDDINGS_DISABLED'
      : readiness.status === 'configured_but_execution_disabled'
        ? 'EMBEDDING_EXECUTION_DISABLED'
        : 'EMBEDDING_PROVIDER_NOT_CONFIGURED';
  return new AppError(409, code, readiness.reason);
}

export function embeddingInputError(code: string, message: string) {
  return new AppError(422, code, message);
}

export function embeddingProviderError(code: string, message: string) {
  return new AppError(502, code, message);
}

export function embeddingProviderTimeoutError() {
  return new AppError(504, 'EMBEDDING_PROVIDER_TIMEOUT', 'Embedding provider request timed out.');
}
