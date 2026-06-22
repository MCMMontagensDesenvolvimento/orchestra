import type { AnalyticsData } from '@/types';
import { mockAnalytics } from '@/services/mocks';
import { mockResponse } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';

export const analyticsService = {
  overview(): Promise<AnalyticsData[]> {
    if (env.useMocks) return mockResponse(mockAnalytics);
    return Promise.resolve([]);
  },
};
