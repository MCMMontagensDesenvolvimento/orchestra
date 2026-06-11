import type { AssistantMcpBindingPayload, McpBinding, McpPrompt, McpResource, McpServer, McpTool, RiskLevel, ToolExecutionLog } from '@/types';
import {
  mockMcpServers, mockMcpTools, mockMcpResources, mockMcpPrompts, mockMcpBindings, mockToolExecutionLogs,
} from '@/services/mocks';
import { mockResponse, mockFind } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';
import { apiClient, type ApiEnvelope, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

interface ApiMcpToolPolicy {
  id: string;
  mcpServerId: string;
  mcpToolId: string | null;
  allowRuntimeExecution: boolean;
  sandboxOnly: boolean;
  requiresApproval: boolean;
  blockedByDefault: boolean;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

interface ApiMcpServer {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  serverType: 'internal' | 'external' | 'local' | 'remote';
  baseUrl: string | null;
  status: 'active' | 'disabled' | 'archived';
  trustLevel: 'trusted' | 'restricted' | 'experimental';
  riskLevel: RiskLevel;
  authType: string;
  secretRef: string | null;
  metadata?: Record<string, unknown> | null;
  createdById: string | null;
  createdBy?: { id: string; name: string; email: string } | null;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  bindingCount: number;
  policy?: ApiMcpToolPolicy | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiMcpTool {
  id: string;
  tenantId: string;
  workspaceId: string;
  mcpServerId: string;
  name: string;
  description: string | null;
  inputSchema?: unknown;
  outputSchema?: unknown;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  isEnabled: boolean;
  metadata?: Record<string, unknown> | null;
  server?: ApiMcpServer;
  policy?: ApiMcpToolPolicy | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiMcpResource {
  id: string;
  tenantId: string;
  workspaceId: string;
  mcpServerId: string;
  name: string;
  uri: string;
  description: string | null;
  mimeType: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiMcpPrompt {
  id: string;
  tenantId: string;
  workspaceId: string;
  mcpServerId: string;
  name: string;
  description: string | null;
  template: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiAssistantMcpBinding {
  id: string;
  tenantId: string;
  workspaceId: string;
  assistantId: string;
  mcpServerId: string;
  mcpToolId: string | null;
  isEnabled: boolean;
  mode: 'disabled' | 'sandbox_only' | 'enabled_placeholder';
  requiresApprovalOverride: boolean | null;
  server?: ApiMcpServer;
  tool?: ApiMcpTool;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface McpServerPayload {
  name: string;
  description?: string;
  serverType?: 'internal' | 'external' | 'local' | 'remote';
  baseUrl?: string;
  status?: 'active' | 'disabled' | 'archived';
  trustLevel?: 'trusted' | 'restricted' | 'experimental';
  riskLevel?: RiskLevel;
  authType?: 'none' | 'api_key' | 'bearer' | 'oauth' | 'mTLS' | 'other';
  secretRef?: string;
  metadata?: Record<string, unknown>;
}

export interface McpToolPayload {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  riskLevel?: RiskLevel;
  requiresApproval?: boolean;
  isEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

function formatDate(value?: string | null) {
  return value ? value.split('T')[0] : '';
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string, fallback: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function jsonToString(value: unknown) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function mapServer(server: ApiMcpServer): McpServer {
  const metadata = server.metadata ?? {};
  return {
    id: server.id,
    tenantId: server.tenantId,
    workspaceId: server.workspaceId,
    name: server.name,
    description: server.description ?? '',
    status: server.status,
    serverType: server.serverType,
    trustLevel: server.trustLevel,
    authType: server.authType,
    riskLevel: server.riskLevel,
    toolCount: server.toolCount,
    resourceCount: server.resourceCount,
    promptCount: server.promptCount,
    bindings: server.bindingCount,
    lastSync: metadataString(metadata, 'lastSync', ''),
    url: server.baseUrl ?? '',
    owner: server.createdBy?.name ?? server.createdById ?? 'Orchestra',
    createdAt: formatDate(server.createdAt),
    updatedAt: server.updatedAt,
    deletedAt: server.deletedAt,
    version: metadataString(metadata, 'version', '1.0.0'),
    secretRef: server.secretRef,
    metadata,
  };
}

function mapTool(tool: ApiMcpTool): McpTool {
  return {
    id: tool.id,
    tenantId: tool.tenantId,
    workspaceId: tool.workspaceId,
    serverId: tool.mcpServerId,
    mcpServerId: tool.mcpServerId,
    name: tool.name,
    description: tool.description ?? '',
    riskLevel: tool.riskLevel,
    requiresApproval: tool.requiresApproval,
    isEnabled: tool.isEnabled,
    executionCount: Number(tool.metadata?.executionCount ?? 0),
    inputSchema: jsonToString(tool.inputSchema),
    outputSchema: jsonToString(tool.outputSchema),
    lastExecuted: typeof tool.metadata?.lastExecuted === 'string' ? tool.metadata.lastExecuted : undefined,
    metadata: tool.metadata,
    createdAt: tool.createdAt,
    updatedAt: tool.updatedAt,
    deletedAt: tool.deletedAt,
    policy: tool.policy ?? null,
  };
}

function mapResource(resource: ApiMcpResource): McpResource {
  return {
    id: resource.id,
    serverId: resource.mcpServerId,
    mcpServerId: resource.mcpServerId,
    name: resource.name,
    uri: resource.uri,
    description: resource.description ?? '',
    mimeType: resource.mimeType ?? 'application/octet-stream',
    metadata: resource.metadata,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
    deletedAt: resource.deletedAt,
  };
}

function mapPrompt(prompt: ApiMcpPrompt): McpPrompt {
  return {
    id: prompt.id,
    serverId: prompt.mcpServerId,
    mcpServerId: prompt.mcpServerId,
    name: prompt.name,
    description: prompt.description ?? '',
    arguments: Array.isArray(prompt.metadata?.arguments) ? prompt.metadata.arguments.map(String) : [],
    template: prompt.template,
    metadata: prompt.metadata,
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
    deletedAt: prompt.deletedAt,
  };
}

function mapBinding(binding: ApiAssistantMcpBinding): McpBinding {
  const tool = binding.tool ? mapTool(binding.tool) : undefined;
  const server = binding.server ? mapServer(binding.server) : undefined;
  return {
    id: binding.id,
    serverId: binding.mcpServerId,
    mcpServerId: binding.mcpServerId,
    mcpToolId: binding.mcpToolId,
    assistantId: binding.assistantId,
    assistantName: binding.assistantId,
    toolsEnabled: tool ? [tool.name] : [],
    resourcesEnabled: [],
    createdAt: formatDate(binding.createdAt),
    approvalPolicy: binding.requiresApprovalOverride === false ? 'auto' : tool?.requiresApproval ? 'manual' : 'none',
    isEnabled: binding.isEnabled,
    mode: binding.mode,
    requiresApprovalOverride: binding.requiresApprovalOverride,
    server,
    tool,
    updatedAt: binding.updatedAt,
  };
}

export const mcpService = {
  async servers(): Promise<McpServer[]> {
    if (env.useMocks) return mockResponse(mockMcpServers);
    const response = await apiClient.get<PaginatedApiEnvelope<ApiMcpServer>>(endpoints.mcp.servers);
    return response.data.data.map(mapServer);
  },

  async server(id: string): Promise<McpServer> {
    if (env.useMocks) return mockFind(mockMcpServers, id);
    const response = await apiClient.get<ApiEnvelope<ApiMcpServer>>(endpoints.mcp.server(id));
    return mapServer(response.data.data);
  },

  async createServer(payload: McpServerPayload): Promise<McpServer> {
    if (env.useMocks) {
      return mockResponse({
        ...mockMcpServers[0],
        id: `mock-mcp-${Date.now()}`,
        name: payload.name,
        description: payload.description ?? '',
        status: payload.status === 'active' ? 'active' : 'inactive',
        riskLevel: payload.riskLevel ?? 'medium',
        url: payload.baseUrl ?? '',
      });
    }
    const response = await apiClient.post<ApiEnvelope<ApiMcpServer>>(endpoints.mcp.servers, payload);
    return mapServer(response.data.data);
  },

  async updateServer(id: string, payload: Partial<McpServerPayload>): Promise<McpServer> {
    if (env.useMocks) return mockFind(mockMcpServers, id);
    const response = await apiClient.patch<ApiEnvelope<ApiMcpServer>>(endpoints.mcp.server(id), payload);
    return mapServer(response.data.data);
  },

  async archiveServer(id: string): Promise<McpServer> {
    if (env.useMocks) return mockFind(mockMcpServers, id);
    const response = await apiClient.post<ApiEnvelope<ApiMcpServer>>(endpoints.mcp.serverArchive(id));
    return mapServer(response.data.data);
  },

  async restoreServer(id: string): Promise<McpServer> {
    if (env.useMocks) return mockFind(mockMcpServers, id);
    const response = await apiClient.post<ApiEnvelope<ApiMcpServer>>(endpoints.mcp.serverRestore(id));
    return mapServer(response.data.data);
  },

  async tools(serverId?: string): Promise<McpTool[]> {
    if (env.useMocks) {
      const tools = serverId ? mockMcpTools.filter(t => t.serverId === serverId) : mockMcpTools;
      return mockResponse(tools);
    }
    if (!serverId) {
      const servers = await mcpService.servers();
      const results = await Promise.all(servers.map((server) => mcpService.tools(server.id)));
      return results.flat();
    }
    const response = await apiClient.get<ApiEnvelope<ApiMcpTool[]>>(endpoints.mcp.serverTools(serverId));
    return response.data.data.map(mapTool);
  },

  async createTool(serverId: string, payload: McpToolPayload): Promise<McpTool> {
    if (env.useMocks) {
      return mockResponse({
        ...mockMcpTools[0],
        id: `mock-tool-${Date.now()}`,
        serverId,
        name: payload.name,
        description: payload.description ?? '',
        riskLevel: payload.riskLevel ?? 'medium',
        requiresApproval: payload.requiresApproval ?? (payload.riskLevel === 'high' || payload.riskLevel === 'critical'),
      });
    }
    const response = await apiClient.post<ApiEnvelope<ApiMcpTool>>(endpoints.mcp.serverTools(serverId), payload);
    return mapTool(response.data.data);
  },

  async updateTool(toolId: string, payload: Partial<McpToolPayload>): Promise<McpTool> {
    if (env.useMocks) return mockFind(mockMcpTools, toolId);
    const response = await apiClient.patch<ApiEnvelope<ApiMcpTool>>(endpoints.mcp.tool(toolId), payload);
    return mapTool(response.data.data);
  },

  async archiveTool(toolId: string): Promise<McpTool> {
    if (env.useMocks) return mockFind(mockMcpTools, toolId);
    const response = await apiClient.post<ApiEnvelope<ApiMcpTool>>(endpoints.mcp.toolArchive(toolId));
    return mapTool(response.data.data);
  },

  async resources(serverId?: string): Promise<McpResource[]> {
    if (env.useMocks) {
      const items = serverId ? mockMcpResources.filter(r => r.serverId === serverId) : mockMcpResources;
      return mockResponse(items);
    }
    if (!serverId) return [];
    const response = await apiClient.get<ApiEnvelope<ApiMcpResource[]>>(endpoints.mcp.serverResources(serverId));
    return response.data.data.map(mapResource);
  },

  async prompts(serverId?: string): Promise<McpPrompt[]> {
    if (env.useMocks) {
      const items = serverId ? mockMcpPrompts.filter(p => p.serverId === serverId) : mockMcpPrompts;
      return mockResponse(items);
    }
    if (!serverId) return [];
    const response = await apiClient.get<ApiEnvelope<ApiMcpPrompt[]>>(endpoints.mcp.serverPrompts(serverId));
    return response.data.data.map(mapPrompt);
  },

  async bindings(assistantId?: string): Promise<McpBinding[]> {
    if (env.useMocks) return mockResponse(mockMcpBindings);
    if (!assistantId) return [];
    const response = await apiClient.get<ApiEnvelope<ApiAssistantMcpBinding[]>>(endpoints.assistants.mcpBindings(assistantId));
    return response.data.data.map(mapBinding);
  },

  async createBinding(assistantId: string, payload: AssistantMcpBindingPayload): Promise<McpBinding> {
    if (env.useMocks) {
      return mockResponse({
        id: `mock-mcp-binding-${Date.now()}`,
        serverId: payload.mcpServerId,
        mcpServerId: payload.mcpServerId,
        mcpToolId: payload.mcpToolId,
        assistantId,
        assistantName: assistantId,
        toolsEnabled: [],
        resourcesEnabled: [],
        createdAt: new Date().toISOString(),
        approvalPolicy: payload.requiresApprovalOverride === false ? 'auto' : 'manual',
        isEnabled: payload.isEnabled ?? true,
        mode: payload.mode ?? 'sandbox_only',
        requiresApprovalOverride: payload.requiresApprovalOverride ?? null,
      });
    }
    const response = await apiClient.post<ApiEnvelope<ApiAssistantMcpBinding>>(endpoints.assistants.mcpBindings(assistantId), payload);
    return mapBinding(response.data.data);
  },

  async updateBinding(assistantId: string, bindingId: string, payload: Partial<AssistantMcpBindingPayload>): Promise<McpBinding> {
    if (env.useMocks) return mockFind(mockMcpBindings, bindingId);
    const response = await apiClient.patch<ApiEnvelope<ApiAssistantMcpBinding>>(endpoints.assistants.mcpBinding(assistantId, bindingId), payload);
    return mapBinding(response.data.data);
  },

  async removeBinding(assistantId: string, bindingId: string): Promise<void> {
    if (env.useMocks) {
      await mockResponse(null);
      return;
    }
    await apiClient.delete(endpoints.assistants.mcpBinding(assistantId, bindingId));
  },

  executions(): Promise<ToolExecutionLog[]> {
    if (env.useMocks) return mockResponse(mockToolExecutionLogs);
    return Promise.resolve([]);
  },
};
