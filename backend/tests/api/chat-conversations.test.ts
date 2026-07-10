import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => {
  const chatConversationsRepository = {
    findAssistantForConversation: vi.fn(),
    listForAssistant: vi.fn(),
    createConversation: vi.fn(),
    findConversationForOwner: vi.fn(),
    listContextMessagesForConversation: vi.fn(),
    createMessage: vi.fn(),
    updateConversation: vi.fn(),
    archiveConversation: vi.fn(),
  };
  const agentRunsService = {
    createForAssistant: vi.fn(),
  };

  return { chatConversationsRepository, agentRunsService };
});

vi.mock('../../src/modules/chat-conversations/chat-conversations.repository', () => ({
  chatConversationsRepository: mocks.chatConversationsRepository,
}));

vi.mock('../../src/modules/agent-runs/agent-runs.service', () => ({
  agentRunsService: mocks.agentRunsService,
}));

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const userId = '00000000-0000-0000-0000-000000000001';
const otherUserId = '00000000-0000-0000-0000-000000000002';
const assistantId = '00000000-0000-0000-0000-000000000101';
const conversationId = '00000000-0000-0000-0000-000000000501';
const runId = '00000000-0000-0000-0000-000000000601';

const chatPermissions = [
  'assistants.read',
  'agent_runs.create',
  'agent_runs.read',
  'execution.precheck',
  'execution.run_published',
];

const testUser: AuthenticatedUser = {
  id: userId,
  email: 'admin.dev@orchestra.local',
  name: 'Development Admin',
  tenant: {
    id: tenantId,
    name: 'Orchestra Dev Tenant',
    slug: 'orchestra-dev',
  },
  workspaces: [
    {
      id: workspaceId,
      name: 'Default Workspace',
      slug: 'default',
      role: 'admin',
    },
  ],
  roles: ['admin_platform'],
  permissions: chatPermissions,
};

function sessionCookie(user: AuthenticatedUser = testUser) {
  const token = signSession({ sub: user.id, user });
  return `${env.COOKIE_NAME}=${token}`;
}

const createdAt = new Date('2026-07-06T12:00:00.000Z');

function assistantFixture() {
  return {
    id: assistantId,
    tenantId,
    workspaceId,
    status: 'published',
    createdById: userId,
  };
}

function prismaRunFixture() {
  return {
    id: runId,
    tenantId,
    workspaceId,
    assistantId,
    assistantVersionId: null,
    assistantPublicationId: null,
    conversationId,
    requestedById: userId,
    status: 'completed',
    mode: 'published',
    source: 'chat-conversation',
    inputSummary: 'Ola',
    requestId: 'req-chat',
    traceId: 'trace-chat',
    startedAt: createdAt,
    completedAt: createdAt,
    failedAt: null,
    cancelledAt: null,
    blockedAt: null,
    errorCode: null,
    errorMessage: null,
    precheckSnapshot: { canExecute: true, mode: 'published', reasons: [], requestId: 'req-chat' },
    metadata: {
      runtime: {
        provider: 'local',
        status: 'completed',
      },
    },
    createdAt,
    updatedAt: createdAt,
    events: [],
  };
}

function apiRunFixture() {
  return {
    ...prismaRunFixture(),
    startedAt: createdAt.toISOString(),
    completedAt: createdAt.toISOString(),
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    events: [],
  };
}

function messageFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000701',
    tenantId,
    workspaceId,
    conversationId,
    assistantId,
    userId,
    role: 'user',
    content: 'Ola',
    agentRunId: null,
    metadata: null,
    createdAt,
    agentRun: null,
    ...overrides,
  };
}

function conversationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: conversationId,
    tenantId,
    workspaceId,
    assistantId,
    ownerUserId: userId,
    title: 'Nova conversa',
    visibility: 'private',
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
    messages: [],
    _count: { messages: 0 },
    ...overrides,
  };
}

describe('chat conversation endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatConversationsRepository.findAssistantForConversation.mockResolvedValue(assistantFixture());
    mocks.chatConversationsRepository.listForAssistant.mockResolvedValue([
      conversationFixture({
        title: 'Minha conversa',
        messages: [messageFixture({ content: 'Ultima mensagem', createdAt })],
        _count: { messages: 2 },
      }),
    ]);
    mocks.chatConversationsRepository.createConversation.mockResolvedValue(conversationFixture());
    mocks.chatConversationsRepository.findConversationForOwner.mockResolvedValue(conversationFixture());
    mocks.chatConversationsRepository.listContextMessagesForConversation.mockResolvedValue([]);
    mocks.chatConversationsRepository.createMessage.mockImplementation(async (input) =>
      messageFixture({
        id: input.role === 'assistant'
          ? '00000000-0000-0000-0000-000000000702'
          : '00000000-0000-0000-0000-000000000701',
        ...input,
        userId: input.userId ?? null,
        agentRun: input.agentRunId ? prismaRunFixture() : null,
      }),
    );
    mocks.chatConversationsRepository.archiveConversation.mockResolvedValue(conversationFixture({ archivedAt: createdAt }));
    mocks.agentRunsService.createForAssistant.mockImplementation(async (...args) => {
      const options = args[4] as { onRuntimeResult?: (result: { outputPreview?: string }) => void } | undefined;
      options?.onRuntimeResult?.({ outputPreview: 'Resposta persistida do assistente' });
      return apiRunFixture();
    });
  });

  it('creates a private conversation for the authenticated user', async () => {
    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/conversations`)
      .set('Cookie', [sessionCookie()])
      .send({ title: 'Analise fiscal' })
      .expect(201);

    expect(response.body.data.visibility).toBe('private');
    expect(response.body.data.ownerUserId).toBe(userId);
    expect(mocks.chatConversationsRepository.createConversation).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      workspaceId,
      assistantId,
      ownerUserId: userId,
      title: 'Analise fiscal',
      visibility: 'private',
    }));
  });

  it('lists only conversations scoped to tenant, workspace, assistant and owner', async () => {
    const response = await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/conversations`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual(expect.objectContaining({
      assistantId,
      ownerUserId: userId,
      title: 'Minha conversa',
      messageCount: 2,
      lastMessage: 'Ultima mensagem',
    }));
    expect(mocks.chatConversationsRepository.listForAssistant).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      workspaceId,
      assistantId,
      ownerUserId: userId,
      query: expect.objectContaining({ includeArchived: false }),
    }));
  });

  it('uses the authenticated user as owner filter and never another user', async () => {
    await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/conversations`)
      .set('Cookie', [sessionCookie({ ...testUser, id: otherUserId })])
      .expect(200);

    expect(mocks.chatConversationsRepository.listForAssistant).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: otherUserId,
    }));
    expect(mocks.chatConversationsRepository.listForAssistant).not.toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: userId,
    }));
  });

  it('opens a conversation with ordered messages and safe AgentRun data', async () => {
    mocks.chatConversationsRepository.findConversationForOwner.mockResolvedValueOnce(conversationFixture({
      messages: [
        messageFixture({ role: 'user', content: 'Ola', createdAt: new Date('2026-07-06T12:00:00.000Z') }),
        messageFixture({
          id: '00000000-0000-0000-0000-000000000702',
          role: 'assistant',
          userId: null,
          content: 'Resposta persistida do assistente',
          agentRunId: runId,
          agentRun: prismaRunFixture(),
          createdAt: new Date('2026-07-06T12:00:01.000Z'),
        }),
      ],
      _count: { messages: 2 },
    }));

    const response = await request(createApp())
      .get(`/api/v1/chat/conversations/${conversationId}`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data.messages.map((message: { role: string }) => message.role)).toEqual(['user', 'assistant']);
    expect(response.body.data.messages[1].agentRun.id).toBe(runId);
    expect(JSON.stringify(response.body)).not.toMatch(/Authorization|baseUrl|token|secret|rawPrompt|rawResponse/i);
  });

  it('blocks access to conversations owned by another user', async () => {
    mocks.chatConversationsRepository.findConversationForOwner.mockResolvedValueOnce(null);

    const response = await request(createApp())
      .get(`/api/v1/chat/conversations/${conversationId}`)
      .set('Cookie', [sessionCookie()])
      .expect(404);

    expect(response.body.code).toBe('CHAT_CONVERSATION_NOT_FOUND');
  });

  it('sends a message, creates AgentRun through the backend and links assistant message to the run', async () => {
    const userMessage = messageFixture({ role: 'user', content: 'Ola' });
    const assistantMessage = messageFixture({
      id: '00000000-0000-0000-0000-000000000702',
      role: 'assistant',
      userId: null,
      content: 'Resposta persistida do assistente',
      agentRunId: runId,
      agentRun: prismaRunFixture(),
      createdAt: new Date('2026-07-06T12:00:01.000Z'),
    });
    mocks.chatConversationsRepository.findConversationForOwner
      .mockResolvedValueOnce(conversationFixture({ messages: [], _count: { messages: 0 } }))
      .mockResolvedValueOnce(conversationFixture({ messages: [userMessage, assistantMessage], _count: { messages: 2 } }));

    const response = await request(createApp())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Cookie', [sessionCookie()])
      .send({ input: 'Ola' })
      .expect(201);

    expect(mocks.chatConversationsRepository.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      role: 'user',
      content: 'Ola',
      userId,
      conversationUpdate: { title: 'Ola' },
    }));
    expect(mocks.agentRunsService.createForAssistant).toHaveBeenCalledWith(
      assistantId,
      expect.objectContaining({
        mode: 'published',
        input: 'Ola',
        source: 'chat-conversation',
        metadata: {
          origin: 'chat-conversation',
          conversationId,
          assistantId,
          conversationContextSummary: expect.objectContaining({
            enabled: true,
            included: false,
            messageCount: 0,
            totalChars: 0,
          }),
        },
      }),
      expect.objectContaining({ id: userId }),
      expect.objectContaining({ requestId: expect.any(String) }),
      expect.objectContaining({ conversationId, onRuntimeResult: expect.any(Function) }),
    );
    expect(mocks.chatConversationsRepository.listContextMessagesForConversation).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      workspaceId,
      assistantId,
      conversationId,
      ownerUserId: userId,
      excludeMessageId: userMessage.id,
      limit: 13,
    }));
    expect(mocks.agentRunsService.createForAssistant.mock.calls[0][4]).toEqual(expect.objectContaining({
      conversationId,
      conversationContext: undefined,
    }));
    expect(JSON.stringify(mocks.agentRunsService.createForAssistant.mock.calls[0][1])).not.toMatch(/fullContext|rawPayload|systemPrompt|previousMessages|messagesToRuntime/i);
    expect(mocks.chatConversationsRepository.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      role: 'assistant',
      content: 'Resposta persistida do assistente',
      agentRunId: runId,
    }));
    expect(response.body.data.assistantMessage.agentRunId).toBe(runId);
    expect(response.body.data.run.id).toBe(runId);
  });

  it('persists the fake Agno LLM output returned by AgentRun as the assistant message', async () => {
    const fakeAgnoOutput = 'Resposta simulada do LLM real executado via Agno.';
    const agnoRun = {
      ...apiRunFixture(),
      metadata: {
        runtime: {
          provider: 'agno_http',
          status: 'completed',
          externalProviderCalled: true,
        },
      },
    };
    mocks.agentRunsService.createForAssistant.mockImplementationOnce(async (...args) => {
      const options = args[4] as { onRuntimeResult?: (result: { outputPreview?: string }) => void } | undefined;
      options?.onRuntimeResult?.({ outputPreview: fakeAgnoOutput });
      return agnoRun;
    });
    mocks.chatConversationsRepository.findConversationForOwner
      .mockResolvedValueOnce(conversationFixture({ messages: [], _count: { messages: 0 } }))
      .mockResolvedValueOnce(conversationFixture({ messages: [], _count: { messages: 2 } }));

    const response = await request(createApp())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Cookie', [sessionCookie()])
      .send({ input: 'Pergunta atual enviada somente pelo frontend.' })
      .expect(201);

    expect(mocks.agentRunsService.createForAssistant).toHaveBeenCalledWith(
      assistantId,
      expect.objectContaining({
        input: 'Pergunta atual enviada somente pelo frontend.',
        source: 'chat-conversation',
      }),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ onRuntimeResult: expect.any(Function) }),
    );
    expect(mocks.chatConversationsRepository.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      role: 'assistant',
      content: fakeAgnoOutput,
      agentRunId: runId,
    }));
    expect(response.body.data.run.metadata.runtime).toEqual(expect.objectContaining({
      provider: 'agno_http',
      externalProviderCalled: true,
    }));
  });

  it('sends a second message with backend-governed conversation context only in AgentRun options', async () => {
    const previousUserMessage = messageFixture({
      id: '00000000-0000-0000-0000-000000000711',
      role: 'user',
      content: 'Primeira pergunta',
      createdAt: new Date('2026-07-06T12:00:00.000Z'),
    });
    const previousAssistantMessage = messageFixture({
      id: '00000000-0000-0000-0000-000000000712',
      role: 'assistant',
      userId: null,
      content: 'Primeira resposta',
      createdAt: new Date('2026-07-06T12:00:01.000Z'),
    });
    const currentUserMessage = messageFixture({
      id: '00000000-0000-0000-0000-000000000713',
      role: 'user',
      content: 'Segunda pergunta',
      createdAt: new Date('2026-07-06T12:01:00.000Z'),
    });
    const assistantMessage = messageFixture({
      id: '00000000-0000-0000-0000-000000000714',
      role: 'assistant',
      userId: null,
      content: 'Resposta persistida do assistente',
      agentRunId: runId,
      agentRun: prismaRunFixture(),
      createdAt: new Date('2026-07-06T12:01:01.000Z'),
    });

    mocks.chatConversationsRepository.findConversationForOwner
      .mockResolvedValueOnce(conversationFixture({
        title: 'Primeira pergunta',
        messages: [previousUserMessage, previousAssistantMessage],
        _count: { messages: 2 },
      }))
      .mockResolvedValueOnce(conversationFixture({
        title: 'Primeira pergunta',
        messages: [previousUserMessage, previousAssistantMessage, currentUserMessage, assistantMessage],
        _count: { messages: 4 },
      }));
    mocks.chatConversationsRepository.createMessage.mockImplementation(async (input) => (
      input.role === 'user'
        ? { ...currentUserMessage, ...input, agentRun: null }
        : { ...assistantMessage, ...input, userId: null, agentRun: prismaRunFixture() }
    ));
    mocks.chatConversationsRepository.listContextMessagesForConversation.mockResolvedValue([
      previousAssistantMessage,
      previousUserMessage,
    ]);

    await request(createApp())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Cookie', [sessionCookie()])
      .send({ input: 'Segunda pergunta' })
      .expect(201);

    const runInput = mocks.agentRunsService.createForAssistant.mock.calls[0][1];
    const runOptions = mocks.agentRunsService.createForAssistant.mock.calls[0][4];

    expect(runInput.input).toBe('Segunda pergunta');
    expect(runInput.metadata.conversationContextSummary).toEqual(expect.objectContaining({
      included: true,
      messageCount: 2,
      totalChars: 'Primeira pergunta'.length + 'Primeira resposta'.length,
      truncated: false,
    }));
    expect(runOptions.conversationContext.messages.map((message: { role: string; content: string }) => ({
      role: message.role,
      content: message.content,
    }))).toEqual([
      { role: 'user', content: 'Primeira pergunta' },
      { role: 'assistant', content: 'Primeira resposta' },
    ]);
    expect(runOptions.conversationContext.messages.map((message: { messageId: string }) => message.messageId)).not.toContain(currentUserMessage.id);
    expect(JSON.stringify(runOptions.conversationContext)).not.toMatch(/metadata|agentRun|rawPayload|systemPrompt/i);
  });

  it('does not accept new messages in archived conversations', async () => {
    mocks.chatConversationsRepository.findConversationForOwner.mockResolvedValueOnce(conversationFixture({ archivedAt: createdAt }));

    const response = await request(createApp())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Cookie', [sessionCookie()])
      .send({ input: 'Mensagem bloqueada' })
      .expect(409);

    expect(response.body.code).toBe('CHAT_CONVERSATION_ARCHIVED');
    expect(mocks.chatConversationsRepository.createMessage).not.toHaveBeenCalled();
    expect(mocks.agentRunsService.createForAssistant).not.toHaveBeenCalled();
  });

  it('archives a conversation without deleting messages or AgentRuns', async () => {
    const response = await request(createApp())
      .post(`/api/v1/chat/conversations/${conversationId}/archive`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data.archivedAt).toBe(createdAt.toISOString());
    expect(mocks.chatConversationsRepository.archiveConversation).toHaveBeenCalledWith(conversationId, expect.any(Date));
  });
});
