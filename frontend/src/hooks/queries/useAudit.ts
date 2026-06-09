import { useQuery } from '@tanstack/react-query';
import { auditService } from '@/services/audit.service';
import { queryKeys } from './queryKeys';

export const useAuditLogs = () =>
  useQuery({ queryKey: queryKeys.audit.logs, queryFn: () => auditService.logs() });
