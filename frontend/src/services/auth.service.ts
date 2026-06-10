import type { CurrentSession } from '@/types';
import { env } from '@/lib/env';
import { apiClient } from './api/api-client';
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
    'assistants.feedback.read',
    'assistants.feedback.create',
    'assistants.testResults.read',
    'assistants.testResults.create',
    'audit.read',
    'settings.read',
  ],
};

export const authService = {
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
