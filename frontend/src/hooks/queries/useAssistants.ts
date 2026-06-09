import { useQuery } from '@tanstack/react-query';
import { assistantsService } from '@/services/assistants.service';
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
