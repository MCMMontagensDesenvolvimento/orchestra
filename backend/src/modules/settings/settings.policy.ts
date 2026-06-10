import { hasPermission } from '../../shared/security/rbac';
import type { AuthenticatedUser } from '../../shared/types/auth';

export function canManageSettings(user: AuthenticatedUser) {
  return hasPermission(user, 'settings.manage');
}
