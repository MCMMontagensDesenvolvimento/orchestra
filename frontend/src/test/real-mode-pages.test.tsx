import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const useAssistants = vi.hoisted(() => vi.fn());
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

vi.mock('@/hooks/queries/useAssistants', () => ({ useAssistants }));
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
  refetch: vi.fn(),
});

describe('critical pages in real API mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAssistants.mockReturnValue(queryResult([
      { id: 'assistant-1', name: 'Assistant real', owner: 'Admin', status: 'published' },
    ]));
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

  it('shows an explicit prototype state instead of demo chat content', () => {
    render(<ChatPage />);

    expect(screen.getByText(/Chat .* apenas como prot/i)).toBeInTheDocument();
    expect(screen.getByText(/tool calls de demonstra/i)).toBeInTheDocument();
    expect(screen.queryByText('Simular estados de IA')).not.toBeInTheDocument();
    expect(useAssistants).not.toHaveBeenCalled();
  });
});
