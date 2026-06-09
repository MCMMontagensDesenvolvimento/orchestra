import type { AuditLog } from '@/types';
import { mockAuditLogs } from '@/services/mocks';
import { mockResponse } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';

export const auditService = {
  logs(): Promise<AuditLog[]> {
    if (env.useMocks) return mockResponse(mockAuditLogs);
    throw new Error('API real ainda não implementada.');
  },
};
