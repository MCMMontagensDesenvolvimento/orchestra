import { describe, expect, it } from 'vitest';
import { hasPermission, hasWorkspaceAccess } from '../../src/shared/security/rbac';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  tenant: { id: 'tenant-1', name: 'Tenant', slug: 'tenant' },
  workspaces: [{ id: 'workspace-1', name: 'Workspace', slug: 'workspace' }],
  roles: ['editor'],
  permissions: ['assistants.read'],
};

describe('rbac helpers', () => {
  it('checks permission membership', () => {
    expect(hasPermission(user, 'assistants.read')).toBe(true);
    expect(hasPermission(user, 'assistants.publish')).toBe(false);
  });

  it('checks workspace access', () => {
    expect(hasWorkspaceAccess(user, 'workspace-1')).toBe(true);
    expect(hasWorkspaceAccess(user, 'workspace-2')).toBe(false);
  });
});
