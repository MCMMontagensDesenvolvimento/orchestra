import type { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import {
  mapAssistantKnowledgeBinding,
  mapKnowledgeBase,
  mapKnowledgeChunk,
  mapKnowledgeDataSource,
  mapKnowledgeDocument,
  mapKnowledgeIngestionEvent,
  mapKnowledgeIngestionJob,
  mapKnowledgeSourceReference,
} from './knowledge.mapper';
import { knowledgeRepository } from './knowledge.repository';
import { chunkContentText, hashText, localChunkingDefaults, normalizeContentText } from './knowledge.chunking';
import type {
  AssistantKnowledgeBindingCreateInput,
  AssistantKnowledgeBindingUpdateInput,
  KnowledgeBaseCreateInput,
  KnowledgeBasesQuery,
  KnowledgeBaseUpdateInput,
  KnowledgeChunksQuery,
  KnowledgeDataSourceCreateInput,
  KnowledgeDataSourceUpdateInput,
  KnowledgeDocumentCreateInput,
  KnowledgeDocumentUpdateInput,
  KnowledgeIngestionRequestInput,
  RagLocalSearchInput,
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

function sourceUriForDocument(document: { id: string; sourceUri: string | null; sourceType: string }) {
  return document.sourceUri ?? `knowledge-document://${document.id}`;
}

function localSearchScore(content: string, query: string) {
  const normalizedContent = content.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let score = 0;
  let index = normalizedContent.indexOf(normalizedQuery);
  while (index >= 0) {
    score += 1;
    index = normalizedContent.indexOf(normalizedQuery, index + normalizedQuery.length);
  }
  return Math.max(score, 1);
}

function localSearchSnippet(content: string, query: string) {
  const index = content.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return content.slice(0, 240);
  const start = Math.max(0, index - 90);
  const end = Math.min(content.length, index + query.length + 150);
  return `${start > 0 ? '...' : ''}${content.slice(start, end)}${end < content.length ? '...' : ''}`;
}

async function recordFailedIngestionJob(input: {
  documentId: string;
  errorCode: string;
  errorMessage: string;
  user: AuthenticatedUser;
  metadata?: Record<string, unknown>;
}) {
  return knowledgeRepository.recordFailedIngestion({
    documentId: input.documentId,
    tenantId: input.user.tenant.id,
    workspaceIds: userWorkspaceIds(input.user),
    createdById: input.user.id,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    metadata: sanitizeMetadata({
      ...(input.metadata ?? {}),
      strategy: 'local_text_chunking',
      requestedById: input.user.id,
    }) as Prisma.InputJsonValue,
  });
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
    const current = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    if (current.status === 'archived' || current.deletedAt) {
      throw new AppError(409, 'KNOWLEDGE_DOCUMENT_ARCHIVED', 'Documento arquivado nao pode ser ingerido.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_document_ingestion_requested',
      entity: 'knowledge_document',
      entityId: current.id,
      workspaceId: current.workspaceId,
      metadata: {
        knowledgeBaseId: current.knowledgeBaseId,
        sourceType: current.sourceType,
        strategy: 'local_text_chunking',
      },
    });

    const normalizedText = normalizeContentText(current.contentText ?? '');
    if (!normalizedText) {
      const errorCode = 'KNOWLEDGE_DOCUMENT_NO_CONTENT';
      const errorMessage = 'Documento nao possui conteudo textual simples para ingestao local.';
      const failed = await recordFailedIngestionJob({
        documentId: current.id,
        errorCode,
        errorMessage,
        user,
        metadata: { knowledgeBaseId: current.knowledgeBaseId, reason: 'empty_text' },
      });
      await audit({
        user,
        context,
        action: 'knowledge_ingestion_failed',
        entity: failed?.job ? 'knowledge_ingestion_job' : 'knowledge_document',
        entityId: failed?.job.id ?? current.id,
        workspaceId: current.workspaceId,
        metadata: {
          knowledgeBaseId: current.knowledgeBaseId,
          documentId: current.id,
          errorCode,
          jobId: failed?.job.id,
          status: failed?.job.status ?? 'failed',
        },
      });
      throw new AppError(422, errorCode, errorMessage);
    }

    let chunks;
    try {
      chunks = chunkContentText(normalizedText);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const maxDocumentChars = localChunkingDefaults.maxDocumentChars;
      const errorCode = message.startsWith('DOCUMENT_TEXT_TOO_LARGE') ? 'DOCUMENT_TEXT_TOO_LARGE' : 'LOCAL_CHUNKING_FAILED';
      const errorMessage = errorCode === 'DOCUMENT_TEXT_TOO_LARGE'
        ? `Conteudo textual excede o limite de ${maxDocumentChars} caracteres.`
        : 'Falha no chunking textual local.';
      const failed = await recordFailedIngestionJob({
        documentId: current.id,
        errorCode,
        errorMessage,
        user,
        metadata: { knowledgeBaseId: current.knowledgeBaseId, maxDocumentChars },
      });
      await audit({
        user,
        context,
        action: 'knowledge_ingestion_failed',
        entity: failed?.job ? 'knowledge_ingestion_job' : 'knowledge_document',
        entityId: failed?.job.id ?? current.id,
        workspaceId: current.workspaceId,
        metadata: {
          knowledgeBaseId: current.knowledgeBaseId,
          documentId: current.id,
          errorCode,
          jobId: failed?.job.id,
          status: failed?.job.status ?? 'failed',
          maxDocumentChars,
        },
      });
      throw new AppError(422, errorCode, errorMessage);
    }

    if (chunks.length === 0) {
      const errorCode = 'KNOWLEDGE_DOCUMENT_NO_CHUNKS';
      const errorMessage = 'Conteudo textual nao gerou chunks validos.';
      const failed = await recordFailedIngestionJob({
        documentId: current.id,
        errorCode,
        errorMessage,
        user,
        metadata: { knowledgeBaseId: current.knowledgeBaseId, reason: 'no_chunks' },
      });
      await audit({
        user,
        context,
        action: 'knowledge_ingestion_failed',
        entity: failed?.job ? 'knowledge_ingestion_job' : 'knowledge_document',
        entityId: failed?.job.id ?? current.id,
        workspaceId: current.workspaceId,
        metadata: {
          knowledgeBaseId: current.knowledgeBaseId,
          documentId: current.id,
          errorCode,
          jobId: failed?.job.id,
          status: failed?.job.status ?? 'failed',
        },
      });
      throw new AppError(422, errorCode, errorMessage);
    }

    const sourceReferences = chunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      label: `${current.title} #${chunk.chunkIndex + 1}`,
      sourceType: current.sourceType,
      sourceUri: sourceUriForDocument(current),
      sectionTitle: chunk.sectionTitle,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      metadata: {
        strategy: 'local_text_chunking',
      } as Prisma.InputJsonValue,
    }));

    const result = await knowledgeRepository.requestIngestion({
      documentId,
      tenantId: user.tenant.id,
      workspaceIds: userWorkspaceIds(user),
      createdById: user.id,
      contentHash: hashText(normalizedText),
      chunks,
      sourceReferences,
      metadata: sanitizeMetadata({
        ...(input.metadata ?? {}),
        strategy: 'local_text_chunking',
        chunkSizeChars: localChunkingDefaults.chunkSizeChars,
        chunkOverlapChars: localChunkingDefaults.chunkOverlapChars,
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
        strategy: result.job.strategy,
      },
    });

    await audit({
      user,
      context,
      action: 'knowledge_ingestion_started',
      entity: 'knowledge_ingestion_job',
      entityId: result.job.id,
      workspaceId: result.job.workspaceId,
      metadata: {
        knowledgeBaseId: result.job.knowledgeBaseId,
        documentId: result.job.documentId,
        strategy: result.job.strategy,
      },
    });

    await audit({
      user,
      context,
      action: 'knowledge_chunks_created',
      entity: 'knowledge_chunk',
      entityId: result.job.id,
      workspaceId: result.job.workspaceId,
      metadata: {
        knowledgeBaseId: result.job.knowledgeBaseId,
        documentId: result.job.documentId,
        chunksCreated: result.chunks.length,
      },
    });

    await audit({
      user,
      context,
      action: 'knowledge_source_references_created',
      entity: 'knowledge_source_reference',
      entityId: result.job.id,
      workspaceId: result.job.workspaceId,
      metadata: {
        knowledgeBaseId: result.job.knowledgeBaseId,
        documentId: result.job.documentId,
        sourceReferencesCreated: result.sourceReferences.length,
      },
    });

    await audit({
      user,
      context,
      action: 'knowledge_ingestion_completed',
      entity: 'knowledge_ingestion_job',
      entityId: result.job.id,
      workspaceId: result.job.workspaceId,
      metadata: {
        knowledgeBaseId: result.job.knowledgeBaseId,
        documentId: result.job.documentId,
        chunksCreated: result.chunks.length,
        sourceReferencesCreated: result.sourceReferences.length,
      },
    });

    return {
      document: mapKnowledgeDocument(result.document),
      job: mapKnowledgeIngestionJob(result.job),
      chunksCreated: result.chunks.length,
      sourceReferencesCreated: result.sourceReferences.length,
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

  async getIngestionJob(jobId: string, user: AuthenticatedUser) {
    const job = await knowledgeRepository.findIngestionJob(jobId, user.tenant.id, userWorkspaceIds(user));
    if (!job) {
      throw new AppError(404, 'KNOWLEDGE_INGESTION_JOB_NOT_FOUND', 'Job de ingestao nao encontrado.');
    }
    return {
      ...mapKnowledgeIngestionJob(job),
      events: job.events.map(mapKnowledgeIngestionEvent),
    };
  },

  async listDocumentChunks(documentId: string, query: KnowledgeChunksQuery, user: AuthenticatedUser) {
    const document = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    const result = await knowledgeRepository.listDocumentChunks(document.id, user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapKnowledgeChunk),
      pagination: paginationMeta(query, result.total),
    };
  },

  async listKnowledgeBaseChunks(knowledgeBaseId: string, query: KnowledgeChunksQuery, user: AuthenticatedUser) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    const result = await knowledgeRepository.listKnowledgeBaseChunks(base.id, user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapKnowledgeChunk),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getChunk(chunkId: string, user: AuthenticatedUser) {
    const chunk = await knowledgeRepository.findChunk(chunkId, user.tenant.id, userWorkspaceIds(user));
    if (!chunk) {
      throw new AppError(404, 'KNOWLEDGE_CHUNK_NOT_FOUND', 'Chunk de conhecimento nao encontrado.');
    }
    return mapKnowledgeChunk(chunk);
  },

  async listDocumentSourceReferences(documentId: string, user: AuthenticatedUser) {
    const document = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    const references = await knowledgeRepository.listDocumentSourceReferences(document.id, user.tenant.id, userWorkspaceIds(user));
    return references.map(mapKnowledgeSourceReference);
  },

  async listChunkSourceReferences(chunkId: string, user: AuthenticatedUser) {
    const chunk = await knowledgeRepository.findChunk(chunkId, user.tenant.id, userWorkspaceIds(user));
    if (!chunk) {
      throw new AppError(404, 'KNOWLEDGE_CHUNK_NOT_FOUND', 'Chunk de conhecimento nao encontrado.');
    }
    const references = await knowledgeRepository.listChunkSourceReferences(chunk.id, user.tenant.id, userWorkspaceIds(user));
    return references.map(mapKnowledgeSourceReference);
  },

  async getRagReadiness(assistantId: string, user: AuthenticatedUser, context: RequestContext) {
    const readiness = await knowledgeRepository.getRagReadiness(assistantId, user.tenant.id, userWorkspaceIds(user));
    if (!readiness) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }

    const missingRequirements = [];
    if (readiness.knowledgeBasesBound === 0) missingRequirements.push('NO_KNOWLEDGE_BASES_BOUND');
    if (readiness.documentsIngested === 0) missingRequirements.push('NO_INGESTED_DOCUMENTS');
    if (readiness.chunksAvailable === 0) missingRequirements.push('NO_ACTIVE_CHUNKS');

    await audit({
      user,
      context,
      action: 'rag_readiness_checked',
      entity: 'assistant',
      entityId: readiness.assistant.id,
      workspaceId: readiness.assistant.workspaceId,
      metadata: {
        knowledgeBasesBound: readiness.knowledgeBasesBound,
        documentsIngested: readiness.documentsIngested,
        chunksAvailable: readiness.chunksAvailable,
        embeddingsEnabled: false,
        vectorStoreEnabled: false,
      },
    });

    return {
      assistantId: readiness.assistant.id,
      canUseKnowledge: missingRequirements.length === 0,
      knowledgeBasesBound: readiness.knowledgeBasesBound,
      documentsIngested: readiness.documentsIngested,
      chunksAvailable: readiness.chunksAvailable,
      missingRequirements,
      retrievalMode: 'local_chunks_only',
      embeddingsEnabled: false,
      vectorStoreEnabled: false,
    };
  },

  async localSearch(assistantId: string, input: RagLocalSearchInput, user: AuthenticatedUser, context: RequestContext) {
    const result = await knowledgeRepository.localSearch(assistantId, user.tenant.id, userWorkspaceIds(user), input.query);
    if (!result) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'rag_local_search_executed',
      entity: 'assistant',
      entityId: result.readiness.assistant.id,
      workspaceId: result.readiness.assistant.workspaceId,
      metadata: {
        mode: 'keyword_local_placeholder',
        queryLength: input.query.length,
        results: result.chunks.length,
      },
    });

    return {
      mode: 'keyword_local_placeholder',
      retrievalMode: 'local_chunks_only',
      embeddingsEnabled: false,
      vectorStoreEnabled: false,
      results: result.chunks.map((chunk) => {
        const reference = chunk.sourceReferences[0];
        return {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          knowledgeBaseId: chunk.knowledgeBaseId,
          score: localSearchScore(chunk.content, input.query),
          snippet: localSearchSnippet(chunk.content, input.query),
          source: reference
            ? {
                label: reference.label,
                sourceUri: reference.sourceUri,
                sectionTitle: reference.sectionTitle,
              }
            : null,
        };
      }),
    };
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
