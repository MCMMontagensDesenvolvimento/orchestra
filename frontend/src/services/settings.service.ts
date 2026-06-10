import { env } from '@/lib/env';
import { mockResponse } from '@/services/mocks/mock-utils';
import { apiClient, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

export interface Setting {
  id: string;
  tenantId: string;
  workspaceId: string | null;
  key: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

export const settingsService = {
  async list(): Promise<Setting[]> {
    if (env.useMocks) return mockResponse([]);
    const response = await apiClient.get<PaginatedApiEnvelope<Setting>>(endpoints.settings.list);
    return response.data.data;
  },
};
