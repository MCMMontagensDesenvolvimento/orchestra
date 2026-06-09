import { mockAssistants, mockKnowledgeBases, mockMcpTools, mockConversations, mockAuditLogs } from '@/services/mocks';
import { mockResponse } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';

export interface DashboardSummary {
  totalAssistants: number;
  publishedAssistants: number;
  knowledgeBases: number;
  mcpTools: number;
  conversations: number;
  auditEvents: number;
}

export const dashboardService = {
  summary(): Promise<DashboardSummary> {
    if (env.useMocks) {
      return mockResponse({
        totalAssistants: mockAssistants.length,
        publishedAssistants: mockAssistants.filter(a => a.status === 'published').length,
        knowledgeBases: mockKnowledgeBases.length,
        mcpTools: mockMcpTools.length,
        conversations: mockConversations.length,
        auditEvents: mockAuditLogs.length,
      });
    }
    throw new Error('API real ainda não implementada.');
  },
};
