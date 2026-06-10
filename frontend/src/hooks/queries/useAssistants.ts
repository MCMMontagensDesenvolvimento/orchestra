import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assistantsService } from '@/services/assistants.service';
import type { AssistantWizardFormData } from '@/types';
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const usePublishAssistantMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assistantsService.publish(id),
    onSuccess: (_assistant, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};
