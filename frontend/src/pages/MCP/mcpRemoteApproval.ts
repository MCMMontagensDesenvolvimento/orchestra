import type {
  McpRemoteImportApplyPayload,
  McpRemoteImportPlan,
} from '@/services/mcp.service';

export function isMcpRemoteManualApplyReady(
  plan: McpRemoteImportPlan | null | undefined,
): plan is McpRemoteImportPlan {
  if (!plan) return false;

  if (
    plan.status !== 'pending_approval'
    && plan.status !== 'ready_for_manual_apply'
  ) {
    return false;
  }

  if (
    plan.validation.valid !== true
    || plan.preflight.requiresManualApproval !== true
    || plan.preflight.canApply !== false
    || plan.preflight.canApplyAutomatically !== false
    || plan.operations.length === 0
  ) {
    return false;
  }

  return plan.operations.every((operation) => (
    operation.canApply === false
    && operation.canApplyAutomatically === false
    && operation.requiresApproval === true
    && operation.policyDraft.allowRuntimeExecution === false
    && operation.policyDraft.runtimeEnabled === false
    && operation.policyDraft.remoteExecutionEnabled === false
  ));
}

export function buildMcpRemoteManualApplyPayload(
  plan: McpRemoteImportPlan,
  approvalReason: string,
): McpRemoteImportApplyPayload {
  if (!isMcpRemoteManualApplyReady(plan)) {
    throw new Error(
      'O plano remoto não está apto para aprovação manual governada.',
    );
  }

  const normalizedReason = approvalReason.trim();

  if (normalizedReason.length < 8) {
    throw new Error(
      'Informe um motivo de aprovação com pelo menos 8 caracteres.',
    );
  }

  if (normalizedReason.length > 1000) {
    throw new Error(
      'O motivo da aprovação deve possuir no máximo 1000 caracteres.',
    );
  }

  return {
    planId: plan.planId,
    planHash: plan.planHash,
    confirmManualApply: true,
    approvalReason: normalizedReason,
  };
}
