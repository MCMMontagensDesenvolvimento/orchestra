import { hasPermission, hasWorkspaceAccess } from '../../shared/security/rbac';
import type { AuthenticatedUser } from '../../shared/types/auth';

export interface AssistantPolicySubject {
  workspaceId: string;
  createdById: string;
  status: string;
}

function isPlatformAdmin(user: AuthenticatedUser) {
  return user.roles.includes('admin_platform');
}

function isOwner(user: AuthenticatedUser, assistant: Pick<AssistantPolicySubject, 'createdById'>) {
  return assistant.createdById === user.id;
}

function hasWorkspaceScope(user: AuthenticatedUser, assistant: Pick<AssistantPolicySubject, 'workspaceId'>) {
  return hasWorkspaceAccess(user, assistant.workspaceId);
}

function canManageOwned(user: AuthenticatedUser, assistant: AssistantPolicySubject, permission: string) {
  return hasPermission(user, permission) && hasWorkspaceScope(user, assistant) && (isPlatformAdmin(user) || isOwner(user, assistant));
}

export const assistantPolicies = {
  canReadAssistant(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    return hasPermission(user, 'assistants.read') && hasWorkspaceScope(user, assistant);
  },

  canCreateAssistant(user: AuthenticatedUser, workspaceId: string) {
    return hasPermission(user, 'assistants.create') && hasWorkspaceAccess(user, workspaceId);
  },

  canUpdateAssistant(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status === 'archived') return false;
    return hasPermission(user, 'assistants.update') && hasWorkspaceScope(user, assistant);
  },

  canArchiveAssistant(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status === 'archived') return false;
    return canManageOwned(user, assistant, 'assistants.archive') || (hasPermission(user, 'assistants.archive') && isPlatformAdmin(user));
  },

  canRestoreAssistant(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    return assistant.status === 'archived' && (canManageOwned(user, assistant, 'assistants.restore') || (hasPermission(user, 'assistants.restore') && isPlatformAdmin(user)));
  },

  canPublishAssistant(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status === 'archived') return false;
    return canManageOwned(user, assistant, 'assistants.publish') || (hasPermission(user, 'assistants.publish') && isPlatformAdmin(user));
  },

  canUnpublishAssistant(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status !== 'published') return false;
    return canManageOwned(user, assistant, 'assistants.unpublish') || (hasPermission(user, 'assistants.unpublish') && isPlatformAdmin(user));
  },

  canRollbackAssistant(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status === 'archived') return false;
    return canManageOwned(user, assistant, 'assistants.rollback') || (hasPermission(user, 'assistants.rollback') && isPlatformAdmin(user));
  },

  canShareAssistant(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status === 'archived') return false;
    return canManageOwned(user, assistant, 'assistants.share') || (hasPermission(user, 'assistants.share') && isPlatformAdmin(user));
  },

  canCreateFeedback(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    return hasPermission(user, 'assistants.feedback.create') && hasWorkspaceScope(user, assistant);
  },

  canReadFeedback(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    return hasPermission(user, 'assistants.feedback.read') && hasWorkspaceScope(user, assistant);
  },

  canCreateTestResult(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status === 'archived') return false;
    return hasPermission(user, 'assistants.testResults.create') && hasWorkspaceScope(user, assistant);
  },

  canReadTestResults(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    return hasPermission(user, 'assistants.testResults.read') && hasWorkspaceScope(user, assistant);
  },
};
