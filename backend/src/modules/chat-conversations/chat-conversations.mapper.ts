import type { Conversation, ConversationMessage } from '@prisma/client';
import { mapAgentRun } from '../agent-runs/agent-runs.mapper';
import type {
  ChatConversationListItem,
  ChatConversationWithMessages,
  ChatMessageWithRun,
} from './chat-conversations.repository';

type ConversationCounts = { _count?: { messages?: number } };
type ConversationLastMessage = { messages?: Array<Pick<ConversationMessage, 'content' | 'createdAt'>> };

export function mapChatConversationListItem(conversation: Conversation & ConversationCounts & ConversationLastMessage) {
  const lastMessage = conversation.messages?.[0] ?? null;

  return {
    id: conversation.id,
    tenantId: conversation.tenantId,
    workspaceId: conversation.workspaceId,
    assistantId: conversation.assistantId,
    ownerUserId: conversation.ownerUserId,
    title: conversation.title,
    visibility: conversation.visibility,
    archivedAt: conversation.archivedAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messageCount: conversation._count?.messages ?? 0,
    lastMessage: lastMessage?.content.slice(0, 240) ?? null,
    lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
  };
}

export function mapChatMessage(message: ConversationMessage | ChatMessageWithRun) {
  const agentRun = 'agentRun' in message ? message.agentRun : undefined;

  return {
    id: message.id,
    tenantId: message.tenantId,
    workspaceId: message.workspaceId,
    conversationId: message.conversationId,
    assistantId: message.assistantId,
    userId: message.userId,
    role: message.role,
    content: message.content,
    agentRunId: message.agentRunId,
    createdAt: message.createdAt.toISOString(),
    agentRun: agentRun ? mapAgentRun(agentRun) : null,
  };
}

export function mapChatConversation(conversation: ChatConversationWithMessages | ChatConversationListItem) {
  return {
    ...mapChatConversationListItem(conversation),
    messages: 'messages' in conversation
      ? conversation.messages
        .slice()
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(mapChatMessage)
      : undefined,
  };
}
