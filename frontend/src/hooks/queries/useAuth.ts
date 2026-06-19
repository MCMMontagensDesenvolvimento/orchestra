import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { queryKeys } from './queryKeys';

export const useCurrentSession = () =>
  useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => authService.me(),
    retry: false,
  });

export const useSsoConfigQuery = () =>
  useQuery({
    queryKey: queryKeys.auth.ssoConfig,
    queryFn: () => authService.ssoConfig(),
    retry: false,
    staleTime: 60_000,
  });

export const useDevLoginMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email?: string) => authService.devLogin(email),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.auth.me, session);
    },
  });
};

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.auth.me });
    },
  });
};
