import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatService } from '@/services/chat.service';
import type { ChatConversation, SendChatMessageResponse } from '@/types';
import { queryKeys } from './queryKeys';

export const useChatConversations = (assistantId: string | undefined, includeArchived = false) =>
  useQuery({
    queryKey: queryKeys.chat.conversations(assistantId ?? '', includeArchived),
    queryFn: () => chatService.conversations(assistantId!, includeArchived),
    enabled: !!assistantId,
  });

export const useChatConversation = (conversationId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.chat.conversation(conversationId ?? ''),
    queryFn: () => chatService.getConversation(conversationId!),
    enabled: !!conversationId,
  });

export const useCreateChatConversationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assistantId, title }: { assistantId: string; title?: string }) =>
      chatService.createConversation(assistantId, { title }),
    onSuccess: (conversation) => {
      queryClient.setQueryData(queryKeys.chat.conversation(conversation.id), conversation);
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations(conversation.assistantId) });
    },
  });
};

export const useSendChatMessageMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, input }: { conversationId: string; input: string }) =>
      chatService.sendMessage(conversationId, input),
    onSuccess: (result: SendChatMessageResponse) => {
      queryClient.setQueryData(queryKeys.chat.conversation(result.conversation.id), result.conversation);
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations(result.conversation.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.assistant(result.conversation.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns.detail(result.run.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};

export const useArchiveChatConversationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatService.archiveConversation(conversationId),
    onSuccess: (conversation: ChatConversation) => {
      queryClient.setQueryData(queryKeys.chat.conversation(conversation.id), conversation);
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations(conversation.assistantId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.logs });
    },
  });
};
