import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import type { AssistantCreateInput, AssistantUpdateInput } from './assistants.schema';

export const assistantsRepository = {
  list(tenantId: string, workspaceIds: string[]) {
    return prisma.assistant.findMany({
      where: {
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
      orderBy: { updatedAt: 'desc' },
    });
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
        versions: {
          orderBy: { createdAt: 'desc' },
        },
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
        versions: true,
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
        versions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },
};
