import { useQuery } from '@tanstack/react-query';
import { mcpService } from '@/services/mcp.service';
import { queryKeys } from './queryKeys';

export const useMcpServers = () =>
  useQuery({ queryKey: queryKeys.mcp.servers(), queryFn: () => mcpService.servers() });

export const useMcpServer = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.mcp.server(id ?? ''),
    queryFn: () => mcpService.server(id!),
    enabled: !!id,
  });

export const useMcpTools = (serverId?: string) =>
  useQuery({
    queryKey: queryKeys.mcp.tools(serverId),
    queryFn: () => mcpService.tools(serverId),
  });

export const useMcpResources = (serverId?: string) =>
  useQuery({
    queryKey: queryKeys.mcp.resources(serverId),
    queryFn: () => mcpService.resources(serverId),
  });

export const useMcpPrompts = (serverId?: string) =>
  useQuery({
    queryKey: queryKeys.mcp.prompts(serverId),
    queryFn: () => mcpService.prompts(serverId),
  });

export const useMcpBindings = () =>
  useQuery({ queryKey: queryKeys.mcp.bindings(), queryFn: () => mcpService.bindings() });

export const useMcpExecutions = () =>
  useQuery({ queryKey: queryKeys.mcp.executions(), queryFn: () => mcpService.executions() });
