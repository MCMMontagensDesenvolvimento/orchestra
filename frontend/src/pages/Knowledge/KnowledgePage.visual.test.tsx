import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  useKnowledgeBases: vi.fn(),
  useArchivedKnowledgeBases: vi.fn(),
  useCreateKnowledgeBaseMutation: vi.fn(),
  useUpdateKnowledgeBaseMutation: vi.fn(),
  useArchiveKnowledgeBaseMutation: vi.fn(),
  useRestoreKnowledgeBaseMutation: vi.fn(),
}));

vi.mock('@/components/shared/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/hooks/queries/useKnowledge', () => mocks);
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import KnowledgePage from './KnowledgePage';

const queryResult = (data: unknown) => ({
  data, isLoading: false, isSuccess: true, isError: false, isFetching: false,
  error: null, refetch: vi.fn(),
});

const base = (overrides: Record<string, unknown> = {}) => ({
  id: 'base-1', tenantId: 'tenant-1', workspaceId: 'workspace-1',
  name: 'Políticas de RH', description: 'Diretrizes internas e processos',
  documentCount: 3, totalChunks: 7, status: 'completed',
  lastUpdated: '17/11/2026', size: '0 MB', assistants: [],
  classification: 'Interno', connectorType: 'upload', embeddingModel: 'placeholder-not-configured',
  chunkSize: 512, chunkOverlap: 64, retention: '2 anos', owner: 'Equipe',
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-17T00:00:00Z',
  ...overrides,
});

const renderPage = () => render(<MemoryRouter><KnowledgePage /></MemoryRouter>);

describe('VIS-04 catálogo de bases de conhecimento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useKnowledgeBases.mockReturnValue(queryResult([base(), base({ id: 'base-2', name: 'Normas de Segurança', classification: 'Confidencial', documentCount: 2 })]));
    mocks.useArchivedKnowledgeBases.mockImplementation((enabled: boolean) => enabled
      ? queryResult([base({ id: 'base-3', name: 'Base arquivada', status: 'archived' })])
      : { ...queryResult(undefined), isSuccess: false });
    const mutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
    mocks.useCreateKnowledgeBaseMutation.mockReturnValue(mutation);
    mocks.useUpdateKnowledgeBaseMutation.mockReturnValue(mutation);
    mocks.useArchiveKnowledgeBaseMutation.mockReturnValue(mutation);
    mocks.useRestoreKnowledgeBaseMutation.mockReturnValue(mutation);
  });

  it('apresenta a identidade Maria com dados reais e estado ativo da base', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Base de Conhecimento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar base de conhecimento/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Todas\s*3/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ativas\s*2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arquivadas\s*1/i })).toBeInTheDocument();
    expect(screen.getByText('Políticas de RH')).toBeInTheDocument();
    expect(screen.getByText('Políticas de RH').closest('article')).toHaveTextContent('3 documentos');
    expect(screen.getAllByText('Ativa')).toHaveLength(2);
    expect(screen.queryByText('Concluído')).not.toBeInTheDocument();
  });

  it('inclui bases ativas e arquivadas em Todas sem duplicar registros', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Todas\s*3/i })).toBeInTheDocument();
    expect(screen.getByText('Políticas de RH')).toBeInTheDocument();
    expect(screen.getByText('Normas de Segurança')).toBeInTheDocument();
    expect(screen.getByText('Base arquivada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ativas\s*2/i }));
    expect(screen.queryByText('Base arquivada')).not.toBeInTheDocument();
  });

  it('filtra bases por busca textual ignorando acentos', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar bases de conhecimento' }), { target: { value: 'seguranca' } });
    expect(screen.getByText('Normas de Segurança')).toBeInTheDocument();
    expect(screen.queryByText('Políticas de RH')).not.toBeInTheDocument();
  });

  it('consulta e apresenta bases arquivadas somente na aba dedicada', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Arquivadas\s*1/i }));
    expect(screen.getByText('Base arquivada')).toBeInTheDocument();
    expect(screen.getByText('Arquivada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurar Base arquivada' })).toBeInTheDocument();
    expect(screen.queryByText('Políticas de RH')).not.toBeInTheDocument();
  });

  it('aciona a restauração real usando a mutation existente', async () => {
    const restore = vi.fn().mockResolvedValue({});
    mocks.useRestoreKnowledgeBaseMutation.mockReturnValue({ mutateAsync: restore, isPending: false });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Arquivadas\s*1/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Base arquivada' }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith('base-3'));
  });

  it('mantém edição, arquivamento e visualização em tabela', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Políticas de RH' }));
    expect(screen.getByRole('dialog', { name: 'Editar Base de Conhecimento' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar Políticas de RH' }));
    expect(screen.getByRole('dialog', { name: 'Arquivar Base de Conhecimento' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar tabela' }));
    expect(screen.getByRole('columnheader', { name: 'Docs' })).toBeInTheDocument();
  });
});
