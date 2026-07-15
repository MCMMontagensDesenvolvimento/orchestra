import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';
import { localChunkingDefaults } from './knowledge.chunking';

export const knowledgeBaseStatusValues = ['active', 'archived'] as const;
export const knowledgeVisibilityValues = ['private', 'workspace', 'tenant'] as const;
export const dataClassificationValues = ['public', 'internal', 'sensitive', 'pii', 'confidential'] as const;
export const knowledgeDocumentSourceTypeValues = ['manual', 'url', 'file', 'connector', 'api', 'other'] as const;
export const knowledgeDocumentStatusValues = ['draft', 'pending_ingestion', 'indexed', 'indexed_placeholder', 'failed', 'archived'] as const;
export const knowledgeIngestionStatusValues = ['pending', 'queued', 'running', 'completed', 'completed_placeholder', 'failed', 'cancelled'] as const;
export const knowledgeChunkStatusValues = ['active', 'stale', 'archived'] as const;
export const knowledgeDataSourceTypeValues = ['manual', 'url', 'connector', 'api', 'storage', 'other'] as const;
export const knowledgeDataSourceStatusValues = ['active', 'disabled', 'archived'] as const;
export const assistantKnowledgeRetrievalModeValues = ['disabled', 'citation_only', 'retrieval_placeholder'] as const;

const unsafeJsonKeys = new Set([
  'secret',
  'secrets',
  'token',
  'tokens',
  'password',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'privatekey',
  'private_key',
]);

function hasUnsafeJsonKey(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== 'object' || depth > 6) return false;
  if (Array.isArray(value)) return value.some((item) => hasUnsafeJsonKey(item, depth + 1));
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => {
    const normalized = key.replace(/[-\s]/g, '').toLowerCase();
    return unsafeJsonKeys.has(normalized) || hasUnsafeJsonKey(item, depth + 1);
  });
}

const safeJsonRecord = z.record(z.unknown()).refine((value) => !hasUnsafeJsonKey(value), {
  message: 'Nao informe secrets, tokens, passwords, api keys ou authorization em JSON de catalogo.',
});

export const knowledgeBasesQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['name', 'status', 'updatedAt', 'createdAt']).default('updatedAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(knowledgeBaseStatusValues).optional(),
  workspaceId: z.string().uuid().optional(),
  visibility: z.enum(knowledgeVisibilityValues).optional(),
  dataClassification: z.enum(dataClassificationValues).optional(),
});

export const knowledgeBaseCreateSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(knowledgeBaseStatusValues).default('active'),
  visibility: z.enum(knowledgeVisibilityValues).default('workspace'),
  dataClassification: z.enum(dataClassificationValues).default('internal'),
  ownerUserId: z.string().uuid().nullable().optional(),
  metadata: safeJsonRecord.optional(),
});

export const knowledgeBaseUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(knowledgeBaseStatusValues).optional(),
  visibility: z.enum(knowledgeVisibilityValues).optional(),
  dataClassification: z.enum(dataClassificationValues).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  metadata: safeJsonRecord.nullable().optional(),
}).refine((input) => Object.keys(input).length > 0, {
  message: 'Informe ao menos uma propriedade para atualizar.',
});

export const knowledgePolicyUpdateSchema = z.object({
  allowRuntimeRetrieval: z.boolean().optional(),
  allowCitationOnly: z.boolean().optional(),
  requireApprovalForExternal: z.boolean().optional(),
  metadata: safeJsonRecord.nullable().optional(),
}).refine((input) => Object.keys(input).length > 0, {
  message: 'Informe ao menos uma propriedade para atualizar a policy.',
});

export const knowledgeDocumentCreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  sourceType: z.enum(knowledgeDocumentSourceTypeValues).default('manual'),
  sourceUri: z.string().trim().max(1000).optional(),
  mimeType: z.string().trim().max(160).optional(),
  status: z.enum(knowledgeDocumentStatusValues).default('draft'),
  ingestionStatus: z.enum(knowledgeIngestionStatusValues).default('pending'),
  dataClassification: z.enum(dataClassificationValues).default('internal'),
  contentText: z.string().max(localChunkingDefaults.maxDocumentChars).optional(),
  metadata: safeJsonRecord.optional(),
});

export const knowledgeDocumentUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  sourceType: z.enum(knowledgeDocumentSourceTypeValues).optional(),
  sourceUri: z.string().trim().max(1000).nullable().optional(),
  mimeType: z.string().trim().max(160).nullable().optional(),
  status: z.enum(knowledgeDocumentStatusValues).optional(),
  ingestionStatus: z.enum(knowledgeIngestionStatusValues).optional(),
  ingestionErrorCode: z.string().trim().max(120).nullable().optional(),
  ingestionErrorMessage: z.string().trim().max(1000).nullable().optional(),
  dataClassification: z.enum(dataClassificationValues).optional(),
  contentText: z.string().max(localChunkingDefaults.maxDocumentChars).nullable().optional(),
  metadata: safeJsonRecord.nullable().optional(),
}).refine((input) => Object.keys(input).length > 0, {
  message: 'Informe ao menos uma propriedade para atualizar.',
});

export const knowledgeDocumentParamsSchema = z.object({
  documentId: z.string().uuid(),
});

export const knowledgeBaseChildParamsSchema = z.object({
  id: z.string().uuid(),
});

export const knowledgeIngestionRequestSchema = z.object({
  metadata: safeJsonRecord.optional(),
}).default({});

export const knowledgeEmbeddingRequestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  force: z.boolean().default(false),
  chunkIds: z.array(z.string().uuid()).max(100).optional(),
  metadata: safeJsonRecord.optional(),
}).default({});

export const knowledgeChunksQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['chunkIndex', 'createdAt', 'updatedAt']).default('chunkIndex'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
  status: z.enum(knowledgeChunkStatusValues).default('active'),
});

export const knowledgeChunkParamsSchema = z.object({
  chunkId: z.string().uuid(),
});

export const knowledgeIngestionJobParamsSchema = z.object({
  jobId: z.string().uuid(),
});

export const ragLocalSearchSchema = z.object({
  query: z.string().trim().min(1).max(200),
});

export const ragSemanticSearchSchema = z.object({
  query: z.string().trim().min(2).max(500),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  fallback: z.boolean().default(true),
});

export const ragQueryRequestSchema = z.object({
  query: z.string().trim().min(2).max(500),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  includeArchived: z.boolean().default(false),
  assistantVersionId: z.string().uuid().optional(),
  agentRunId: z.string().uuid().optional(),
  traceId: z.string().trim().max(160).optional(),
});

export const ragQueriesQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['createdAt', 'status', 'resultCount']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['completed', 'no_results', 'blocked', 'failed']).optional(),
});

export const ragQueryParamsSchema = z.object({
  queryId: z.string().uuid(),
});

export const knowledgeDataSourceCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum(knowledgeDataSourceTypeValues).default('manual'),
  config: safeJsonRecord.optional(),
  status: z.enum(knowledgeDataSourceStatusValues).default('active'),
});

export const knowledgeDataSourceUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  type: z.enum(knowledgeDataSourceTypeValues).optional(),
  config: safeJsonRecord.nullable().optional(),
  status: z.enum(knowledgeDataSourceStatusValues).optional(),
}).refine((input) => Object.keys(input).length > 0, {
  message: 'Informe ao menos uma propriedade para atualizar.',
});

export const knowledgeDataSourceParamsSchema = z.object({
  dataSourceId: z.string().uuid(),
});

export const assistantKnowledgeBindingCreateSchema = z.object({
  knowledgeBaseId: z.string().uuid(),
  isEnabled: z.boolean().default(true),
  retrievalMode: z.enum(assistantKnowledgeRetrievalModeValues).default('retrieval_placeholder'),
  priority: z.number().int().min(0).max(1000).default(100),
});

export const assistantKnowledgeBindingUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  retrievalMode: z.enum(assistantKnowledgeRetrievalModeValues).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
}).refine((input) => Object.keys(input).length > 0, {
  message: 'Informe ao menos uma propriedade para atualizar.',
});

export const assistantKnowledgeBindingParamsSchema = z.object({
  id: z.string().uuid(),
  bindingId: z.string().uuid(),
});

export type KnowledgeBasesQuery = z.infer<typeof knowledgeBasesQuerySchema>;
export type KnowledgeBaseCreateInput = z.infer<typeof knowledgeBaseCreateSchema>;
export type KnowledgeBaseUpdateInput = z.infer<typeof knowledgeBaseUpdateSchema>;
export type KnowledgePolicyUpdateInput = z.infer<typeof knowledgePolicyUpdateSchema>;
export type KnowledgeDocumentCreateInput = z.infer<typeof knowledgeDocumentCreateSchema>;
export type KnowledgeDocumentUpdateInput = z.infer<typeof knowledgeDocumentUpdateSchema>;
export type KnowledgeIngestionRequestInput = z.infer<typeof knowledgeIngestionRequestSchema>;
export type KnowledgeEmbeddingRequestInput = z.infer<typeof knowledgeEmbeddingRequestSchema>;
export type KnowledgeChunksQuery = z.infer<typeof knowledgeChunksQuerySchema>;
export type RagLocalSearchInput = z.infer<typeof ragLocalSearchSchema>;
export type RagSemanticSearchInput = z.infer<typeof ragSemanticSearchSchema>;
export type RagQueryRequestInput = z.infer<typeof ragQueryRequestSchema>;
export type RagQueriesQuery = z.infer<typeof ragQueriesQuerySchema>;
export type KnowledgeDataSourceCreateInput = z.infer<typeof knowledgeDataSourceCreateSchema>;
export type KnowledgeDataSourceUpdateInput = z.infer<typeof knowledgeDataSourceUpdateSchema>;
export type AssistantKnowledgeBindingCreateInput = z.infer<typeof assistantKnowledgeBindingCreateSchema>;
export type AssistantKnowledgeBindingUpdateInput = z.infer<typeof assistantKnowledgeBindingUpdateSchema>;
