import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { CurrentSession } from '@/types';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
  useCurrentSession: vi.fn(),
  useLogoutMutation: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/hooks/queries/useAuth', () => ({
  useCurrentSession: mocks.useCurrentSession,
  useLogoutMutation: mocks.useLogoutMutation,
}));

import {
  APP_SIDEBAR_COLLAPSED_STORAGE_KEY,
  AppShell,
} from './AppShell';
import { AppTopbar } from './AppTopbar';

const session: CurrentSession = {
  user: {
    id: 'user-1',
    name: 'Maria Silva',
    email: 'maria.silva@empresa.com',
  },
  tenant: {
    id: 'tenant-1',
    name: 'MCM',
    slug: 'mcm',
  },
  workspaces: [
    {
      id: 'workspace-1',
      tenantId: 'tenant-1',
      name: 'Principal',
      slug: 'principal',
      role: 'admin',
    },
  ],
  roles: ['admin_platform'],
  permissions: [],
};

describe('AppShell governance hardening', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.logout.mockResolvedValue(undefined);
    mocks.useCurrentSession.mockReturnValue({ data: session });
    mocks.useLogoutMutation.mockReturnValue({
      mutateAsync: mocks.logout,
      isPending: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('opens the user menu without logging out and exposes logout only as an explicit action', async () => {
    render(
      <MemoryRouter>
        <AppTopbar onToggleSidebar={vi.fn()} />
      </MemoryRouter>,
    );

    const userMenu = screen.getByRole('button', { name: 'Abrir menu do usuário' });
    userMenu.focus();
    fireEvent.keyDown(userMenu, { key: 'Enter', code: 'Enter' });

    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(await screen.findByText('maria.silva@empresa.com')).toBeInTheDocument();
    expect(screen.getByText('Papel: admin platform')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Sair' }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/login', { replace: true }));
  });

  it('shows non-interactive honest states for search, notifications and tenant/workspace context', () => {
    render(
      <MemoryRouter>
        <AppTopbar onToggleSidebar={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Busca global em breve')).toHaveTextContent('Busca global em breve');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Sem notificações nesta fase')).toHaveTextContent('Sem notificações nesta fase');
    expect(screen.queryByRole('button', { name: /notifica/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Contexto atual: tenant MCM, workspace Principal')).toHaveTextContent(
      'MCM / Principal',
    );
  });

  it('restores and persists the desktop sidebar collapsed state in localStorage', () => {
    window.localStorage.setItem(APP_SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');

    const firstRender = render(
      <MemoryRouter>
        <AppShell><div>Conteúdo</div></AppShell>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expandir sidebar' }));
    expect(window.localStorage.getItem(APP_SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('false');

    firstRender.unmount();
    render(
      <MemoryRouter>
        <AppShell><div>Conteúdo</div></AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Colapsar sidebar' })).toBeInTheDocument();
  });
});
