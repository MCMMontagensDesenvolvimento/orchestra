import type { Permission, Role, User, Workspace } from '@/types';
import { permissionsService } from './permissions.service';
import { rolesService } from './roles.service';
import { usersService } from './users.service';
import { workspacesService } from './workspaces.service';

export const adminService = {
  users(): Promise<User[]> {
    return usersService.list();
  },

  workspaces(): Promise<Workspace[]> {
    return workspacesService.list();
  },

  roles(): Promise<Role[]> {
    return rolesService.list();
  },

  permissions(): Promise<Permission[]> {
    return permissionsService.list();
  },
};
