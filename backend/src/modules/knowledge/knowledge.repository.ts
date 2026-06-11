import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
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

  async requestIngestion(input: {
    documentId: string;
    tenantId: string;
    workspaceIds: string[];
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
      const updatedDocument = await tx.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: 'indexed_placeholder',
          ingestionStatus: 'completed_placeholder',
          ingestionErrorCode: null,
          ingestionErrorMessage: null,
        },
      });
      const job = await tx.knowledgeIngestionJob.create({
        data: {
          tenantId: document.tenantId,
          workspaceId: document.workspaceId,
          knowledgeBaseId: document.knowledgeBaseId,
          documentId: document.id,
          status: 'completed_placeholder',
          startedAt: now,
          completedAt: now,
          metadata: input.metadata,
        },
      });
      return { document: updatedDocument, job };
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
