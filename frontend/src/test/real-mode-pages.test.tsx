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
    runtime: {
      provider: 'local',
      status: 'completed',
      outputPreview: 'Resposta real do assistant',
      protocolVersion: 'orchestra.runtime.assistant.v1',
      specVersion: 'orchestra.runtime.assistant.v1',
      latencyMs: 42,
      externalProviderCalled: false,
      externalMcpCalled: false,
      toolCallsExecuted: 0,
      ragSourceCount: 0,
      ragContextChars: 0,
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
    useAssistantRuns.mockReturnValue(queryResult([historyRun]));
    useAgentRunEvents.mockReturnValue(queryResult([]));
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
    expect(screen.getByText('Publicacao ativa')).toBeInTheDocument();
    expect(screen.getByText('orchestra-runtime')).toBeInTheDocument();
    expect(screen.getByLabelText('Mensagem')).toBeInTheDocument();
    expect(screen.getByText('Conversa pronta para homologacao')).toBeInTheDocument();
    expect(screen.getByText('Ultimos runs')).toBeInTheDocument();
    expect(screen.getByText('Validar regra fiscal')).toBeInTheDocument();
    expect(screen.queryByText(/Chat .* apenas como prot/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Simular estados de IA')).not.toBeInTheDocument();
    expect(useAssistant).toHaveBeenCalledWith('assistant-1');
    expect(useAssistantActivePublication).toHaveBeenCalledWith('assistant-1');
  });

  it('submits chat messages through the AgentRun mutation contract', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(agentRun());
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

  it('shows a safe fallback when a completed run has no textual response', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(agentRun({ metadata: { runtime: { provider: 'local', status: 'completed' } } }));
    useCreateAgentRunMutation.mockReturnValue({ mutateAsync, isPending: false });

    renderChatRoute();

    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Sem texto' } });
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));

    expect(await screen.findByText(/Nao houve campo textual publico claro/i)).toBeInTheDocument();
    expect(screen.getByText(/runId=run-1 requestId=req-1/i)).toBeInTheDocument();
  });

  it('shows policy blocks as governed blocks with precheck reasons', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(agentRun({
      status: 'blocked',
      errorCode: 'NO_ACTIVE_PUBLICATION',
      errorMessage: 'O assistente nao possui publicacao ativa.',
      precheckSnapshot: {
        canExecute: false,
        mode: 'published',
        requestId: 'req-1',
        reasons: [
          { code: 'NO_ACTIVE_PUBLICATION', message: 'O assistente nao possui publicacao ativa.' },
        ],
      },
      metadata: { runtime: { provider: 'local', status: 'blocked' } },
    }));
    useCreateAgentRunMutation.mockReturnValue({ mutateAsync, isPending: false });

    renderChatRoute();

    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Bloquear' } });
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));

    expect(await screen.findByText(/Execucao bloqueada por policy governada/i)).toBeInTheDocument();
    expect(screen.getByText(/Codigo: NO_ACTIVE_PUBLICATION/i)).toBeInTheDocument();
    expect(screen.getByText(/NO_ACTIVE_PUBLICATION: O assistente nao possui publicacao ativa/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar/i })).toBeInTheDocument();
  });

  it('shows failed runs with safe error and request id', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(agentRun({
      status: 'failed',
      errorCode: 'RUNTIME_UNAVAILABLE',
      errorMessage: 'Runtime indisponivel.',
      metadata: { runtime: { provider: 'local', status: 'failed' } },
    }));
    useCreateAgentRunMutation.mockReturnValue({ mutateAsync, isPending: false });

    renderChatRoute();

    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Falhar' } });
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));

    expect(await screen.findByText(/Nao foi possivel concluir a execucao/i)).toBeInTheDocument();
    expect(screen.getByText(/Codigo: RUNTIME_UNAVAILABLE/i)).toBeInTheDocument();
    expect(screen.getByText(/requestId=req-1/i)).toBeInTheDocument();
  });

  it('shows safe technical details for a run', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(agentRun());
    useCreateAgentRunMutation.mockReturnValue({ mutateAsync, isPending: false });

    renderChatRoute();

    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Detalhes' } });
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));

    await screen.findByText('Resposta real do assistant');
    fireEvent.click(screen.getByText('Detalhes tecnicos'));

    expect(screen.getByText('runId')).toBeInTheDocument();
    expect(screen.getByText('run-1')).toBeInTheDocument();
    expect(screen.getByText('requestId')).toBeInTheDocument();
    expect(screen.getByText('req-1')).toBeInTheDocument();
    expect(screen.getByText('traceId')).toBeInTheDocument();
    expect(screen.getByText('trace-1')).toBeInTheDocument();
    expect(screen.getByText('runtime provider')).toBeInTheDocument();
    expect(screen.getByText('local')).toBeInTheDocument();
  });

  it('loads run events on demand from the AgentRun events hook', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(agentRun());
    useCreateAgentRunMutation.mockReturnValue({ mutateAsync, isPending: false });
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

    renderChatRoute();

    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Eventos' } });
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));

    await screen.findByText('Resposta real do assistant');
    fireEvent.click(screen.getByText('Detalhes tecnicos'));
    fireEvent.click(screen.getByRole('button', { name: 'Carregar eventos' }));

    expect(await screen.findByText('run.precheck_passed')).toBeInTheDocument();
    expect(screen.getByText('Precheck aprovado.')).toBeInTheDocument();
    expect(useAgentRunEvents).toHaveBeenCalledWith('run-1');
  });
});
