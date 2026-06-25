import { AppError } from '../../shared/errors/app-error';
import type { EmbeddingReadiness } from './embeddings.types';

export function embeddingReadinessError(readiness: EmbeddingReadiness) {
  const code = readiness.status === 'disabled' ? 'EMBEDDINGS_DISABLED' : 'EMBEDDING_PROVIDER_NOT_CONFIGURED';
  return new AppError(409, code, readiness.reason);
}
