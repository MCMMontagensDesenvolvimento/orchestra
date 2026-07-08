import { describe, expect, it } from 'vitest';
import {
  buildGovernedChatConversationContext,
  chatConversationContextQueryLimit,
  toRuntimeConversationContext,
  type ChatConversationContextConfig,
  type ChatConversationContextSourceMessage,
} from '../../src/modules/chat-conversations/chat-conversation-context';

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const assistantId = '00000000-0000-0000-0000-000000000101';
const conversationId = '00000000-0000-0000-0000-000000000501';
const ownerUserId = '00000000-0000-0000-0000-000000000001';
const currentMessageId = '00000000-0000-0000-0000-000000000999';

const baseConfig: ChatConversationContextConfig = {
  enabled: true,
  maxMessages: 4,
  maxMessageChars: 40,
  maxTotalChars: 90,
};

const conversation = {
  id: conversationId,
  tenantId,
  workspaceId,
  assistantId,
  ownerUserId,
};

function message(overrides: Partial<ChatConversationContextSourceMessage> = {}): ChatConversationContextSourceMessage {
  const index = Number(overrides.id?.slice(-2) ?? '1');

  return {
    id: `00000000-0000-0000-0000-0000000007${String(index).padStart(2, '0')}`,
    tenantId,
    workspaceId,
    conversationId,
    assistantId,
    userId: ownerUserId,
    role: 'user',
    content: `Mensagem ${index}`,
    createdAt: new Date(`2026-07-06T12:00:${String(index).padStart(2, '0')}.000Z`),
    ...overrides,
  };
}

function build(messages: ChatConversationContextSourceMessage[], config = baseConfig) {
  return buildGovernedChatConversationContext({
    conversation,
    currentMessageId,
    messages,
    config,
  });
}

describe('governed chat conversation context', () => {
  it('returns no runtime context for the first message when only the current input exists', () => {
    const context = build([message({ id: currentMessageId, content: 'Mensagem atual' })]);

    expect(context.messages).toEqual([]);
    expect(context.summary).toEqual(expect.objectContaining({
      enabled: true,
      included: false,
      messageCount: 0,
      totalChars: 0,
      truncated: false,
    }));
    expect(toRuntimeConversationContext(context)).toBeUndefined();
  });

  it('includes previous user and assistant messages in chronological order', () => {
    const first = message({ id: '00000000-0000-0000-0000-000000000701', role: 'user', content: 'Primeira pergunta' });
    const second = message({
      id: '00000000-0000-0000-0000-000000000702',
      role: 'assistant',
      userId: null,
      content: 'Primeira resposta',
    });
    const context = build([second, first, message({ id: currentMessageId, content: 'Pergunta atual' })]);

    expect(context.messages.map((item) => ({ role: item.role, content: item.content }))).toEqual([
      { role: 'user', content: 'Primeira pergunta' },
      { role: 'assistant', content: 'Primeira resposta' },
    ]);
    expect(context.summary).toEqual(expect.objectContaining({
      included: true,
      messageCount: 2,
      truncated: false,
    }));
  });

  it('limits the number of previous messages while keeping the most recent chronological slice', () => {
    const context = build([
      message({ id: '00000000-0000-0000-0000-000000000701', content: 'M1' }),
      message({ id: '00000000-0000-0000-0000-000000000702', content: 'M2' }),
      message({ id: '00000000-0000-0000-0000-000000000703', content: 'M3' }),
      message({ id: '00000000-0000-0000-0000-000000000704', content: 'M4' }),
    ], { ...baseConfig, maxMessages: 2 });

    expect(context.messages.map((item) => item.content)).toEqual(['M3', 'M4']);
    expect(context.summary.truncated).toBe(true);
    expect(chatConversationContextQueryLimit({ ...baseConfig, maxMessages: 2 })).toBe(3);
  });

  it('truncates each message and records truncation', () => {
    const context = build([
      message({ content: 'abcdefghijklmnopqrstuvwxyz' }),
    ], { ...baseConfig, maxMessageChars: 10 });

    expect(context.messages[0].content).toBe('abcdefghij');
    expect(context.summary).toEqual(expect.objectContaining({
      totalChars: 10,
      truncated: true,
    }));
  });

  it('applies the total character limit to the most recent context window', () => {
    const context = build([
      message({ id: '00000000-0000-0000-0000-000000000701', content: '1111111111' }),
      message({ id: '00000000-0000-0000-0000-000000000702', content: '2222222222' }),
      message({ id: '00000000-0000-0000-0000-000000000703', content: '3333333333' }),
    ], { ...baseConfig, maxTotalChars: 15 });

    expect(context.messages.map((item) => item.content)).toEqual(['22222', '3333333333']);
    expect(context.summary).toEqual(expect.objectContaining({
      totalChars: 15,
      truncated: true,
    }));
  });

  it('keeps only allowed roles and excludes system messages', () => {
    const context = build([
      message({ role: 'system', content: 'Prompt interno' }),
      message({ role: 'assistant', userId: null, content: 'Resposta segura' }),
    ]);

    expect(context.messages).toHaveLength(1);
    expect(context.messages[0]).toEqual(expect.objectContaining({
      role: 'assistant',
      content: 'Resposta segura',
    }));
    expect(JSON.stringify(context)).not.toContain('Prompt interno');
  });

  it('enforces tenant, workspace, assistant, conversation and owner isolation', () => {
    const context = build([
      message({ content: 'Mensagem correta' }),
      message({ tenantId: '00000000-0000-0000-0000-000000000011', content: 'Tenant errado' }),
      message({ workspaceId: '00000000-0000-0000-0000-000000000021', content: 'Workspace errado' }),
      message({ assistantId: '00000000-0000-0000-0000-000000000102', content: 'Assistant errado' }),
      message({ conversationId: '00000000-0000-0000-0000-000000000502', content: 'Conversa errada' }),
      message({ userId: '00000000-0000-0000-0000-000000000002', content: 'Usuario errado' }),
    ]);

    expect(context.messages.map((item) => item.content)).toEqual(['Mensagem correta']);
    expect(JSON.stringify(context)).not.toMatch(/errado|errada/i);
  });

  it('excludes the current input to avoid duplicating the AgentRun input', () => {
    const context = build([
      message({ id: '00000000-0000-0000-0000-000000000701', content: 'Mensagem anterior' }),
      message({ id: currentMessageId, content: 'Mensagem atual' }),
    ]);

    expect(context.messages.map((item) => item.messageId)).toEqual(['00000000-0000-0000-0000-000000000701']);
    expect(context.messages.map((item) => item.content)).not.toContain('Mensagem atual');
  });

  it('redacts obvious secret-shaped strings from message content', () => {
    const context = build([
      message({ content: 'Use Bearer abc123456789 e sk-1234567890abcdef aqui' }),
    ]);

    expect(context.messages[0].content).toContain('Bearer [redacted]');
    expect(context.messages[0].content).toContain('sk-[redacted]');
    expect(context.messages[0].content).not.toContain('abc123456789');
    expect(context.messages[0].content).not.toContain('sk-1234567890abcdef');
  });

  it('does not build runtime context when the backend flag disables context', () => {
    const context = build([
      message({ content: 'Mensagem anterior' }),
    ], { ...baseConfig, enabled: false });

    expect(context.summary.enabled).toBe(false);
    expect(context.summary.included).toBe(false);
    expect(toRuntimeConversationContext(context)).toBeUndefined();
    expect(chatConversationContextQueryLimit({ ...baseConfig, enabled: false })).toBe(0);
  });
});
