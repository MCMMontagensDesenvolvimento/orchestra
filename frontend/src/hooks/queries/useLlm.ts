import { useQuery } from '@tanstack/react-query';
import { llmService } from '@/services/llm.service';
import { queryKeys } from './queryKeys';

export const useLlmProviders = () =>
  useQuery({ queryKey: queryKeys.llm.providers(), queryFn: () => llmService.providers() });

export const useLlmConfig = () =>
  useQuery({ queryKey: queryKeys.llm.config(), queryFn: () => llmService.config() });
