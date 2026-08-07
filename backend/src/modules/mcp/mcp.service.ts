import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../../shared/errors/app-error';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import {
  mapAssistantMcpBinding,
  mapMcpToolCall,
  mapMcpToolCallEvent,
  mapMcpPrompt,
  mapMcpResource,
  mapMcpServer,
  mapMcpTool,
} from './mcp.mapper';
import { mcpRepository } from './mcp.repository';
import { McpRemoteClient } from './remote/mcp-remote.client';
import { getMcpRemoteConfig } from './remote/mcp-remote.config';
import { mcpRemoteDiscoveryService } from './remote/mcp-remote-discovery.service';
import { mcpRemoteReadinessService } from './remote/mcp-remote-readiness.service';
import { createGovernedMcpRemoteTransport } from './remote/mcp-remote-transport.factory';
import {
  getMcpLocalDemoPrecheck,
  isMcpLocalDemoMetadata,
} from './local-demo/mcp-local-demo.catalog';
import type {
  AssistantMcpBindingCreateInput,
  AssistantMcpBindingUpdateInput,
  McpExecutionRequestInput,
  McpToolCallsQuery,
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

type AssistantForMcpExecution = NonNullable<Awaited<ReturnType<typeof mcpRepository.findAssistantForExecution>>>;
type ToolForMcpExecution = NonNullable<Awaited<ReturnType<typeof mcpRepository.findToolForExecution>>>;
type MatchingMcpBinding = Awaited<ReturnType<typeof mcpRepository.listMatchingBindings>>[number];
type AgentRunForMcp = NonNullable<Awaited<ReturnType<typeof mcpRepository.findAgentRunForMcp>>>;
type McpExecutionStatus = 'allowed' | 'blocked' | 'approval_required';

interface McpPrecheckResult {
  canExecute: boolean;
  status: McpExecutionStatus;
  mode: 'sandbox';
  reasons: string[];
  warnings: Array<{ code: string; message: string }>;
  policy: {
    requiresApproval: boolean;
    riskLevel: string;
    bindingMode?: string;
    sandboxOnly: boolean;
    allowRuntimeExecution: boolean;
    blockedByDefault: boolean;
    executionMode?: string;
  };
  assistant: AssistantForMcpExecution;
  tool: ToolForMcpExecution;
  binding: MatchingMcpBinding | null;
  agentRun: AgentRunForMcp | null;
  traceId: string;
  requestId: string;
}

const unsafeMetadataKeys = new Set(['instructions', 'prompt', 'content', 'secret', 'token', 'password', 'apiKey', 'authorization']);
const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);
const finalAgentRunStatuses = new Set(['completed', 'failed', 'cancelled', 'blocked']);

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

function truncate(value: string, max = 600) {
  return value.length > max ? `${value.slice(0, max - 15)}...[truncated]` : value;
}

function stableJson(value: unknown) {
  if (value === undefined) return '';
  return JSON.stringify(value);
}

function previewInput(value: unknown) {
  const sanitized = sanitizeMetadata(value);
  if (sanitized === undefined) return undefined;
  return truncate(typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized), 600);
}

function inputHash(value: unknown) {
  if (value === undefined) return undefined;
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function selectVersionId(assistant: AssistantForMcpExecution, agentRun: AgentRunForMcp | null) {
  return agentRun?.assistantVersionId ?? assistant.versions[0]?.id ?? null;
}

function selectBinding(bindings: MatchingMcpBinding[], toolId: string) {
  const enabled = bindings.filter((binding) => binding.isEnabled && binding.mode !== 'disabled');
  return (
    enabled.find((binding) => binding.mcpToolId === toolId) ??
    enabled.find((binding) => binding.mcpToolId === null) ??
    null
  );
}

function policySnapshot(precheck: McpPrecheckResult) {
  return {
    status: precheck.status,
    canExecute: precheck.canExecute,
    reasons: precheck.reasons,
    warnings: precheck.warnings,
    policy: precheck.policy,
    mcpServerId: precheck.tool.mcpServerId,
    mcpToolId: precheck.tool.id,
    assistantMcpBindingId: precheck.binding?.id ?? null,
  } satisfies Prisma.InputJsonValue;
}

function publicPrecheck(precheck: McpPrecheckResult) {
  return {
    canExecute: precheck.canExecute,
    status: precheck.status,
    mode: precheck.mode,
    reasons: precheck.reasons,
    warnings: precheck.warnings,
    policy: precheck.policy,
  };
}

function sandboxOutput(tool: ToolForMcpExecution, inputPreview?: string) {
  const suffix = inputPreview ? ` Input preview: ${inputPreview}` : '';
  return truncate(`Sandbox execution completed for tool "${tool.name}". No external MCP server was called.${suffix}`, 1000);
}

function agentRunEvents(input: {
  toolCallId?: string;
  tool: ToolForMcpExecution;
  traceId: string;
  status: 'completed' | 'blocked' | 'approval_required' | 'failed';
  reasons?: string[];
}) {
  const baseMetadata: Record<string, unknown> = {
    mcpToolId: input.tool.id,
    mcpServerId: input.tool.mcpServerId,
    traceId: input.traceId,
  };
  if (input.toolCallId) baseMetadata.toolCallId = input.toolCallId;
  const metadata = baseMetadata as Prisma.InputJsonValue;
  const metadataWithReasons = { ...baseMetadata, reasons: input.reasons ?? [] } as Prisma.InputJsonValue;

  if (input.status === 'approval_required') {
    return [
      { type: 'tool.precheck.started', status: 'running', message: 'MCP sandbox precheck iniciado.', metadata },
      { type: 'tool.approval_required', status: 'blocked', message: 'Tool MCP exige approval.', metadata: metadataWithReasons },
    ];
  }
  if (input.status === 'blocked') {
    return [
      { type: 'tool.precheck.started', status: 'running', message: 'MCP sandbox precheck iniciado.', metadata },
      { type: 'tool.precheck.blocked', status: 'blocked', message: 'Tool MCP bloqueada por policy.', metadata: metadataWithReasons },
    ];
  }
  if (input.status === 'failed') {
    return [
      { type: 'tool.precheck.started', status: 'running', message: 'MCP sandbox precheck iniciado.', metadata },
      { type: 'tool.execution.failed', status: 'failed', message: 'Tool MCP falhou no sandbox.', metadata: metadataWithReasons },
    ];
  }
  return [
    { type: 'tool.precheck.started', status: 'running', message: 'MCP sandbox precheck iniciado.', metadata },
    { type: 'tool.execution.started', status: 'running', message: 'Execucao sandbox da tool MCP iniciada.', metadata },
    { type: 'tool.execution.completed', status: 'completed', message: 'Execucao sandbox da tool MCP concluida.', metadata },
  ];
}

async function getServerOrThrow(id: string, user: AuthenticatedUser) {
  const server = await mcpRepository.findServer(id, user.tenant.id, userWorkspaceIds(user));
  if (!server) {
    throw new AppError(404, 'MCP_SERVER_NOT_FOUND', 'MCP server nao encontrado.');
  }
  return server;
}

function assertRemoteServer(server: Awaited<ReturnType<typeof getServerOrThrow>>) {
  if (server.serverType !== 'remote' && server.serverType !== 'external') {
    throw new AppError(409, 'MCP_REMOTE_SERVER_REQUIRED', 'MCP remote readiness is available only for remote servers.');
  }
}

function assertLocalDemoCatalogMutable(metadata: unknown) {
  if (isMcpLocalDemoMetadata(metadata)) {
    throw new AppError(
      409,
      'MCP_LOCAL_DEMO_READ_ONLY',
      'O catálogo MCP demo local da Fase 18D é imutável e deve ser restaurado somente pelo seed governado.',
    );
  }
}

function governedRemotePolicy(server: Awaited<ReturnType<typeof getServerOrThrow>>) {
  const policy = server.policies[0];
  return {
    allowDiscovery: true,
    allowRuntimeExecution: policy?.allowRuntimeExecution === true,
    sandboxOnly: policy?.sandboxOnly !== false,
    blockedByDefault: policy?.blockedByDefault !== false,
    requiresApproval: policy?.requiresApproval !== false,
  };
}

async function getAssistantOrThrow(id: string, user: AuthenticatedUser) {
  const assistant = await mcpRepository.findAssistant(id, user.tenant.id, userWorkspaceIds(user));
  if (!assistant) {
    throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
  }
  return assistant;
}

async function getAssistantForExecutionOrThrow(id: string, user: AuthenticatedUser) {
  const assistant = await mcpRepository.findAssistantForExecution(id, user.tenant.id, userWorkspaceIds(user));
  if (!assistant) {
    throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
  }
  return assistant;
}

async function getToolForExecutionOrThrow(id: string, user: AuthenticatedUser) {
  const tool = await mcpRepository.findToolForExecution(id, user.tenant.id, userWorkspaceIds(user));
  if (!tool) {
    throw new AppError(404, 'MCP_TOOL_NOT_FOUND', 'MCP tool nao encontrada.');
  }
  return tool;
}

async function buildMcpExecutionPrecheck(
  assistantId: string,
  input: McpExecutionRequestInput,
  user: AuthenticatedUser,
  context: RequestContext,
): Promise<McpPrecheckResult> {
  const assistant = await getAssistantForExecutionOrThrow(assistantId, user);
  const tool = await getToolForExecutionOrThrow(input.mcpToolId, user);
  const policy = assistant.executionPolicy ?? (await mcpRepository.getExecutionPolicy(assistant));
  const bindings = await mcpRepository.listMatchingBindings(assistant.id, tool.mcpServerId, tool.id, user.tenant.id, userWorkspaceIds(user));
  const binding = selectBinding(bindings, tool.id);
  const toolPolicy = tool.policies?.[0] ?? null;
  const reasons: string[] = [];
  const warnings: Array<{ code: string; message: string }> = [];
  let agentRun: AgentRunForMcp | null = null;

  if (assistant.workspaceId !== tool.workspaceId) reasons.push('workspace_scope_denied');
  if (assistant.status === 'archived') reasons.push('execution_policy_blocks_sandbox');
  if (tool.server.status === 'archived' || tool.server.deletedAt) reasons.push('server_archived');
  else if (tool.server.status !== 'active') reasons.push('server_disabled');
  if (tool.deletedAt) reasons.push('tool_archived');
  else if (!tool.isEnabled) reasons.push('tool_disabled');

  if (!binding) {
    reasons.push(bindings.length > 0 ? 'binding_disabled' : 'tool_not_bound_to_assistant');
  } else if (!['sandbox_only', 'enabled_placeholder'].includes(binding.mode)) {
    reasons.push('sandbox_not_allowed');
  }

  if (!policy.sandboxEnabled || policy.executionMode === 'blocked' || policy.executionMode === 'archived') {
    reasons.push('execution_policy_blocks_sandbox');
  }
  if (!policy.sandboxBlocksExternalTools || !policy.sandboxBlocksRealProviders || !policy.sandboxLogsRequired) {
    reasons.push('execution_policy_blocks_sandbox');
  }

  if (input.agentRunId) {
    const foundRun = await mcpRepository.findAgentRunForMcp(input.agentRunId, user.tenant.id, userWorkspaceIds(user));
    if (!foundRun) {
      throw new AppError(404, 'AGENT_RUN_NOT_FOUND', 'Run de agente nao encontrado.');
    }
    agentRun = foundRun;
    if (foundRun.assistantId !== assistant.id || foundRun.workspaceId !== assistant.workspaceId) {
      reasons.push('invalid_input');
    }
    if (finalAgentRunStatuses.has(foundRun.status)) {
      reasons.push('execution_policy_blocks_sandbox');
    }
  }

  if (tool.server.trustLevel !== 'trusted') {
    warnings.push({
      code: 'server_trust_not_trusted',
      message: `MCP server esta marcado como ${tool.server.trustLevel}.`,
    });
  }

  const riskRequiresApproval = requiresApprovalForRisk(tool.riskLevel);
  const bindingRequiresApproval = binding?.requiresApprovalOverride;
  const requiresApproval = riskRequiresApproval || bindingRequiresApproval === true || (bindingRequiresApproval !== false && tool.requiresApproval);
  const uniqueReasons = [...new Set(reasons)];
  const status: McpExecutionStatus = uniqueReasons.length > 0 ? 'blocked' : requiresApproval ? 'approval_required' : 'allowed';

  return {
    canExecute: status === 'allowed',
    status,
    mode: 'sandbox',
    reasons: status === 'approval_required' ? ['tool_requires_approval'] : uniqueReasons,
    warnings,
    policy: {
      requiresApproval,
      riskLevel: tool.riskLevel,
      bindingMode: binding?.mode,
      sandboxOnly: toolPolicy?.sandboxOnly ?? true,
      allowRuntimeExecution: toolPolicy?.allowRuntimeExecution ?? false,
      blockedByDefault: toolPolicy?.blockedByDefault ?? true,
      executionMode: policy.executionMode,
    },
    assistant,
    tool,
    binding,
    agentRun,
    traceId: agentRun?.traceId ?? `trace_${randomUUID()}`,
    requestId: context.requestId,
  };
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

  async getServer(id: string, user: AuthenticatedUser, context: RequestContext) {
    const server = await getServerOrThrow(id, user);
    await audit({
      user,
      context,
      action: 'mcp.server.viewed',
      entity: 'mcp_server',
      entityId: server.id,
      workspaceId: server.workspaceId,
      metadata: { serverType: server.serverType, localDemo: isMcpLocalDemoMetadata(server.metadata) },
    });
    return mapMcpServer(server);
  },

  async getLocalDemoPrecheck(id: string, user: AuthenticatedUser, context: RequestContext) {
    const server = await getServerOrThrow(id, user);
    const precheck = getMcpLocalDemoPrecheck(server);
    if (!precheck) {
      throw new AppError(409, 'MCP_LOCAL_DEMO_REQUIRED', 'Precheck local disponível somente para o catálogo demo governado da Fase 18D.');
    }
    await audit({
      user,
      context,
      action: 'mcp.precheck.demo_checked',
      entity: 'mcp_server',
      entityId: server.id,
      workspaceId: server.workspaceId,
      metadata: {
        status: precheck.status,
        allowed: precheck.allowed,
        failClosed: precheck.failClosed,
        remoteExecution: precheck.policy.remoteExecution,
        externalNetworkAllowed: precheck.policy.externalNetworkAllowed,
        writeToolsAllowed: precheck.policy.writeToolsAllowed,
      },
    });
    return precheck;
  },

  async getRemoteReadiness(id: string, user: AuthenticatedUser) {
    const server = await getServerOrThrow(id, user);
    assertRemoteServer(server);
    const config = getMcpRemoteConfig();
    const readiness = mcpRemoteReadinessService.getReadiness({
      server,
      policy: governedRemotePolicy(server),
      credentialsConfigured: Boolean(server.secretRef),
      purpose: 'discovery',
      config,
    });
    if (readiness.status !== 'ready') return readiness;

    const client = new McpRemoteClient({
      serverId: server.id,
      baseUrl: server.baseUrl,
      authType: server.authType,
      secretRef: server.secretRef,
      credentialsConfigured: Boolean(server.secretRef),
      timeoutMs: config.defaultTimeoutMs,
    }, config, { transport: createGovernedMcpRemoteTransport({ baseUrl: server.baseUrl }, config) });
    return client.checkHealth(readiness);
  },

  async discoverRemoteTools(id: string, user: AuthenticatedUser, context: RequestContext) {
    const server = await getServerOrThrow(id, user);
    assertRemoteServer(server);
    const result = await mcpRemoteDiscoveryService.runGovernedDiscovery({
      tenantId: user.tenant.id,
      workspaceId: server.workspaceId,
      server,
      policy: governedRemotePolicy(server),
      credentialsConfigured: Boolean(server.secretRef),
      requestedByUserId: user.id,
      requestId: context.requestId,
      existingTools: [],
    });
    await audit({
      user,
      context,
      action: 'mcp_remote_readonly_discovery_checked',
      entity: 'mcp_server',
      entityId: server.id,
      workspaceId: server.workspaceId,
      metadata: {
        status: result.status,
        toolCount: result.tools.length,
        transportCalled: result.sanitizedMetadata.transportCalled === true,
        ...(typeof result.sanitizedMetadata.mcpRemoteHost === 'string'
          ? { mcpRemoteHost: result.sanitizedMetadata.mcpRemoteHost }
          : {}),
      },
    });
    return result;
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
    assertLocalDemoCatalogMutable(current.metadata);
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
    assertLocalDemoCatalogMutable(current.metadata);
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
    assertLocalDemoCatalogMutable(current.metadata);
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

  async listTools(serverId: string, user: AuthenticatedUser, context: RequestContext) {
    const server = await getServerOrThrow(serverId, user);
    const tools = await mcpRepository.listTools(server.id, user.tenant.id, userWorkspaceIds(user));
    await audit({
      user,
      context,
      action: 'mcp.tool.catalog.viewed',
      entity: 'mcp_server',
      entityId: server.id,
      workspaceId: server.workspaceId,
      metadata: { toolCount: tools.length, localDemo: isMcpLocalDemoMetadata(server.metadata) },
    });
    return tools.map(mapMcpTool);
  },

  async createTool(serverId: string, input: McpToolCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const server = await getServerOrThrow(serverId, user);
    assertLocalDemoCatalogMutable(server.metadata);
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
    assertLocalDemoCatalogMutable(current.metadata);
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
    assertLocalDemoCatalogMutable(current.metadata);
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
    assertLocalDemoCatalogMutable(server.metadata);
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
    assertLocalDemoCatalogMutable(server.metadata);
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

  async listCatalogBindings(user: AuthenticatedUser) {
    const bindings = await mcpRepository.listCatalogBindings(user.tenant.id, userWorkspaceIds(user));
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
    if (isMcpLocalDemoMetadata(server.metadata)) {
      const toolMetadata = tool?.metadata;
      if (
        !tool
        || !isMcpLocalDemoMetadata(toolMetadata)
        || input.mode !== 'sandbox_only'
        || input.requiresApprovalOverride === false
      ) {
        throw new AppError(
          422,
          'MCP_LOCAL_DEMO_BINDING_GOVERNANCE_REQUIRED',
          'Bindings do demo local exigem tool explícita, modo sandbox_only e approval preservado.',
        );
      }
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
    assertLocalDemoCatalogMutable(current.server?.metadata);
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
    const current = (await mcpRepository.listBindings(assistant.id, user.tenant.id, userWorkspaceIds(user))).find((item) => item.id === bindingId);
    if (!current) {
      throw new AppError(404, 'MCP_BINDING_NOT_FOUND', 'Binding MCP nao encontrado.');
    }
    assertLocalDemoCatalogMutable(current.server?.metadata);
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

  async precheckSandboxExecution(assistantId: string, input: McpExecutionRequestInput, user: AuthenticatedUser, context: RequestContext) {
    const precheck = await buildMcpExecutionPrecheck(assistantId, input, user, context);
    await audit({
      user,
      context,
      action: precheck.canExecute ? 'mcp_execution_precheck_allowed' : 'mcp_execution_precheck_blocked',
      entity: 'mcp_execution_precheck',
      entityId: precheck.tool.id,
      workspaceId: precheck.assistant.workspaceId,
      metadata: {
        assistantId: precheck.assistant.id,
        mcpServerId: precheck.tool.mcpServerId,
        mcpToolId: precheck.tool.id,
        agentRunId: input.agentRunId,
        mode: precheck.mode,
        status: precheck.status,
        riskLevel: precheck.policy.riskLevel,
        requiresApproval: precheck.policy.requiresApproval,
        reasons: precheck.reasons,
      },
    });
    return publicPrecheck(precheck);
  },

  async runSandboxToolCall(assistantId: string, input: McpExecutionRequestInput, user: AuthenticatedUser, context: RequestContext) {
    const precheck = await buildMcpExecutionPrecheck(assistantId, input, user, context);
    await audit({
      user,
      context,
      action: precheck.canExecute ? 'mcp_execution_precheck_allowed' : 'mcp_execution_precheck_blocked',
      entity: 'mcp_execution_precheck',
      entityId: precheck.tool.id,
      workspaceId: precheck.assistant.workspaceId,
      metadata: {
        assistantId: precheck.assistant.id,
        mcpServerId: precheck.tool.mcpServerId,
        mcpToolId: precheck.tool.id,
        agentRunId: input.agentRunId,
        mode: precheck.mode,
        status: precheck.status,
        riskLevel: precheck.policy.riskLevel,
        requiresApproval: precheck.policy.requiresApproval,
        reasons: precheck.reasons,
      },
    });

    if (isMcpLocalDemoMetadata(precheck.tool.metadata)) {
      await audit({
        user,
        context,
        action: 'mcp.precheck.blocked',
        entity: 'mcp_tool',
        entityId: precheck.tool.id,
        workspaceId: precheck.assistant.workspaceId,
        metadata: {
          assistantId: precheck.assistant.id,
          mcpServerId: precheck.tool.mcpServerId,
          mode: 'precheck_only',
          remoteExecution: false,
          externalNetworkAllowed: false,
          writeToolsAllowed: false,
        },
      });
      throw new AppError(
        409,
        'MCP_LOCAL_DEMO_PRECHECK_ONLY',
        'O catálogo demo local permite somente precheck determinístico; nenhuma tool é executada.',
      );
    }

    const now = new Date();
    const inputPreview = previewInput(input.input);
    const baseCallInput = {
      tenantId: user.tenant.id,
      workspaceId: precheck.assistant.workspaceId,
      assistantId: precheck.assistant.id,
      assistantVersionId: selectVersionId(precheck.assistant, precheck.agentRun),
      agentRunId: precheck.agentRun?.id ?? input.agentRunId ?? null,
      mcpServerId: precheck.tool.mcpServerId,
      mcpToolId: precheck.tool.id,
      assistantMcpBindingId: precheck.binding?.id ?? null,
      requestedByUserId: user.id,
      mode: precheck.mode,
      riskLevelSnapshot: precheck.tool.riskLevel,
      approvalRequiredSnapshot: precheck.policy.requiresApproval,
      requestId: context.requestId,
      traceId: precheck.traceId,
      inputHash: inputHash(input.input),
      inputPreview,
      policySnapshot: policySnapshot(precheck),
      metadata: {
        sandbox: true,
        externalMcpCall: false,
        toolName: precheck.tool.name,
      } as Prisma.InputJsonValue,
    };

    if (!precheck.canExecute) {
      const status = precheck.status === 'approval_required' ? 'approval_required' : 'blocked';
      const call = await mcpRepository.createMcpToolCallWithEvents({
        ...baseCallInput,
        status,
        errorCode: precheck.reasons[0],
        errorMessage: status === 'approval_required' ? 'Tool MCP exige approval antes da execucao.' : 'Tool MCP bloqueada por policy.',
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        events: [
          {
            type: 'precheck_started',
            message: 'Precheck MCP sandbox iniciado.',
            metadata: { mode: precheck.mode, requestId: context.requestId } as Prisma.InputJsonValue,
          },
          {
            type: status,
            message: status === 'approval_required' ? 'Tool MCP exige approval.' : 'Tool MCP bloqueada por policy.',
            metadata: { reasons: precheck.reasons, riskLevel: precheck.tool.riskLevel } as Prisma.InputJsonValue,
          },
        ],
        agentRunEvents: precheck.agentRun
          ? agentRunEvents({
              tool: precheck.tool,
              traceId: precheck.traceId,
              status,
              reasons: precheck.reasons,
            })
          : undefined,
      });

      await audit({
        user,
        context,
        action: 'mcp_tool_call_created',
        entity: 'mcp_tool_call',
        entityId: call.id,
        workspaceId: precheck.assistant.workspaceId,
        metadata: {
          assistantId: precheck.assistant.id,
          mcpServerId: precheck.tool.mcpServerId,
          mcpToolId: precheck.tool.id,
          agentRunId: precheck.agentRun?.id,
          status,
          riskLevel: precheck.tool.riskLevel,
        },
      });
      await audit({
        user,
        context,
        action: status === 'approval_required' ? 'mcp_tool_call_approval_required' : 'mcp_tool_call_blocked',
        entity: 'mcp_tool_call',
        entityId: call.id,
        workspaceId: precheck.assistant.workspaceId,
        metadata: {
          assistantId: precheck.assistant.id,
          mcpServerId: precheck.tool.mcpServerId,
          mcpToolId: precheck.tool.id,
          agentRunId: precheck.agentRun?.id,
          status,
          reasons: precheck.reasons,
          riskLevel: precheck.tool.riskLevel,
        },
      });
      return mapMcpToolCall(call);
    }

    const startedAt = new Date();
    const outputPreview = sandboxOutput(precheck.tool, inputPreview);
    const completedAt = new Date();
    const durationMs = Math.max(1, completedAt.getTime() - startedAt.getTime());
    const call = await mcpRepository.createMcpToolCallWithEvents({
      ...baseCallInput,
      status: 'completed',
      outputPreview,
      startedAt,
      completedAt,
      durationMs,
      events: [
        {
          type: 'precheck_started',
          message: 'Precheck MCP sandbox iniciado.',
          metadata: { mode: precheck.mode, requestId: context.requestId } as Prisma.InputJsonValue,
        },
        {
          type: 'precheck_passed',
          message: 'Precheck MCP sandbox aprovado.',
          metadata: { riskLevel: precheck.tool.riskLevel } as Prisma.InputJsonValue,
        },
        {
          type: 'execution_started',
          message: 'Execucao sandbox local iniciada.',
          metadata: { sandbox: true, externalMcpCall: false } as Prisma.InputJsonValue,
        },
        {
          type: 'execution_completed',
          message: 'Execucao sandbox local concluida sem chamada MCP externa.',
          metadata: { durationMs, outputPreview } as Prisma.InputJsonValue,
        },
      ],
      agentRunEvents: precheck.agentRun
        ? agentRunEvents({
            tool: precheck.tool,
            traceId: precheck.traceId,
            status: 'completed',
          })
        : undefined,
    });

    await audit({
      user,
      context,
      action: 'mcp_tool_call_created',
      entity: 'mcp_tool_call',
      entityId: call.id,
      workspaceId: precheck.assistant.workspaceId,
      metadata: {
        assistantId: precheck.assistant.id,
        mcpServerId: precheck.tool.mcpServerId,
        mcpToolId: precheck.tool.id,
        agentRunId: precheck.agentRun?.id,
        status: 'completed',
        riskLevel: precheck.tool.riskLevel,
      },
    });
    await audit({
      user,
      context,
      action: 'mcp_tool_call_completed',
      entity: 'mcp_tool_call',
      entityId: call.id,
      workspaceId: precheck.assistant.workspaceId,
      metadata: {
        assistantId: precheck.assistant.id,
        mcpServerId: precheck.tool.mcpServerId,
        mcpToolId: precheck.tool.id,
        agentRunId: precheck.agentRun?.id,
        mode: precheck.mode,
        durationMs,
        riskLevel: precheck.tool.riskLevel,
      },
    });
    return mapMcpToolCall(call);
  },

  async listAssistantToolCalls(assistantId: string, user: AuthenticatedUser, query: McpToolCallsQuery) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const result = await mcpRepository.listMcpToolCalls(user.tenant.id, userWorkspaceIds(user), query, assistant.id);
    return {
      data: result.data.map(mapMcpToolCall),
      pagination: paginationMeta(query, result.total),
    };
  },

  async listToolCalls(user: AuthenticatedUser, query: McpToolCallsQuery) {
    const result = await mcpRepository.listMcpToolCalls(user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapMcpToolCall),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getToolCall(toolCallId: string, user: AuthenticatedUser) {
    const call = await mcpRepository.findMcpToolCall(toolCallId, user.tenant.id, userWorkspaceIds(user));
    if (!call) {
      throw new AppError(404, 'MCP_TOOL_CALL_NOT_FOUND', 'Tool call MCP nao encontrada.');
    }
    return mapMcpToolCall(call);
  },

  async listToolCallEvents(toolCallId: string, user: AuthenticatedUser) {
    const call = await mcpRepository.findMcpToolCall(toolCallId, user.tenant.id, userWorkspaceIds(user));
    if (!call) {
      throw new AppError(404, 'MCP_TOOL_CALL_NOT_FOUND', 'Tool call MCP nao encontrada.');
    }
    const events = await mcpRepository.listMcpToolCallEvents(call.id, user.tenant.id, userWorkspaceIds(user));
    return events.map(mapMcpToolCallEvent);
  },
};
