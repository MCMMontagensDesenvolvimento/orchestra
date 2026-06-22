import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  env: {
    appEnv: 'test',
    isProductionLike: false,
    useMocks: false,
    mockModeAllowed: true,
    mockModeBlockedReason: null as string | null,
    mockDelayMs: 0,
    mockScenario: 'success',
    apiBaseUrl: '/api/v1',
  },
  useCurrentSession: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: mocks.env }));
vi.mock('@/hooks/queries/useAuth', () => ({
  useCurrentSession: mocks.useCurrentSession,
}));

import ProtectedRoute from '@/components/auth/ProtectedRoute';

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={['/app/private']}>
      <Routes>
        <Route path="/login" element={<div>Login requerido</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app/private" element={<div>Conteudo protegido</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute mock mode guardrail', () => {
  beforeEach(() => {
    Object.assign(mocks.env, {
      appEnv: 'test',
      isProductionLike: false,
      useMocks: false,
      mockModeAllowed: true,
      mockModeBlockedReason: null,
    });
    mocks.useCurrentSession.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('bypasses authentication only when mock mode is enabled and allowed', () => {
    Object.assign(mocks.env, {
      appEnv: 'local',
      useMocks: true,
      mockModeAllowed: true,
    });

    renderProtectedRoute();

    expect(screen.getByText('Conteudo protegido')).toBeInTheDocument();
  });

  it('does not bypass authentication when mock mode is not allowed', () => {
    Object.assign(mocks.env, {
      appEnv: 'production',
      isProductionLike: true,
      useMocks: true,
      mockModeAllowed: false,
      mockModeBlockedReason: 'blocked',
    });

    renderProtectedRoute();

    expect(screen.getByText('Login requerido')).toBeInTheDocument();
    expect(screen.queryByText('Conteudo protegido')).not.toBeInTheDocument();
  });

  it('requires a session when mock mode is disabled', () => {
    renderProtectedRoute();

    expect(screen.getByText('Login requerido')).toBeInTheDocument();
  });
});
