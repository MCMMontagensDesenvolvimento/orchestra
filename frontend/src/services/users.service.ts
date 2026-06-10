import type { User } from '@/types';
import { env } from '@/lib/env';
import { mockUsers } from '@/services/mocks';
import { mockResponse } from '@/services/mocks/mock-utils';
import { apiClient, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

interface ApiUser {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt: string | null;
  roles: Array<{ name: string }>;
}

const mapUser = (user: ApiUser): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.roles[0]?.name ?? user.status,
  lastLogin: user.lastLoginAt ?? new Date().toISOString(),
});

export const usersService = {
  async list(): Promise<User[]> {
    if (env.useMocks) return mockResponse(mockUsers);
    const response = await apiClient.get<PaginatedApiEnvelope<ApiUser>>(endpoints.users.list);
    return response.data.data.map(mapUser);
  },
};
