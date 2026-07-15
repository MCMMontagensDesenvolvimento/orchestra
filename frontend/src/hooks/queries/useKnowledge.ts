import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  knowledgeService,
  type AssistantKnowledgeBindingPayload,
  type KnowledgeBasePayload,
  type KnowledgeDataSourcePayload,
  type KnowledgeDocumentPayload,
  type RagQueryPayload,
} from '@/services/knowledge.service';
import { queryKeys } from './queryKeys';

export const useKnowledgeBases = () =>
  useQuery({ queryKey: queryKeys.knowledge.list(), queryFn: () => knowledgeService.list() });

export const useKnowledgeBase = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.knowledge.detail(id ?? ''),
    queryFn: () => knowledgeService.get(id!),
    enabled: !!id,
  });

export const useKnowledgeBaseReadiness = (id: string | undefined) =>
  useQuery({
    queryKey: queryKeys.knowledge.readiness(id),
    queryFn: () => knowledgeService.readiness(id!),
    enabled: !!id,
  });

export const useKnowledgeDocuments = (knowledgeBaseId?: string) =>
  useQuery({
    queryKey: queryKeys.knowledge.documents(knowledgeBaseId),
    queryFn: () => knowledgeService.documents(knowledgeBaseId),
  });

export const useKnowledgeDataSources = (knowledgeBaseId?: string) =>
  useQuery({
    queryKey: queryKeys.knowledge.dataSources(knowledgeBaseId),
    queryFn: () => knowledgeService.dataSources(knowledgeBaseId!),
    enabled: !!knowledgeBaseId,
  });

export const useKnowledgeIngestionJobs = (documentId?: string) =>
  useQuery({
    queryKey: queryKeys.knowledge.ingestion(documentId ?? ''),
    queryFn: () => knowledgeService.ingestionJobs(documentId!),
    enabled: !!documentId,
  });

export const useKnowledgeChunks = (documentId?: string) =>
  useQuery({
    queryKey: queryKeys.knowledge.chunks(documentId ?? ''),
    queryFn: () => knowledgeService.chunksByDocument(documentId!),
    enabled: !!documentId,
  });

export const useKnowledgeSourceReferences = (documentId?: string) =>
  useQuery({
    queryKey: queryKeys.knowledge.sourceReferences(documentId ?? ''),
    queryFn: () => knowledgeService.sourceReferencesByDocument(documentId!),
    enabled: !!documentId,
  });

export const useAssistantKnowledgeBindings = (assistantId?: string) =>
  useQuery({
    queryKey: queryKeys.knowledge.assistantBindings(assistantId ?? ''),
    queryFn: () => knowledgeService.assistantBindings(assistantId!),
    enabled: !!assistantId,
  });

export const useAssistantRagReadiness = (assistantId?: string) =>
  useQuery({
    queryKey: queryKeys.knowledge.ragReadiness(assistantId ?? ''),
    queryFn: () => knowledgeService.ragReadiness(assistantId!),
    enabled: !!assistantId,
  });

export const useAssistantRagQueries = (assistantId?: string) =>
  useQuery({
    queryKey: queryKeys.knowledge.ragQueries(assistantId ?? ''),
    queryFn: () => knowledgeService.ragQueries(assistantId!),
    enabled: !!assistantId,
  });

export const useRagQueryDetail = (queryId?: string) =>
  useQuery({
    queryKey: queryKeys.knowledge.ragQuery(queryId ?? ''),
    queryFn: () => knowledgeService.ragQueryDetail(queryId!),
    enabled: !!queryId,
  });

export const useAssistantRagLocalSearchMutation = () =>
  useMutation({
    mutationFn: ({ assistantId, query }: { assistantId: string; query: string }) => knowledgeService.ragLocalSearch(assistantId, query),
  });

export const useAssistantRagQueryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assistantId, payload }: { assistantId: string; payload: RagQueryPayload }) =>
      knowledgeService.ragQuery(assistantId, payload),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.ragQueries(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.ragReadiness(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useCreateKnowledgeBaseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KnowledgeBasePayload) => knowledgeService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useUpdateKnowledgeBaseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<KnowledgeBasePayload> }) => knowledgeService.update(id, payload),
    onSuccess: (_base, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useArchiveKnowledgeBaseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeService.archive(id),
    onSuccess: (_base, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useRestoreKnowledgeBaseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeService.restore(id),
    onSuccess: (_base, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useCreateKnowledgeDocumentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ knowledgeBaseId, payload }: { knowledgeBaseId: string; payload: KnowledgeDocumentPayload }) =>
      knowledgeService.createDocument(knowledgeBaseId, payload),
    onSuccess: (_document, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.documents(variables.knowledgeBaseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(variables.knowledgeBaseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useUploadKnowledgeDocumentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ knowledgeBaseId, file }: { knowledgeBaseId: string; file: File }) =>
      knowledgeService.uploadDocument(knowledgeBaseId, file),
    onSuccess: (_document, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.documents(variables.knowledgeBaseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(variables.knowledgeBaseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.readiness(variables.knowledgeBaseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useRequestKnowledgeIngestionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, knowledgeBaseId }: { documentId: string; knowledgeBaseId: string }) =>
      knowledgeService.requestIngestion(documentId).then((result) => ({ ...result, documentId, knowledgeBaseId })),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.documents(result.knowledgeBaseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.ingestion(result.documentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.chunks(result.documentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.sourceReferences(result.documentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(result.knowledgeBaseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.readiness(result.knowledgeBaseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useArchiveKnowledgeDocumentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, knowledgeBaseId }: { documentId: string; knowledgeBaseId: string }) =>
      knowledgeService.archiveDocument(documentId).then((document) => ({ document, knowledgeBaseId })),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.documents(result.knowledgeBaseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useCreateKnowledgeDataSourceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ knowledgeBaseId, payload }: { knowledgeBaseId: string; payload: KnowledgeDataSourcePayload }) =>
      knowledgeService.createDataSource(knowledgeBaseId, payload),
    onSuccess: (_dataSource, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.dataSources(variables.knowledgeBaseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useCreateAssistantKnowledgeBindingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assistantId, payload }: { assistantId: string; payload: AssistantKnowledgeBindingPayload }) =>
      knowledgeService.createAssistantBinding(assistantId, payload),
    onSuccess: (_binding, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.assistantBindings(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useRemoveAssistantKnowledgeBindingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assistantId, bindingId }: { assistantId: string; bindingId: string }) =>
      knowledgeService.removeAssistantBinding(assistantId, bindingId).then(() => ({ assistantId })),
    onSuccess: (variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.assistantBindings(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assistants.detail(variables.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};
