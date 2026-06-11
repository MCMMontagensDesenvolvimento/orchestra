import { hasPermission, hasWorkspaceAccess } from '../../shared/security/rbac';
import type { AuthenticatedUser } from '../../shared/types/auth';

export interface AgentRunPolicySubject {
  workspaceId: string;
}

function hasWorkspaceScope(user: AuthenticatedUser, subject: AgentRunPolicySubject) {
  return hasWorkspaceAccess(user, subject.workspaceId);
}

export const agentRunPolicies = {
  canReadAgentRun(user: AuthenticatedUser, subject: AgentRunPolicySubject) {
    return hasPermission(user, 'agent_runs.read') && hasWorkspaceScope(user, subject);
  },

  canCreateAgentRun(user: AuthenticatedUser, subject: AgentRunPolicySubject) {
    return hasPermission(user, 'agent_runs.create') && hasWorkspaceScope(user, subject);
  },

  canCancelAgentRun(user: AuthenticatedUser, subject: AgentRunPolicySubject) {
    return hasPermission(user, 'agent_runs.cancel') && hasWorkspaceScope(user, subject);
  },

  canAuditAgentRun(user: AuthenticatedUser, subject: AgentRunPolicySubject) {
    return hasPermission(user, 'agent_runs.audit') && hasWorkspaceScope(user, subject);
  },

  canRunPrecheck(user: AuthenticatedUser, subject: AgentRunPolicySubject) {
    return hasPermission(user, 'execution.precheck') && hasWorkspaceScope(user, subject);
  },

  canRunSandbox(user: AuthenticatedUser, subject: AgentRunPolicySubject) {
    return hasPermission(user, 'execution.run_sandbox') && hasWorkspaceScope(user, subject);
  },

  canRunPublished(user: AuthenticatedUser, subject: AgentRunPolicySubject) {
    return hasPermission(user, 'execution.run_published') && hasWorkspaceScope(user, subject);
  },
};
