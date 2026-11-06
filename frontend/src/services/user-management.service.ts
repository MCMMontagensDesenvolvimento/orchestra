import { apiClient, type ApiEnvelope, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt: string | null;
  roles: Array<{ id: string; name: string; description: string | null }>;
  workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
}

export interface ManagedUserInput {
  name: string;
  status: 'active' | 'inactive';
  roleId?: string;
  email?: string;
}

export const userManagementService = {
  async list(page: number, search: string) {
    const response = await apiClient.get<PaginatedApiEnvelope<ManagedUser>>(endpoints.users.list, {
      params: { page, perPage: 20, search, sortBy: 'name', sortDirection: 'asc' },
    });
    return response.data;
  },

  async create(input: ManagedUserInput) {
    const response = await apiClient.post<ApiEnvelope<ManagedUser>>(endpoints.users.list, input);
    return response.data.data;
  },

  async update(id: string, input: Omit<ManagedUserInput, 'email'>) {
    const response = await apiClient.patch<ApiEnvelope<ManagedUser>>(endpoints.users.detail(id), input);
    return response.data.data;
  },

  async remove(id: string) {
    await apiClient.delete(endpoints.users.detail(id));
  },
};
