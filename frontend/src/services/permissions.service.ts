import type { Permission } from '@/types';
import { env } from '@/lib/env';
import { mockResponse } from '@/services/mocks/mock-utils';
import { apiClient, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

const mockPermissions: Permission[] = [
  { id: 'perm-assistants-read', key: 'assistants.read', description: 'Ler assistentes' },
  { id: 'perm-assistants-update', key: 'assistants.update', description: 'Editar assistentes' },
  { id: 'perm-audit-read', key: 'audit.read', description: 'Ler auditoria' },
];

export const permissionsService = {
  async list(): Promise<Permission[]> {
    if (env.useMocks) return mockResponse(mockPermissions);
    const response = await apiClient.get<PaginatedApiEnvelope<Permission>>(endpoints.permissions.list);
    return response.data.data;
  },
};
