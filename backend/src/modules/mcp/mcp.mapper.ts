import type {
  AssistantMcpBinding,
  McpPrompt,
  McpResource,
  McpServer,
  McpTool,
  McpToolCall,
  McpToolCallEvent,
  McpToolPolicy,
} from '@prisma/client';

export function mapMcpToolPolicy(policy: McpToolPolicy | null | undefined) {
  if (!policy) return null;
  return {
    id: policy.id,
    tenantId: policy.tenantId,
    workspaceId: policy.workspaceId,
    mcpServerId: policy.mcpServerId,
    mcpToolId: policy.mcpToolId,
    allowRuntimeExecution: policy.allowRuntimeExecution,
    sandboxOnly: policy.sandboxOnly,
    requiresApproval: policy.requiresApproval,
    blockedByDefault: policy.blockedByDefault,
    metadata: policy.metadata,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

export function mapMcpServer(
  server: McpServer & {
    policies?: McpToolPolicy[];
    _count?: {
      tools?: number;
      resources?: number;
      prompts?: number;
      bindings?: number;
    };
    createdBy?: { id: string; name: string; email: string } | null;
  },
) {
  return {
    id: server.id,
    tenantId: server.tenantId,
    workspaceId: server.workspaceId,
    name: server.name,
    description: server.description,
    serverType: server.serverType,
    baseUrl: server.baseUrl,
    status: server.status,
    trustLevel: server.trustLevel,
    riskLevel: server.riskLevel,
    authType: server.authType,
    credentialConfigured: Boolean(server.secretRef),
    metadata: server.metadata,
    createdById: server.createdById,
    createdBy: server.createdBy,
    toolCount: server._count?.tools ?? 0,
    resourceCount: server._count?.resources ?? 0,
    promptCount: server._count?.prompts ?? 0,
    bindingCount: server._count?.bindings ?? 0,
    policy: mapMcpToolPolicy(server.policies?.find((policy) => policy.mcpToolId === null) ?? server.policies?.[0]),
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString(),
    deletedAt: server.deletedAt?.toISOString() ?? null,
  };
}

export function mapMcpTool(tool: McpTool & { server?: McpServer | null; policies?: McpToolPolicy[] }) {
  return {
    id: tool.id,
    tenantId: tool.tenantId,
    workspaceId: tool.workspaceId,
    mcpServerId: tool.mcpServerId,
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    riskLevel: tool.riskLevel,
    requiresApproval: tool.requiresApproval,
    isEnabled: tool.isEnabled,
    metadata: tool.metadata,
    server: tool.server ? mapMcpServer(tool.server) : undefined,
    policy: mapMcpToolPolicy(tool.policies?.[0]),
    createdAt: tool.createdAt.toISOString(),
    updatedAt: tool.updatedAt.toISOString(),
    deletedAt: tool.deletedAt?.toISOString() ?? null,
  };
}

export function mapMcpResource(resource: McpResource) {
  return {
    id: resource.id,
    tenantId: resource.tenantId,
    workspaceId: resource.workspaceId,
    mcpServerId: resource.mcpServerId,
    name: resource.name,
    uri: resource.uri,
    description: resource.description,
    mimeType: resource.mimeType,
    metadata: resource.metadata,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
    deletedAt: resource.deletedAt?.toISOString() ?? null,
  };
}

export function mapMcpPrompt(prompt: McpPrompt) {
  return {
    id: prompt.id,
    tenantId: prompt.tenantId,
    workspaceId: prompt.workspaceId,
    mcpServerId: prompt.mcpServerId,
    name: prompt.name,
    description: prompt.description,
    template: prompt.template,
    metadata: prompt.metadata,
    createdAt: prompt.createdAt.toISOString(),
    updatedAt: prompt.updatedAt.toISOString(),
    deletedAt: prompt.deletedAt?.toISOString() ?? null,
  };
}

export function mapAssistantMcpBinding(
  binding: AssistantMcpBinding & {
    server?: McpServer | null;
    tool?: (McpTool & { policies?: McpToolPolicy[] }) | null;
  },
) {
  return {
    id: binding.id,
    tenantId: binding.tenantId,
    workspaceId: binding.workspaceId,
    assistantId: binding.assistantId,
    mcpServerId: binding.mcpServerId,
    mcpToolId: binding.mcpToolId,
    isEnabled: binding.isEnabled,
    mode: binding.mode,
    requiresApprovalOverride: binding.requiresApprovalOverride,
    server: binding.server ? mapMcpServer(binding.server) : undefined,
    tool: binding.tool ? mapMcpTool(binding.tool) : undefined,
    createdById: binding.createdById,
    createdAt: binding.createdAt.toISOString(),
    updatedAt: binding.updatedAt.toISOString(),
  };
}

export function mapMcpToolCallEvent(event: McpToolCallEvent) {
  return {
    id: event.id,
    tenantId: event.tenantId,
    workspaceId: event.workspaceId,
    toolCallId: event.toolCallId,
    agentRunId: event.agentRunId,
    type: event.type,
    message: event.message,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}

export function mapMcpToolCall(
  call: McpToolCall & {
    server?: McpServer | null;
    tool?: (McpTool & { policies?: McpToolPolicy[] }) | null;
    assistantMcpBinding?: AssistantMcpBinding | null;
    events?: McpToolCallEvent[];
  },
) {
  const reasons = Array.isArray((call.policySnapshot as { reasons?: unknown[] } | null)?.reasons)
    ? ((call.policySnapshot as { reasons: unknown[] }).reasons as unknown[]).filter((reason): reason is string => typeof reason === 'string')
    : [];
  return {
    id: call.id,
    tenantId: call.tenantId,
    workspaceId: call.workspaceId,
    assistantId: call.assistantId,
    assistantVersionId: call.assistantVersionId,
    agentRunId: call.agentRunId,
    mcpServerId: call.mcpServerId,
    mcpToolId: call.mcpToolId,
    assistantMcpBindingId: call.assistantMcpBindingId,
    requestedByUserId: call.requestedByUserId,
    mode: call.mode,
    status: call.status,
    riskLevelSnapshot: call.riskLevelSnapshot,
    approvalRequiredSnapshot: call.approvalRequiredSnapshot,
    requestId: call.requestId,
    traceId: call.traceId,
    inputHash: call.inputHash,
    inputPreview: call.inputPreview,
    outputPreview: call.outputPreview,
    errorCode: call.errorCode,
    errorMessage: call.errorMessage,
    policySnapshot: call.policySnapshot,
    metadata: call.metadata,
    startedAt: call.startedAt?.toISOString() ?? null,
    completedAt: call.completedAt?.toISOString() ?? null,
    durationMs: call.durationMs,
    createdAt: call.createdAt.toISOString(),
    updatedAt: call.updatedAt.toISOString(),
    server: call.server ? mapMcpServer(call.server) : undefined,
    tool: call.tool ? mapMcpTool(call.tool) : undefined,
    binding: call.assistantMcpBinding ? mapAssistantMcpBinding(call.assistantMcpBinding) : undefined,
    events: call.events?.map(mapMcpToolCallEvent),
    reasons,
  };
}
