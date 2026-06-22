import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics.service';
import { queryKeys } from './queryKeys';

export const useAnalytics = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.analytics.overview,
    queryFn: () => analyticsService.overview(),
    enabled,
  });
