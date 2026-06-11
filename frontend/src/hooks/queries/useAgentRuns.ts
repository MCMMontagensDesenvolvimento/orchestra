import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentRunsService } from '@/services/agent-runs.service';
import type { CreateAgentRunInput } from '@/types';
import { queryKeys } from './queryKeys';

export const useAssistantRuns = (assistantId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.agentRuns.assistant(assistantId ?? ''),
    queryFn: () => agentRunsService.listForAssistant(assistantId!),
    enabled: !!assistantId,
  });

export const useAgentRun = (runId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.agentRuns.detail(runId ?? ''),
    queryFn: () => agentRunsService.get(runId!),
    enabled: !!runId,
  });

export const useAgentRunEvents = (runId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.agentRuns.events(runId ?? ''),
    queryFn: () => agentRunsService.events(runId!),
    enabled: !!runId,
  });

export const useCreateAgentRunMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assistantId, input }: { assistantId: string; input: CreateAgentRunInput }) =>
      agentRunsService.createForAssistant(assistantId, input),
    onSuccess: (_run, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.assistant(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useCancelAgentRunMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => agentRunsService.cancel(runId),
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.assistant(run.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.detail(run.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.events(run.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};
