import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  useAssistants: vi.fn(),
  useCurrentSession: vi.fn(),
  usePublishAssistantMutation: vi.fn(),
  useUnpublishAssistantMutation: vi.fn(),
  useArchiveAssistantMutation: vi.fn(),
  useRestoreAssistantMutation: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: { useMocks: false, mockModeAllowed: false } }));
vi.mock('@/components/shared/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/hooks/queries/useAssistants', () => ({
  useAssistants: mocks.useAssistants,
  usePublishAssistantMutation: mocks.usePublishAssistantMutation,
  useUnpublishAssistantMutation: mocks.useUnpublishAssistantMutation,
  useArchiveAssistantMutation: mocks.useArchiveAssistantMutation,
  useRestoreAssistantMutation: mocks.useRestoreAssistantMutation,
}));
vi.mock('@/hooks/queries/useAuth', () => ({ useCurrentSession: mocks.useCurrentSession }));

import AssistantsPage from './AssistantsPage';

const assistants = [
  {
    id: 'a1', name: 'Orchestra — Validador RAG', description: 'Valida conhecimento documental.',
    area: 'TI', owner: 'Maria', status: 'published', model: 'gpt-4o-mini',
    version: '0.1.0', conversations: 0, costThisMonth: 0, satisfaction: 0,
    temperature: 0.2, updatedAt: '2026-11-12T13:00:00.000Z',
  },
  {
    id: 'a2', name: 'Orchestra Corporate Readonly HML', description: 'Integração corporativa governada.',
    area: 'Operações', owner: 'Maria', status: 'draft', model: 'not-configured',
    version: '0.1.0', conversations: 0, costThisMonth: 0, satisfaction: 0,
    temperature: 0.2, updatedAt: '2026-11-14T13:00:00.000Z',
  },
];

const renderCatalog = () => render(<MemoryRouter initialEntries={['/app/assistants']}><AssistantsPage /></MemoryRouter>);

describe('VIS-03 catálogo de assistentes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAssistants.mockReturnValue({
      data: assistants, isLoading: false, isError: false, error: null, refetch: vi.fn(),
    });
    mocks.useCurrentSession.mockReturnValue({ data: { permissions: [
      'assistants.read', 'assistants.create', 'assistants.update', 'assistants.publish',
      'assistants.unpublish', 'assistants.archive', 'assistants.restore',
    ] } });
    const mutation = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
    mocks.usePublishAssistantMutation.mockReturnValue(mutation);
    mocks.useUnpublishAssistantMutation.mockReturnValue(mutation);
    mocks.useArchiveAssistantMutation.mockReturnValue(mutation);
    mocks.useRestoreAssistantMutation.mockReturnValue(mutation);
  });

  afterEach(() => { cleanup(); });

  it('apresenta banner corporativo, criação e abas com contagens reais', () => {
    renderCatalog();
    expect(screen.getByRole('heading', { name: 'Assistentes' })).toBeInTheDocument();
    expect(screen.getByText('Gerencie e acompanhe os assistentes de IA da MCM.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Criar Assistente/i })).toHaveAttribute('href', '/app/assistants/new');
    expect(screen.getByRole('button', { name: /Todos\s*2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publicados\s*1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rascunhos\s*1/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Orchestra — Validador RAG' })).toHaveAttribute('href', '/app/assistants/a1');
    expect(screen.getByRole('link', { name: 'Orchestra Corporate Readonly HML' })).toHaveAttribute('href', '/app/assistants/a2');
  });

  it('filtra por abas sem perder os demais estados', () => {
    renderCatalog();
    fireEvent.click(screen.getByRole('button', { name: /Publicados\s*1/i }));
    expect(screen.getByText('Orchestra — Validador RAG')).toBeInTheDocument();
    expect(screen.queryByText('Orchestra Corporate Readonly HML')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Rascunhos\s*1/i }));
    expect(screen.queryByText('Orchestra — Validador RAG')).not.toBeInTheDocument();
    expect(screen.getByText('Orchestra Corporate Readonly HML')).toBeInTheDocument();
  });

  it('mantém busca, filtros por área real e visualização em tabela', () => {
    renderCatalog();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar assistentes' }), { target: { value: 'RAG' } });
    expect(screen.getByText('Orchestra — Validador RAG')).toBeInTheDocument();
    expect(screen.queryByText('Orchestra Corporate Readonly HML')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }));
    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Operações' }));
    expect(screen.queryByText('Orchestra — Validador RAG')).not.toBeInTheDocument();
    expect(screen.getByText('Orchestra Corporate Readonly HML')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar tabela' }));
    expect(screen.getByRole('columnheader', { name: /Assistente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Visualizar tabela' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('não apresenta métricas de uso simuladas como valores confirmados na API real', () => {
    renderCatalog();
    expect(screen.getAllByText('— conversas')).toHaveLength(2);
    expect(screen.getAllByText('— custo')).toHaveLength(2);
    expect(screen.queryByText('R$ 0')).not.toBeInTheDocument();
    expect(screen.getByText('Modelo não configurado')).toBeInTheDocument();
  });
});
