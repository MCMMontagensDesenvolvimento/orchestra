import { useQuery } from '@tanstack/react-query';
import { analyticsService, type RuntimeRunFilters } from '@/services/analytics.service';
import { queryKeys } from './queryKeys';

export const useAnalytics = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.analytics.overview,
    queryFn: () => analyticsService.overview(),
    enabled,
  });

export const useRuntimeRuns = (filters: RuntimeRunFilters) =>
  useQuery({
    queryKey: queryKeys.analytics.runs(filters),
    queryFn: () => analyticsService.runtimeRuns(filters),
  });

export const useRuntimeSummary = () =>
  useQuery({
    queryKey: queryKeys.analytics.summary(),
    queryFn: () => analyticsService.runtimeSummary(),
  });

export const useRuntimeRunDetail = (runId: string | null) =>
  useQuery({
    queryKey: queryKeys.analytics.detail(runId ?? 'none'),
    queryFn: () => analyticsService.runtimeRun(runId!),
    enabled: Boolean(runId),
  });
