import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type {
  AssistantMcpBindingCreateInput,
  AssistantMcpBindingUpdateInput,
  McpPromptCreateInput,
  McpResourceCreateInput,
  McpServerCreateInput,
  McpServersQuery,
  McpServerUpdateInput,
  McpToolCreateInput,
  McpToolUpdateInput,
} from './mcp.schema';

const mcpServerInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  policies: { take: 5 },
  _count: {
    select: {
      tools: true,
      resources: true,
      prompts: true,
      bindings: true,
    },
  },
} satisfies Prisma.McpServerInclude;

const mcpToolInclude = {
  server: true,
  policies: { take: 1 },
} satisfies Prisma.McpToolInclude;

const bindingInclude = {
  server: {
    include: mcpServerInclude,
  },
  tool: {
    include: {
      policies: { take: 1 },
    },
  },
} satisfies Prisma.AssistantMcpBindingInclude;

function scopedServerWhere(id: string, tenantId: string, workspaceIds: string[]) {
  return {
    id,
    tenantId,
    workspaceId: { in: workspaceIds },
  } satisfies Prisma.McpServerWhereInput;
}

function jsonInput(value: unknown) {
  return value as Prisma.InputJsonValue | undefined;
}

function requiresApprovalForRisk(riskLevel: string, requested?: boolean) {
  if (riskLevel === 'high' || riskLevel === 'critical') return true;
  return requested ?? false;
}

export const mcpRepository = {
  async listServers(tenantId: string, workspaceIds: string[], query: McpServersQuery) {
    const where: Prisma.McpServerWhereInput = {
      tenantId,
      workspaceId: query.workspaceId ?? { in: workspaceIds },
      ...(query.status ? { status: query.status } : { deletedAt: null, status: { not: 'archived' } }),
      ...(query.status === 'archived' ? {} : query.status ? { deletedAt: null } : {}),
      ...(query.trustLevel ? { trustLevel: query.trustLevel } : {}),
      ...(query.riskLevel ? { riskLevel: query.riskLevel } : {}),
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
      prisma.mcpServer.findMany({
        where,
        include: mcpServerInclude,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.mcpServer.count({ where }),
    ]);
    return { data, total };
  },

  findServer(id: string, tenantId: string, workspaceIds: string[]) {
    return prisma.mcpServer.findFirst({
      where: scopedServerWhere(id, tenantId, workspaceIds),
      include: mcpServerInclude,
    });
  },

  createServer(input: McpServerCreateInput & { tenantId: string; workspaceId: string; createdById: string }) {
    return prisma.mcpServer.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        serverType: input.serverType,
        baseUrl: input.baseUrl,
        status: input.status,
        trustLevel: input.trustLevel,
        riskLevel: input.riskLevel,
        authType: input.authType,
        secretRef: input.secretRef,
        metadata: jsonInput(input.metadata),
        createdById: input.createdById,
        policies: {
          create: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            allowRuntimeExecution: false,
            sandboxOnly: true,
            requiresApproval: input.riskLevel === 'high' || input.riskLevel === 'critical',
            blockedByDefault: true,
          },
        },
      },
      include: mcpServerInclude,
    });
  },

  async updateServer(id: string, tenantId: string, workspaceIds: string[], input: McpServerUpdateInput) {
    const existing = await prisma.mcpServer.findFirst({
      where: scopedServerWhere(id, tenantId, workspaceIds),
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.mcpServer.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description,
        serverType: input.serverType,
        baseUrl: input.baseUrl,
        status: input.status,
        trustLevel: input.trustLevel,
        riskLevel: input.riskLevel,
        authType: input.authType,
        secretRef: input.secretRef,
        metadata: input.metadata === null ? Prisma.JsonNull : jsonInput(input.metadata),
      },
      include: mcpServerInclude,
    });
  },

  async archiveServer(id: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.mcpServer.findFirst({
      where: scopedServerWhere(id, tenantId, workspaceIds),
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.mcpServer.update({
      where: { id: existing.id },
      data: { status: 'archived', deletedAt: new Date() },
      include: mcpServerInclude,
    });
  },

  async restoreServer(id: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.mcpServer.findFirst({
      where: scopedServerWhere(id, tenantId, workspaceIds),
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.mcpServer.update({
      where: { id: existing.id },
      data: { status: 'disabled', deletedAt: null },
      include: mcpServerInclude,
    });
  },

  listTools(serverId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.mcpTool.findMany({
      where: {
        mcpServerId: serverId,
        tenantId,
        workspaceId: { in: workspaceIds },
        deletedAt: null,
      },
      include: mcpToolInclude,
      orderBy: [{ riskLevel: 'desc' }, { name: 'asc' }],
    });
  },

  findTool(toolId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.mcpTool.findFirst({
      where: {
        id: toolId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      include: mcpToolInclude,
    });
  },

  createTool(input: McpToolCreateInput & { tenantId: string; workspaceId: string; mcpServerId: string }) {
    const requiresApproval = requiresApprovalForRisk(input.riskLevel, input.requiresApproval);
    return prisma.mcpTool.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        mcpServerId: input.mcpServerId,
        name: input.name,
        description: input.description,
        inputSchema: jsonInput(input.inputSchema),
        outputSchema: jsonInput(input.outputSchema),
        riskLevel: input.riskLevel,
        requiresApproval,
        isEnabled: input.isEnabled,
        metadata: jsonInput(input.metadata),
        policies: {
          create: {
            tenantId: input.tenantId,
            workspaceId: input.workspaceId,
            mcpServerId: input.mcpServerId,
            allowRuntimeExecution: false,
            sandboxOnly: true,
            requiresApproval,
            blockedByDefault: true,
          },
        },
      },
      include: mcpToolInclude,
    });
  },

  async updateTool(toolId: string, tenantId: string, workspaceIds: string[], input: McpToolUpdateInput) {
    const existing = await prisma.mcpTool.findFirst({
      where: { id: toolId, tenantId, workspaceId: { in: workspaceIds } },
      select: { id: true, riskLevel: true },
    });
    if (!existing) return null;
    const effectiveRiskLevel = input.riskLevel ?? existing.riskLevel;
    const requiresApproval = input.requiresApproval === undefined ? undefined : requiresApprovalForRisk(effectiveRiskLevel, input.requiresApproval);
    const forceApprovalForRisk = input.riskLevel && (input.riskLevel === 'high' || input.riskLevel === 'critical');

    return prisma.$transaction(async (tx) => {
      const tool = await tx.mcpTool.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          description: input.description,
          inputSchema: input.inputSchema === null ? Prisma.JsonNull : jsonInput(input.inputSchema),
          outputSchema: input.outputSchema === null ? Prisma.JsonNull : jsonInput(input.outputSchema),
          riskLevel: input.riskLevel,
          requiresApproval: forceApprovalForRisk ? true : requiresApproval,
          isEnabled: input.isEnabled,
          metadata: input.metadata === null ? Prisma.JsonNull : jsonInput(input.metadata),
        },
        include: mcpToolInclude,
      });
      await tx.mcpToolPolicy.updateMany({
        where: { mcpToolId: tool.id },
        data: {
          requiresApproval: tool.requiresApproval,
          allowRuntimeExecution: false,
          sandboxOnly: true,
          blockedByDefault: true,
        },
      });
      return tool;
    });
  },

  async archiveTool(toolId: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.mcpTool.findFirst({
      where: { id: toolId, tenantId, workspaceId: { in: workspaceIds } },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.mcpTool.update({
      where: { id: existing.id },
      data: { isEnabled: false, deletedAt: new Date() },
      include: mcpToolInclude,
    });
  },

  listResources(serverId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.mcpResource.findMany({
      where: { mcpServerId: serverId, tenantId, workspaceId: { in: workspaceIds }, deletedAt: null },
      orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
    });
  },

  createResource(input: McpResourceCreateInput & { tenantId: string; workspaceId: string; mcpServerId: string }) {
    return prisma.mcpResource.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        mcpServerId: input.mcpServerId,
        name: input.name,
        uri: input.uri,
        description: input.description,
        mimeType: input.mimeType,
        metadata: jsonInput(input.metadata),
      },
    });
  },

  listPrompts(serverId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.mcpPrompt.findMany({
      where: { mcpServerId: serverId, tenantId, workspaceId: { in: workspaceIds }, deletedAt: null },
      orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
    });
  },

  createPrompt(input: McpPromptCreateInput & { tenantId: string; workspaceId: string; mcpServerId: string }) {
    return prisma.mcpPrompt.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        mcpServerId: input.mcpServerId,
        name: input.name,
        description: input.description,
        template: input.template,
        metadata: jsonInput(input.metadata),
      },
    });
  },

  findAssistant(id: string, tenantId: string, workspaceIds: string[]) {
    return prisma.assistant.findFirst({
      where: { id, tenantId, workspaceId: { in: workspaceIds }, deletedAt: null },
      select: { id: true, tenantId: true, workspaceId: true, status: true, deletedAt: true },
    });
  },

  listBindings(assistantId: string, tenantId: string, workspaceIds: string[]) {
    return prisma.assistantMcpBinding.findMany({
      where: {
        assistantId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      include: bindingInclude,
      orderBy: [{ createdAt: 'desc' }],
    });
  },

  async createBinding(input: AssistantMcpBindingCreateInput & {
    tenantId: string;
    workspaceId: string;
    assistantId: string;
    createdById: string;
  }) {
    const existing = await prisma.assistantMcpBinding.findFirst({
      where: {
        assistantId: input.assistantId,
        mcpServerId: input.mcpServerId,
        mcpToolId: input.mcpToolId ?? null,
      },
      select: { id: true },
    });
    if (existing) {
      return prisma.assistantMcpBinding.update({
        where: { id: existing.id },
        data: {
          isEnabled: input.isEnabled,
          mode: input.mode,
          requiresApprovalOverride: input.requiresApprovalOverride,
        },
        include: bindingInclude,
      });
    }

    return prisma.assistantMcpBinding.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        mcpServerId: input.mcpServerId,
        mcpToolId: input.mcpToolId,
        isEnabled: input.isEnabled,
        mode: input.mode,
        requiresApprovalOverride: input.requiresApprovalOverride,
        createdById: input.createdById,
      },
      include: bindingInclude,
    });
  },

  async updateBinding(assistantId: string, bindingId: string, tenantId: string, workspaceIds: string[], input: AssistantMcpBindingUpdateInput) {
    const existing = await prisma.assistantMcpBinding.findFirst({
      where: {
        id: bindingId,
        assistantId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.assistantMcpBinding.update({
      where: { id: existing.id },
      data: {
        isEnabled: input.isEnabled,
        mode: input.mode,
        requiresApprovalOverride: input.requiresApprovalOverride,
      },
      include: bindingInclude,
    });
  },

  async disableBinding(assistantId: string, bindingId: string, tenantId: string, workspaceIds: string[]) {
    const existing = await prisma.assistantMcpBinding.findFirst({
      where: {
        id: bindingId,
        assistantId,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.assistantMcpBinding.update({
      where: { id: existing.id },
      data: { isEnabled: false, mode: 'disabled' },
      include: bindingInclude,
    });
  },
};
