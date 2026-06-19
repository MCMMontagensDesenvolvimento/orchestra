import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SsoProviderConfig } from '@/types';
import LoginPage from '@/pages/Auth/LoginPage';
import {
  MICROSOFT_SSO_LOGIN_URL,
  microsoftSsoNavigator,
} from '@/lib/microsoft-sso';
import { authService } from '@/services/auth.service';

vi.mock('@/services/auth.service', () => ({
  authService: {
    ssoConfig: vi.fn(),
    devLogin: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  },
}));

const ssoConfig = (overrides: Partial<SsoProviderConfig> = {}): SsoProviderConfig => ({
  provider: 'microsoft',
  enabled: true,
  configured: true,
  allowedDomains: ['empresa.com'],
  loginUrl: MICROSOFT_SSO_LOGIN_URL,
  ...overrides,
});

const originalMicrosoftSsoAssign = microsoftSsoNavigator.assign;

function renderLogin(route = '/login') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app/dashboard" element={<div>Dashboard autenticado</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage Microsoft SSO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.ssoConfig).mockResolvedValue(ssoConfig({ enabled: false, configured: false }));
  });

  afterEach(() => {
    cleanup();
    microsoftSsoNavigator.assign = originalMicrosoftSsoAssign;
  });

  it('renders the current login while SSO config is unavailable', () => {
    vi.mocked(authService.ssoConfig).mockReturnValueOnce(new Promise(() => {}));

    renderLogin();

    expect(screen.getByRole('button', { name: /^Entrar$/i })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar com Microsoft/i })).toBeDisabled();
  });

  it('disables Microsoft login when SSO is disabled or incomplete', async () => {
    vi.mocked(authService.ssoConfig).mockResolvedValueOnce(ssoConfig({ enabled: false, configured: false }));

    renderLogin();

    const button = await screen.findByRole('button', { name: /Entrar com Microsoft/i });
    await waitFor(() => expect(button).toBeDisabled());
    await waitFor(() => expect(screen.getByText(/nao esta habilitado/i)).toBeInTheDocument());
  });

  it('enables Microsoft login when backend config allows it', async () => {
    vi.mocked(authService.ssoConfig).mockResolvedValueOnce(ssoConfig());

    renderLogin();

    const button = await waitFor(() => {
      const microsoftButton = screen.getByRole('button', { name: /Entrar com Microsoft/i });
      expect(microsoftButton).toBeEnabled();
      return microsoftButton;
    });
    expect(button).toBeEnabled();
    expect(screen.getByText(/conta corporativa/i)).toBeInTheDocument();
  });

  it('redirects to the internal backend loginUrl on Microsoft login click', async () => {
    const assign = vi.spyOn(microsoftSsoNavigator, 'assign').mockImplementation(() => undefined);
    vi.mocked(authService.ssoConfig).mockResolvedValueOnce(ssoConfig());

    renderLogin();

    const button = await waitFor(() => {
      const microsoftButton = screen.getByRole('button', { name: /Entrar com Microsoft/i });
      expect(microsoftButton).toBeEnabled();
      return microsoftButton;
    });
    fireEvent.click(button);

    expect(assign).toHaveBeenCalledWith(MICROSOFT_SSO_LOGIN_URL);
  });

  it('does not redirect when backend returns an invalid loginUrl', async () => {
    const assign = vi.spyOn(microsoftSsoNavigator, 'assign').mockImplementation(() => undefined);
    vi.mocked(authService.ssoConfig).mockResolvedValueOnce(ssoConfig({ loginUrl: 'https://identity.example.test/start' }));

    renderLogin();

    const button = await screen.findByRole('button', { name: /Entrar com Microsoft/i });
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.click(button);

    expect(assign).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/indisponivel/i)).toBeInTheDocument());
  });

  it('shows a safe message for a known sso_error', async () => {
    renderLogin('/login?sso_error=state_invalid');

    expect(await screen.findByText('Nao foi possivel validar a tentativa de login. Tente novamente.')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain('state_invalid');
  });

  it('shows a generic safe message for an unknown sso_error', async () => {
    renderLogin('/login?sso_error=upstream_detail_access_token');

    expect(await screen.findByText('Nao foi possivel concluir o login corporativo. Tente novamente.')).toBeInTheDocument();
    const rendered = document.body.textContent ?? '';
    expect(rendered).not.toMatch(/client_secret|id_token|access_token|refresh_token|authorization_code|state|nonce/i);
  });
});
