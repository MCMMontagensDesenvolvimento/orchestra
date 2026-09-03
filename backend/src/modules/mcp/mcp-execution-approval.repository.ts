import { Prisma, type McpExecutionApprovalStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type {
  McpExecutionApprovalsQuery,
  McpExecutionApprovalStatus as ApprovalStatus,
} from './mcp-execution-approval.schema';

export const mcpExecutionApprovalInclude = {
  requestedBy: { select: { id: true, name: true, email: true } },
  decidedBy: { select: { id: true, name: true, email: true } },
  server: { select: { id: true, name: true, serverType: true, status: true } },
  tool: { select: { id: true, name: true, riskLevel: true, requiresApproval: true } },
  assistantMcpBinding: {
    select: {
      id: true,
      isEnabled: true,
      mode: true,
      requiresApprovalOverride: true,
    },
  },
} satisfies Prisma.McpExecutionApprovalInclude;

export type McpExecutionApprovalWithRelations = Prisma.McpExecutionApprovalGetPayload<{
  include: typeof mcpExecutionApprovalInclude;
}>;

export interface McpExecutionApprovalScope {
  tenantId: string;
  workspaceId: string;
  assistantId: string;
  assistantVersionId: string;
  mcpServerId: string;
  mcpToolId: string;
  assistantMcpBindingId: string;
  agentRunId: string;
}

export const mcpExecutionApprovalRepository = {
  findRequestTarget(
    assistantId: string,
    mcpToolId: string,
    tenantId: string,
    workspaceIds: string[],
  ) {
    return prisma.assistant.findFirst({
      where: {
        id: assistantId,
        tenantId,
        workspaceId: { in: workspaceIds },
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        workspaceId: true,
        status: true,
        publications: {
          where: { status: 'active' },
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: { id: true, assistantVersionId: true },
        },
        mcpBindings: {
          where: { mcpToolId },
          orderBy: { createdAt: 'desc' },
          take: 2,
          include: {
            server: true,
            tool: {
              include: { policies: { take: 1 } },
            },
          },
        },
      },
    });
  },

  async list(
    assistantId: string,
    tenantId: string,
    workspaceIds: string[],
    query: McpExecutionApprovalsQuery,
  ) {
    const where: Prisma.McpExecutionApprovalWhereInput = {
      assistantId,
      tenantId,
      workspaceId: { in: workspaceIds },
      ...(query.status ? { status: query.status as McpExecutionApprovalStatus } : {}),
      ...(query.mcpToolId ? { mcpToolId: query.mcpToolId } : {}),
      ...(query.search ? {
        OR: [
          { tool: { name: { contains: query.search, mode: 'insensitive' } } },
          { reason: { contains: query.search, mode: 'insensitive' } },
          { decisionReason: { contains: query.search, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.mcpExecutionApproval.findMany({
        where,
        include: mcpExecutionApprovalInclude,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.mcpExecutionApproval.count({ where }),
    ]);
    return { data, total };
  },

  findById(approvalId: string, assistantId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.mcpExecutionApproval.findFirst({
      where: {
        id: approvalId,
        assistantId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      include: mcpExecutionApprovalInclude,
    });
  },

  create(input: {
    tenantId: string;
    workspaceId: string;
    assistantId: string;
    assistantVersionId: string;
    mcpServerId: string;
    mcpToolId: string;
    assistantMcpBindingId: string;
    requestedById: string;
    reason?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.mcpExecutionApproval.create({
      data: input,
      include: mcpExecutionApprovalInclude,
    });
  },

  async decide(input: {
    approvalId: string;
    assistantId: string;
    tenantId: string;
    workspaceIds: string[];
    fromStatuses: ApprovalStatus[];
    status: ApprovalStatus;
    decidedById?: string;
    decisionReason?: string;
    approvedAt?: Date;
    expiresAt?: Date;
    rejectedAt?: Date;
    cancelledAt?: Date;
  }) {
    const updated = await prisma.mcpExecutionApproval.updateMany({
      where: {
        id: input.approvalId,
        assistantId: input.assistantId,
        tenantId: input.tenantId,
        workspaceId: { in: input.workspaceIds },
        status: { in: input.fromStatuses as McpExecutionApprovalStatus[] },
      },
      data: {
        status: input.status as McpExecutionApprovalStatus,
        decidedById: input.decidedById,
        decisionReason: input.decisionReason,
        approvedAt: input.approvedAt,
        expiresAt: input.expiresAt,
        rejectedAt: input.rejectedAt,
        cancelledAt: input.cancelledAt,
      },
    });
    if (updated.count !== 1) return null;
    return prisma.mcpExecutionApproval.findUniqueOrThrow({
      where: { id: input.approvalId },
      include: mcpExecutionApprovalInclude,
    });
  },

  async expireIfNeeded(approvalId: string, now: Date) {
    const updated = await prisma.mcpExecutionApproval.updateMany({
      where: {
        id: approvalId,
        status: { in: ['approved', 'claimed'] },
        expiresAt: { lte: now },
      },
      data: { status: 'expired' },
    });
    if (updated.count !== 1) return null;
    return prisma.mcpExecutionApproval.findUniqueOrThrow({
      where: { id: approvalId },
      include: mcpExecutionApprovalInclude,
    });
  },

  async expireForAssistant(assistantId: string, tenantId: string, workspaceIds: string[], now: Date) {
    const candidates = await prisma.mcpExecutionApproval.findMany({
      where: {
        assistantId,
        tenantId,
        workspaceId: { in: workspaceIds },
        status: { in: ['approved', 'claimed'] },
        expiresAt: { lte: now },
      },
      select: { id: true },
      take: 100,
    });
    const expired: McpExecutionApprovalWithRelations[] = [];
    for (const candidate of candidates) {
      const approval = await this.expireIfNeeded(candidate.id, now);
      if (approval) expired.push(approval);
    }
    return expired;
  },

  async claim(input: McpExecutionApprovalScope & { approvalId: string; now: Date }) {
    const updated = await prisma.mcpExecutionApproval.updateMany({
      where: {
        id: input.approvalId,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        assistantVersionId: input.assistantVersionId,
        mcpServerId: input.mcpServerId,
        mcpToolId: input.mcpToolId,
        assistantMcpBindingId: input.assistantMcpBindingId,
        status: 'approved',
        claimedByAgentRunId: null,
        expiresAt: { gt: input.now },
        AND: [{
          OR: [
            { tool: { is: { requiresApproval: true } } },
            { assistantMcpBinding: { is: { requiresApprovalOverride: true } } },
          ],
        }],
        tool: {
          is: {
            id: input.mcpToolId,
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            mcpServerId: input.mcpServerId,
            riskLevel: 'low',
            isEnabled: true,
            deletedAt: null,
            metadata: { path: ['readOnly'], equals: true },
          },
        },
        server: {
          is: {
            id: input.mcpServerId,
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            serverType: { in: ['remote', 'external'] },
            status: 'active',
            trustLevel: 'trusted',
            riskLevel: 'low',
            deletedAt: null,
          },
        },
        assistantMcpBinding: {
          is: {
            id: input.assistantMcpBindingId,
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            assistantId: input.assistantId,
            mcpServerId: input.mcpServerId,
            mcpToolId: input.mcpToolId,
            isEnabled: true,
            mode: 'enabled_placeholder',
          },
        },
      },
      data: {
        status: 'claimed',
        claimedByAgentRunId: input.agentRunId,
        claimedAt: input.now,
      },
    });
    if (updated.count !== 1) return null;
    return prisma.mcpExecutionApproval.findUniqueOrThrow({
      where: { id: input.approvalId },
      include: mcpExecutionApprovalInclude,
    });
  },

  findClaimedForGateway(input: McpExecutionApprovalScope & { now: Date }) {
    return prisma.mcpExecutionApproval.findFirst({
      where: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        assistantVersionId: input.assistantVersionId,
        mcpServerId: input.mcpServerId,
        mcpToolId: input.mcpToolId,
        assistantMcpBindingId: input.assistantMcpBindingId,
        claimedByAgentRunId: input.agentRunId,
        status: 'claimed',
        consumedAt: null,
      },
      include: mcpExecutionApprovalInclude,
    });
  },

  async consume(input: McpExecutionApprovalScope & { toolCallId: string; now: Date }) {
    const updated = await prisma.mcpExecutionApproval.updateMany({
      where: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        assistantVersionId: input.assistantVersionId,
        mcpServerId: input.mcpServerId,
        mcpToolId: input.mcpToolId,
        assistantMcpBindingId: input.assistantMcpBindingId,
        claimedByAgentRunId: input.agentRunId,
        status: 'claimed',
        consumedAt: null,
        expiresAt: { gt: input.now },
        AND: [{
          OR: [
            { tool: { is: { requiresApproval: true } } },
            { assistantMcpBinding: { is: { requiresApprovalOverride: true } } },
          ],
        }],
        tool: {
          is: {
            id: input.mcpToolId,
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            mcpServerId: input.mcpServerId,
            riskLevel: 'low',
            isEnabled: true,
            deletedAt: null,
            metadata: { path: ['readOnly'], equals: true },
          },
        },
        server: {
          is: {
            id: input.mcpServerId,
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            serverType: { in: ['remote', 'external'] },
            status: 'active',
            trustLevel: 'trusted',
            riskLevel: 'low',
            deletedAt: null,
          },
        },
        assistantMcpBinding: {
          is: {
            id: input.assistantMcpBindingId,
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            assistantId: input.assistantId,
            mcpServerId: input.mcpServerId,
            mcpToolId: input.mcpToolId,
            isEnabled: true,
            mode: 'enabled_placeholder',
          },
        },
      },
      data: {
        status: 'consumed',
        consumedAt: input.now,
      },
    });
    if (updated.count !== 1) return null;
    return prisma.mcpExecutionApproval.findFirstOrThrow({
      where: {
        claimedByAgentRunId: input.agentRunId,
        status: 'consumed',
        consumedAt: input.now,
      },
      include: mcpExecutionApprovalInclude,
    });
  },

  correlateConsumedToolCall(agentRunId: string, toolCallId: string) {
    return prisma.mcpExecutionApproval.updateMany({
      where: {
        claimedByAgentRunId: agentRunId,
        status: 'consumed',
        consumedAt: { not: null },
        consumedByToolCallId: null,
      },
      data: { consumedByToolCallId: toolCallId },
    });
  },
};
