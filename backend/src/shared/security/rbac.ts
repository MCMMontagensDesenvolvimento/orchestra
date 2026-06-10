import type { AuthenticatedUser } from '../types/auth';

export function hasPermission(user: Pick<AuthenticatedUser, 'permissions'>, permission: string) {
  return user.permissions.includes(permission);
}

export function hasWorkspaceAccess(user: Pick<AuthenticatedUser, 'workspaces'>, workspaceId: string) {
  return user.workspaces.some((workspace) => workspace.id === workspaceId);
}
