import type {
  AgentRun,
  ChatConversation,
  ChatMessage,
  Conversation,
  ConversationMessage,
  SendChatMessageResponse,
} from '@/types';
import { mockConversations, mockMessages } from '@/services/mocks';
import { mockResponse } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';
import { apiClient, type ApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

const nowIso = () => new Date().toISOString();

function mockChatConversation(conversation: Conversation): ChatConversation {
  return {
    id: conversation.id,
    tenantId: 'mock-tenant',
    workspaceId: 'default',
    assistantId: conversation.assistantId,
    ownerUserId: 'mock-user-1',
    title: conversation.title,
    visibility: 'private',
    archivedAt: null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messageCount,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.updatedAt,
  };
}

function mockChatMessage(message: ConversationMessage, conversationId: string, assistantId: string): ChatMessage {
  return {
    id: message.id,
    tenantId: 'mock-tenant',
    workspaceId: 'default',
    conversationId,
    assistantId,
    userId: message.role === 'user' ? 'mock-user-1' : null,
    role: message.role,
    content: message.content,
    agentRunId: null,
    createdAt: message.timestamp,
    agentRun: null,
  };
}

export const chatService = {
  async conversations(assistantId?: string, includeArchived = false): Promise<ChatConversation[]> {
    if (env.useMocks) {
      const items = assistantId
        ? mockConversations.filter((conversation) => conversation.assistantId === assistantId)
        : mockConversations;
      return mockResponse(items.map(mockChatConversation));
    }
    if (!assistantId) throw new Error('assistantId e obrigatorio para listar conversas.');
    const response = await apiClient.get<ApiEnvelope<ChatConversation[]>>(
      endpoints.assistants.conversations(assistantId),
      { params: { includeArchived } },
    );
    return response.data.data;
  },

  async createConversation(assistantId: string, input: { title?: string } = {}): Promise<ChatConversation> {
    if (env.useMocks) {
      const now = nowIso();
      return mockResponse({
        id: `mock-conversation-${Date.now()}`,
        tenantId: 'mock-tenant',
        workspaceId: 'default',
        assistantId,
        ownerUserId: 'mock-user-1',
        title: input.title?.trim() || 'Nova conversa',
        visibility: 'private',
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        lastMessage: null,
        lastMessageAt: null,
        messages: [],
      });
    }
    const response = await apiClient.post<ApiEnvelope<ChatConversation>>(endpoints.assistants.conversations(assistantId), input);
    return response.data.data;
  },

  async getConversation(conversationId: string): Promise<ChatConversation> {
    if (env.useMocks) {
      const conversation = mockConversations.find((item) => item.id === conversationId) ?? mockConversations[0];
      return mockResponse({
        ...mockChatConversation(conversation),
        messages: mockMessages.map((message) => mockChatMessage(message, conversation.id, conversation.assistantId)),
      });
    }
    const response = await apiClient.get<ApiEnvelope<ChatConversation>>(endpoints.chat.conversation(conversationId));
    return response.data.data;
  },

  async messages(conversationId: string): Promise<ChatMessage[]> {
    const conversation = await this.getConversation(conversationId);
    return conversation.messages ?? [];
  },

  async sendMessage(conversationId: string, input: string): Promise<SendChatMessageResponse> {
    if (env.useMocks) {
      const now = nowIso();
      const conversation = await this.getConversation(conversationId);
      const userMessage: ChatMessage = {
        id: `mock-user-message-${Date.now()}`,
        tenantId: conversation.tenantId,
        workspaceId: conversation.workspaceId,
        conversationId,
        assistantId: conversation.assistantId,
        userId: conversation.ownerUserId,
        role: 'user',
        content: input,
        createdAt: now,
        agentRun: null,
      };
      const assistantMessage: ChatMessage = {
        id: `mock-assistant-message-${Date.now()}`,
        tenantId: conversation.tenantId,
        workspaceId: conversation.workspaceId,
        conversationId,
        assistantId: conversation.assistantId,
        userId: null,
        role: 'assistant',
        content: 'Resposta simulada persistida pelo mock local.',
        agentRunId: `mock-run-${Date.now()}`,
        createdAt: now,
        agentRun: null,
      };
      const run: AgentRun = {
        id: assistantMessage.agentRunId!,
        tenantId: conversation.tenantId,
        workspaceId: conversation.workspaceId,
        assistantId: conversation.assistantId,
        assistantVersionId: null,
        assistantPublicationId: null,
        conversationId,
        requestedById: conversation.ownerUserId,
        status: 'completed',
        mode: 'published',
        source: 'chat-conversation',
        inputSummary: input.slice(0, 500),
        requestId: `req_${assistantMessage.agentRunId}`,
        traceId: `trace_${assistantMessage.agentRunId}`,
        startedAt: now,
        completedAt: now,
        failedAt: null,
        cancelledAt: null,
        blockedAt: null,
        errorCode: null,
        errorMessage: null,
        precheckSnapshot: { canExecute: true, mode: 'published', reasons: [], requestId: `req_${assistantMessage.agentRunId}` },
        metadata: {
          runtime: {
            provider: 'local',
            status: 'completed',
          },
        },
        createdAt: now,
        updatedAt: now,
      };
      assistantMessage.agentRun = run;
      return mockResponse({
        conversation: {
          ...conversation,
          updatedAt: now,
          messageCount: (conversation.messageCount ?? 0) + 2,
          lastMessage: assistantMessage.content,
          lastMessageAt: now,
          messages: [...(conversation.messages ?? []), userMessage, assistantMessage],
        },
        userMessage,
        assistantMessage,
        run,
      });
    }
    const response = await apiClient.post<ApiEnvelope<SendChatMessageResponse>>(endpoints.chat.send(conversationId), { input });
    return response.data.data;
  },

  async archiveConversation(conversationId: string): Promise<ChatConversation> {
    if (env.useMocks) {
      const conversation = await this.getConversation(conversationId);
      return mockResponse({ ...conversation, archivedAt: nowIso() });
    }
    const response = await apiClient.post<ApiEnvelope<ChatConversation>>(endpoints.chat.archive(conversationId));
    return response.data.data;
  },
};
