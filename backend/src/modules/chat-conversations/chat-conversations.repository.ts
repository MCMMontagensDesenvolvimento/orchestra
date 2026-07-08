import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import type { ChatConversationsQuery, ChatMessageRole, ChatVisibility } from './chat-conversations.schema';

const chatAgentRunInclude = {
  events: {
    orderBy: { sequence: 'asc' },
  },
} satisfies Prisma.AgentRunInclude;

const chatMessageInclude = {
  agentRun: {
    include: chatAgentRunInclude,
  },
} satisfies Prisma.ConversationMessageInclude;

const chatConversationInclude = {
  messages: {
    orderBy: { createdAt: 'asc' },
    include: chatMessageInclude,
  },
  _count: {
    select: { messages: true },
  },
} satisfies Prisma.ConversationInclude;

const chatConversationListInclude = {
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  _count: {
    select: { messages: true },
  },
} satisfies Prisma.ConversationInclude;

export type ChatConversationWithMessages = Prisma.ConversationGetPayload<{ include: typeof chatConversationInclude }>;
export type ChatConversationListItem = Prisma.ConversationGetPayload<{ include: typeof chatConversationListInclude }>;
export type ChatMessageWithRun = Prisma.ConversationMessageGetPayload<{ include: typeof chatMessageInclude }>;

export const chatConversationsRepository = {
  findAssistantForConversation(id: string, tenantId: string, workspaceIds: string[]) {
    return prisma.assistant.findFirst({
      where: {
        id,
        tenantId,
        workspaceId: { in: workspaceIds },
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        workspaceId: true,
        status: true,
        createdById: true,
      },
    });
  },

  async listForAssistant(input: {
    tenantId: string;
    workspaceId: string;
    assistantId: string;
    ownerUserId: string;
    query: ChatConversationsQuery;
  }) {
    return prisma.conversation.findMany({
      where: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        ownerUserId: input.ownerUserId,
        ...(input.query.includeArchived ? {} : { archivedAt: null }),
      },
      include: chatConversationListInclude,
      orderBy: { updatedAt: 'desc' },
    });
  },

  createConversation(input: {
    tenantId: string;
    workspaceId: string;
    assistantId: string;
    ownerUserId: string;
    title: string;
    visibility: ChatVisibility;
  }) {
    return prisma.conversation.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        ownerUserId: input.ownerUserId,
        title: input.title,
        visibility: input.visibility,
      },
      include: chatConversationInclude,
    });
  },

  findConversationForOwner(conversationId: string, tenantId: string, workspaceIds: string[], ownerUserId: string) {
    return prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        workspaceId: { in: workspaceIds },
        ownerUserId,
      },
      include: chatConversationInclude,
    });
  },

  listContextMessagesForConversation(input: {
    tenantId: string;
    workspaceId: string;
    assistantId: string;
    conversationId: string;
    ownerUserId: string;
    excludeMessageId?: string | null;
    limit: number;
  }) {
    if (input.limit <= 0) return Promise.resolve([]);

    return prisma.conversationMessage.findMany({
      where: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId,
        conversationId: input.conversationId,
        role: { in: ['user', 'assistant'] },
        ...(input.excludeMessageId ? { id: { not: input.excludeMessageId } } : {}),
        conversation: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          assistantId: input.assistantId,
          ownerUserId: input.ownerUserId,
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: input.limit,
    });
  },

  createMessage(input: {
    tenantId: string;
    workspaceId: string;
    conversationId: string;
    assistantId: string;
    userId?: string | null;
    role: ChatMessageRole;
    content: string;
    agentRunId?: string | null;
    conversationUpdate?: Prisma.ConversationUpdateInput;
  }) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.conversationMessage.create({
        data: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          conversationId: input.conversationId,
          assistantId: input.assistantId,
          userId: input.userId,
          role: input.role,
          content: input.content,
          agentRunId: input.agentRunId,
        },
        include: chatMessageInclude,
      });

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: input.conversationUpdate ?? { updatedAt: new Date() },
      });

      return message;
    });
  },

  updateConversation(conversationId: string, data: Prisma.ConversationUpdateInput) {
    return prisma.conversation.update({
      where: { id: conversationId },
      data,
      include: chatConversationInclude,
    });
  },

  archiveConversation(conversationId: string, archivedAt: Date) {
    return prisma.conversation.update({
      where: { id: conversationId },
      data: { archivedAt },
      include: chatConversationInclude,
    });
  },
};
