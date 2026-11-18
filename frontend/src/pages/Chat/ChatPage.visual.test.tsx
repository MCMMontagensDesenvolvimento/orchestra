import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  useAssistants: vi.fn(),
  useCurrentSession: vi.fn(),
  useRecentHomeConversations: vi.fn(),
}));

vi.mock('@/components/shared/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/hooks/queries/useAssistants', () => ({
  useAssistants: mocks.useAssistants,
  useAssistant: vi.fn(),
  useAssistantActivePublication: vi.fn(),
}));
vi.mock('@/hooks/queries/useAuth', () => ({ useCurrentSession: mocks.useCurrentSession }));
vi.mock('@/hooks/queries/useRecentHomeConversations', () => ({
  useRecentHomeConversations: mocks.useRecentHomeConversations,
}));

import ChatPage from './ChatPage';

const query = (data: unknown) => ({
  data, isLoading: false, isError: false, isFetching: false, error: null, refetch: vi.fn(),
});

const activeAssistant = {
  id: 'assistant-1', name: 'Assistente de Projetos', description: 'Apoia o planejamento de obras',
  area: 'Operações', status: 'published', model: 'gpt-4o-mini',
  workspaceId: 'workspace-1', activePublication: { id: 'publication-1', status: 'active' },
};
const inactiveAssistant = {
  ...activeAssistant, id: 'assistant-2', name: 'Assistente sem publicação', activePublication: null,
};
const conversations = [
  { id: 'conversation-1', assistantId: 'assistant-1', assistantName: 'Assistente de Projetos',
    title: 'Relatório semanal', updatedAt: '2026-11-16T12:00:00Z' },
  { id: 'conversation-2', assistantId: 'assistant-1', assistantName: 'Assistente de Projetos',
    title: 'Acompanhamento de obra', updatedAt: '2026-11-15T12:00:00Z' },
];

function renderCatalog(path = '/app/chat') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/app/chat" element={<ChatPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('VIS-05 catálogo Minhas conversas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAssistants.mockReturnValue(query([activeAssistant, inactiveAssistant]));
    mocks.useCurrentSession.mockReturnValue(query({
      user: { id: 'user-1' }, workspaces: [{ id: 'workspace-1' }],
      permissions: ['assistants.read', 'agent_runs.read', 'agent_runs.create'],
    }));
    mocks.useRecentHomeConversations.mockReturnValue({
      items: conversations, isLoading: false, isError: false, isPartialError: false, refresh: vi.fn(),
    });
  });

  it('exibe banner sem mascote, assistentes utilizáveis e conversas reais', () => {
    renderCatalog();
    expect(screen.getByRole('heading', { name: 'Minhas conversas' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar assistentes ou conversas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Assistente de Projetos' })).toBeInTheDocument();
    expect(screen.queryByText('Assistente sem publicação')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Iniciar conversa/i })).toHaveAttribute('href', '/app/chat/assistant-1');
    expect(screen.getByText('Relatório semanal').closest('a')).toHaveAttribute('href',
      '/app/chat/assistant-1?conversationId=conversation-1');
    expect(mocks.useRecentHomeConversations).toHaveBeenCalledWith(
      expect.any(Array), 'user-1', ['workspace-1'], true, 50,
    );
  });

  it('filtra assistentes e conversas por busca, ignorando acentos', () => {
    renderCatalog();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar assistentes ou conversas' }), {
      target: { value: 'relatorio' },
    });
    expect(screen.getByText('Relatório semanal')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Iniciar conversa/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Acompanhamento de obra')).not.toBeInTheDocument();
  });

  it('alterna entre Recentes e Assistentes publicados usando a rota real', () => {
    renderCatalog();
    fireEvent.click(screen.getByRole('button', { name: 'Recentes' }));
    expect(screen.getByText('Relatório semanal')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Iniciar conversa/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Assistentes publicados' }));
    expect(screen.getByRole('link', { name: /Iniciar conversa/i })).toBeInTheDocument();
    expect(screen.queryByText('Relatório semanal')).not.toBeInTheDocument();
  });

  it('não exibe histórico sem permissão e bloqueia novos chats', () => {
    mocks.useCurrentSession.mockReturnValue(query({
      user: { id: 'user-1' }, workspaces: [{ id: 'workspace-1' }],
      permissions: ['assistants.read'],
    }));
    renderCatalog();
    expect(screen.queryByText('Relatório semanal')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Iniciar conversa/i })).not.toBeInTheDocument();
    expect(screen.getByText('Sem permissão para iniciar conversas')).toBeInTheDocument();
    expect(mocks.useRecentHomeConversations).toHaveBeenCalledWith(
      [], 'user-1', ['workspace-1'], false, 50,
    );
  });

  it('representa fielmente ausência de históricos e falhas parciais', () => {
    mocks.useRecentHomeConversations.mockReturnValue({
      items: [], isLoading: false, isError: false, isPartialError: true, refresh: vi.fn(),
    });
    renderCatalog();
    expect(screen.getByText(/Você ainda não possui conversas recentes/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Parte do histórico não pôde ser consultada');
  });
});
