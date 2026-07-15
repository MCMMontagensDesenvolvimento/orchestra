import { env } from '../../config/env';

export const supportedKnowledgeUploadExtensions = ['txt', 'md', 'csv'] as const;
export type KnowledgeUploadExtension = typeof supportedKnowledgeUploadExtensions[number];
export type KnowledgeRetrievalMode = 'keyword' | 'semantic' | 'hybrid';

export function getKnowledgeUploadConfig() {
  const supported = new Set<string>(supportedKnowledgeUploadExtensions);
  const allowedExtensions = Array.from(new Set(
    env.KNOWLEDGE_ALLOWED_FILE_TYPES
      .split(',')
      .map((value) => value.trim().toLowerCase().replace(/^\./, ''))
      .filter((value): value is KnowledgeUploadExtension => supported.has(value)),
  ));

  return {
    maxUploadBytes: env.KNOWLEDGE_MAX_UPLOAD_BYTES,
    allowedExtensions,
  };
}

export function getKnowledgeRetrievalConfig() {
  return {
    mode: env.KNOWLEDGE_RETRIEVAL_MODE as KnowledgeRetrievalMode,
    maxTopK: env.KNOWLEDGE_RETRIEVAL_MAX_TOP_K,
    maxExcerptChars: env.KNOWLEDGE_RETRIEVAL_MAX_EXCERPT_CHARS,
    maxContextChars: env.KNOWLEDGE_RETRIEVAL_MAX_CONTEXT_CHARS,
    scoreThreshold: env.KNOWLEDGE_RETRIEVAL_SCORE_THRESHOLD,
  };
}
