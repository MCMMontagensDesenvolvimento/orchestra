import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../shared/types/auth';

type UserForAuth = Prisma.UserGetPayload<{
  include: {
    tenant: true;
    roles: {
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true;
              };
            };
          };
        };
      };
    };
    memberships: {
      include: {
        workspace: true;
      };
    };
  };
}>;

export function mapUserForAuth(user: UserForAuth): AuthenticatedUser {
  const permissions = new Set<string>();
  const roles = new Set<string>();

  for (const userRole of user.roles) {
    roles.add(userRole.role.name);
    for (const rolePermission of userRole.role.permissions) {
      permissions.add(rolePermission.permission.key);
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
    },
    workspaces: user.memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
    })),
    roles: [...roles],
    permissions: [...permissions],
  };
}
