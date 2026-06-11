import { AppError } from '../../shared/errors/app-error';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import {
  mapAssistantMcpBinding,
  mapMcpPrompt,
  mapMcpResource,
  mapMcpServer,
  mapMcpTool,
} from './mcp.mapper';
import { mcpRepository } from './mcp.repository';
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
    entity: 'mcp',
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

function requiresApprovalForRisk(riskLevel: string) {
  return riskLevel === 'high' || riskLevel === 'critical';
}

async function getServerOrThrow(id: string, user: AuthenticatedUser) {
  const server = await mcpRepository.findServer(id, user.tenant.id, userWorkspaceIds(user));
  if (!server) {
    throw new AppError(404, 'MCP_SERVER_NOT_FOUND', 'MCP server nao encontrado.');
  }
  return server;
}

async function getAssistantOrThrow(id: string, user: AuthenticatedUser) {
  const assistant = await mcpRepository.findAssistant(id, user.tenant.id, userWorkspaceIds(user));
  if (!assistant) {
    throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
  }
  return assistant;
}

export const mcpService = {
  async listServers(user: AuthenticatedUser, query: McpServersQuery, context: RequestContext) {
    if (query.workspaceId) {
      await assertWorkspace(user, query.workspaceId, context, 'listMcpServers');
    }
    const result = await mcpRepository.listServers(user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapMcpServer),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getServer(id: string, user: AuthenticatedUser) {
    const server = await getServerOrThrow(id, user);
    return mapMcpServer(server);
  },

  async createServer(input: McpServerCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const workspaceId = await resolveWorkspace(user, input.workspaceId, context, 'createMcpServer');
    const server = await mcpRepository.createServer({
      ...input,
      tenantId: user.tenant.id,
      workspaceId,
      createdById: user.id,
    });

    await audit({
      user,
      context,
      action: 'mcp_server_created',
      entity: 'mcp_server',
      entityId: server.id,
      workspaceId,
      metadata: {
        status: server.status,
        serverType: server.serverType,
        trustLevel: server.trustLevel,
        riskLevel: server.riskLevel,
        authType: server.authType,
        hasSecretRef: Boolean(server.secretRef),
      },
    });

    return mapMcpServer(server);
  },

  async updateServer(id: string, input: McpServerUpdateInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await getServerOrThrow(id, user);
    const server = await mcpRepository.updateServer(id, user.tenant.id, userWorkspaceIds(user), input);
    if (!server) {
      throw new AppError(404, 'MCP_SERVER_NOT_FOUND', 'MCP server nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'mcp_server_updated',
      entity: 'mcp_server',
      entityId: server.id,
      workspaceId: current.workspaceId,
      metadata: {
        changedFields: Object.keys(input),
        status: server.status,
        trustLevel: server.trustLevel,
        riskLevel: server.riskLevel,
        hasSecretRef: Boolean(server.secretRef),
      },
    });

    return mapMcpServer(server);
  },

  async archiveServer(id: string, user: AuthenticatedUser, context: RequestContext) {
    const current = await getServerOrThrow(id, user);
    const server = await mcpRepository.archiveServer(id, user.tenant.id, userWorkspaceIds(user));
    if (!server) {
      throw new AppError(404, 'MCP_SERVER_NOT_FOUND', 'MCP server nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'mcp_server_archived',
      entity: 'mcp_server',
      entityId: server.id,
      workspaceId: current.workspaceId,
    });

    return mapMcpServer(server);
  },

  async restoreServer(id: string, user: AuthenticatedUser, context: RequestContext) {
    const current = await getServerOrThrow(id, user);
    const server = await mcpRepository.restoreServer(id, user.tenant.id, userWorkspaceIds(user));
    if (!server) {
      throw new AppError(404, 'MCP_SERVER_NOT_FOUND', 'MCP server nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'mcp_server_restored',
      entity: 'mcp_server',
      entityId: server.id,
      workspaceId: current.workspaceId,
      metadata: { restoredStatus: server.status },
    });

    return mapMcpServer(server);
  },

  async listTools(serverId: string, user: AuthenticatedUser) {
    const server = await getServerOrThrow(serverId, user);
    const tools = await mcpRepository.listTools(server.id, user.tenant.id, userWorkspaceIds(user));
    return tools.map(mapMcpTool);
  },

  async createTool(serverId: string, input: McpToolCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const server = await getServerOrThrow(serverId, user);
    if (server.status === 'archived' || server.deletedAt) {
      throw new AppError(409, 'MCP_SERVER_ARCHIVED', 'MCP server arquivado nao aceita novas tools.');
    }

    const tool = await mcpRepository.createTool({
      ...input,
      tenantId: user.tenant.id,
      workspaceId: server.workspaceId,
      mcpServerId: server.id,
    });

    await audit({
      user,
      context,
      action: 'mcp_tool_created',
      entity: 'mcp_tool',
      entityId: tool.id,
      workspaceId: server.workspaceId,
      metadata: {
        mcpServerId: server.id,
        riskLevel: tool.riskLevel,
        requiresApproval: tool.requiresApproval,
        isEnabled: tool.isEnabled,
      },
    });
    await audit({
      user,
      context,
      action: 'mcp_policy_updated',
      entity: 'mcp_tool_policy',
      entityId: tool.policies?.[0]?.id,
      workspaceId: server.workspaceId,
      metadata: {
        mcpServerId: server.id,
        mcpToolId: tool.id,
        allowRuntimeExecution: false,
        sandboxOnly: true,
      },
    });

    return mapMcpTool(tool);
  },

  async updateTool(toolId: string, input: McpToolUpdateInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await mcpRepository.findTool(toolId, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'MCP_TOOL_NOT_FOUND', 'MCP tool nao encontrada.');
    }
    if ((input.riskLevel === 'high' || input.riskLevel === 'critical') && input.requiresApproval === false) {
      throw new AppError(422, 'MCP_APPROVAL_REQUIRED', 'Tools high ou critical exigem approval.');
    }

    const tool = await mcpRepository.updateTool(toolId, user.tenant.id, userWorkspaceIds(user), input);
    if (!tool) {
      throw new AppError(404, 'MCP_TOOL_NOT_FOUND', 'MCP tool nao encontrada.');
    }

    await audit({
      user,
      context,
      action: 'mcp_tool_updated',
      entity: 'mcp_tool',
      entityId: tool.id,
      workspaceId: tool.workspaceId,
      metadata: {
        mcpServerId: tool.mcpServerId,
        changedFields: Object.keys(input),
        riskLevel: tool.riskLevel,
        requiresApproval: tool.requiresApproval,
        isEnabled: tool.isEnabled,
      },
    });
    if (Object.keys(input).some((key) => ['riskLevel', 'requiresApproval', 'isEnabled'].includes(key))) {
      await audit({
        user,
        context,
        action: 'mcp_policy_updated',
        entity: 'mcp_tool_policy',
        entityId: tool.policies?.[0]?.id,
        workspaceId: tool.workspaceId,
        metadata: {
          mcpServerId: tool.mcpServerId,
          mcpToolId: tool.id,
          allowRuntimeExecution: false,
          sandboxOnly: true,
          requiresApproval: tool.requiresApproval,
        },
      });
    }

    return mapMcpTool(tool);
  },

  async archiveTool(toolId: string, user: AuthenticatedUser, context: RequestContext) {
    const current = await mcpRepository.findTool(toolId, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'MCP_TOOL_NOT_FOUND', 'MCP tool nao encontrada.');
    }
    const tool = await mcpRepository.archiveTool(toolId, user.tenant.id, userWorkspaceIds(user));
    if (!tool) {
      throw new AppError(404, 'MCP_TOOL_NOT_FOUND', 'MCP tool nao encontrada.');
    }

    await audit({
      user,
      context,
      action: 'mcp_tool_archived',
      entity: 'mcp_tool',
      entityId: tool.id,
      workspaceId: tool.workspaceId,
      metadata: { mcpServerId: current.mcpServerId, riskLevel: current.riskLevel },
    });

    return mapMcpTool(tool);
  },

  async listResources(serverId: string, user: AuthenticatedUser) {
    const server = await getServerOrThrow(serverId, user);
    const resources = await mcpRepository.listResources(server.id, user.tenant.id, userWorkspaceIds(user));
    return resources.map(mapMcpResource);
  },

  async createResource(serverId: string, input: McpResourceCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const server = await getServerOrThrow(serverId, user);
    if (server.status === 'archived' || server.deletedAt) {
      throw new AppError(409, 'MCP_SERVER_ARCHIVED', 'MCP server arquivado nao aceita novos resources.');
    }
    const resource = await mcpRepository.createResource({
      ...input,
      tenantId: user.tenant.id,
      workspaceId: server.workspaceId,
      mcpServerId: server.id,
    });
    await audit({
      user,
      context,
      action: 'mcp_resource_created',
      entity: 'mcp_resource',
      entityId: resource.id,
      workspaceId: server.workspaceId,
      metadata: { mcpServerId: server.id, mimeType: resource.mimeType },
    });
    return mapMcpResource(resource);
  },

  async listPrompts(serverId: string, user: AuthenticatedUser) {
    const server = await getServerOrThrow(serverId, user);
    const prompts = await mcpRepository.listPrompts(server.id, user.tenant.id, userWorkspaceIds(user));
    return prompts.map(mapMcpPrompt);
  },

  async createPrompt(serverId: string, input: McpPromptCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const server = await getServerOrThrow(serverId, user);
    if (server.status === 'archived' || server.deletedAt) {
      throw new AppError(409, 'MCP_SERVER_ARCHIVED', 'MCP server arquivado nao aceita novos prompts.');
    }
    const prompt = await mcpRepository.createPrompt({
      ...input,
      tenantId: user.tenant.id,
      workspaceId: server.workspaceId,
      mcpServerId: server.id,
    });
    await audit({
      user,
      context,
      action: 'mcp_prompt_created',
      entity: 'mcp_prompt',
      entityId: prompt.id,
      workspaceId: server.workspaceId,
      metadata: { mcpServerId: server.id, hasTemplate: Boolean(prompt.template) },
    });
    return mapMcpPrompt(prompt);
  },

  async listBindings(assistantId: string, user: AuthenticatedUser) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const bindings = await mcpRepository.listBindings(assistant.id, user.tenant.id, userWorkspaceIds(user));
    return bindings.map(mapAssistantMcpBinding);
  },

  async createBinding(assistantId: string, input: AssistantMcpBindingCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const server = await getServerOrThrow(input.mcpServerId, user);
    if (server.status !== 'active' || server.deletedAt) {
      throw new AppError(409, 'MCP_SERVER_NOT_BINDABLE', 'MCP server deve estar ativo para ser vinculado.');
    }
    if (assistant.workspaceId !== server.workspaceId) {
      await recordDenied(user, context, assistant.workspaceId, 'mcpBindingWorkspaceScope');
      throw new AppError(403, 'WORKSPACE_SCOPE_MISMATCH', 'MCP server e assistente devem pertencer ao mesmo workspace.');
    }

    const tool = input.mcpToolId ? await mcpRepository.findTool(input.mcpToolId, user.tenant.id, userWorkspaceIds(user)) : null;
    if (input.mcpToolId && (!tool || tool.mcpServerId !== server.id)) {
      throw new AppError(404, 'MCP_TOOL_NOT_FOUND', 'MCP tool nao encontrada no server informado.');
    }
    if (tool && (!tool.isEnabled || tool.deletedAt)) {
      throw new AppError(409, 'MCP_TOOL_NOT_BINDABLE', 'MCP tool deve estar habilitada para ser vinculada.');
    }
    if (tool && (tool.requiresApproval || requiresApprovalForRisk(tool.riskLevel)) && input.requiresApprovalOverride === false) {
      throw new AppError(422, 'MCP_APPROVAL_REQUIRED', 'Esta MCP tool exige approval e nao aceita override falso.');
    }

    const binding = await mcpRepository.createBinding({
      ...input,
      mcpToolId: input.mcpToolId ?? null,
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      assistantId: assistant.id,
      createdById: user.id,
    });

    await audit({
      user,
      context,
      action: 'mcp_binding_created',
      entity: 'assistant_mcp_binding',
      entityId: binding.id,
      workspaceId: assistant.workspaceId,
      metadata: {
        assistantId: assistant.id,
        mcpServerId: input.mcpServerId,
        mcpToolId: input.mcpToolId,
        mode: binding.mode,
        requiresApprovalEffective: tool?.requiresApproval ?? binding.requiresApprovalOverride ?? true,
      },
    });

    return mapAssistantMcpBinding(binding);
  },

  async updateBinding(
    assistantId: string,
    bindingId: string,
    input: AssistantMcpBindingUpdateInput,
    user: AuthenticatedUser,
    context: RequestContext,
  ) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const current = (await mcpRepository.listBindings(assistant.id, user.tenant.id, userWorkspaceIds(user))).find((binding) => binding.id === bindingId);
    if (!current) {
      throw new AppError(404, 'MCP_BINDING_NOT_FOUND', 'Binding MCP nao encontrado.');
    }
    if (current.tool && (current.tool.requiresApproval || requiresApprovalForRisk(current.tool.riskLevel)) && input.requiresApprovalOverride === false) {
      throw new AppError(422, 'MCP_APPROVAL_REQUIRED', 'Esta MCP tool exige approval e nao aceita override falso.');
    }

    const binding = await mcpRepository.updateBinding(assistant.id, bindingId, user.tenant.id, userWorkspaceIds(user), input);
    if (!binding) {
      throw new AppError(404, 'MCP_BINDING_NOT_FOUND', 'Binding MCP nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'mcp_binding_updated',
      entity: 'assistant_mcp_binding',
      entityId: binding.id,
      workspaceId: assistant.workspaceId,
      metadata: {
        assistantId: assistant.id,
        mcpServerId: binding.mcpServerId,
        mcpToolId: binding.mcpToolId,
        changedFields: Object.keys(input),
        isEnabled: binding.isEnabled,
      },
    });

    return mapAssistantMcpBinding(binding);
  },

  async removeBinding(assistantId: string, bindingId: string, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const binding = await mcpRepository.disableBinding(assistant.id, bindingId, user.tenant.id, userWorkspaceIds(user));
    if (!binding) {
      throw new AppError(404, 'MCP_BINDING_NOT_FOUND', 'Binding MCP nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'mcp_binding_removed',
      entity: 'assistant_mcp_binding',
      entityId: binding.id,
      workspaceId: assistant.workspaceId,
      metadata: {
        assistantId: assistant.id,
        mcpServerId: binding.mcpServerId,
        mcpToolId: binding.mcpToolId,
        removalMode: 'soft_disable',
      },
    });
  },
};
