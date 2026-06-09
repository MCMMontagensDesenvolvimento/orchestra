import { useQuery } from '@tanstack/react-query';
import { knowledgeService } from '@/services/knowledge.service';
import { queryKeys } from './queryKeys';

export const useKnowledgeBases = () =>
  useQuery({ queryKey: queryKeys.knowledge.list(), queryFn: () => knowledgeService.list() });

export const useKnowledgeBase = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.knowledge.detail(id ?? ''),
    queryFn: () => knowledgeService.get(id!),
    enabled: !!id,
  });

export const useKnowledgeDocuments = (knowledgeBaseId?: string) =>
  useQuery({
    queryKey: queryKeys.knowledge.documents(knowledgeBaseId),
    queryFn: () => knowledgeService.documents(knowledgeBaseId),
  });
