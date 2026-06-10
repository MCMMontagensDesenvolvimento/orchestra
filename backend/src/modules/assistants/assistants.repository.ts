import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type {
  AssistantCreateInput,
  AssistantsQuery,
  AssistantShareCreateInput,
  AssistantUpdateInput,
  AssistantVersionCreateInput,
} from './assistants.schema';

export const assistantsRepository = {
  async list(tenantId: string, workspaceIds: string[], query: AssistantsQuery) {
    const where: Prisma.AssistantWhereInput = {
      tenantId,
      workspaceId: { in: workspaceIds },
      deletedAt: null,
      ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
      ...(query.status ? { status: query.status } : {}),
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
      prisma.assistant.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          versions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.assistant.count({ where }),
    ]);
    return { data, total };
  },

  findById(id: string, tenantId: string, workspaceIds: string[]) {
    return prisma.assistant.findFirst({
      where: {
        id,
        tenantId,
        workspaceId: { in: workspaceIds },
        deletedAt: null,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        versions: {
          orderBy: { createdAt: 'desc' },
        },
        shares: true,
      },
    });
  },

  create(input: AssistantCreateInput & { tenantId: string; workspaceId: string; createdById: string }) {
    const version = input.version;
    return prisma.assistant.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        status: input.status,
        createdById: input.createdById,
        versions: {
          create: {
            version: '0.1.0',
            status: 'draft',
            displayName: version?.displayName ?? 'Initial draft',
            instructions: version?.instructions,
            modelProvider: version?.modelProvider,
            modelName: version?.modelName,
            temperature: version?.temperature != null ? new Prisma.Decimal(version.temperature) : undefined,
            createdById: input.createdById,
          },
        },
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        versions: true,
        shares: true,
      },
    });
  },

  async update(id: string, tenantId: string, workspaceIds: string[], input: AssistantUpdateInput) {
    const existing = await prisma.assistant.findFirst({
      where: {
        id,
        tenantId,
        workspaceId: { in: workspaceIds },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    return prisma.assistant.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        versions: {
          orderBy: { createdAt: 'desc' },
        },
        shares: true,
      },
    });
  },

  async archive(id: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.assistant.findFirst({
      where: {
        id,
        tenantId,
        workspaceId: { in: workspaceIds },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    return prisma.assistant.update({
      where: { id: existing.id },
      data: { status: 'archived' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        versions: { orderBy: { createdAt: 'desc' } },
        shares: true,
      },
    });
  },

  listVersions(assistantId: string) {
    return prisma.assistantVersion.findMany({
      where: { assistantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  findVersion(assistantId: string, versionId: string) {
    return prisma.assistantVersion.findFirst({
      where: { id: versionId, assistantId },
    });
  },

  async createVersion(input: AssistantVersionCreateInput & { assistantId: string; createdById: string }) {
    const versionCount = await prisma.assistantVersion.count({ where: { assistantId: input.assistantId } });
    return prisma.assistantVersion.create({
      data: {
        assistantId: input.assistantId,
        version: input.version ?? `0.${versionCount + 1}.0`,
        status: 'draft',
        displayName: input.displayName,
        instructions: input.instructions,
        modelProvider: input.modelProvider,
        modelName: input.modelName,
        temperature: input.temperature != null ? new Prisma.Decimal(input.temperature) : undefined,
        createdById: input.createdById,
      },
    });
  },

  async publish(id: string, tenantId: string, workspaceIds: string[]) {
    const assistant = await prisma.assistant.findFirst({
      where: {
        id,
        tenantId,
        workspaceId: { in: workspaceIds },
        deletedAt: null,
      },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!assistant || assistant.versions.length === 0) {
      return null;
    }
    const latestVersion = assistant.versions[0];
    await prisma.assistantVersion.update({
      where: { id: latestVersion.id },
      data: {
        status: 'published',
        publishedAt: latestVersion.publishedAt ?? new Date(),
      },
    });
    return prisma.assistant.update({
      where: { id: assistant.id },
      data: { status: 'published' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        versions: { orderBy: { createdAt: 'desc' } },
        shares: true,
      },
    });
  },

  async unpublish(id: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.assistant.findFirst({
      where: {
        id,
        tenantId,
        workspaceId: { in: workspaceIds },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    return prisma.assistant.update({
      where: { id: existing.id },
      data: { status: 'draft' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        versions: { orderBy: { createdAt: 'desc' } },
        shares: true,
      },
    });
  },

  listShares(assistantId: string) {
    return prisma.assistantShare.findMany({
      where: { assistantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  createShare(input: AssistantShareCreateInput & { assistantId: string }) {
    return prisma.assistantShare.create({
      data: {
        assistantId: input.assistantId,
        shareType: input.shareType,
        targetId: input.targetId,
      },
    });
  },

  workspaceExists(workspaceId: string, tenantId: string) {
    return prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId, deletedAt: null },
      select: { id: true },
    });
  },

  userExists(userId: string, tenantId: string) {
    return prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: { id: true },
    });
  },

  async deleteShare(assistantId: string, shareId: string) {
    const existing = await prisma.assistantShare.findFirst({
      where: { id: shareId, assistantId },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    await prisma.assistantShare.delete({ where: { id: existing.id } });
    return existing;
  },
};
