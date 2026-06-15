import { useQuery } from '@tanstack/react-query';
import { runtimeService } from '@/services/runtime.service';
import { queryKeys } from './queryKeys';

export const useRuntimeProviders = () =>
  useQuery({ queryKey: queryKeys.runtime.providers(), queryFn: () => runtimeService.providers() });

export const useRuntimeCapabilities = () =>
  useQuery({ queryKey: queryKeys.runtime.capabilities(), queryFn: () => runtimeService.capabilities() });

export const useRuntimeHealth = () =>
  useQuery({ queryKey: queryKeys.runtime.health(), queryFn: () => runtimeService.health() });

export const useRuntimeConfig = () =>
  useQuery({ queryKey: queryKeys.runtime.config(), queryFn: () => runtimeService.config() });
