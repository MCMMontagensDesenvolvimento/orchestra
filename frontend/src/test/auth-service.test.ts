import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentSession, SsoProviderConfig } from '@/types';
import { MICROSOFT_SSO_LOGIN_URL } from '@/lib/microsoft-sso';
import { endpoints } from '@/services/api/endpoints';

vi.mock('@/lib/env', () => ({
  env: {
    useMocks: false,
    mockDelayMs: 0,
    mockScenario: 'success',
    apiBaseUrl: '/api/v1',
  },
}));

vi.mock('@/services/api/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '@/services/api/api-client';
import { authService } from '@/services/auth.service';

const session: CurrentSession = {
  user: {
    id: 'user-1',
    name: 'Admin Dev',
    email: 'admin.dev@orchestra.local',
  },
  tenant: {
    id: 'tenant-1',
    name: 'Tenant',
    slug: 'tenant',
  },
  workspaces: [],
  roles: ['admin_platform'],
  permissions: ['settings.read'],
};

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads sanitized SSO config from the backend envelope', async () => {
    const ssoConfig: SsoProviderConfig = {
      provider: 'microsoft',
      enabled: true,
      configured: true,
      allowedDomains: ['empresa.com'],
      loginUrl: MICROSOFT_SSO_LOGIN_URL,
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: ssoConfig, requestId: 'req_test' } });

    await expect(authService.ssoConfig()).resolves.toEqual(ssoConfig);

    expect(apiClient.get).toHaveBeenCalledWith(endpoints.auth.ssoConfig);
    expect(JSON.stringify(ssoConfig)).not.toMatch(/client_secret|id_token|access_token|refresh_token|authorization_code/i);
  });

  it('keeps /auth/me as the session source without reading browser token storage', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: session });

    await expect(authService.me()).resolves.toEqual(session);

    expect(apiClient.get).toHaveBeenCalledWith(endpoints.auth.me);
    expect(getItem).not.toHaveBeenCalledWith(expect.stringMatching(/token/i));
  });

  it('keeps logout on the Orchestra backend endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ status: 204 });

    await expect(authService.logout()).resolves.toBeUndefined();

    expect(apiClient.post).toHaveBeenCalledWith(endpoints.auth.logout);
  });
});
