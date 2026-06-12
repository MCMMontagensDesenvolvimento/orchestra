import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  mcpService,
  type McpServerPayload,
  type McpToolPayload,
} from '@/services/mcp.service';
import type { AssistantMcpBindingPayload, McpSandboxExecutionPayload } from '@/types';
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

export const useAssistantMcpBindings = (assistantId?: string) =>
  useQuery({
    queryKey: queryKeys.mcp.assistantBindings(assistantId ?? ''),
    queryFn: () => mcpService.bindings(assistantId!),
    enabled: !!assistantId,
  });

export const useMcpExecutions = () =>
  useQuery({ queryKey: queryKeys.mcp.executions(), queryFn: () => mcpService.executions() });

export const useAssistantMcpToolCalls = (assistantId?: string) =>
  useQuery({
    queryKey: queryKeys.mcp.assistantToolCalls(assistantId ?? ''),
    queryFn: () => mcpService.assistantToolCalls(assistantId!),
    enabled: !!assistantId,
  });

export const useMcpToolCall = (toolCallId?: string) =>
  useQuery({
    queryKey: queryKeys.mcp.toolCall(toolCallId ?? ''),
    queryFn: () => mcpService.toolCall(toolCallId!),
    enabled: !!toolCallId,
  });

export const useMcpToolCallEvents = (toolCallId?: string) =>
  useQuery({
    queryKey: queryKeys.mcp.toolCallEvents(toolCallId ?? ''),
    queryFn: () => mcpService.toolCallEvents(toolCallId!),
    enabled: !!toolCallId,
  });

export const useCreateMcpServerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: McpServerPayload) => mcpService.createServer(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useUpdateMcpServerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<McpServerPayload> }) => mcpService.updateServer(id, payload),
    onSuccess: (_server, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.server(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useArchiveMcpServerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mcpService.archiveServer(id),
    onSuccess: (_server, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.server(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useRestoreMcpServerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mcpService.restoreServer(id),
    onSuccess: (_server, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.server(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useCreateMcpToolMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serverId, payload }: { serverId: string; payload: McpToolPayload }) => mcpService.createTool(serverId, payload),
    onSuccess: (_tool, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.tools(variables.serverId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.server(variables.serverId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useUpdateMcpToolMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ toolId, payload }: { toolId: string; payload: Partial<McpToolPayload>; serverId?: string }) =>
      mcpService.updateTool(toolId, payload),
    onSuccess: (_tool, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.all });
      if (variables.serverId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.tools(variables.serverId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useArchiveMcpToolMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ toolId, serverId }: { toolId: string; serverId?: string }) =>
      mcpService.archiveTool(toolId).then((tool) => ({ tool, serverId })),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.all });
      if (result.serverId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.tools(result.serverId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useCreateAssistantMcpBindingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assistantId, payload }: { assistantId: string; payload: AssistantMcpBindingPayload }) =>
      mcpService.createBinding(assistantId, payload),
    onSuccess: (_binding, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.assistantBindings(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useUpdateAssistantMcpBindingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assistantId, bindingId, payload }: { assistantId: string; bindingId: string; payload: Partial<AssistantMcpBindingPayload> }) =>
      mcpService.updateBinding(assistantId, bindingId, payload),
    onSuccess: (_binding, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.assistantBindings(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useRemoveAssistantMcpBindingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assistantId, bindingId }: { assistantId: string; bindingId: string }) =>
      mcpService.removeBinding(assistantId, bindingId).then(() => ({ assistantId })),
    onSuccess: (variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.assistantBindings(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useMcpSandboxPrecheckMutation = () =>
  useMutation({
    mutationFn: ({ assistantId, payload }: { assistantId: string; payload: McpSandboxExecutionPayload }) =>
      mcpService.precheckSandboxExecution(assistantId, payload),
  });

export const useMcpSandboxToolCallMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assistantId, payload }: { assistantId: string; payload: McpSandboxExecutionPayload }) =>
      mcpService.runSandboxToolCall(assistantId, payload),
    onSuccess: (_call, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.assistantToolCalls(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.mcp.executions() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};
