import type { AuditEventType, AuditLog, RiskLevel } from '@/types';
import { env } from '@/lib/env';
import { displayResourceLabel, displayUserLabel } from '@/lib/display-safety';
import { mockAuditLogs } from '@/services/mocks';
import { mockResponse } from '@/services/mocks/mock-utils';
import { apiClient, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

interface ApiAuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorUserId: string | null;
  createdAt: string;
  requestId: string | null;
}

const eventMap: Record<string, AuditEventType> = {
  dev_login: 'user_login',
  logout: 'user_login',
  assistant_created: 'assistant_created',
  assistant_updated: 'assistant_updated',
  assistant_archived: 'assistant_updated',
  assistant_published: 'assistant_published',
  assistant_unpublished: 'assistant_updated',
  assistant_version_created: 'assistant_updated',
  assistant_share_created: 'policy_changed',
  assistant_share_deleted: 'policy_changed',
  role_permission_added: 'policy_changed',
  role_permission_removed: 'policy_changed',
};

const riskForAction = (action: string): RiskLevel => {
  if (action.includes('permission') || action.includes('published')) return 'high';
  if (action.includes('login') || action.includes('logout')) return 'low';
  return 'medium';
};

const mapAuditLog = (log: ApiAuditLog): AuditLog => ({
  id: log.id,
  event: eventMap[log.action] ?? 'policy_changed',
  description: `${log.action.replace(/_/g, ' ')} em ${log.entity}`,
  user: displayUserLabel(log.actorUserId, 'sistema'),
  timestamp: log.createdAt,
  resource: displayResourceLabel(log.entity, log.entityId),
  riskLevel: riskForAction(log.action),
});

export const auditService = {
  async logs(): Promise<AuditLog[]> {
    if (env.useMocks) return mockResponse(mockAuditLogs);
    const response = await apiClient.get<PaginatedApiEnvelope<ApiAuditLog>>(endpoints.audit.logs);
    return response.data.data.map(mapAuditLog);
  },
};
