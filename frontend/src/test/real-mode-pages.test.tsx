import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const useAssistants = vi.hoisted(() => vi.fn());
const useAssistant = vi.hoisted(() => vi.fn());
const useAssistantActivePublication = vi.hoisted(() => vi.fn());
const useCreateAgentRunMutation = vi.hoisted(() => vi.fn());
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
vi.mock('@/hooks/queries/useAgentRuns', () => ({ useCreateAgentRunMutation }));
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

const renderChatRoute = () => render(
  <MemoryRouter initialEntries={['/app/chat/assistant-1']}>
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
    useCreateAgentRunMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
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

  it('renders the real AgentRun chat instead of the prototype placeholder', () => {
    renderChatRoute();

    expect(screen.getByText('Assistant real')).toBeInTheDocument();
    expect(screen.getByLabelText('Mensagem')).toBeInTheDocument();
    expect(screen.queryByText(/Chat .* apenas como prot/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Simular estados de IA')).not.toBeInTheDocument();
    expect(useAssistant).toHaveBeenCalledWith('assistant-1');
    expect(useAssistantActivePublication).toHaveBeenCalledWith('assistant-1');
  });

  it('submits chat messages through the AgentRun mutation contract', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
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
        runtime: {
          provider: 'local',
          status: 'completed',
          outputPreview: 'Resposta real do assistant',
        },
      },
      createdAt: '2026-07-03T12:00:00.000Z',
      updatedAt: '2026-07-03T12:00:01.000Z',
    });
    useCreateAgentRunMutation.mockReturnValue({ mutateAsync, isPending: false });

    renderChatRoute();

    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Ola' } });
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        assistantId: 'assistant-1',
        input: {
          mode: 'published',
          input: 'Ola',
          source: 'frontend-chat',
          metadata: {
            origin: 'chat-ui',
            assistantId: 'assistant-1',
            route: '/app/chat/assistant-1',
          },
        },
      });
    });
    expect(await screen.findByText('Resposta real do assistant')).toBeInTheDocument();
  });
});
