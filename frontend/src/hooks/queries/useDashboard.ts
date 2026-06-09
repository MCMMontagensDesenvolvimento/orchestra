import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { queryKeys } from './queryKeys';

export const useDashboardSummary = () =>
  useQuery({ queryKey: queryKeys.dashboard.summary, queryFn: () => dashboardService.summary() });
