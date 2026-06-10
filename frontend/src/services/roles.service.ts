import type { Role } from '@/types';
import { env } from '@/lib/env';
import { mockResponse } from '@/services/mocks/mock-utils';
import { apiClient, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

const mockRoles: Role[] = [
  {
    id: 'role-admin',
    name: 'admin_platform',
    description: 'Administrador da plataforma',
    permissions: [],
  },
  {
    id: 'role-editor',
    name: 'editor',
    description: 'Editor de assistentes',
    permissions: [],
  },
];

export const rolesService = {
  async list(): Promise<Role[]> {
    if (env.useMocks) return mockResponse(mockRoles);
    const response = await apiClient.get<PaginatedApiEnvelope<Role>>(endpoints.roles.list);
    return response.data.data;
  },
};
