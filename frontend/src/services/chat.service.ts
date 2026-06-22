import type { Conversation, ConversationMessage } from '@/types';
import { mockConversations, mockMessages } from '@/services/mocks';
import { mockResponse } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';

export const chatService = {
  async conversations(assistantId?: string): Promise<Conversation[]> {
    if (env.useMocks) {
      const items = assistantId
        ? mockConversations.filter(c => c.assistantId === assistantId)
        : mockConversations;
      return mockResponse(items);
    }
    throw new Error('API real ainda não implementada.');
  },
  async messages(conversationId: string): Promise<ConversationMessage[]> {
    if (env.useMocks) {
      // Mock atual não diferencia por conversationId; retorna todas.
      void conversationId;
      return mockResponse(mockMessages);
    }
    throw new Error('API real ainda não implementada.');
  },
};
