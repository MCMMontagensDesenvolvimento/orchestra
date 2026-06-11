import type { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import {
  mapAssistantKnowledgeBinding,
  mapKnowledgeBase,
  mapKnowledgeDataSource,
  mapKnowledgeDocument,
  mapKnowledgeIngestionJob,
} from './knowledge.mapper';
import { knowledgeRepository } from './knowledge.repository';
import type {
  AssistantKnowledgeBindingCreateInput,
  AssistantKnowledgeBindingUpdateInput,
  KnowledgeBaseCreateInput,
  KnowledgeBasesQuery,
  KnowledgeBaseUpdateInput,
  KnowledgeDataSourceCreateInput,
  KnowledgeDataSourceUpdateInput,
  KnowledgeDocumentCreateInput,
  KnowledgeDocumentUpdateInput,
  KnowledgeIngestionRequestInput,
} from './knowledge.schema';

interface RequestContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

const unsafeMetadataKeys = new Set(['instructions', 'prompt', 'content', 'secret', 'token', 'password', 'apiKey', 'authorization']);
const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 300);
  if (depth >= 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 30)
      .map(([key, item]) => [
        key,
        unsafeMetadataKeys.has(key) || unsafeMetadataKeys.has(key.toLowerCase()) ? '[redacted]' : sanitizeMetadata(item, depth + 1),
      ]),
  );
}

async function audit(input: {
  user: AuthenticatedUser;
  context: RequestContext;
  action: string;
  entity: string;
  entityId?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}) {
  await recordAuditEvent({
    tenantId: input.user.tenant.id,
    workspaceId: input.workspaceId,
    actorUserId: input.user.id,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    metadata: input.metadata ? (sanitizeMetadata(input.metadata) as Prisma.InputJsonValue) : undefined,
    requestId: input.context.requestId,
    ipAddress: input.context.ipAddress,
    userAgent: input.context.userAgent,
  });
}

async function recordDenied(user: AuthenticatedUser, context: RequestContext, workspaceId: string | undefined, policy: string) {
  await audit({
    user,
    context,
    action: 'permission_denied',
    entity: 'knowledge',
    workspaceId,
    metadata: { policy },
  });
}

async function assertWorkspace(user: AuthenticatedUser, workspaceId: string | undefined, context: RequestContext, policy: string) {
  if (workspaceId && userWorkspaceIds(user).includes(workspaceId)) return workspaceId;
  await recordDenied(user, context, workspaceId, policy);
  throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Workspace fora do escopo do usuario.');
}

async function resolveWorkspace(user: AuthenticatedUser, inputWorkspaceId: string | undefined, context: RequestContext, policy: string) {
  const workspaceId = inputWorkspaceId ?? user.workspaces[0]?.id;
  return assertWorkspace(user, workspaceId, context, policy);
}

async function getKnowledgeBaseOrThrow(id: string, user: AuthenticatedUser) {
  const base = await knowledgeRepository.findKnowledgeBaseById(id, user.tenant.id, userWorkspaceIds(user));
  if (!base) {
    throw new AppError(404, 'KNOWLEDGE_BASE_NOT_FOUND', 'Base de conhecimento nao encontrada.');
  }
  return base;
}

async function getAssistantOrThrow(id: string, user: AuthenticatedUser) {
  const assistant = await knowledgeRepository.findAssistant(id, user.tenant.id, userWorkspaceIds(user));
  if (!assistant) {
    throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
  }
  return assistant;
}

export const knowledgeService = {
  async listKnowledgeBases(user: AuthenticatedUser, query: KnowledgeBasesQuery, context: RequestContext) {
    if (query.workspaceId) {
      await assertWorkspace(user, query.workspaceId, context, 'listKnowledgeBases');
    }
    const result = await knowledgeRepository.listKnowledgeBases(user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapKnowledgeBase),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getKnowledgeBase(id: string, user: AuthenticatedUser) {
    const base = await getKnowledgeBaseOrThrow(id, user);
    return mapKnowledgeBase(base);
  },

  async createKnowledgeBase(input: KnowledgeBaseCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const workspaceId = await resolveWorkspace(user, input.workspaceId, context, 'createKnowledgeBase');
    const ownerUserId = input.ownerUserId === null ? null : (input.ownerUserId ?? user.id);
    const base = await knowledgeRepository.createKnowledgeBase({
      ...input,
      tenantId: user.tenant.id,
      workspaceId,
      ownerUserId,
    });

    await audit({
      user,
      context,
      action: 'knowledge_base_created',
      entity: 'knowledge_base',
      entityId: base.id,
      workspaceId,
      metadata: {
        status: base.status,
        visibility: base.visibility,
        dataClassification: base.dataClassification,
      },
    });

    return mapKnowledgeBase(base);
  },

  async updateKnowledgeBase(id: string, input: KnowledgeBaseUpdateInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await getKnowledgeBaseOrThrow(id, user);
    const base = await knowledgeRepository.updateKnowledgeBase(id, user.tenant.id, userWorkspaceIds(user), input);
    if (!base) {
      throw new AppError(404, 'KNOWLEDGE_BASE_NOT_FOUND', 'Base de conhecimento nao encontrada.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_base_updated',
      entity: 'knowledge_base',
      entityId: base.id,
      workspaceId: current.workspaceId,
      metadata: {
        changedFields: Object.keys(input),
        status: base.status,
      },
    });

    return mapKnowledgeBase(base);
  },

  async archiveKnowledgeBase(id: string, user: AuthenticatedUser, context: RequestContext) {
    const current = await getKnowledgeBaseOrThrow(id, user);
    const base = await knowledgeRepository.archiveKnowledgeBase(id, user.tenant.id, userWorkspaceIds(user));
    if (!base) {
      throw new AppError(404, 'KNOWLEDGE_BASE_NOT_FOUND', 'Base de conhecimento nao encontrada.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_base_archived',
      entity: 'knowledge_base',
      entityId: base.id,
      workspaceId: current.workspaceId,
    });

    return mapKnowledgeBase(base);
  },

  async restoreKnowledgeBase(id: string, user: AuthenticatedUser, context: RequestContext) {
    const current = await getKnowledgeBaseOrThrow(id, user);
    const base = await knowledgeRepository.restoreKnowledgeBase(id, user.tenant.id, userWorkspaceIds(user));
    if (!base) {
      throw new AppError(404, 'KNOWLEDGE_BASE_NOT_FOUND', 'Base de conhecimento nao encontrada.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_base_restored',
      entity: 'knowledge_base',
      entityId: base.id,
      workspaceId: current.workspaceId,
    });

    return mapKnowledgeBase(base);
  },

  async listDocuments(knowledgeBaseId: string, user: AuthenticatedUser) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    const documents = await knowledgeRepository.listDocuments(base.id, user.tenant.id, userWorkspaceIds(user));
    return documents.map(mapKnowledgeDocument);
  },

  async createDocument(knowledgeBaseId: string, input: KnowledgeDocumentCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    if (base.status === 'archived' || base.deletedAt) {
      throw new AppError(409, 'KNOWLEDGE_BASE_ARCHIVED', 'Base arquivada nao aceita novos documentos.');
    }

    const document = await knowledgeRepository.createDocument({
      ...input,
      tenantId: user.tenant.id,
      workspaceId: base.workspaceId,
      knowledgeBaseId: base.id,
      createdById: user.id,
    });

    await audit({
      user,
      context,
      action: 'knowledge_document_created',
      entity: 'knowledge_document',
      entityId: document.id,
      workspaceId: base.workspaceId,
      metadata: {
        knowledgeBaseId: base.id,
        sourceType: document.sourceType,
        status: document.status,
        ingestionStatus: document.ingestionStatus,
      },
    });

    return mapKnowledgeDocument(document);
  },

  async getDocument(documentId: string, user: AuthenticatedUser) {
    const document = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    return mapKnowledgeDocument(document);
  },

  async updateDocument(documentId: string, input: KnowledgeDocumentUpdateInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    const document = await knowledgeRepository.updateDocument(documentId, user.tenant.id, userWorkspaceIds(user), input);
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_document_updated',
      entity: 'knowledge_document',
      entityId: document.id,
      workspaceId: document.workspaceId,
      metadata: {
        knowledgeBaseId: current.knowledgeBaseId,
        changedFields: Object.keys(input),
        status: document.status,
        ingestionStatus: document.ingestionStatus,
      },
    });

    return mapKnowledgeDocument(document);
  },

  async archiveDocument(documentId: string, user: AuthenticatedUser, context: RequestContext) {
    const current = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    const document = await knowledgeRepository.archiveDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_document_archived',
      entity: 'knowledge_document',
      entityId: document.id,
      workspaceId: document.workspaceId,
      metadata: { knowledgeBaseId: current.knowledgeBaseId },
    });

    return mapKnowledgeDocument(document);
  },

  async requestIngestion(documentId: string, input: KnowledgeIngestionRequestInput, user: AuthenticatedUser, context: RequestContext) {
    const result = await knowledgeRepository.requestIngestion({
      documentId,
      tenantId: user.tenant.id,
      workspaceIds: userWorkspaceIds(user),
      metadata: sanitizeMetadata({
        ...(input.metadata ?? {}),
        placeholderOnly: true,
        requestedById: user.id,
      }) as Prisma.InputJsonValue,
    });
    if (!result) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_ingestion_requested',
      entity: 'knowledge_ingestion_job',
      entityId: result.job.id,
      workspaceId: result.job.workspaceId,
      metadata: {
        knowledgeBaseId: result.job.knowledgeBaseId,
        documentId: result.job.documentId,
        status: result.job.status,
        placeholderOnly: true,
      },
    });

    return {
      document: mapKnowledgeDocument(result.document),
      job: mapKnowledgeIngestionJob(result.job),
    };
  },

  async listIngestionJobs(documentId: string, user: AuthenticatedUser) {
    const document = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    const jobs = await knowledgeRepository.listIngestionJobs(document.id, user.tenant.id, userWorkspaceIds(user));
    return jobs.map(mapKnowledgeIngestionJob);
  },

  async listDataSources(knowledgeBaseId: string, user: AuthenticatedUser) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    const dataSources = await knowledgeRepository.listDataSources(base.id, user.tenant.id, userWorkspaceIds(user));
    return dataSources.map(mapKnowledgeDataSource);
  },

  async createDataSource(knowledgeBaseId: string, input: KnowledgeDataSourceCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    if (base.status === 'archived' || base.deletedAt) {
      throw new AppError(409, 'KNOWLEDGE_BASE_ARCHIVED', 'Base arquivada nao aceita novos data sources.');
    }

    const dataSource = await knowledgeRepository.createDataSource({
      ...input,
      tenantId: user.tenant.id,
      workspaceId: base.workspaceId,
      knowledgeBaseId: base.id,
      createdById: user.id,
    });

    await audit({
      user,
      context,
      action: 'knowledge_data_source_created',
      entity: 'knowledge_data_source',
      entityId: dataSource.id,
      workspaceId: base.workspaceId,
      metadata: {
        knowledgeBaseId: base.id,
        type: dataSource.type,
        status: dataSource.status,
      },
    });

    return mapKnowledgeDataSource(dataSource);
  },

  async updateDataSource(dataSourceId: string, input: KnowledgeDataSourceUpdateInput, user: AuthenticatedUser, context: RequestContext) {
    const dataSource = await knowledgeRepository.updateDataSource(dataSourceId, user.tenant.id, userWorkspaceIds(user), input);
    if (!dataSource) {
      throw new AppError(404, 'KNOWLEDGE_DATA_SOURCE_NOT_FOUND', 'Data source de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_data_source_updated',
      entity: 'knowledge_data_source',
      entityId: dataSource.id,
      workspaceId: dataSource.workspaceId,
      metadata: {
        knowledgeBaseId: dataSource.knowledgeBaseId,
        changedFields: Object.keys(input),
        status: dataSource.status,
      },
    });

    return mapKnowledgeDataSource(dataSource);
  },

  async archiveDataSource(dataSourceId: string, user: AuthenticatedUser, context: RequestContext) {
    const dataSource = await knowledgeRepository.archiveDataSource(dataSourceId, user.tenant.id, userWorkspaceIds(user));
    if (!dataSource) {
      throw new AppError(404, 'KNOWLEDGE_DATA_SOURCE_NOT_FOUND', 'Data source de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_data_source_updated',
      entity: 'knowledge_data_source',
      entityId: dataSource.id,
      workspaceId: dataSource.workspaceId,
      metadata: {
        knowledgeBaseId: dataSource.knowledgeBaseId,
        status: dataSource.status,
      },
    });

    return mapKnowledgeDataSource(dataSource);
  },

  async listBindings(assistantId: string, user: AuthenticatedUser) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const bindings = await knowledgeRepository.listBindings(assistant.id, user.tenant.id, userWorkspaceIds(user));
    return bindings.map(mapAssistantKnowledgeBinding);
  },

  async createBinding(assistantId: string, input: AssistantKnowledgeBindingCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const knowledgeBase = await getKnowledgeBaseOrThrow(input.knowledgeBaseId, user);
    if (knowledgeBase.status === 'archived' || knowledgeBase.deletedAt) {
      throw new AppError(409, 'KNOWLEDGE_BASE_ARCHIVED', 'Base arquivada nao pode ser vinculada.');
    }
    if (assistant.workspaceId !== knowledgeBase.workspaceId) {
      await recordDenied(user, context, assistant.workspaceId, 'knowledgeBindingWorkspaceScope');
      throw new AppError(403, 'WORKSPACE_SCOPE_MISMATCH', 'Base de conhecimento e assistente devem pertencer ao mesmo workspace.');
    }

    const binding = await knowledgeRepository.createBinding({
      ...input,
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      assistantId: assistant.id,
      createdById: user.id,
    });

    await audit({
      user,
      context,
      action: 'knowledge_binding_created',
      entity: 'assistant_knowledge_binding',
      entityId: binding.id,
      workspaceId: assistant.workspaceId,
      metadata: {
        assistantId: assistant.id,
        knowledgeBaseId: input.knowledgeBaseId,
        retrievalMode: binding.retrievalMode,
        isEnabled: binding.isEnabled,
      },
    });

    return mapAssistantKnowledgeBinding(binding);
  },

  async updateBinding(
    assistantId: string,
    bindingId: string,
    input: AssistantKnowledgeBindingUpdateInput,
    user: AuthenticatedUser,
    context: RequestContext,
  ) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const binding = await knowledgeRepository.updateBinding(assistant.id, bindingId, user.tenant.id, userWorkspaceIds(user), input);
    if (!binding) {
      throw new AppError(404, 'KNOWLEDGE_BINDING_NOT_FOUND', 'Binding de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_binding_updated',
      entity: 'assistant_knowledge_binding',
      entityId: binding.id,
      workspaceId: assistant.workspaceId,
      metadata: {
        assistantId: assistant.id,
        knowledgeBaseId: binding.knowledgeBaseId,
        changedFields: Object.keys(input),
        isEnabled: binding.isEnabled,
      },
    });

    return mapAssistantKnowledgeBinding(binding);
  },

  async removeBinding(assistantId: string, bindingId: string, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const binding = await knowledgeRepository.disableBinding(assistant.id, bindingId, user.tenant.id, userWorkspaceIds(user));
    if (!binding) {
      throw new AppError(404, 'KNOWLEDGE_BINDING_NOT_FOUND', 'Binding de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_binding_removed',
      entity: 'assistant_knowledge_binding',
      entityId: binding.id,
      workspaceId: assistant.workspaceId,
      metadata: {
        assistantId: assistant.id,
        knowledgeBaseId: binding.knowledgeBaseId,
        removalMode: 'soft_disable',
      },
    });
  },
};
