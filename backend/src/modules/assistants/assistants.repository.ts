import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type {
  AssistantCreateInput,
  AssistantApprovalCreateInput,
  AssistantExecutionPolicyUpdateInput,
  AssistantFeedbackCreateInput,
  AssistantPublishInput,
  AssistantRollbackInput,
  AssistantShareCreateInput,
  AssistantTestResultCreateInput,
  AssistantUpdateInput,
  AssistantsQuery,
  AssistantVersionCreateInput,
} from './assistants.schema';

const assistantListInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  versions: {
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  publications: {
    where: { status: 'active' },
    orderBy: { publishedAt: 'desc' },
    take: 1,
  },
  executionPolicy: true,
} satisfies Prisma.AssistantInclude;

const assistantDetailInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  versions: {
    orderBy: { createdAt: 'desc' },
  },
  publications: {
    orderBy: { publishedAt: 'desc' },
  },
  shares: {
    orderBy: { createdAt: 'desc' },
  },
  executionPolicy: true,
} satisfies Prisma.AssistantInclude;

const publicationOrder = [{ publishedAt: 'desc' as const }, { createdAt: 'desc' as const }];

function scopedAssistantWhere(id: string, tenantId: string, workspaceIds: string[]) {
  return {
    id,
    tenantId,
    workspaceId: { in: workspaceIds },
    deletedAt: null,
  } satisfies Prisma.AssistantWhereInput;
}

function versionData(input: AssistantVersionCreateInput & { version: string }, createdById: string) {
  return {
    version: input.version,
    status: 'draft',
    displayName: input.displayName,
    description: input.description,
    instructions: input.instructions,
    modelProvider: input.modelProvider,
    modelName: input.modelName,
    temperature: input.temperature != null ? new Prisma.Decimal(input.temperature) : undefined,
    configuration: input.configuration as Prisma.InputJsonValue | undefined,
    createdById,
  };
}

function executionPolicyData(input: AssistantExecutionPolicyUpdateInput, updatedById?: string) {
  return {
    executionMode: input.executionMode,
    requiresApprovalToPublish: input.requiresApprovalToPublish,
    sandboxEnabled: input.sandboxEnabled,
    sandboxRequiresAuth: input.sandboxRequiresAuth,
    sandboxAllowedForRoles: input.sandboxAllowedForRoles as Prisma.InputJsonValue | undefined,
    sandboxBlocksExternalTools: input.sandboxBlocksExternalTools,
    sandboxBlocksRealProviders: input.sandboxBlocksRealProviders,
    sandboxLogsRequired: input.sandboxLogsRequired,
    sandboxCostLimitPlaceholder:
      input.sandboxCostLimitPlaceholder === null
        ? null
        : input.sandboxCostLimitPlaceholder !== undefined
          ? new Prisma.Decimal(input.sandboxCostLimitPlaceholder)
          : undefined,
    allowDraftTesting: input.allowDraftTesting,
    allowPublishedExecution: input.allowPublishedExecution,
    isExecutionEnabled: input.isExecutionEnabled,
    updatedById,
  };
}

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
        include: assistantListInclude,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.assistant.count({ where }),
    ]);
    return { data, total };
  },

  findById(id: string, tenantId: string, workspaceIds: string[]) {
    return prisma.assistant.findFirst({
      where: scopedAssistantWhere(id, tenantId, workspaceIds),
      include: assistantDetailInclude,
    });
  },

  create(input: AssistantCreateInput & { tenantId: string; workspaceId: string; createdById: string }) {
    const initialVersion = input.version;
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
            displayName: initialVersion?.displayName ?? 'Initial draft',
            description: initialVersion?.description,
            instructions: initialVersion?.instructions,
            modelProvider: initialVersion?.modelProvider,
            modelName: initialVersion?.modelName,
            temperature: initialVersion?.temperature != null ? new Prisma.Decimal(initialVersion.temperature) : undefined,
            configuration: initialVersion?.configuration as Prisma.InputJsonValue | undefined,
            createdById: input.createdById,
          },
        },
        executionPolicy: {
          create: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
          },
        },
      },
      include: assistantDetailInclude,
    });
  },

  async update(id: string, tenantId: string, workspaceIds: string[], input: AssistantUpdateInput) {
    const existing = await prisma.assistant.findFirst({
      where: scopedAssistantWhere(id, tenantId, workspaceIds),
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
      include: assistantDetailInclude,
    });
  },

  async archive(input: { id: string; tenantId: string; workspaceIds: string[]; actorUserId: string }) {
    return prisma.$transaction(async (tx) => {
      const assistant = await tx.assistant.findFirst({
        where: scopedAssistantWhere(input.id, input.tenantId, input.workspaceIds),
        select: { id: true },
      });
      if (!assistant) return null;

      const now = new Date();
      const activePublication = await tx.assistantPublication.findFirst({
        where: { assistantId: assistant.id, status: 'active' },
      });
      if (activePublication) {
        await tx.assistantPublication.update({
          where: { id: activePublication.id },
          data: {
            status: 'inactive',
            unpublishedById: input.actorUserId,
            unpublishedAt: now,
          },
        });
        await tx.assistantVersion.update({
          where: { id: activePublication.assistantVersionId },
          data: { status: 'archived', archivedAt: now },
        });
      }

      return tx.assistant.update({
        where: { id: assistant.id },
        data: { status: 'archived' },
        include: assistantDetailInclude,
      });
    });
  },

  async restore(id: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.assistant.findFirst({
      where: scopedAssistantWhere(id, tenantId, workspaceIds),
      select: { id: true },
    });
    if (!existing) return null;

    return prisma.assistant.update({
      where: { id: existing.id },
      data: { status: 'draft' },
      include: assistantDetailInclude,
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
        ...versionData({ ...input, version: input.version ?? `0.${versionCount + 1}.0` }, input.createdById),
      },
    });
  },

  async publish(input: {
    id: string;
    tenantId: string;
    workspaceIds: string[];
    actorUserId: string;
    payload: AssistantPublishInput;
  }) {
    return prisma.$transaction(async (tx) => {
      const assistant = await tx.assistant.findFirst({
        where: scopedAssistantWhere(input.id, input.tenantId, input.workspaceIds),
        include: {
          versions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!assistant) return null;

      const targetVersion = input.payload.versionId
        ? await tx.assistantVersion.findFirst({ where: { id: input.payload.versionId, assistantId: assistant.id } })
        : assistant.versions[0];
      if (!targetVersion) return null;

      const activePublication = await tx.assistantPublication.findFirst({
        where: { assistantId: assistant.id, status: 'active' },
      });
      const now = new Date();

      if (activePublication?.assistantVersionId === targetVersion.id) {
        await tx.assistant.update({ where: { id: assistant.id }, data: { status: 'published' } });
        await tx.assistantVersion.update({
          where: { id: targetVersion.id },
          data: {
            status: 'published',
            publishedAt: targetVersion.publishedAt ?? now,
          },
        });
        const hydrated = await tx.assistant.findUnique({ where: { id: assistant.id }, include: assistantDetailInclude });
        return { assistant: hydrated, publication: activePublication, previousPublication: null };
      }

      if (activePublication) {
        await tx.assistantPublication.update({
          where: { id: activePublication.id },
          data: {
            status: 'inactive',
            unpublishedById: input.actorUserId,
            unpublishedAt: now,
          },
        });
      }

      await tx.assistantVersion.updateMany({
        where: { assistantId: assistant.id, status: 'published' },
        data: { status: 'archived', archivedAt: now },
      });

      await tx.assistantVersion.update({
        where: { id: targetVersion.id },
        data: {
          status: 'published',
          publishedAt: targetVersion.publishedAt ?? now,
          archivedAt: null,
        },
      });

      const publication = await tx.assistantPublication.create({
        data: {
          tenantId: assistant.tenantId,
          workspaceId: assistant.workspaceId,
          assistantId: assistant.id,
          assistantVersionId: targetVersion.id,
          status: 'active',
          publishedById: input.actorUserId,
          publishedAt: now,
        },
      });

      const hydrated = await tx.assistant.update({
        where: { id: assistant.id },
        data: { status: 'published' },
        include: assistantDetailInclude,
      });

      return { assistant: hydrated, publication, previousPublication: activePublication };
    });
  },

  async unpublish(input: { id: string; tenantId: string; workspaceIds: string[]; actorUserId: string }) {
    return prisma.$transaction(async (tx) => {
      const assistant = await tx.assistant.findFirst({
        where: scopedAssistantWhere(input.id, input.tenantId, input.workspaceIds),
        select: { id: true },
      });
      if (!assistant) return null;

      const now = new Date();
      const activePublication = await tx.assistantPublication.findFirst({
        where: { assistantId: assistant.id, status: 'active' },
      });

      if (activePublication) {
        await tx.assistantPublication.update({
          where: { id: activePublication.id },
          data: {
            status: 'inactive',
            unpublishedById: input.actorUserId,
            unpublishedAt: now,
          },
        });
        await tx.assistantVersion.update({
          where: { id: activePublication.assistantVersionId },
          data: { status: 'archived', archivedAt: now },
        });
      }

      const hydrated = await tx.assistant.update({
        where: { id: assistant.id },
        data: { status: 'draft' },
        include: assistantDetailInclude,
      });

      return { assistant: hydrated, publication: activePublication };
    });
  },

  async rollback(input: {
    id: string;
    tenantId: string;
    workspaceIds: string[];
    actorUserId: string;
    payload: AssistantRollbackInput;
  }) {
    return prisma.$transaction(async (tx) => {
      const assistant = await tx.assistant.findFirst({
        where: scopedAssistantWhere(input.id, input.tenantId, input.workspaceIds),
      });
      if (!assistant) return null;

      const activePublication = await tx.assistantPublication.findFirst({
        where: { assistantId: assistant.id, status: 'active' },
      });

      const publicationTarget = input.payload.publicationId
        ? await tx.assistantPublication.findFirst({
            where: { id: input.payload.publicationId, assistantId: assistant.id },
          })
        : await tx.assistantPublication.findFirst({
            where: {
              assistantId: assistant.id,
              status: { not: 'active' },
            },
            orderBy: publicationOrder,
          });

      const versionTarget = input.payload.versionId
        ? await tx.assistantVersion.findFirst({ where: { id: input.payload.versionId, assistantId: assistant.id } })
        : publicationTarget
          ? await tx.assistantVersion.findFirst({ where: { id: publicationTarget.assistantVersionId, assistantId: assistant.id } })
          : null;

      if (!versionTarget) return null;

      const now = new Date();

      if (activePublication?.assistantVersionId === versionTarget.id) {
        const hydrated = await tx.assistant.update({
          where: { id: assistant.id },
          data: { status: 'published' },
          include: assistantDetailInclude,
        });
        return { assistant: hydrated, publication: activePublication, previousPublication: activePublication };
      }

      if (activePublication) {
        await tx.assistantPublication.update({
          where: { id: activePublication.id },
          data: {
            status: 'inactive',
            unpublishedById: input.actorUserId,
            unpublishedAt: now,
          },
        });
      }

      await tx.assistantVersion.updateMany({
        where: { assistantId: assistant.id, status: 'published' },
        data: { status: 'archived', archivedAt: now },
      });

      await tx.assistantVersion.update({
        where: { id: versionTarget.id },
        data: {
          status: 'published',
          publishedAt: versionTarget.publishedAt ?? now,
          archivedAt: null,
        },
      });

      const publication = await tx.assistantPublication.create({
        data: {
          tenantId: assistant.tenantId,
          workspaceId: assistant.workspaceId,
          assistantId: assistant.id,
          assistantVersionId: versionTarget.id,
          status: 'active',
          publishedById: input.actorUserId,
          publishedAt: now,
          rollbackFromPublicationId: activePublication?.id,
          rollbackReason: input.payload.reason,
        },
      });

      const hydrated = await tx.assistant.update({
        where: { id: assistant.id },
        data: { status: 'published' },
        include: assistantDetailInclude,
      });

      return { assistant: hydrated, publication, previousPublication: activePublication };
    });
  },

  async listPublications(assistantId: string) {
    return prisma.assistantPublication.findMany({
      where: { assistantId },
      orderBy: publicationOrder,
    });
  },

  async getActivePublication(assistantId: string) {
    return prisma.assistantPublication.findFirst({
      where: { assistantId, status: 'active' },
      orderBy: publicationOrder,
    });
  },

  findPublication(assistantId: string, publicationId: string) {
    return prisma.assistantPublication.findFirst({
      where: { id: publicationId, assistantId },
    });
  },

  listApprovals(assistantId: string) {
    return prisma.assistantApprovalRequest.findMany({
      where: { assistantId },
      orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
    });
  },

  findApproval(assistantId: string, approvalId: string) {
    return prisma.assistantApprovalRequest.findFirst({
      where: { id: approvalId, assistantId },
    });
  },

  createApproval(input: Omit<AssistantApprovalCreateInput, 'metadata'> & {
    tenantId: string;
    workspaceId: string;
    assistantId: string;
    requestedById: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.assistantApprovalRequest.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        assistantVersionId: input.assistantVersionId,
        publicationId: input.publicationId,
        requestedById: input.requestedById,
        action: input.action,
        status: 'pending',
        reason: input.reason,
        metadata: input.metadata,
      },
    });
  },

  decideApproval(input: {
    assistantId: string;
    approvalId: string;
    status: 'approved' | 'rejected';
    decidedById: string;
    decisionReason?: string;
  }) {
    return prisma.assistantApprovalRequest.update({
      where: { id: input.approvalId },
      data: {
        status: input.status,
        decidedById: input.decidedById,
        decisionReason: input.decisionReason,
        decidedAt: new Date(),
      },
    });
  },

  cancelApproval(input: { assistantId: string; approvalId: string; requestedById?: string; decisionReason?: string }) {
    return prisma.assistantApprovalRequest.update({
      where: { id: input.approvalId },
      data: {
        status: 'cancelled',
        decisionReason: input.decisionReason,
        cancelledAt: new Date(),
      },
    });
  },

  findApprovedApproval(input: { assistantId: string; approvalId: string; action: string }) {
    return prisma.assistantApprovalRequest.findFirst({
      where: {
        id: input.approvalId,
        assistantId: input.assistantId,
        action: input.action,
        status: 'approved',
      },
    });
  },

  countPendingApprovals(assistantId: string, actions?: string[]) {
    return prisma.assistantApprovalRequest.count({
      where: {
        assistantId,
        status: 'pending',
        ...(actions ? { action: { in: actions } } : {}),
      },
    });
  },

  getExecutionPolicy(assistant: { id: string; tenantId: string; workspaceId: string }) {
    return prisma.assistantExecutionPolicy.upsert({
      where: { assistantId: assistant.id },
      update: {},
      create: {
        tenantId: assistant.tenantId,
        workspaceId: assistant.workspaceId,
        assistantId: assistant.id,
      },
    });
  },

  updateExecutionPolicy(input: {
    assistant: { id: string; tenantId: string; workspaceId: string };
    payload: AssistantExecutionPolicyUpdateInput;
    updatedById: string;
  }) {
    return prisma.assistantExecutionPolicy.upsert({
      where: { assistantId: input.assistant.id },
      create: {
        tenantId: input.assistant.tenantId,
        workspaceId: input.assistant.workspaceId,
        assistantId: input.assistant.id,
        ...executionPolicyData(input.payload, input.updatedById),
      },
      update: executionPolicyData(input.payload, input.updatedById),
    });
  },

  async resolveVersion(assistantId: string, versionId?: string) {
    if (versionId) {
      return prisma.assistantVersion.findFirst({ where: { id: versionId, assistantId } });
    }

    const activePublication = await prisma.assistantPublication.findFirst({
      where: { assistantId, status: 'active' },
      orderBy: publicationOrder,
    });
    if (activePublication) {
      return prisma.assistantVersion.findFirst({
        where: { id: activePublication.assistantVersionId, assistantId },
      });
    }

    return prisma.assistantVersion.findFirst({
      where: { assistantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  listFeedback(assistantId: string) {
    return prisma.assistantFeedback.findMany({
      where: { assistantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  createFeedback(input: AssistantFeedbackCreateInput & {
    tenantId: string;
    workspaceId: string;
    assistantId: string;
    userId: string;
  }) {
    return prisma.assistantFeedback.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        assistantVersionId: input.assistantVersionId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        userId: input.userId,
        rating: input.rating,
        comment: input.comment,
      },
    });
  },

  listTestResults(assistantId: string) {
    return prisma.assistantTestResult.findMany({
      where: { assistantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  createTestResult(input: AssistantTestResultCreateInput & {
    tenantId: string;
    workspaceId: string;
    assistantId: string;
    assistantVersionId: string;
    testedById: string;
  }) {
    return prisma.assistantTestResult.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        assistantVersionId: input.assistantVersionId,
        testedById: input.testedById,
        input: input.input,
        expectedBehavior: input.expectedBehavior,
        actualOutput: input.actualOutput,
        status: input.status,
        score: input.score,
        notes: input.notes,
      },
    });
  },

  listShares(assistantId: string) {
    return prisma.assistantShare.findMany({
      where: { assistantId },
      orderBy: { createdAt: 'desc' },
    });
  },

  createShare(input: AssistantShareCreateInput & {
    assistantId: string;
    tenantId: string;
    workspaceId: string;
    createdById: string;
  }) {
    const targetType = input.targetType ?? input.shareType ?? 'workspace';
    const targetUserId = targetType === 'user' ? (input.targetUserId ?? input.targetId ?? undefined) : undefined;
    const targetWorkspaceId = targetType === 'workspace' ? (input.targetWorkspaceId ?? input.targetId ?? undefined) : undefined;
    const targetRoleId = targetType === 'role' ? (input.targetRoleId ?? input.targetId ?? undefined) : undefined;
    const targetId = targetType === 'tenant' ? null : (input.targetId ?? targetUserId ?? targetWorkspaceId ?? targetRoleId ?? null);

    return prisma.assistantShare.create({
      data: {
        assistantId: input.assistantId,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        shareType: targetType,
        targetId,
        targetType,
        targetUserId,
        targetWorkspaceId,
        targetRoleId,
        permission: input.permission,
        createdById: input.createdById,
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

  roleExists(roleId: string, tenantId: string) {
    return prisma.role.findFirst({
      where: { id: roleId, tenantId },
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
