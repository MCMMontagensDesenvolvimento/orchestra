import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  useAssistant: vi.fn(),
  useAssistantActivePublication: vi.fn(),
  useChatConversations: vi.fn(),
  useChatConversation: vi.fn(),
  useCreateChatConversationMutation: vi.fn(),
  useSendChatMessageMutation: vi.fn(),
  useArchiveChatConversationMutation: vi.fn(),
  useAgentRunEvents: vi.fn(),
}));

vi.mock('@/components/shared/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/hooks/queries/useAssistants', () => ({
  useAssistants: vi.fn(),
  useAssistant: mocks.useAssistant,
  useAssistantActivePublication: mocks.useAssistantActivePublication,
}));
vi.mock('@/hooks/queries/useChatConversations', () => ({
  useChatConversations: mocks.useChatConversations,
  useChatConversation: mocks.useChatConversation,
  useCreateChatConversationMutation: mocks.useCreateChatConversationMutation,
  useSendChatMessageMutation: mocks.useSendChatMessageMutation,
  useArchiveChatConversationMutation: mocks.useArchiveChatConversationMutation,
}));
vi.mock('@/hooks/queries/useAgentRuns', () => ({ useAgentRunEvents: mocks.useAgentRunEvents }));

import ChatPage from './ChatPage';

const result = (data: unknown) => ({
  data, isLoading: false, isError: false, isFetching: false, error: null, refetch: vi.fn(),
});

const assistant = {
  id: 'assistant-1', name: 'Assistente de Teste', status: 'published',
  model: 'gpt-4o-mini', version: '1.0.0',
  activePublication: { id: 'publication-1', status: 'active' },
};

const now = new Date();
const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);
const conversations = [
  {
    id: 'conversation-1', title: 'Conversa de hoje', updatedAt: now.toISOString(),
    archivedAt: null, lastMessage: 'Mensagem mais recente', messageCount: 2,
  },
  {
    id: 'conversation-2', title: 'Conversa de ontem', updatedAt: yesterday.toISOString(),
    archivedAt: null, lastMessage: 'Mensagem anterior', messageCount: 1,
  },
];

function renderChat(entry = '/app/chat/assistant-1?conversationId=conversation-1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/app/chat/:assistantId" element={<ChatPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('VIS-05B — conversa em andamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAssistant.mockReturnValue(result(assistant));
    mocks.useAssistantActivePublication.mockReturnValue(result(assistant.activePublication));
    mocks.useChatConversations.mockReturnValue(result(conversations));
    mocks.useChatConversation.mockReturnValue(result({
      id: 'conversation-1', archivedAt: null,
      messages: [
        { id: 'm1', role: 'user', content: 'Pergunta real do usuário', createdAt: now.toISOString(), agentRun: null },
        { id: 'm2', role: 'assistant', content: 'Resposta persistida do assistente', createdAt: now.toISOString(), agentRun: null },
      ],
    }));
    mocks.useCreateChatConversationMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useSendChatMessageMutation.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
    mocks.useArchiveChatConversationMutation.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
    mocks.useAgentRunEvents.mockReturnValue(result([]));
  });

  it('apresenta histórico compacto agrupado por dia e cabeçalho funcional', () => {
    renderChat();
    expect(screen.getByRole('heading', { name: 'Conversas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Hoje' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ontem' })).toBeInTheDocument();
    expect(screen.getByText('Conversa de hoje')).toBeInTheDocument();
    expect(screen.getByText('Conversa de ontem')).toBeInTheDocument();
    expect(screen.getByText('Detalhes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Trocar assistente' })).toHaveAttribute('href', '/app/chat');
    expect(screen.getByText('Publicacao ativa')).toBeInTheDocument();
  });

  it('filtra conversas sem arquivar ou modificar as existentes', () => {
    renderChat();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar conversas' }), { target: { value: 'ontem' } });
    expect(screen.queryByText('Conversa de hoje')).not.toBeInTheDocument();
    expect(screen.getByText('Conversa de ontem')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arquivar conversa' })).toBeInTheDocument();
  });

  it('distingue visualmente usuário e assistente, mantendo a resposta real', () => {
    renderChat();
    expect(screen.getByTestId('chat-message-user')).toHaveTextContent('Pergunta real do usuário');
    expect(screen.getByTestId('chat-message-assistant')).toHaveTextContent('Resposta persistida do assistente');
    expect(screen.getByRole('button', { name: 'Copiar resposta' })).toBeInTheDocument();
  });

  it('preserva Enter para enviar e Shift+Enter para não enviar', async () => {
    const send = vi.fn().mockResolvedValue({});
    mocks.useSendChatMessageMutation.mockReturnValue({ mutateAsync: send, isPending: false });
    renderChat();
    const composer = screen.getByRole('textbox', { name: 'Mensagem' });
    fireEvent.change(composer, { target: { value: 'Linha 1\nLinha 2' } });
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter', shiftKey: true });
    expect(send).not.toHaveBeenCalled();
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(send).toHaveBeenCalledWith({
      conversationId: 'conversation-1', input: 'Linha 1\nLinha 2',
    }));
  });
});
