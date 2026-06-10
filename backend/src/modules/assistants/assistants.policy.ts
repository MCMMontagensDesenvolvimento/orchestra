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

  canReadPublications(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    return (hasPermission(user, 'assistants.publications.read') || hasPermission(user, 'assistants.read')) && hasWorkspaceScope(user, assistant);
  },

  canShareAssistant(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status === 'archived') return false;
    return canManageOwned(user, assistant, 'assistants.share') || (hasPermission(user, 'assistants.share') && isPlatformAdmin(user));
  },

  canRequestApproval(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status === 'archived' && !hasPermission(user, 'assistants.restore')) return false;
    return hasPermission(user, 'assistants.approval.request') && hasWorkspaceScope(user, assistant);
  },

  canApproveApproval(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    return hasPermission(user, 'assistants.approval.approve') && hasWorkspaceScope(user, assistant);
  },

  canRejectApproval(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    return hasPermission(user, 'assistants.approval.reject') && hasWorkspaceScope(user, assistant);
  },

  canCancelApproval(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    return hasPermission(user, 'assistants.approval.cancel') && hasWorkspaceScope(user, assistant);
  },

  canConfigureExecutionPolicy(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status === 'archived') return false;
    return hasPermission(user, 'assistants.execution.configure') && hasWorkspaceScope(user, assistant);
  },

  canEnableExecution(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status === 'archived') return false;
    return hasPermission(user, 'assistants.execution.enable') && hasWorkspaceScope(user, assistant);
  },

  canRunExecutionPrecheck(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    return hasPermission(user, 'assistants.read') && hasWorkspaceScope(user, assistant);
  },

  canUseSandbox(user: AuthenticatedUser, assistant: AssistantPolicySubject) {
    if (assistant.status === 'archived') return false;
    return hasPermission(user, 'assistants.execution.sandbox') && hasWorkspaceScope(user, assistant);
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
