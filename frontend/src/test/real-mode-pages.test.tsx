import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const useAssistants = vi.hoisted(() => vi.fn());
const useAssistant = vi.hoisted(() => vi.fn());
const useAssistantActivePublication = vi.hoisted(() => vi.fn());
const useCreateAgentRunMutation = vi.hoisted(() => vi.fn());
const useAssistantRuns = vi.hoisted(() => vi.fn());
const useAgentRunEvents = vi.hoisted(() => vi.fn());
const useChatConversations = vi.hoisted(() => vi.fn());
const useChatConversation = vi.hoisted(() => vi.fn());
const useCreateChatConversationMutation = vi.hoisted(() => vi.fn());
const useSendChatMessageMutation = vi.hoisted(() => vi.fn());
const useArchiveChatConversationMutation = vi.hoisted(() => vi.fn());
const useAuditLogs = vi.hoisted(() => vi.fn());
const useAnalytics = vi.hoisted(() => vi.fn());
const useMcpTools = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    appEnv: 'test',
    isProductionLike: false,
    useMocks: false,
    mockModeAllowed: true,
    mockModeBlockedReason: null,
    mockDelayMs: 0,
    mockScenario: 'success',
    apiBaseUrl: '/api/v1',
  },
}));

vi.mock('@/components/shared/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/hooks/queries/useAssistants', () => ({
  useAssistants,
  useAssistant,
  useAssistantActivePublication,
}));
vi.mock('@/hooks/queries/useAgentRuns', () => ({
  useAssistantRuns,
  useAgentRunEvents,
  useCreateAgentRunMutation,
}));
vi.mock('@/hooks/queries/useChatConversations', () => ({
  useArchiveChatConversationMutation,
  useChatConversation,
  useChatConversations,
  useCreateChatConversationMutation,
  useSendChatMessageMutation,
}));
vi.mock('@/hooks/queries/useAudit', () => ({ useAuditLogs }));
vi.mock('@/hooks/queries/useAnalytics', () => ({ useAnalytics }));
vi.mock('@/hooks/queries/useMcp', () => ({ useMcpTools }));

import ChatPage from '@/pages/Chat/ChatPage';
import DashboardPage from '@/pages/Dashboard/DashboardPage';

const queryResult = (data: unknown) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
});

const agentRun = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  tenantId: 'tenant-1',
  workspaceId: 'workspace-1',
  assistantId: 'assistant-1',
  assistantPublicationId: 'publication-1',
  requestedById: 'user-1',
  status: 'completed',
  mode: 'published',
  source: 'frontend-chat',
  requestId: 'req-1',
  traceId: 'trace-1',
  metadata: {
    conversationContextSummary: {
      included: true,
      messageCount: 2,
      totalChars: 42,
      truncated: false,
      maxMessages: 12,
      maxMessageChars: 1200,
      maxTotalChars: 6000,
      messages: [
        {
          messageId: 'message-context-secret',
          createdAt: '2026-07-03T11:59:00.000Z',
          content: 'historico bruto nao deve renderizar',
        },
      ],
    },
    runtime: {
      provider: 'local',
      status: 'completed',
      outputPreview: 'Resposta real do assistant',
      protocolVersion: 'orchestra.runtime.assistant.v1',
      specVersion: 'orchestra.runtime.assistant.v1',
      latencyMs: 42,
      conversationContextIncluded: true,
      conversationContextMessageCount: 2,
      conversationContextChars: 42,
      conversationContextTruncated: false,
      externalProviderCalled: false,
      externalMcpCalled: false,
      toolDescriptorCount: 2,
      maxToolCalls: 0,
      toolCallsExecuted: 0,
      approvalRequiredCount: 1,
      ragMode: 'resolved_context',
      ragSourceCount: 2,
      ragContextChars: 320,
      maxRagResults: 5,
      requestSent: true,
      failedClosed: false,
      adapterMetadata: {
        llmProvider: 'openai',
        llmModel: 'gpt-4.1-mini',
        llmLatencyMs: 37,
        externalProviderCalled: true,
        llmSelectionReason: 'assistant_policy_opt_in',
      },
    },
  },
  inputSummary: 'Ola',
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:01.000Z',
  ...overrides,
});

const assistant = {
  id: 'assistant-1',
  name: 'Assistant real',
  description: 'Assistente publicado',
  area: 'workspace-1',
  owner: 'Admin',
  status: 'published',
  model: 'orchestra-runtime',
  fallbackModel: 'orchestra-runtime',
  temperature: 0.2,
  version: '1.0.0',
  conversations: 0,
  costThisMonth: 0,
  satisfaction: 0,
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-03T12:00:00.000Z',
  knowledgeBases: [],
  mcpTools: [],
  activePublication: {
    id: 'publication-1',
    assistantId: 'assistant-1',
    assistantVersionId: 'version-1',
    status: 'active',
    publishedById: 'user-1',
    publishedAt: '2026-07-03T12:00:00.000Z',
  },
};

const historyRun = agentRun({
  id: 'run-history-1',
  inputSummary: 'Validar regra fiscal',
  requestId: 'req-history-1',
  traceId: 'trace-history-1',
});

const chatConversationSummary = {
  id: 'conversation-1',
  tenantId: 'tenant-1',
  workspaceId: 'workspace-1',
  assistantId: 'assistant-1',
  ownerUserId: 'user-1',
  title: 'Minha conversa',
  visibility: 'private',
  archivedAt: null,
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: '2026-07-03T12:05:00.000Z',
  messageCount: 2,
  lastMessage: 'Resposta real do assistant',
  lastMessageAt: '2026-07-03T12:05:00.000Z',
};

const chatConversationDetail = {
  ...chatConversationSummary,
  messages: [
    {
      id: 'message-user-1',
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
      conversationId: 'conversation-1',
      assistantId: 'assistant-1',
      userId: 'user-1',
      role: 'user',
      content: 'Pergunta antiga',
      agentRunId: null,
      createdAt: '2026-07-03T12:04:00.000Z',
      agentRun: null,
    },
    {
      id: 'message-assistant-1',
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
      conversationId: 'conversation-1',
      assistantId: 'assistant-1',
      userId: null,
      role: 'assistant',
      content: 'Resposta real do assistant',
      agentRunId: 'run-1',
      createdAt: '2026-07-03T12:05:00.000Z',
      agentRun: agentRun(),
    },
  ],
};

const renderChatRoute = () => render(
  <MemoryRouter initialEntries={['/app/chat/assistant-1']}>
    <Routes>
      <Route path="/app/chat/:assistantId" element={<ChatPage />} />
    </Routes>
  </MemoryRouter>,
);

const renderChatRouteAt = (entry: string) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/app/chat/:assistantId" element={<ChatPage />} />
    </Routes>
  </MemoryRouter>,
);

describe('critical pages in real API mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAssistants.mockReturnValue(queryResult([assistant]));
    useAssistant.mockReturnValue(queryResult(assistant));
    useAssistantActivePublication.mockReturnValue(queryResult(assistant.activePublication));
    useAssistantRuns.mockReturnValue(queryResult([historyRun]));
    useAgentRunEvents.mockReturnValue(queryResult([]));
    useCreateAgentRunMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useChatConversations.mockReturnValue(queryResult([chatConversationSummary]));
    useChatConversation.mockReturnValue(queryResult({ ...chatConversationSummary, messages: [] }));
    useCreateChatConversationMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        ...chatConversationSummary,
        id: 'conversation-2',
        title: 'Nova conversa',
        messageCount: 0,
        lastMessage: null,
        lastMessageAt: null,
        messages: [],
      }),
      isPending: false,
    });
    useSendChatMessageMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useArchiveChatConversationMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    useAuditLogs.mockReturnValue(queryResult([
      { id: 'audit-1', description: 'assistant created', user: 'Admin', riskLevel: 'low' },
    ]));
    useMcpTools.mockReturnValue(queryResult([
      { id: 'tool-1', name: 'catalog.search' },
    ]));
    useAnalytics.mockReturnValue(queryResult([]));
  });

  it('renders only real API counts on the dashboard', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Assistant real')).toBeInTheDocument();
    expect(screen.getByText('Eventos auditados')).toBeInTheDocument();
    expect(screen.getByText(/Metricas consolidadas/i)).toBeInTheDocument();
    expect(screen.queryByText(/Conversas por dia/i)).not.toBeInTheDocument();
    expect(useAnalytics).not.toHaveBeenCalled();
  });

  it('renders the persistent chat shell instead of the prototype placeholder', () => {
    renderChatRoute();

    expect(screen.getByText('Assistant real')).toBeInTheDocument();
    expect(screen.getByText('Publicacao ativa')).toBeInTheDocument();
    expect(screen.getByText('orchestra-runtime')).toBeInTheDocument();
    expect(screen.getByText('Conversas')).toBeInTheDocument();
    expect(screen.getAllByText('Nova conversa')[0]).toBeInTheDocument();
    expect(screen.getByText('Minha conversa')).toBeInTheDocument();
    expect(screen.getByText('Inicie uma conversa')).toBeInTheDocument();
    expect(screen.queryByText(/Chat .* apenas como prot/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Simular estados de IA')).not.toBeInTheDocument();
    expect(useAssistant).toHaveBeenCalledWith('assistant-1');
    expect(useAssistantActivePublication).toHaveBeenCalledWith('assistant-1');
    expect(useChatConversations).toHaveBeenCalledWith('assistant-1');
  });

  it('creates a new persistent conversation from the chat page', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      ...chatConversationSummary,
      id: 'conversation-2',
      title: 'Nova conversa',
      messageCount: 0,
      lastMessage: null,
      messages: [],
    });
    useCreateChatConversationMutation.mockReturnValue({ mutateAsync, isPending: false });

    renderChatRoute();

    fireEvent.click(screen.getAllByRole('button', { name: /Nova conversa/i })[0]);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ assistantId: 'assistant-1' });
    });
  });

  it('opens an existing conversation and renders persisted messages', () => {
    useChatConversation.mockReturnValue(queryResult(chatConversationDetail));

    renderChatRouteAt('/app/chat/assistant-1?conversationId=conversation-1');

    expect(screen.getByText('Pergunta antiga')).toBeInTheDocument();
    expect(screen.getAllByText('Resposta real do assistant').length).toBeGreaterThan(0);
    expect(useChatConversation).toHaveBeenCalledWith('conversation-1');
  });

  it('submits chat messages through the conversation message endpoint', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      conversation: chatConversationDetail,
      userMessage: chatConversationDetail.messages[0],
      assistantMessage: chatConversationDetail.messages[1],
      run: agentRun(),
    });
    useChatConversation.mockReturnValue(queryResult({ ...chatConversationSummary, messages: [] }));
    useSendChatMessageMutation.mockReturnValue({ mutateAsync, isPending: false });

    renderChatRouteAt('/app/chat/assistant-1?conversationId=conversation-1');

    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Ola' } });
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ conversationId: 'conversation-1', input: 'Ola' });
    });
    expect(mutateAsync.mock.calls[0][0]).not.toHaveProperty('messages');
    expect(mutateAsync.mock.calls[0][0]).not.toHaveProperty('history');
    expect(mutateAsync.mock.calls[0][0]).not.toHaveProperty('conversationContext');
    expect(mutateAsync.mock.calls[0][0]).not.toHaveProperty('tool');
    expect(mutateAsync.mock.calls[0][0]).not.toHaveProperty('toolName');
    expect(mutateAsync.mock.calls[0][0]).not.toHaveProperty('mcpServer');
    expect(mutateAsync.mock.calls[0][0]).not.toHaveProperty('toolArgs');
    expect(mutateAsync.mock.calls[0][0]).not.toHaveProperty('approvalDecision');
    expect(useCreateAgentRunMutation).not.toHaveBeenCalled();
  });

  it('keeps technical details for the AgentRun linked to an assistant message', () => {
    useChatConversation.mockReturnValue(queryResult(chatConversationDetail));

    renderChatRouteAt('/app/chat/assistant-1?conversationId=conversation-1');

    fireEvent.click(screen.getByText('Detalhes tecnicos'));

    expect(screen.getByText('runId')).toBeInTheDocument();
    expect(screen.getByText('run-1')).toBeInTheDocument();
    expect(screen.getByText('requestId')).toBeInTheDocument();
    expect(screen.getByText('req-1')).toBeInTheDocument();
    expect(screen.getByText('traceId')).toBeInTheDocument();
    expect(screen.getByText('trace-1')).toBeInTheDocument();
    expect(screen.getByText('runtime provider')).toBeInTheDocument();
    expect(screen.getByText('local')).toBeInTheDocument();
    expect(screen.getByText('ragMode')).toBeInTheDocument();
    expect(screen.getByText('resolved_context')).toBeInTheDocument();
    expect(screen.getByText('ragSourceCount')).toBeInTheDocument();
    expect(screen.getByText('ragContextChars')).toBeInTheDocument();
    expect(screen.getByText('maxRagResults')).toBeInTheDocument();
    expect(screen.getByText('toolDescriptorCount')).toBeInTheDocument();
    expect(screen.getByText('maxToolCalls')).toBeInTheDocument();
    expect(screen.getByText('toolCallsExecuted')).toBeInTheDocument();
    expect(screen.getByText('approvalRequiredCount')).toBeInTheDocument();
    expect(screen.getByText('Contexto conversacional')).toBeInTheDocument();
    expect(screen.getByText('contexto anexado')).toBeInTheDocument();
    expect(screen.getByText('mensagens')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText('caracteres')).toBeInTheDocument();
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
    expect(screen.getByText('Provider LLM')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('gpt-4.1-mini')).toBeInTheDocument();
    expect(screen.getByText('Provider selecionado por policy')).toBeInTheDocument();
    expect(screen.queryByText('historico bruto nao deve renderizar')).not.toBeInTheDocument();
    expect(screen.queryByText('message-context-secret')).not.toBeInTheDocument();
    expect(screen.queryByText('2026-07-03T11:59:00.000Z')).not.toBeInTheDocument();
  });

  it('archives the selected conversation', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ...chatConversationSummary, archivedAt: '2026-07-03T12:10:00.000Z' });
    useArchiveChatConversationMutation.mockReturnValue({ mutateAsync, isPending: false });
    useChatConversation.mockReturnValue(queryResult(chatConversationDetail));

    renderChatRouteAt('/app/chat/assistant-1?conversationId=conversation-1');

    fireEvent.click(screen.getByLabelText('Arquivar conversa'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('conversation-1');
    });
  });

  it('loads run events on demand from the AgentRun events hook', async () => {
    useChatConversation.mockReturnValue(queryResult(chatConversationDetail));
    useAgentRunEvents.mockReturnValue(queryResult([
      {
        id: 'event-1',
        agentRunId: 'run-1',
        type: 'run.precheck_passed',
        sequence: 2,
        status: 'running',
        message: 'Precheck aprovado.',
        metadata: { provider: 'local', traceId: 'trace-1', externalProviderCalled: false },
        createdAt: '2026-07-03T12:00:00.000Z',
      },
    ]));

    renderChatRouteAt('/app/chat/assistant-1?conversationId=conversation-1');

    fireEvent.click(screen.getByText('Detalhes tecnicos'));
    fireEvent.click(screen.getByRole('button', { name: 'Carregar eventos' }));

    expect(await screen.findByText('run.precheck_passed')).toBeInTheDocument();
    expect(screen.getByText('Precheck aprovado.')).toBeInTheDocument();
    expect(useAgentRunEvents).toHaveBeenCalledWith('run-1');
  });

  it('renders governed conversation context event metadata without raw context payload', async () => {
    useChatConversation.mockReturnValue(queryResult(chatConversationDetail));
    useAgentRunEvents.mockReturnValue(queryResult([
      {
        id: 'event-context',
        agentRunId: 'run-1',
        type: 'run.conversation_context_selected',
        sequence: 3,
        status: 'queued',
        message: 'raw context event message must not render',
        metadata: {
          conversationContext: {
            included: true,
            messageCount: 2,
            totalChars: 42,
            truncated: false,
            limits: {
              maxMessages: 12,
              maxMessageChars: 1200,
              maxTotalChars: 6000,
            },
            messages: [
              {
                messageId: 'message-event-secret',
                createdAt: '2026-07-03T11:59:00.000Z',
                content: 'historico bruto de evento',
              },
            ],
          },
        },
        createdAt: '2026-07-03T12:00:00.000Z',
      },
      {
        id: 'event-provider-unsafe',
        agentRunId: 'run-1',
        type: 'llm.generation_failed',
        sequence: 4,
        status: 'failed',
        message: 'raw provider payload must not render',
        metadata: {
          llmProvider: 'openai',
          rawProviderResponse: 'Authorization: Bearer provider-secret',
        },
        createdAt: '2026-07-03T12:00:01.000Z',
      },
    ]));

    renderChatRouteAt('/app/chat/assistant-1?conversationId=conversation-1');

    fireEvent.click(screen.getByText('Detalhes tecnicos'));
    fireEvent.click(screen.getByRole('button', { name: 'Carregar eventos' }));

    expect(await screen.findByText('run.conversation_context_selected')).toBeInTheDocument();
    expect(screen.getAllByText('contexto anexado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('mensagens').length).toBeGreaterThan(0);
    expect(screen.getAllByText('caracteres').length).toBeGreaterThan(0);
    expect(screen.queryByText('raw context event message must not render')).not.toBeInTheDocument();
    expect(screen.queryByText('historico bruto de evento')).not.toBeInTheDocument();
    expect(screen.queryByText('message-event-secret')).not.toBeInTheDocument();
    expect(screen.queryByText('2026-07-03T11:59:00.000Z')).not.toBeInTheDocument();
    expect(screen.queryByText('raw provider payload must not render')).not.toBeInTheDocument();
    expect(screen.queryByText('Authorization: Bearer provider-secret')).not.toBeInTheDocument();
  });
});
