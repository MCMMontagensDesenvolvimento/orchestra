import { useQueries } from '@tanstack/react-query';
import { chatService } from '@/services/chat.service';
import { queryKeys } from './queryKeys';
import type { Assistant, ChatConversation } from '@/types';

export interface RecentHomeConversation {
  id: string;
  assistantId: string;
  assistantName: string;
  title: string;
  updatedAt: string;
}

/** Ordena apenas conversas próprias, não arquivadas e do workspace da sessão. */
export function selectRecentHomeConversations(
  assistants: ReadonlyArray<Pick<Assistant, 'id' | 'name'>>,
  results: ReadonlyArray<ChatConversation[] | undefined>,
  ownerUserId: string | undefined,
  workspaceIds: ReadonlyArray<string>,
  limit = 3,
): RecentHomeConversation[] {
  if (!ownerUserId || workspaceIds.length === 0) return [];
  const allowedWorkspaces = new Set(workspaceIds);

  return assistants.flatMap((assistant, index) =>
    (results[index] ?? [])
      .filter((conversation) =>
        conversation.ownerUserId === ownerUserId
        && allowedWorkspaces.has(conversation.workspaceId)
        && conversation.assistantId === assistant.id
        && !conversation.archivedAt,
      )
      .map((conversation) => ({
        id: conversation.id,
        assistantId: assistant.id,
        assistantName: assistant.name,
        title: conversation.title,
        updatedAt: conversation.lastMessageAt || conversation.updatedAt,
      })),
  )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

/** Reutiliza a API e o cache já existentes, consultando os assistentes autorizados. */
export function useRecentHomeConversations(
  assistants: Assistant[],
  ownerUserId: string | undefined,
  workspaceIds: string[],
  enabled: boolean,
  limit = 3,
) {
  const shouldLoad = enabled && Boolean(ownerUserId) && workspaceIds.length > 0;
  const queries = useQueries({
    queries: assistants.map((assistant) => ({
      queryKey: queryKeys.chat.conversations(assistant.id),
      queryFn: () => chatService.conversations(assistant.id),
      enabled: shouldLoad,
      staleTime: 30_000,
    })),
  });

  const items = selectRecentHomeConversations(
    assistants,
    queries.map((query) => query.data),
    ownerUserId,
    workspaceIds,
    limit,
  );
  const hasError = shouldLoad && queries.some((query) => query.isError);

  return {
    items,
    isLoading: shouldLoad && queries.some((query) => query.isLoading),
    isError: hasError && queries.every((query) => query.isError),
    isPartialError: hasError && queries.some((query) => query.isSuccess),
    refresh: () => { void Promise.all(queries.filter((query) => query.isError).map((query) => query.refetch())); },
  };
}
