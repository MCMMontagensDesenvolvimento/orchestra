import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
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
  RagQueriesQuery,
} from './knowledge.schema';

const knowledgeBaseInclude = {
  owner: { select: { id: true, name: true, email: true } },
  policies: { take: 1 },
  _count: {
    select: {
      documents: true,
      dataSources: true,
      bindings: true,
      ingestionJobs: true,
      chunks: true,
    },
  },
} satisfies Prisma.KnowledgeBaseInclude;

const bindingInclude = {
  knowledgeBase: {
    include: knowledgeBaseInclude,
  },
} satisfies Prisma.AssistantKnowledgeBindingInclude;

function scopedKnowledgeBaseWhere(id: string, tenantId: string, workspaceIds: string[]) {
  return {
    id,
    tenantId,
    workspaceId: { in: workspaceIds },
  } satisfies Prisma.KnowledgeBaseWhereInput;
}

function jsonInput(value: unknown) {
  return value as Prisma.InputJsonValue | undefined;
}

async function getRagReadinessInternal(assistantId: string, tenantId: string, workspaceIds: string[]) {
  const assistant = await prisma.assistant.findFirst({
    where: { id: assistantId, tenantId, workspaceId: { in: workspaceIds }, deletedAt: null },
    select: { id: true, workspaceId: true },
  });
  if (!assistant) return null;

  const bindings = await prisma.assistantKnowledgeBinding.findMany({
    where: {
      assistantId,
      tenantId,
      workspaceId: { in: workspaceIds },
    },
    include: {
      knowledgeBase: true,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
  const enabledBindings = bindings.filter((binding) => binding.isEnabled && binding.retrievalMode !== 'disabled');
  const archivedKnowledgeBaseCount = enabledBindings.filter(
    (binding) => binding.knowledgeBase.status === 'archived' || Boolean(binding.knowledgeBase.deletedAt),
  ).length;
  const workspaceScopeMismatchCount = enabledBindings.filter((binding) => binding.knowledgeBase.workspaceId !== assistant.workspaceId).length;
  const activeBindings = enabledBindings.filter(
    (binding) =>
      binding.knowledgeBase.status === 'active' &&
      !binding.knowledgeBase.deletedAt &&
      binding.knowledgeBase.workspaceId === assistant.workspaceId,
  );
  const activeKnowledgeBaseIds = activeBindings
    .map((binding) => binding.knowledgeBaseId);

  const [documentsIngested, chunksAvailable, sourceReferencesAvailable] = activeKnowledgeBaseIds.length > 0
    ? await Promise.all([
        prisma.knowledgeDocument.count({
          where: {
            tenantId,
            workspaceId: { in: workspaceIds },
            knowledgeBaseId: { in: activeKnowledgeBaseIds },
            deletedAt: null,
            ingestionStatus: 'completed',
            chunkCount: { gt: 0 },
            status: { not: 'archived' },
          },
        }),
        prisma.knowledgeChunk.count({
          where: {
            tenantId,
            workspaceId: { in: workspaceIds },
            knowledgeBaseId: { in: activeKnowledgeBaseIds },
            status: 'active',
            document: {
              deletedAt: null,
              ingestionStatus: 'completed',
              status: { not: 'archived' },
            },
          },
        }),
        prisma.knowledgeSourceReference.count({
          where: {
            tenantId,
            workspaceId: { in: workspaceIds },
            knowledgeBaseId: { in: activeKnowledgeBaseIds },
            document: {
              deletedAt: null,
              ingestionStatus: 'completed',
              status: { not: 'archived' },
            },
          },
        }),
      ])
    : [0, 0, 0];

  const blockedReasons = [];
  const warnings = [];
  if (bindings.length === 0) blockedReasons.push('NO_KNOWLEDGE_BINDINGS');
  if (bindings.length > 0 && enabledBindings.length === 0) blockedReasons.push('NO_ENABLED_KNOWLEDGE_BINDINGS');
  if (archivedKnowledgeBaseCount > 0 && activeKnowledgeBaseIds.length === 0) blockedReasons.push('KNOWLEDGE_BASE_ARCHIVED');
  if (workspaceScopeMismatchCount > 0 && activeKnowledgeBaseIds.length === 0) blockedReasons.push('WORKSPACE_SCOPE_MISMATCH');
  if (activeKnowledgeBaseIds.length > 0 && documentsIngested === 0) blockedReasons.push('NO_INGESTED_DOCUMENTS');
  if (activeKnowledgeBaseIds.length > 0 && documentsIngested > 0 && chunksAvailable === 0) blockedReasons.push('NO_CHUNKS_AVAILABLE');
  if (archivedKnowledgeBaseCount > 0 && activeKnowledgeBaseIds.length > 0) {
    warnings.push({
      code: 'KNOWLEDGE_BASE_ARCHIVED',
      message: 'Uma ou mais bases vinculadas estao arquivadas e foram excluidas da consulta.',
    });
  }
  if (workspaceScopeMismatchCount > 0 && activeKnowledgeBaseIds.length > 0) {
    warnings.push({
      code: 'WORKSPACE_SCOPE_MISMATCH',
      message: 'Uma ou mais bases vinculadas estao fora do workspace do assistente e foram excluidas da consulta.',
    });
  }
  if (chunksAvailable > 0 && sourceReferencesAvailable === 0) {
    warnings.push({
      code: 'NO_SOURCE_REFERENCES_AVAILABLE',
      message: 'Chunks locais existem, mas ainda nao possuem source references rastreaveis.',
    });
  }

  return {
    assistant,
    bindings,
    enabledBindings,
    activeBindings,
    activeKnowledgeBaseIds,
    knowledgeBasesBound: activeKnowledgeBaseIds.length,
    knowledgeBaseCount: activeKnowledgeBaseIds.length,
    documentsIngested,
    documentCount: documentsIngested,
    chunksAvailable,
    chunkCount: chunksAvailable,
    sourceReferenceCount: sourceReferencesAvailable,
    enabledBindingCount: enabledBindings.length,
    blockedReasons,
    warnings,
  };
}

interface LocalChunkPersistenceInput {
  chunkIndex: number;
  content: string;
  contentHash: string;
  tokenEstimate: number;
  charCount: number;
  startOffset: number;
  endOffset: number;
  sectionTitle: string | null;
}

interface SourceReferencePersistenceInput {
  chunkIndex: number;
  label: string;
  sourceType: string;
  sourceUri?: string | null;
  sectionTitle?: string | null;
  startOffset?: number | null;
  endOffset?: number | null;
  metadata?: Prisma.InputJsonValue;
}

interface RagQueryPersistenceResultInput {
  knowledgeBaseId: string;
  documentId: string;
  chunkId: string;
  sourceReferenceId?: string | null;
  rank: number;
  score: number;
  matchType: string;
  excerpt: string;
  citationLabel: string;
  metadata?: Prisma.InputJsonValue;
}

interface RagQueryPersistenceInput {
  tenantId: string;
  workspaceId: string;
  assistantId: string;
  assistantVersionId?: string | null;
  agentRunId?: string | null;
  queryText: string;
  normalizedQuery: string;
  mode: string;
  status: string;
  limit: number;
  resultCount: number;
  blockedReason?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdById: string;
  requestId?: string | null;
  traceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  results?: RagQueryPersistenceResultInput[];
}

export const knowledgeRepository = {
  async listKnowledgeBases(tenantId: string, workspaceIds: string[], query: KnowledgeBasesQuery) {
    const where: Prisma.KnowledgeBaseWhereInput = {
      tenantId,
      workspaceId: query.workspaceId ?? { in: workspaceIds },
      ...(query.status ? { status: query.status } : { deletedAt: null, status: { not: 'archived' } }),
      ...(query.status === 'archived' ? {} : query.status ? { deletedAt: null } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.dataClassification ? { dataClassification: query.dataClassification } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.knowledgeBase.findMany({
        where,
        include: knowledgeBaseInclude,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.knowledgeBase.count({ where }),
    ]);
    return { data, total };
  },

  findKnowledgeBaseById(id: string, tenantId: string, workspaceIds: string[]) {
    return prisma.knowledgeBase.findFirst({
      where: scopedKnowledgeBaseWhere(id, tenantId, workspaceIds),
      include: knowledgeBaseInclude,
    });
  },

  createKnowledgeBase(input: KnowledgeBaseCreateInput & { tenantId: string; workspaceId: string; ownerUserId?: string | null }) {
    return prisma.knowledgeBase.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        status: input.status,
        visibility: input.visibility,
        dataClassification: input.dataClassification,
        ownerUserId: input.ownerUserId,
        metadata: jsonInput(input.metadata),
        policies: {
          create: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            allowRuntimeRetrieval: false,
            allowCitationOnly: true,
            requireApprovalForExternal: true,
          },
        },
      },
      include: knowledgeBaseInclude,
    });
  },

  async updateKnowledgeBase(id: string, tenantId: string, workspaceIds: string[], input: KnowledgeBaseUpdateInput) {
    const existing = await prisma.knowledgeBase.findFirst({
      where: scopedKnowledgeBaseWhere(id, tenantId, workspaceIds),
      select: { id: true },
    });
    if (!existing) return null;

    return prisma.knowledgeBase.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        visibility: input.visibility,
        dataClassification: input.dataClassification,
        ownerUserId: input.ownerUserId,
        metadata: input.metadata === null ? Prisma.JsonNull : jsonInput(input.metadata),
      },
      include: knowledgeBaseInclude,
    });
  },

  async archiveKnowledgeBase(id: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.knowledgeBase.findFirst({
      where: scopedKnowledgeBaseWhere(id, tenantId, workspaceIds),
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.knowledgeBase.update({
      where: { id: existing.id },
      data: { status: 'archived', deletedAt: new Date() },
      include: knowledgeBaseInclude,
    });
  },

  async restoreKnowledgeBase(id: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.knowledgeBase.findFirst({
      where: scopedKnowledgeBaseWhere(id, tenantId, workspaceIds),
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.knowledgeBase.update({
      where: { id: existing.id },
      data: { status: 'active', deletedAt: null },
      include: knowledgeBaseInclude,
    });
  },

  listDocuments(knowledgeBaseId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.knowledgeDocument.findMany({
      where: {
        knowledgeBaseId,
        tenantId,
        workspaceId: { in: workspaceIds },
        deletedAt: null,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  },

  findDocument(documentId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
    });
  },

  createDocument(input: KnowledgeDocumentCreateInput & { tenantId: string; workspaceId: string; knowledgeBaseId: string; createdById: string }) {
    return prisma.knowledgeDocument.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        knowledgeBaseId: input.knowledgeBaseId,
        title: input.title,
        description: input.description,
        sourceType: input.sourceType,
        sourceUri: input.sourceUri,
        mimeType: input.mimeType,
        status: input.status,
        ingestionStatus: input.ingestionStatus,
        dataClassification: input.dataClassification,
        contentText: input.contentText,
        metadata: jsonInput(input.metadata),
        createdById: input.createdById,
      },
    });
  },

  async updateDocument(documentId: string, tenantId: string, workspaceIds: string[], input: KnowledgeDocumentUpdateInput) {
    const existing = await prisma.knowledgeDocument.findFirst({
      where: { id: documentId, tenantId, workspaceId: { in: workspaceIds } },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.knowledgeDocument.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description,
        sourceType: input.sourceType,
        sourceUri: input.sourceUri,
        mimeType: input.mimeType,
        status: input.status,
        ingestionStatus: input.ingestionStatus,
        ingestionErrorCode: input.ingestionErrorCode,
        ingestionErrorMessage: input.ingestionErrorMessage,
        dataClassification: input.dataClassification,
        contentText: input.contentText,
        ...(input.contentText !== undefined
          ? {
              contentHash: null,
              ingestedAt: null,
              chunkCount: 0,
              status: input.status ?? 'draft',
              ingestionStatus: input.ingestionStatus ?? 'pending',
              ingestionErrorCode: null,
              ingestionErrorMessage: null,
            }
          : {}),
        metadata: input.metadata === null ? Prisma.JsonNull : jsonInput(input.metadata),
      },
    });
  },

  async archiveDocument(documentId: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.knowledgeDocument.findFirst({
      where: { id: documentId, tenantId, workspaceId: { in: workspaceIds } },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.knowledgeDocument.update({
      where: { id: existing.id },
      data: { status: 'archived', deletedAt: new Date() },
    });
  },

  async recordFailedIngestion(input: {
    documentId: string;
    tenantId: string;
    workspaceIds: string[];
    createdById: string;
    errorCode: string;
    errorMessage: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.$transaction(async (tx) => {
      const document = await tx.knowledgeDocument.findFirst({
        where: {
          id: input.documentId,
          tenantId: input.tenantId,
          workspaceId: { in: input.workspaceIds },
          deletedAt: null,
        },
      });
      if (!document) return null;

      const now = new Date();
      const job = await tx.knowledgeIngestionJob.create({
        data: {
          tenantId: document.tenantId,
          workspaceId: document.workspaceId,
          knowledgeBaseId: document.knowledgeBaseId,
          documentId: document.id,
          status: 'failed',
          strategy: 'local_text_chunking',
          startedAt: now,
          completedAt: now,
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
          chunksCreated: 0,
          sourceReferencesCreated: 0,
          createdById: input.createdById,
          metadata: input.metadata,
        },
      });

      const event = await tx.knowledgeIngestionEvent.create({
        data: {
          jobId: job.id,
          tenantId: document.tenantId,
          workspaceId: document.workspaceId,
          knowledgeBaseId: document.knowledgeBaseId,
          documentId: document.id,
          eventType: 'knowledge_ingestion_failed',
          level: 'error',
          message: input.errorMessage,
          metadata: {
            errorCode: input.errorCode,
            strategy: 'local_text_chunking',
          },
        },
      });

      const updatedDocument = await tx.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: 'failed',
          ingestionStatus: 'failed',
          ingestionErrorCode: input.errorCode,
          ingestionErrorMessage: input.errorMessage,
          ingestedAt: null,
          chunkCount: 0,
        },
      });

      return { document: updatedDocument, job, events: [event] };
    });
  },

  async requestIngestion(input: {
    documentId: string;
    tenantId: string;
    workspaceIds: string[];
    createdById: string;
    contentHash: string;
    chunks: LocalChunkPersistenceInput[];
    sourceReferences: SourceReferencePersistenceInput[];
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.$transaction(async (tx) => {
      const document = await tx.knowledgeDocument.findFirst({
        where: {
          id: input.documentId,
          tenantId: input.tenantId,
          workspaceId: { in: input.workspaceIds },
          deletedAt: null,
        },
      });
      if (!document) return null;

      const now = new Date();
      const job = await tx.knowledgeIngestionJob.create({
        data: {
          tenantId: document.tenantId,
          workspaceId: document.workspaceId,
          knowledgeBaseId: document.knowledgeBaseId,
          documentId: document.id,
          status: 'running',
          strategy: 'local_text_chunking',
          startedAt: now,
          createdById: input.createdById,
          metadata: input.metadata,
        },
      });

      const startedEvent = await tx.knowledgeIngestionEvent.create({
        data: {
          jobId: job.id,
          tenantId: document.tenantId,
          workspaceId: document.workspaceId,
          knowledgeBaseId: document.knowledgeBaseId,
          documentId: document.id,
          eventType: 'knowledge_ingestion_started',
          message: 'Local text ingestion started.',
          metadata: input.metadata,
        },
      });

      await tx.knowledgeChunk.updateMany({
        where: {
          documentId: document.id,
          tenantId: document.tenantId,
          workspaceId: document.workspaceId,
          status: 'active',
        },
        data: { status: 'stale' },
      });

      await tx.knowledgeSourceReference.deleteMany({
        where: {
          documentId: document.id,
          tenantId: document.tenantId,
          workspaceId: document.workspaceId,
        },
      });

      const createdChunks = [];
      for (const chunk of input.chunks) {
        createdChunks.push(
          await tx.knowledgeChunk.create({
            data: {
              tenantId: document.tenantId,
              workspaceId: document.workspaceId,
              knowledgeBaseId: document.knowledgeBaseId,
              documentId: document.id,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              contentHash: chunk.contentHash,
              tokenEstimate: chunk.tokenEstimate,
              charCount: chunk.charCount,
              status: 'active',
              metadata: {
                startOffset: chunk.startOffset,
                endOffset: chunk.endOffset,
                sectionTitle: chunk.sectionTitle,
              },
            },
          }),
        );
      }

      const chunksByIndex = new Map(createdChunks.map((chunk) => [chunk.chunkIndex, chunk]));
      const createdSourceReferences = [];
      for (const reference of input.sourceReferences) {
        const chunk = chunksByIndex.get(reference.chunkIndex);
        createdSourceReferences.push(
          await tx.knowledgeSourceReference.create({
            data: {
              tenantId: document.tenantId,
              workspaceId: document.workspaceId,
              knowledgeBaseId: document.knowledgeBaseId,
              documentId: document.id,
              chunkId: chunk?.id,
              label: reference.label,
              sourceType: reference.sourceType,
              sourceUri: reference.sourceUri,
              sectionTitle: reference.sectionTitle,
              startOffset: reference.startOffset,
              endOffset: reference.endOffset,
              metadata: reference.metadata,
            },
          }),
        );
      }

      const chunkEvent = await tx.knowledgeIngestionEvent.create({
        data: {
          jobId: job.id,
          tenantId: document.tenantId,
          workspaceId: document.workspaceId,
          knowledgeBaseId: document.knowledgeBaseId,
          documentId: document.id,
          eventType: 'knowledge_chunks_created',
          message: 'Local text chunks created.',
          metadata: {
            chunksCreated: createdChunks.length,
          },
        },
      });

      const referenceEvent = await tx.knowledgeIngestionEvent.create({
        data: {
          jobId: job.id,
          tenantId: document.tenantId,
          workspaceId: document.workspaceId,
          knowledgeBaseId: document.knowledgeBaseId,
          documentId: document.id,
          eventType: 'knowledge_source_references_created',
          message: 'Source references created for local chunks.',
          metadata: {
            sourceReferencesCreated: createdSourceReferences.length,
          },
        },
      });

      const updatedDocument = await tx.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: 'indexed',
          ingestionStatus: 'completed',
          ingestionErrorCode: null,
          ingestionErrorMessage: null,
          contentHash: input.contentHash,
          ingestedAt: now,
          chunkCount: createdChunks.length,
        },
      });

      const completedJob = await tx.knowledgeIngestionJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          completedAt: now,
          chunksCreated: createdChunks.length,
          sourceReferencesCreated: createdSourceReferences.length,
        },
      });

      const completedEvent = await tx.knowledgeIngestionEvent.create({
        data: {
          jobId: job.id,
          tenantId: document.tenantId,
          workspaceId: document.workspaceId,
          knowledgeBaseId: document.knowledgeBaseId,
          documentId: document.id,
          eventType: 'knowledge_ingestion_completed',
          message: 'Local text ingestion completed.',
          metadata: {
            chunksCreated: createdChunks.length,
            sourceReferencesCreated: createdSourceReferences.length,
          },
        },
      });

      return {
        document: updatedDocument,
        job: completedJob,
        chunks: createdChunks,
        sourceReferences: createdSourceReferences,
        events: [startedEvent, chunkEvent, referenceEvent, completedEvent],
      };
    });
  },

  listIngestionJobs(documentId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.knowledgeIngestionJob.findMany({
      where: {
        documentId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  findIngestionJob(jobId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.knowledgeIngestionJob.findFirst({
      where: {
        id: jobId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
  },

  async listDocumentChunks(documentId: string, tenantId: string, workspaceIds: string[], query: KnowledgeChunksQuery) {
    const where: Prisma.KnowledgeChunkWhereInput = {
      documentId,
      tenantId,
      workspaceId: { in: workspaceIds },
      status: query.status,
      ...(query.search ? { content: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.knowledgeChunk.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.knowledgeChunk.count({ where }),
    ]);
    return { data, total };
  },

  async listKnowledgeBaseChunks(knowledgeBaseId: string, tenantId: string, workspaceIds: string[], query: KnowledgeChunksQuery) {
    const where: Prisma.KnowledgeChunkWhereInput = {
      knowledgeBaseId,
      tenantId,
      workspaceId: { in: workspaceIds },
      status: query.status,
      ...(query.search ? { content: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.knowledgeChunk.findMany({
        where,
        orderBy: [{ documentId: 'asc' }, { [query.sortBy]: query.sortDirection }],
        ...paginationOffset(query),
      }),
      prisma.knowledgeChunk.count({ where }),
    ]);
    return { data, total };
  },

  findChunk(chunkId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.knowledgeChunk.findFirst({
      where: {
        id: chunkId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
    });
  },

  listDocumentSourceReferences(documentId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.knowledgeSourceReference.findMany({
      where: {
        documentId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      orderBy: [{ chunkId: 'asc' }, { createdAt: 'asc' }],
    });
  },

  listChunkSourceReferences(chunkId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.knowledgeSourceReference.findMany({
      where: {
        chunkId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getRagReadiness(assistantId: string, tenantId: string, workspaceIds: string[]) {
    return getRagReadinessInternal(assistantId, tenantId, workspaceIds);
  },

  async localSearch(assistantId: string, tenantId: string, workspaceIds: string[], query: string) {
    const readiness = await getRagReadinessInternal(assistantId, tenantId, workspaceIds);
    if (!readiness) return null;
    const knowledgeBaseIds = readiness.bindings
      .filter((binding) => binding.isEnabled && binding.knowledgeBase.status === 'active' && !binding.knowledgeBase.deletedAt)
      .map((binding) => binding.knowledgeBaseId);
    if (knowledgeBaseIds.length === 0) {
      return { readiness, chunks: [] };
    }

    const chunks = await prisma.knowledgeChunk.findMany({
      where: {
        tenantId,
        workspaceId: { in: workspaceIds },
        knowledgeBaseId: { in: knowledgeBaseIds },
        status: 'active',
        content: { contains: query, mode: 'insensitive' },
      },
      include: {
        sourceReferences: { take: 1, orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ updatedAt: 'desc' }, { chunkIndex: 'asc' }],
      take: 10,
    });

    return { readiness, chunks };
  },

  async findRagRetrievalCandidates(input: {
    assistantId: string;
    tenantId: string;
    workspaceIds: string[];
    queryText: string;
    terms: string[];
    take: number;
  }) {
    const readiness = await getRagReadinessInternal(input.assistantId, input.tenantId, input.workspaceIds);
    if (!readiness) return null;
    if (readiness.activeKnowledgeBaseIds.length === 0 || readiness.blockedReasons.length > 0) {
      return { readiness, chunks: [] };
    }

    const searchTerms = Array.from(new Set([input.queryText, ...input.terms].map((term) => term.trim()).filter(Boolean)));
    const baseWhere = {
      tenantId: input.tenantId,
      workspaceId: { in: input.workspaceIds },
      knowledgeBaseId: { in: readiness.activeKnowledgeBaseIds },
      status: 'active',
      document: {
        deletedAt: null,
        ingestionStatus: 'completed',
        status: { not: 'archived' },
      },
    } satisfies Prisma.KnowledgeChunkWhereInput;
    const chunks = await prisma.knowledgeChunk.findMany({
      where: {
        ...baseWhere,
        OR: searchTerms.flatMap((term) => [
          { content: { contains: term, mode: 'insensitive' as const } },
          { document: { title: { contains: term, mode: 'insensitive' as const } } },
        ]),
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            sourceType: true,
            sourceUri: true,
            status: true,
            ingestionStatus: true,
            deletedAt: true,
          },
        },
        knowledgeBase: {
          select: {
            id: true,
            name: true,
            status: true,
            deletedAt: true,
            workspaceId: true,
          },
        },
        sourceReferences: { take: 1, orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ updatedAt: 'desc' }, { chunkIndex: 'asc' }, { id: 'asc' }],
      take: input.take,
    });

    if (chunks.length > 0) {
      return { readiness, chunks };
    }

    const fallbackChunks = await prisma.knowledgeChunk.findMany({
      where: baseWhere,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            sourceType: true,
            sourceUri: true,
            status: true,
            ingestionStatus: true,
            deletedAt: true,
          },
        },
        knowledgeBase: {
          select: {
            id: true,
            name: true,
            status: true,
            deletedAt: true,
            workspaceId: true,
          },
        },
        sourceReferences: { take: 1, orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ updatedAt: 'desc' }, { chunkIndex: 'asc' }, { id: 'asc' }],
      take: input.take,
    });

    return { readiness, chunks: fallbackChunks };
  },

  async createRagQueryWithResults(input: RagQueryPersistenceInput) {
    return prisma.$transaction(async (tx) => {
      const query = await tx.ragQuery.create({
        data: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          assistantId: input.assistantId,
          assistantVersionId: input.assistantVersionId,
          agentRunId: input.agentRunId,
          queryText: input.queryText,
          normalizedQuery: input.normalizedQuery,
          mode: input.mode,
          status: input.status,
          limit: input.limit,
          resultCount: input.resultCount,
          blockedReason: input.blockedReason,
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
          createdById: input.createdById,
          requestId: input.requestId,
          traceId: input.traceId,
          metadata: input.metadata,
        },
      });

      if (input.results?.length) {
        await tx.ragQueryResult.createMany({
          data: input.results.map((result) => ({
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            ragQueryId: query.id,
            knowledgeBaseId: result.knowledgeBaseId,
            documentId: result.documentId,
            chunkId: result.chunkId,
            sourceReferenceId: result.sourceReferenceId,
            rank: result.rank,
            score: result.score,
            matchType: result.matchType,
            excerpt: result.excerpt,
            citationLabel: result.citationLabel,
            metadata: result.metadata,
          })),
        });
      }

      return tx.ragQuery.findUniqueOrThrow({
        where: { id: query.id },
        include: {
          results: {
            orderBy: { rank: 'asc' },
            include: {
              document: { select: { id: true, title: true, sourceUri: true, sourceType: true } },
              sourceReference: { select: { id: true, label: true, sourceUri: true, sectionTitle: true, pageNumber: true } },
            },
          },
        },
      });
    });
  },

  async listRagQueries(assistantId: string, tenantId: string, workspaceIds: string[], query: RagQueriesQuery) {
    const where: Prisma.RagQueryWhereInput = {
      assistantId,
      tenantId,
      workspaceId: { in: workspaceIds },
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            queryText: { contains: query.search, mode: 'insensitive' },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.ragQuery.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.ragQuery.count({ where }),
    ]);
    return { data, total };
  },

  findRagQuery(queryId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.ragQuery.findFirst({
      where: {
        id: queryId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      include: {
        results: {
          orderBy: { rank: 'asc' },
          include: {
            document: { select: { id: true, title: true, sourceUri: true, sourceType: true } },
            sourceReference: { select: { id: true, label: true, sourceUri: true, sectionTitle: true, pageNumber: true } },
          },
        },
      },
    });
  },

  async listRagQueryResults(queryId: string, tenantId: string, workspaceIds: string[]) {
    const query = await prisma.ragQuery.findFirst({
      where: {
        id: queryId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      select: { id: true },
    });
    if (!query) return null;
    return prisma.ragQueryResult.findMany({
      where: {
        ragQueryId: query.id,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      orderBy: { rank: 'asc' },
      include: {
        document: { select: { id: true, title: true, sourceUri: true, sourceType: true } },
        sourceReference: { select: { id: true, label: true, sourceUri: true, sectionTitle: true, pageNumber: true } },
      },
    });
  },

  listDataSources(knowledgeBaseId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.knowledgeDataSource.findMany({
      where: {
        knowledgeBaseId,
        tenantId,
        workspaceId: { in: workspaceIds },
        deletedAt: null,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  },

  createDataSource(input: KnowledgeDataSourceCreateInput & { tenantId: string; workspaceId: string; knowledgeBaseId: string; createdById: string }) {
    return prisma.knowledgeDataSource.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        knowledgeBaseId: input.knowledgeBaseId,
        name: input.name,
        type: input.type,
        config: jsonInput(input.config),
        status: input.status,
        createdById: input.createdById,
      },
    });
  },

  async updateDataSource(dataSourceId: string, tenantId: string, workspaceIds: string[], input: KnowledgeDataSourceUpdateInput) {
    const existing = await prisma.knowledgeDataSource.findFirst({
      where: { id: dataSourceId, tenantId, workspaceId: { in: workspaceIds } },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.knowledgeDataSource.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        type: input.type,
        config: input.config === null ? Prisma.JsonNull : jsonInput(input.config),
        status: input.status,
      },
    });
  },

  async archiveDataSource(dataSourceId: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.knowledgeDataSource.findFirst({
      where: { id: dataSourceId, tenantId, workspaceId: { in: workspaceIds } },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.knowledgeDataSource.update({
      where: { id: existing.id },
      data: { status: 'archived', deletedAt: new Date() },
    });
  },

  findAssistant(id: string, tenantId: string, workspaceIds: string[]) {
    return prisma.assistant.findFirst({
      where: { id, tenantId, workspaceId: { in: workspaceIds }, deletedAt: null },
      select: { id: true, tenantId: true, workspaceId: true, status: true, deletedAt: true },
    });
  },

  listBindings(assistantId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.assistantKnowledgeBinding.findMany({
      where: {
        assistantId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      include: bindingInclude,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  },

  async createBinding(input: AssistantKnowledgeBindingCreateInput & {
    tenantId: string;
    workspaceId: string;
    assistantId: string;
    createdById: string;
  }) {
    const existing = await prisma.assistantKnowledgeBinding.findFirst({
      where: {
        assistantId: input.assistantId,
        knowledgeBaseId: input.knowledgeBaseId,
      },
      select: { id: true },
    });
    if (existing) {
      return prisma.assistantKnowledgeBinding.update({
        where: { id: existing.id },
        data: {
          isEnabled: input.isEnabled,
          retrievalMode: input.retrievalMode,
          priority: input.priority,
        },
        include: bindingInclude,
      });
    }

    return prisma.assistantKnowledgeBinding.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        knowledgeBaseId: input.knowledgeBaseId,
        isEnabled: input.isEnabled,
        retrievalMode: input.retrievalMode,
        priority: input.priority,
        createdById: input.createdById,
      },
      include: bindingInclude,
    });
  },

  async updateBinding(assistantId: string, bindingId: string, tenantId: string, workspaceIds: string[], input: AssistantKnowledgeBindingUpdateInput) {
    const existing = await prisma.assistantKnowledgeBinding.findFirst({
      where: {
        id: bindingId,
        assistantId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.assistantKnowledgeBinding.update({
      where: { id: existing.id },
      data: {
        isEnabled: input.isEnabled,
        retrievalMode: input.retrievalMode,
        priority: input.priority,
      },
      include: bindingInclude,
    });
  },

  async disableBinding(assistantId: string, bindingId: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.assistantKnowledgeBinding.findFirst({
      where: {
        id: bindingId,
        assistantId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.assistantKnowledgeBinding.update({
      where: { id: existing.id },
      data: { isEnabled: false, retrievalMode: 'disabled' },
      include: bindingInclude,
    });
  },
};
