import { useQuery } from '@tanstack/react-query';
import { chatService } from '@/services/chat.service';
import { queryKeys } from './queryKeys';

export const useConversations = (assistantId?: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.chat.conversations(assistantId),
    queryFn: () => chatService.conversations(assistantId),
    enabled,
  });

export const useMessages = (conversationId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: queryKeys.chat.messages(conversationId ?? ''),
    queryFn: () => chatService.messages(conversationId!),
    enabled: !!conversationId && enabled,
  });
