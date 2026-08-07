import type {
  AssistantKnowledgeBinding,
  KnowledgeBase,
  KnowledgeChunk,
  KnowledgeDataSource,
  KnowledgeDocument,
  KnowledgeIngestionEvent,
  KnowledgeIngestionJob,
  KnowledgePolicy,
  KnowledgeSourceReference,
  RagQuery,
  RagQueryResult,
} from '@prisma/client';

export function mapKnowledgePolicy(policy: KnowledgePolicy | null | undefined) {
  if (!policy) return null;
  return {
    id: policy.id,
    tenantId: policy.tenantId,
    workspaceId: policy.workspaceId,
    knowledgeBaseId: policy.knowledgeBaseId,
    allowRuntimeRetrieval: policy.allowRuntimeRetrieval,
    allowCitationOnly: policy.allowCitationOnly,
    requireApprovalForExternal: policy.requireApprovalForExternal,
    metadata: policy.metadata,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

export function mapKnowledgeBase(
  knowledgeBase: KnowledgeBase & {
    policies?: KnowledgePolicy[];
    _count?: {
      documents?: number;
      dataSources?: number;
      bindings?: number;
      ingestionJobs?: number;
      chunks?: number;
    };
    owner?: { id: string; name: string; email: string } | null;
  },
) {
  return {
    id: knowledgeBase.id,
    tenantId: knowledgeBase.tenantId,
    workspaceId: knowledgeBase.workspaceId,
    name: knowledgeBase.name,
    description: knowledgeBase.description,
    status: knowledgeBase.status,
    visibility: knowledgeBase.visibility,
    dataClassification: knowledgeBase.dataClassification,
    ownerUserId: knowledgeBase.ownerUserId,
    owner: knowledgeBase.owner,
    metadata: knowledgeBase.metadata,
    documentCount: knowledgeBase._count?.documents ?? 0,
    chunkCount: knowledgeBase._count?.chunks ?? 0,
    dataSourceCount: knowledgeBase._count?.dataSources ?? 0,
    bindingCount: knowledgeBase._count?.bindings ?? 0,
    ingestionJobCount: knowledgeBase._count?.ingestionJobs ?? 0,
    policy: mapKnowledgePolicy(knowledgeBase.policies?.[0]),
    createdAt: knowledgeBase.createdAt.toISOString(),
    updatedAt: knowledgeBase.updatedAt.toISOString(),
    deletedAt: knowledgeBase.deletedAt?.toISOString() ?? null,
  };
}

export function mapKnowledgeDocument(document: KnowledgeDocument & {
  createdBy?: { id: string; name: string; email: string } | null;
  _count?: { chunkEmbeddings?: number };
  chunkEmbeddings?: Array<{
    status: string;
    provider: string;
    embeddingModel: string;
    updatedAt: Date;
  }>;
}) {
  const embeddingCount = document._count?.chunkEmbeddings ?? 0;
  const latestEmbedding = document.chunkEmbeddings?.[0];
  const embeddingStatus = document.chunkCount > 0 && embeddingCount >= document.chunkCount
    ? 'ready'
    : latestEmbedding?.status === 'failed'
      ? 'failed'
      : embeddingCount > 0
        ? 'partial'
        : 'not_requested';
  return {
    id: document.id,
    tenantId: document.tenantId,
    workspaceId: document.workspaceId,
    knowledgeBaseId: document.knowledgeBaseId,
    title: document.title,
    description: document.description,
    sourceType: document.sourceType,
    sourceUri: document.sourceUri,
    mimeType: document.mimeType,
    status: document.status,
    ingestionStatus: document.ingestionStatus,
    ingestionErrorCode: document.ingestionErrorCode,
    ingestionErrorMessage: document.ingestionErrorMessage,
    dataClassification: document.dataClassification,
    contentText: document.contentText,
    contentHash: document.contentHash,
    ingestedAt: document.ingestedAt?.toISOString() ?? null,
    chunkCount: document.chunkCount,
    embeddingCount,
    embeddingStatus,
    embeddingProvider: latestEmbedding?.provider ?? null,
    embeddingModel: latestEmbedding?.embeddingModel ?? null,
    metadata: document.metadata,
    createdById: document.createdById,
    createdBy: document.createdBy ?? null,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    deletedAt: document.deletedAt?.toISOString() ?? null,
  };
}

export function mapKnowledgeDataSource(dataSource: KnowledgeDataSource) {
  return {
    id: dataSource.id,
    tenantId: dataSource.tenantId,
    workspaceId: dataSource.workspaceId,
    knowledgeBaseId: dataSource.knowledgeBaseId,
    name: dataSource.name,
    type: dataSource.type,
    config: dataSource.config,
    status: dataSource.status,
    createdById: dataSource.createdById,
    createdAt: dataSource.createdAt.toISOString(),
    updatedAt: dataSource.updatedAt.toISOString(),
    deletedAt: dataSource.deletedAt?.toISOString() ?? null,
  };
}

export function mapKnowledgeIngestionJob(job: KnowledgeIngestionJob) {
  return {
    id: job.id,
    tenantId: job.tenantId,
    workspaceId: job.workspaceId,
    knowledgeBaseId: job.knowledgeBaseId,
    documentId: job.documentId,
    status: job.status,
    strategy: job.strategy,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    chunksCreated: job.chunksCreated,
    sourceReferencesCreated: job.sourceReferencesCreated,
    metadata: job.metadata,
    createdById: job.createdById,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export function mapKnowledgeIngestionEvent(event: KnowledgeIngestionEvent) {
  return {
    id: event.id,
    jobId: event.jobId,
    tenantId: event.tenantId,
    workspaceId: event.workspaceId,
    knowledgeBaseId: event.knowledgeBaseId,
    documentId: event.documentId,
    eventType: event.eventType,
    level: event.level,
    message: event.message,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}

export function mapKnowledgeChunk(chunk: KnowledgeChunk) {
  return {
    id: chunk.id,
    tenantId: chunk.tenantId,
    workspaceId: chunk.workspaceId,
    knowledgeBaseId: chunk.knowledgeBaseId,
    documentId: chunk.documentId,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    contentHash: chunk.contentHash,
    tokenEstimate: chunk.tokenEstimate,
    charCount: chunk.charCount,
    status: chunk.status,
    metadata: chunk.metadata,
    createdAt: chunk.createdAt.toISOString(),
    updatedAt: chunk.updatedAt.toISOString(),
  };
}

export function mapKnowledgeSourceReference(reference: KnowledgeSourceReference) {
  return {
    id: reference.id,
    tenantId: reference.tenantId,
    workspaceId: reference.workspaceId,
    knowledgeBaseId: reference.knowledgeBaseId,
    documentId: reference.documentId,
    chunkId: reference.chunkId,
    label: reference.label,
    sourceType: reference.sourceType,
    sourceUri: reference.sourceUri,
    sectionTitle: reference.sectionTitle,
    pageNumber: reference.pageNumber,
    startOffset: reference.startOffset,
    endOffset: reference.endOffset,
    metadata: reference.metadata,
    createdAt: reference.createdAt.toISOString(),
    updatedAt: reference.updatedAt.toISOString(),
  };
}

export function mapAssistantKnowledgeBinding(
  binding: AssistantKnowledgeBinding & {
    knowledgeBase?: KnowledgeBase | null;
  },
) {
  return {
    id: binding.id,
    tenantId: binding.tenantId,
    workspaceId: binding.workspaceId,
    assistantId: binding.assistantId,
    knowledgeBaseId: binding.knowledgeBaseId,
    isEnabled: binding.isEnabled,
    retrievalMode: binding.retrievalMode,
    priority: binding.priority,
    createdById: binding.createdById,
    knowledgeBase: binding.knowledgeBase ? mapKnowledgeBase(binding.knowledgeBase) : undefined,
    createdAt: binding.createdAt.toISOString(),
    updatedAt: binding.updatedAt.toISOString(),
  };
}

export function mapRagQuerySource(
  result: RagQueryResult & {
    document?: Pick<KnowledgeDocument, 'id' | 'title' | 'sourceUri' | 'sourceType'>;
    sourceReference?: Pick<KnowledgeSourceReference, 'id' | 'label' | 'sourceUri' | 'sectionTitle' | 'pageNumber'> | null;
  },
) {
  return {
    id: result.id,
    rank: result.rank,
    score: result.score,
    knowledgeBaseId: result.knowledgeBaseId,
    documentId: result.documentId,
    chunkId: result.chunkId,
    sourceReferenceId: result.sourceReferenceId,
    citationLabel: result.citationLabel,
    documentTitle: result.document?.title ?? null,
    excerpt: result.excerpt,
    sourceUri: result.sourceReference?.sourceUri ?? result.document?.sourceUri ?? null,
    sourceType: result.document?.sourceType ?? null,
    sectionTitle: result.sourceReference?.sectionTitle ?? null,
    pageNumber: result.sourceReference?.pageNumber ?? null,
    matchType: result.matchType,
    metadata: result.metadata,
    createdAt: result.createdAt.toISOString(),
  };
}

export function mapRagQuery(
  query: RagQuery & {
    results?: Array<RagQueryResult & {
      document?: Pick<KnowledgeDocument, 'id' | 'title' | 'sourceUri' | 'sourceType'>;
      sourceReference?: Pick<KnowledgeSourceReference, 'id' | 'label' | 'sourceUri' | 'sectionTitle' | 'pageNumber'> | null;
    }>;
  },
) {
  return {
    id: query.id,
    queryId: query.id,
    tenantId: query.tenantId,
    workspaceId: query.workspaceId,
    assistantId: query.assistantId,
    assistantVersionId: query.assistantVersionId,
    agentRunId: query.agentRunId,
    query: query.queryText,
    queryText: query.queryText,
    normalizedQuery: query.normalizedQuery,
    mode: query.mode,
    status: query.status,
    limit: query.limit,
    resultCount: query.resultCount,
    blockedReason: query.blockedReason,
    errorCode: query.errorCode,
    errorMessage: query.errorMessage,
    requestId: query.requestId,
    traceId: query.traceId,
    createdById: query.createdById,
    metadata: query.metadata,
    sources: query.results?.map(mapRagQuerySource) ?? [],
    createdAt: query.createdAt.toISOString(),
  };
}
