import type { Workspace } from '@/types';
import { env } from '@/lib/env';
import { mockResponse } from '@/services/mocks/mock-utils';
import { apiClient, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

const mockWorkspaces: Workspace[] = [
  { id: 'ws-1', name: 'Acme Corp', slug: 'acme-corp', role: 'admin' },
];

export const workspacesService = {
  async list(): Promise<Workspace[]> {
    if (env.useMocks) return mockResponse(mockWorkspaces);
    const response = await apiClient.get<PaginatedApiEnvelope<Workspace>>(endpoints.workspaces.list);
    return response.data.data;
  },
};
