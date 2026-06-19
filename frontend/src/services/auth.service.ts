import type { CurrentSession, SsoProviderConfig } from '@/types';
import { env } from '@/lib/env';
import { MICROSOFT_SSO_LOGIN_URL } from '@/lib/microsoft-sso';
import { apiClient } from './api/api-client';
import type { ApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';
import { mockResponse } from './mocks/mock-utils';

const mockSession: CurrentSession = {
  user: {
    id: 'mock-user-1',
    name: 'Maria Silva',
    email: 'maria.silva@empresa.com',
  },
  tenant: {
    id: 'mock-tenant-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
  },
  workspaces: [
    {
      id: 'ws-1',
      tenantId: 'mock-tenant-1',
      name: 'Acme Corp',
      slug: 'acme-corp',
      role: 'admin',
    },
  ],
  roles: ['admin_platform'],
  permissions: [
    'users.read',
    'roles.read',
    'permissions.read',
    'workspaces.read',
    'assistants.read',
    'assistants.create',
    'assistants.update',
    'assistants.publish',
    'assistants.unpublish',
    'assistants.rollback',
    'assistants.share',
    'assistants.archive',
    'assistants.restore',
    'assistants.approval.request',
    'assistants.approval.approve',
    'assistants.approval.reject',
    'assistants.approval.cancel',
    'assistants.execution.configure',
    'assistants.execution.sandbox',
    'assistants.execution.enable',
    'assistants.publications.read',
    'assistants.publications.manage',
    'assistants.feedback.read',
    'assistants.feedback.create',
    'assistants.testResults.read',
    'assistants.testResults.create',
    'audit.read',
    'settings.read',
  ],
};

const mockSsoConfig: SsoProviderConfig = {
  provider: 'microsoft',
  enabled: false,
  configured: false,
  allowedDomains: [],
  loginUrl: MICROSOFT_SSO_LOGIN_URL,
};

export const authService = {
  async ssoConfig(): Promise<SsoProviderConfig> {
    if (env.useMocks) return mockResponse(mockSsoConfig);
    const response = await apiClient.get<ApiEnvelope<SsoProviderConfig>>(endpoints.auth.ssoConfig);
    return response.data.data;
  },

  async me(): Promise<CurrentSession> {
    if (env.useMocks) return mockResponse(mockSession);
    const response = await apiClient.get<CurrentSession>(endpoints.auth.me);
    return response.data;
  },

  async devLogin(email?: string): Promise<CurrentSession> {
    if (env.useMocks) return mockResponse(mockSession);
    const response = await apiClient.post<CurrentSession>(endpoints.auth.devLogin, { email });
    return response.data;
  },

  async logout(): Promise<void> {
    if (env.useMocks) return mockResponse(undefined);
    await apiClient.post(endpoints.auth.logout);
  },
};
