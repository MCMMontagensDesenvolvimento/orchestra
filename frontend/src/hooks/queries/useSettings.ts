import { useQuery } from '@tanstack/react-query';
import { settingsService } from '@/services/settings.service';
import { queryKeys } from './queryKeys';

export const useSettings = () =>
  useQuery({ queryKey: queryKeys.admin.settings, queryFn: () => settingsService.list() });
