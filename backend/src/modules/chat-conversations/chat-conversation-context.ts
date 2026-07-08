import { env } from '../../config/env';
import type {
  RuntimeConversationContext,
  RuntimeConversationContextMessage,
  RuntimeConversationContextSummary,
} from '../runtime/runtime.types';

type AllowedConversationContextRole = RuntimeConversationContextMessage['role'];

export interface ChatConversationContextConfig {
  enabled: boolean;
  maxMessages: number;
  maxMessageChars: number;
  maxTotalChars: number;
}

export interface ChatConversationContextSourceMessage {
  id: string;
  tenantId: string;
  workspaceId: string;
  conversationId: string;
  assistantId: string;
  userId?: string | null;
  role: string;
  content: string;
  createdAt: Date;
}

export interface BuildChatConversationContextInput {
  conversation: {
    id: string;
    tenantId: string;
    workspaceId: string;
    assistantId: string;
    ownerUserId: string;
  };
  currentMessageId?: string | null;
  messages: ChatConversationContextSourceMessage[];
  config?: ChatConversationContextConfig;
}

export interface GovernedChatConversationContext {
  messages: RuntimeConversationContextMessage[];
  summary: RuntimeConversationContextSummary;
}

const allowedRoles = new Set<AllowedConversationContextRole>(['user', 'assistant']);
const defaultMaxMessages = 12;
const defaultMaxMessageChars = 1200;
const defaultMaxTotalChars = 6000;
const hardMaxMessages = 50;
const hardMaxMessageChars = 4000;
const hardMaxTotalChars = 20000;

export function getChatConversationContextConfig(): ChatConversationContextConfig {
  return {
    enabled: env.CHAT_CONTEXT_ENABLED,
    maxMessages: boundedPositiveInteger(env.CHAT_CONTEXT_MAX_MESSAGES, defaultMaxMessages, hardMaxMessages),
    maxMessageChars: boundedPositiveInteger(env.CHAT_CONTEXT_MAX_MESSAGE_CHARS, defaultMaxMessageChars, hardMaxMessageChars),
    maxTotalChars: boundedPositiveInteger(env.CHAT_CONTEXT_MAX_TOTAL_CHARS, defaultMaxTotalChars, hardMaxTotalChars),
  };
}

export function chatConversationContextQueryLimit(config: ChatConversationContextConfig) {
  return config.enabled ? config.maxMessages + 1 : 0;
}

export function buildGovernedChatConversationContext(input: BuildChatConversationContextInput): GovernedChatConversationContext {
  const config = input.config ?? getChatConversationContextConfig();
  const empty = emptyContextSummary(config);

  if (!config.enabled) {
    return {
      messages: [],
      summary: empty,
    };
  }

  const candidates = input.messages
    .filter((message) => isEligibleMessage(message, input))
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));

  const quantityTruncated = candidates.length > config.maxMessages;
  const recentCandidates = candidates.slice(-config.maxMessages);
  let perMessageTruncated = false;

  const perMessageLimited = recentCandidates
    .map((message): RuntimeConversationContextMessage | null => {
      const normalized = normalizeContent(message.content);
      if (!normalized) return null;

      const content = truncateText(normalized, config.maxMessageChars);
      if (!content) return null;
      if (content.length < normalized.length) perMessageTruncated = true;

      return {
        messageId: message.id,
        role: message.role as AllowedConversationContextRole,
        content,
        createdAt: message.createdAt.toISOString(),
      };
    })
    .filter((message): message is RuntimeConversationContextMessage => Boolean(message));

  const totalLimited = limitTotalChars(perMessageLimited, config.maxTotalChars);
  const totalChars = totalLimited.messages.reduce((sum, message) => sum + message.content.length, 0);

  return {
    messages: totalLimited.messages,
    summary: {
      enabled: true,
      included: totalLimited.messages.length > 0,
      messageCount: totalLimited.messages.length,
      totalChars,
      truncated: quantityTruncated || perMessageTruncated || totalLimited.truncated,
      maxMessages: config.maxMessages,
      maxMessageChars: config.maxMessageChars,
      maxTotalChars: config.maxTotalChars,
    },
  };
}

export function toRuntimeConversationContext(context: GovernedChatConversationContext): RuntimeConversationContext | undefined {
  if (!context.summary.enabled || !context.summary.included || context.messages.length === 0) return undefined;

  return {
    messages: context.messages,
    summary: context.summary,
  };
}

function emptyContextSummary(config: ChatConversationContextConfig): RuntimeConversationContextSummary {
  return {
    enabled: config.enabled,
    included: false,
    messageCount: 0,
    totalChars: 0,
    truncated: false,
    maxMessages: config.maxMessages,
    maxMessageChars: config.maxMessageChars,
    maxTotalChars: config.maxTotalChars,
  };
}

function isEligibleMessage(message: ChatConversationContextSourceMessage, input: BuildChatConversationContextInput) {
  if (input.currentMessageId && message.id === input.currentMessageId) return false;
  if (message.tenantId !== input.conversation.tenantId) return false;
  if (message.workspaceId !== input.conversation.workspaceId) return false;
  if (message.conversationId !== input.conversation.id) return false;
  if (message.assistantId !== input.conversation.assistantId) return false;
  if (!allowedRoles.has(message.role as AllowedConversationContextRole)) return false;
  if (message.role === 'user' && message.userId !== input.conversation.ownerUserId) return false;
  if (!(message.createdAt instanceof Date) || Number.isNaN(message.createdAt.getTime())) return false;
  return typeof message.content === 'string' && message.content.trim().length > 0;
}

function normalizeContent(value: string) {
  const normalized = value
    .replace(/\s+/g, ' ')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[redacted]')
    .replace(/https?:\/\/[^/\s:@]+:[^/\s@]+@/gi, 'https://[redacted]@')
    .replace(/\b(api[_-]?key|password|secret)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .trim();

  return normalized.length > 0 ? normalized : undefined;
}

function limitTotalChars(messages: RuntimeConversationContextMessage[], maxTotalChars: number) {
  let remaining = maxTotalChars;
  let truncated = false;
  const selected: RuntimeConversationContextMessage[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (remaining <= 0) {
      truncated = true;
      break;
    }

    let content = message.content;
    if (content.length > remaining) {
      content = truncateText(content, remaining);
      truncated = true;
    }

    if (content) {
      selected.push({ ...message, content });
      remaining -= content.length;
    }
  }

  if (selected.length < messages.length) truncated = true;

  return {
    messages: selected.reverse(),
    truncated,
  };
}

function truncateText(value: string, maxChars: number) {
  if (maxChars <= 0) return '';
  return value.slice(0, maxChars).trim();
}

function boundedPositiveInteger(value: number, fallback: number, max: number) {
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return Math.min(value, max);
}
