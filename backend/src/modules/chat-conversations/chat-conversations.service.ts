import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { agentRunsService } from '../agent-runs/agent-runs.service';
import {
  buildGovernedChatConversationContext,
  chatConversationContextQueryLimit,
  getChatConversationContextConfig,
  toRuntimeConversationContext,
} from './chat-conversation-context';
import {
  mapChatConversation,
  mapChatConversationListItem,
  mapChatMessage,
} from './chat-conversations.mapper';
import { chatConversationsRepository } from './chat-conversations.repository';
import type {
  ChatConversationsQuery,
  CreateChatConversationInput,
  CreateChatMessageInput,
} from './chat-conversations.schema';

interface RequestContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

type ChatConversation = NonNullable<Awaited<ReturnType<typeof chatConversationsRepository.findConversationForOwner>>>;
type ChatAgentRun = Awaited<ReturnType<typeof agentRunsService.createForAssistant>>;

const DEFAULT_TITLE = 'Nova conversa';

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);

function sanitizeTitle(title: string | undefined) {
  const normalized = title?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 120) : DEFAULT_TITLE;
}

function titleFromFirstMessage(input: string) {
  const normalized = input.replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 80) || DEFAULT_TITLE;
}

function shouldReplaceGenericTitle(conversation: ChatConversation) {
  return conversation.title.trim().toLowerCase() === DEFAULT_TITLE.toLowerCase() && conversation.messages.length === 0;
}

function safeText(value: unknown, maxLength = 4000) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function precheckReasons(run: ChatAgentRun) {
  const snapshot = asRecord(run.precheckSnapshot);
  const reasons = Array.isArray(snapshot?.reasons) ? snapshot.reasons : [];

  return reasons
    .map((reason) => asRecord(reason))
    .filter((reason): reason is Record<string, unknown> => Boolean(reason))
    .map((reason) => ({
      code: safeText(reason.code, 80) ?? 'POLICY_BLOCKED',
      message: safeText(reason.message, 240) ?? 'Execucao bloqueada por policy.',
    }));
}

function firstPrecheckReason(run: ChatAgentRun) {
  return precheckReasons(run)[0];
}

function publicAssistantMessageFromRun(run: ChatAgentRun, runtimeOutputPreview?: string) {
  if (run.status === 'completed') {
    return safeText(runtimeOutputPreview)
      ?? `Run concluido pelo backend Orchestra. Nao houve campo textual publico claro para exibir. runId=${run.id}${run.requestId ? ` requestId=${run.requestId}` : ''}`;
  }

  if (run.status === 'blocked') {
    const code = run.errorCode ?? firstPrecheckReason(run)?.code ?? 'POLICY_BLOCKED';
    const message = run.errorMessage ?? firstPrecheckReason(run)?.message ?? 'Execucao bloqueada por policy.';
    const reasons = precheckReasons(run)
      .slice(0, 4)
      .map((reason) => `- ${reason.code}: ${reason.message}`)
      .join('\n');

    return [
      'Execucao bloqueada por policy governada.',
      `Codigo: ${code}`,
      `Mensagem: ${message}`,
      reasons ? `Motivos:\n${reasons}` : undefined,
    ].filter(Boolean).join('\n');
  }

  if (run.status === 'failed') {
    return [
      'Nao foi possivel concluir a execucao.',
      run.errorCode ? `Codigo: ${run.errorCode}` : undefined,
      run.errorMessage ? `Mensagem: ${safeText(run.errorMessage, 220)}` : undefined,
      run.requestId ? `requestId=${run.requestId}` : undefined,
    ].filter(Boolean).join('\n');
  }

  if (run.status === 'cancelled') {
    return `Run cancelado pelo backend Orchestra. runId=${run.id}${run.requestId ? ` requestId=${run.requestId}` : ''}`;
  }

  return [
    `Run retornou status ${run.status}.`,
    'A execucao ainda nao chegou a um estado final na resposta recebida.',
    `runId=${run.id}`,
    run.requestId ? `requestId=${run.requestId}` : undefined,
  ].filter(Boolean).join('\n');
}

async function getAssistantOrThrow(assistantId: string, user: AuthenticatedUser) {
  const assistant = await chatConversationsRepository.findAssistantForConversation(
    assistantId,
    user.tenant.id,
    userWorkspaceIds(user),
  );

  if (!assistant) {
    throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
  }

  return assistant;
}

async function getConversationOrThrow(conversationId: string, user: AuthenticatedUser) {
  const conversation = await chatConversationsRepository.findConversationForOwner(
    conversationId,
    user.tenant.id,
    userWorkspaceIds(user),
    user.id,
  );

  if (!conversation) {
    throw new AppError(404, 'CHAT_CONVERSATION_NOT_FOUND', 'Conversa nao encontrada.');
  }

  return conversation;
}

export const chatConversationsService = {
  async listForAssistant(assistantId: string, query: ChatConversationsQuery, user: AuthenticatedUser) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const conversations = await chatConversationsRepository.listForAssistant({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      assistantId: assistant.id,
      ownerUserId: user.id,
      query,
    });

    return conversations.map(mapChatConversationListItem);
  },

  async createForAssistant(assistantId: string, input: CreateChatConversationInput, user: AuthenticatedUser) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    if (assistant.status !== 'published') {
      throw new AppError(409, 'ASSISTANT_NOT_PUBLISHED', 'Somente assistentes publicados podem iniciar conversas no chat.');
    }
    const conversation = await chatConversationsRepository.createConversation({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      assistantId: assistant.id,
      ownerUserId: user.id,
      title: sanitizeTitle(input.title),
      visibility: 'private',
    });

    return mapChatConversation(conversation);
  },

  async get(conversationId: string, user: AuthenticatedUser) {
    const conversation = await getConversationOrThrow(conversationId, user);
    return mapChatConversation(conversation);
  },

  async sendMessage(conversationId: string, input: CreateChatMessageInput, user: AuthenticatedUser, context: RequestContext) {
    const conversation = await getConversationOrThrow(conversationId, user);

    if (conversation.archivedAt) {
      throw new AppError(409, 'CHAT_CONVERSATION_ARCHIVED', 'Conversa arquivada nao aceita novas mensagens.');
    }

    const shouldUpdateTitle = shouldReplaceGenericTitle(conversation);
    const userMessage = await chatConversationsRepository.createMessage({
      tenantId: conversation.tenantId,
      workspaceId: conversation.workspaceId,
      conversationId: conversation.id,
      assistantId: conversation.assistantId,
      userId: user.id,
      role: 'user',
      content: input.input,
      conversationUpdate: shouldUpdateTitle ? { title: titleFromFirstMessage(input.input) } : undefined,
    });

    const contextConfig = getChatConversationContextConfig();
    const contextMessages = await chatConversationsRepository.listContextMessagesForConversation({
      tenantId: conversation.tenantId,
      workspaceId: conversation.workspaceId,
      assistantId: conversation.assistantId,
      conversationId: conversation.id,
      ownerUserId: conversation.ownerUserId,
      excludeMessageId: userMessage.id,
      limit: chatConversationContextQueryLimit(contextConfig),
    });
    const conversationContext = buildGovernedChatConversationContext({
      conversation: {
        id: conversation.id,
        tenantId: conversation.tenantId,
        workspaceId: conversation.workspaceId,
        assistantId: conversation.assistantId,
        ownerUserId: conversation.ownerUserId,
      },
      currentMessageId: userMessage.id,
      messages: contextMessages,
      config: contextConfig,
    });

    let runtimeOutputPreview: string | undefined;
    const run = await agentRunsService.createForAssistant(
      conversation.assistantId,
      {
        mode: 'published',
        input: input.input,
        source: 'chat-conversation',
        metadata: {
          origin: 'chat-conversation',
          conversationId: conversation.id,
          assistantId: conversation.assistantId,
          conversationContextSummary: conversationContext.summary,
        },
      },
      user,
      context,
      {
        conversationId: conversation.id,
        conversationContext: toRuntimeConversationContext(conversationContext),
        onRuntimeResult: (runtimeResult) => {
          runtimeOutputPreview = runtimeResult.outputPreview;
        },
      },
    );

    const assistantMessage = await chatConversationsRepository.createMessage({
      tenantId: conversation.tenantId,
      workspaceId: conversation.workspaceId,
      conversationId: conversation.id,
      assistantId: conversation.assistantId,
      role: 'assistant',
      content: publicAssistantMessageFromRun(run, runtimeOutputPreview),
      agentRunId: run.id,
    });
    const updatedConversation = await getConversationOrThrow(conversation.id, user);

    return {
      conversation: mapChatConversation(updatedConversation),
      userMessage: mapChatMessage(userMessage),
      assistantMessage: mapChatMessage(assistantMessage),
      run,
    };
  },

  async archive(conversationId: string, user: AuthenticatedUser) {
    const conversation = await getConversationOrThrow(conversationId, user);

    if (conversation.archivedAt) {
      return mapChatConversation(conversation);
    }

    const archived = await chatConversationsRepository.archiveConversation(conversation.id, new Date());
    return mapChatConversation(archived);
  },
};
