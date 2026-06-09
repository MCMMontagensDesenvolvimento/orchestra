import type { McpServer, McpTool, McpResource, McpPrompt, McpBinding, ToolExecutionLog } from '@/types';
import {
  mockMcpServers, mockMcpTools, mockMcpResources, mockMcpPrompts, mockMcpBindings, mockToolExecutionLogs,
} from '@/services/mocks';
import { mockResponse, mockFind } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';

export const mcpService = {
  servers(): Promise<McpServer[]> {
    if (env.useMocks) return mockResponse(mockMcpServers);
    throw new Error('API real ainda não implementada.');
  },
  server(id: string): Promise<McpServer> {
    if (env.useMocks) return mockFind(mockMcpServers, id);
    throw new Error('API real ainda não implementada.');
  },
  tools(serverId?: string): Promise<McpTool[]> {
    if (env.useMocks) {
      const tools = serverId ? mockMcpTools.filter(t => t.serverId === serverId) : mockMcpTools;
      return mockResponse(tools);
    }
    throw new Error('API real ainda não implementada.');
  },
  resources(serverId?: string): Promise<McpResource[]> {
    if (env.useMocks) {
      const items = serverId ? mockMcpResources.filter(r => r.serverId === serverId) : mockMcpResources;
      return mockResponse(items);
    }
    throw new Error('API real ainda não implementada.');
  },
  prompts(serverId?: string): Promise<McpPrompt[]> {
    if (env.useMocks) {
      const items = serverId ? mockMcpPrompts.filter(p => p.serverId === serverId) : mockMcpPrompts;
      return mockResponse(items);
    }
    throw new Error('API real ainda não implementada.');
  },
  bindings(): Promise<McpBinding[]> {
    if (env.useMocks) return mockResponse(mockMcpBindings);
    throw new Error('API real ainda não implementada.');
  },
  executions(): Promise<ToolExecutionLog[]> {
    if (env.useMocks) return mockResponse(mockToolExecutionLogs);
    throw new Error('API real ainda não implementada.');
  },
};
