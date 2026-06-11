import type {
  AssistantKnowledgeBinding,
  KnowledgeBase,
  KnowledgeDataSource,
  KnowledgeDocument,
  KnowledgeIngestionJob,
  KnowledgePolicy,
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
    dataSourceCount: knowledgeBase._count?.dataSources ?? 0,
    bindingCount: knowledgeBase._count?.bindings ?? 0,
    ingestionJobCount: knowledgeBase._count?.ingestionJobs ?? 0,
    policy: mapKnowledgePolicy(knowledgeBase.policies?.[0]),
    createdAt: knowledgeBase.createdAt.toISOString(),
    updatedAt: knowledgeBase.updatedAt.toISOString(),
    deletedAt: knowledgeBase.deletedAt?.toISOString() ?? null,
  };
}

export function mapKnowledgeDocument(document: KnowledgeDocument) {
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
    metadata: document.metadata,
    createdById: document.createdById,
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
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    metadata: job.metadata,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
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
