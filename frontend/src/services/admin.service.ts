import type { User } from '@/types';
import { mockUsers } from '@/services/mocks';
import { mockResponse } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';

export const adminService = {
  users(): Promise<User[]> {
    if (env.useMocks) return mockResponse(mockUsers);
    throw new Error('API real ainda não implementada.');
  },
  // Workspaces ainda não modelados em mock — placeholder para futura API.
  workspaces(): Promise<Array<{ id: string; name: string }>> {
    if (env.useMocks) return mockResponse([{ id: 'ws-1', name: 'Acme Corp' }]);
    throw new Error('API real ainda não implementada.');
  },
};
