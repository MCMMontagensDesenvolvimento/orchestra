import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import { queryKeys } from './queryKeys';

export const useUsers = () =>
  useQuery({ queryKey: queryKeys.admin.users, queryFn: () => adminService.users() });

export const useWorkspaces = () =>
  useQuery({ queryKey: queryKeys.admin.workspaces, queryFn: () => adminService.workspaces() });

export const useRoles = () =>
  useQuery({ queryKey: queryKeys.admin.roles, queryFn: () => adminService.roles() });

export const usePermissions = () =>
  useQuery({ queryKey: queryKeys.admin.permissions, queryFn: () => adminService.permissions() });
