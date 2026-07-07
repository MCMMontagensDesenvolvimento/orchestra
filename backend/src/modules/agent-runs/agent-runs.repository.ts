import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type { AgentRunsQuery } from './agent-runs.schema';
import type { AgentRunEventInput } from './agent-runs.types';

export const agentRunInclude = {
  events: {
    orderBy: { sequence: 'asc' },
  },
} satisfies Prisma.AgentRunInclude;

export type AgentRunWithEvents = Prisma.AgentRunGetPayload<{ include: typeof agentRunInclude }>;

export const agentRunsRepository = {
  findAssistantForRun(id: string, tenantId: string, workspaceIds: string[]) {
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
          take: 1,
        },
        publications: {
          where: { status: 'active' },
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
        executionPolicy: true,
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

  countPendingApprovals(assistantId: string, actions?: string[]) {
    return prisma.assistantApprovalRequest.count({
      where: {
        assistantId,
        status: 'pending',
        ...(actions ? { action: { in: actions } } : {}),
      },
    });
  },

  async getRuntimeContextSummary(input: { tenantId: string; workspaceId: string; assistantId: string }) {
    const knowledgeBindings = await prisma.assistantKnowledgeBinding.findMany({
      where: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        isEnabled: true,
      },
      select: { knowledgeBaseId: true },
    });
    const knowledgeBaseIds = knowledgeBindings.map((binding) => binding.knowledgeBaseId);

    const [
      chunkCount,
      sourceReferenceCount,
      lastRagQuery,
      sourceReferences,
      mcpBindings,
      lastToolCalls,
    ] = await Promise.all([
      knowledgeBaseIds.length > 0
        ? prisma.knowledgeChunk.count({
          where: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            knowledgeBaseId: { in: knowledgeBaseIds },
            status: 'active',
          },
        })
        : Promise.resolve(0),
      knowledgeBaseIds.length > 0
        ? prisma.knowledgeSourceReference.count({
          where: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            knowledgeBaseId: { in: knowledgeBaseIds },
          },
        })
        : Promise.resolve(0),
      prisma.ragQuery.findFirst({
        where: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          assistantId: input.assistantId,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, resultCount: true },
      }),
      knowledgeBaseIds.length > 0
        ? prisma.knowledgeSourceReference.findMany({
          where: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            knowledgeBaseId: { in: knowledgeBaseIds },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            label: true,
            documentId: true,
            chunkId: true,
            sourceUri: true,
            document: {
              select: {
                title: true,
              },
            },
            chunk: {
              select: {
                content: true,
              },
            },
          },
        })
        : Promise.resolve([]),
      prisma.assistantMcpBinding.findMany({
        where: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          assistantId: input.assistantId,
          isEnabled: true,
        },
        include: {
          tool: {
            select: {
              id: true,
              name: true,
              description: true,
              inputSchema: true,
              riskLevel: true,
              requiresApproval: true,
              isEnabled: true,
              deletedAt: true,
            },
          },
          server: {
            select: {
              id: true,
              name: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      }),
      prisma.mcpToolCall.findMany({
        where: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          assistantId: input.assistantId,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true },
      }),
    ]);

    return {
      knowledgeBindingsCount: knowledgeBindings.length,
      chunkCount,
      sourceReferenceCount,
      lastRagQuery,
      sourceReferences,
      mcpBindings,
      lastToolCallIds: lastToolCalls.map((toolCall) => toolCall.id),
    };
  },

  createRun(input: {
    id?: string;
    tenantId: string;
    workspaceId: string;
    assistantId: string;
    assistantVersionId?: string | null;
    assistantPublicationId?: string | null;
    conversationId?: string | null;
    requestedById: string;
    status: string;
    mode: string;
    source: string;
    inputSummary?: string;
    requestId: string;
    traceId: string;
    startedAt?: Date;
    completedAt?: Date;
    failedAt?: Date;
    cancelledAt?: Date;
    blockedAt?: Date;
    errorCode?: string;
    errorMessage?: string;
    precheckSnapshot?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
    events: AgentRunEventInput[];
  }) {
    return prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.create({
        data: {
          id: input.id,
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          assistantId: input.assistantId,
          assistantVersionId: input.assistantVersionId,
          assistantPublicationId: input.assistantPublicationId,
          conversationId: input.conversationId,
          requestedById: input.requestedById,
          status: input.status,
          mode: input.mode,
          source: input.source,
          inputSummary: input.inputSummary,
          requestId: input.requestId,
          traceId: input.traceId,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          failedAt: input.failedAt,
          cancelledAt: input.cancelledAt,
          blockedAt: input.blockedAt,
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
          precheckSnapshot: input.precheckSnapshot,
          metadata: input.metadata,
        },
      });

      if (input.events.length > 0) {
        await tx.agentRunEvent.createMany({
          data: input.events.map((event, index) => ({
            agentRunId: run.id,
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            type: event.type,
            sequence: index + 1,
            status: event.status,
            message: event.message,
            metadata: event.metadata,
          })),
        });
      }

      return tx.agentRun.findUniqueOrThrow({ where: { id: run.id }, include: agentRunInclude });
    });
  },

  async appendEvents(run: { id: string; tenantId: string; workspaceId: string }, events: AgentRunEventInput[]) {
    if (events.length === 0) return [];
    return prisma.$transaction(async (tx) => {
      const lastEvent = await tx.agentRunEvent.findFirst({
        where: { agentRunId: run.id },
        orderBy: { sequence: 'desc' },
      });
      const start = lastEvent?.sequence ?? 0;
      await tx.agentRunEvent.createMany({
        data: events.map((event, index) => ({
          agentRunId: run.id,
          tenantId: run.tenantId,
          workspaceId: run.workspaceId,
          type: event.type,
          sequence: start + index + 1,
          status: event.status,
          message: event.message,
          metadata: event.metadata,
        })),
      });
      return tx.agentRunEvent.findMany({
        where: { agentRunId: run.id },
        orderBy: { sequence: 'asc' },
      });
    });
  },

  updateRun(id: string, data: Prisma.AgentRunUpdateInput) {
    return prisma.agentRun.update({
      where: { id },
      data,
      include: agentRunInclude,
    });
  },

  async listByAssistant(tenantId: string, workspaceIds: string[], assistantId: string, query: AgentRunsQuery) {
    const where: Prisma.AgentRunWhereInput = {
      tenantId,
      workspaceId: { in: workspaceIds },
      assistantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.agentRun.findMany({
        where,
        include: agentRunInclude,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.agentRun.count({ where }),
    ]);
    return { data, total };
  },

  async list(tenantId: string, workspaceIds: string[], query: AgentRunsQuery) {
    const where: Prisma.AgentRunWhereInput = {
      tenantId,
      workspaceId: { in: workspaceIds },
      ...(query.assistantId ? { assistantId: query.assistantId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.agentRun.findMany({
        where,
        include: agentRunInclude,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.agentRun.count({ where }),
    ]);
    return { data, total };
  },

  findById(runId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.agentRun.findFirst({
      where: {
        id: runId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      include: agentRunInclude,
    });
  },

  listEvents(runId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.agentRunEvent.findMany({
      where: {
        agentRunId: runId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      orderBy: { sequence: 'asc' },
    });
  },
};
