import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assistantsService } from '@/services/assistants.service';
import type { AssistantApprovalAction, AssistantExecutionMode, AssistantExecutionPolicy, AssistantTestStatus, FeedbackType, AssistantWizardFormData } from '@/types';
import { queryKeys } from './queryKeys';

export const useAssistants = () =>
  useQuery({ queryKey: queryKeys.assistants.list(), queryFn: () => assistantsService.list() });

export const useAssistant = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.assistants.detail(id ?? ''),
    queryFn: () => assistantsService.get(id!),
    enabled: !!id,
  });

export const useAssistantVersions = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.assistants.versions(id ?? ''),
    queryFn: () => assistantsService.versions(id!),
    enabled: !!id,
  });

export const useAssistantPublications = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.assistants.publications(id ?? ''),
    queryFn: () => assistantsService.publications(id!),
    enabled: !!id,
  });

export const useAssistantActivePublication = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.assistants.activePublication(id ?? ''),
    queryFn: () => assistantsService.activePublication(id!),
    enabled: !!id,
  });

export const useAssistantApprovals = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.assistants.approvals(id ?? ''),
    queryFn: () => assistantsService.approvals(id!),
    enabled: !!id,
  });

export const useAssistantExecutionPolicy = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.assistants.executionPolicy(id ?? ''),
    queryFn: () => assistantsService.executionPolicy(id!),
    enabled: !!id,
  });

export const useAssistantFeedback = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.assistants.feedback(id ?? ''),
    queryFn: () => assistantsService.feedback(id!),
    enabled: !!id,
  });

export const useAssistantTestResults = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.assistants.tests(id ?? ''),
    queryFn: () => assistantsService.testResults(id!),
    enabled: !!id,
  });

export const useCreateAssistantMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ formData, publish = false }: { formData: AssistantWizardFormData; publish?: boolean }) =>
      assistantsService.create(formData, publish),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useUpdateAssistantMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData, publish = false }: { id: string; formData: AssistantWizardFormData; publish?: boolean }) =>
      assistantsService.update(id, formData, publish),
    onSuccess: (_assistant, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.versions(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useArchiveAssistantMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assistantsService.archive(id),
    onSuccess: (_assistant, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.publications(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.activePublication(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useRestoreAssistantMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assistantsService.restore(id),
    onSuccess: (_assistant, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.versions(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.publications(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.activePublication(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const usePublishAssistantMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { id: string; versionId?: string; approvalId?: string; reason?: string }) =>
      typeof input === 'string' ? assistantsService.publish(input) : assistantsService.publish(input.id, input),
    onSuccess: (_assistant, input) => {
      const id = typeof input === 'string' ? input : input.id;
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.versions(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.publications(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.activePublication(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.approvals(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useUnpublishAssistantMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assistantsService.unpublish(id),
    onSuccess: (_assistant, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.publications(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.activePublication(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useRollbackAssistantMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, versionId, publicationId, reason }: { id: string; versionId?: string; publicationId?: string; reason: string }) =>
      assistantsService.rollback(id, { versionId, publicationId, reason }),
    onSuccess: (_assistant, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.versions(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.publications(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.activePublication(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useCreateAssistantFeedbackMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating, comment, assistantVersionId }: { id: string; rating: FeedbackType; comment?: string; assistantVersionId?: string }) =>
      assistantsService.createFeedback(id, { rating, comment, assistantVersionId }),
    onSuccess: (_feedback, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.feedback(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useCreateAssistantApprovalMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, assistantVersionId, publicationId, reason }: {
      id: string;
      action: AssistantApprovalAction;
      assistantVersionId?: string;
      publicationId?: string;
      reason?: string;
    }) => assistantsService.createApproval(id, { action, assistantVersionId, publicationId, reason }),
    onSuccess: (_approval, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.approvals(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useApproveAssistantApprovalMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvalId, decisionReason }: { id: string; approvalId: string; decisionReason?: string }) =>
      assistantsService.approveApproval(id, approvalId, decisionReason),
    onSuccess: (_approval, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.approvals(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useRejectAssistantApprovalMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvalId, decisionReason }: { id: string; approvalId: string; decisionReason?: string }) =>
      assistantsService.rejectApproval(id, approvalId, decisionReason),
    onSuccess: (_approval, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.approvals(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useCancelAssistantApprovalMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvalId, decisionReason }: { id: string; approvalId: string; decisionReason?: string }) =>
      assistantsService.cancelApproval(id, approvalId, decisionReason),
    onSuccess: (_approval, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.approvals(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useUpdateAssistantExecutionPolicyMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Pick<AssistantExecutionPolicy,
      'executionMode' |
      'requiresApprovalToPublish' |
      'sandboxEnabled' |
      'sandboxRequiresAuth' |
      'sandboxAllowedForRoles' |
      'sandboxBlocksExternalTools' |
      'sandboxBlocksRealProviders' |
      'sandboxLogsRequired' |
      'sandboxCostLimitPlaceholder' |
      'allowDraftTesting' |
      'allowPublishedExecution' |
      'isExecutionEnabled'
    >> }) => assistantsService.updateExecutionPolicy(id, payload),
    onSuccess: (_policy, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.executionPolicy(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useAssistantExecutionPrecheckMutation = () =>
  useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: AssistantExecutionMode }) => assistantsService.executionPrecheck(id, mode),
  });

export const useCreateAssistantTestResultMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      assistantVersionId,
      input,
      expectedBehavior,
      actualOutput,
      status,
      score,
      notes,
    }: {
      id: string;
      assistantVersionId?: string;
      input: string;
      expectedBehavior?: string;
      actualOutput: string;
      status: AssistantTestStatus;
      score?: number;
      notes?: string;
    }) =>
      assistantsService.createTestResult(id, {
        assistantVersionId,
        input,
        expectedBehavior,
        actualOutput,
        status,
        score,
        notes,
      }),
    onSuccess: (_testResult, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.tests(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};
