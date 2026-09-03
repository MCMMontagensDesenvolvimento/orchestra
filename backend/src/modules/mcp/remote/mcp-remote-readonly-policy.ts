import type {
  GovernedMcpPolicyDecision,
  McpRemoteFeatureConfig,
  McpRemoteReadOnlyEvaluation,
} from './mcp-remote.types';

const dangerousOperationPattern = /(?:^|[^a-z])(create|update|delete|remove|write|post|put|patch|drop|truncate|send|transfer|approve|execute|shell|command)(?:$|[^a-z])/i;

function operationText(value: unknown, depth = 0): string[] {
  if (depth > 5 || value == null) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => operationText(item, depth + 1));
  if (typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [key, ...operationText(item, depth + 1)]);
}

export function hasDangerousMcpRemoteOperation(value: unknown) {
  return operationText(value).some((item) => {
    const normalized = item.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_./:-]+/g, ' ');
    return dangerousOperationPattern.test(normalized);
  });
}

export function evaluateMcpRemoteReadOnly(input: {
  config: McpRemoteFeatureConfig;
  tool: {
    externalName: string;
    displayName: string;
    description?: string | null;
    inputSchema?: unknown;
    outputSchema?: unknown;
    metadata?: unknown;
    riskLevel: string;
    requiresApproval: boolean;
    readOnly: boolean;
  };
  policy: GovernedMcpPolicyDecision;
  authType?: string | null;
  secretRef?: string | null;
}): McpRemoteReadOnlyEvaluation {
  const block = (blockedReason: NonNullable<McpRemoteReadOnlyEvaluation['blockedReason']>): McpRemoteReadOnlyEvaluation => ({
    applied: true,
    allowed: false,
    readOnly: Boolean(input.tool.readOnly),
    blockedReason,
  });

  if (!input.config.remoteEnabled) return block('remote_disabled');
  if (!input.config.executionEnabled) return block('execution_disabled');
  if (!input.config.readOnlyEnabled) return block('readonly_disabled');
  if (input.config.allowWriteTools) return block('write_tools_not_allowed');
  if (!input.tool.readOnly) return block('tool_not_readonly');
  if (hasDangerousMcpRemoteOperation(input.tool)) return block('dangerous_operation');
  if (input.tool.riskLevel !== 'low') return block('risk_not_low');
  if (!input.policy.approvalSatisfied) return block('approval_required');
  if (!input.policy.allowRuntimeExecution || input.policy.status !== 'allowed') return block('runtime_execution_not_allowed');
  if (input.policy.sandboxOnly) return block('sandbox_only');
  if (input.policy.blockedByDefault) return block('blocked_by_default');
  if ((input.authType ?? 'none') !== 'none' && input.config.requireSecretRef && !input.secretRef?.trim()) {
    return block('secret_ref_required');
  }
  return { applied: true, allowed: true, readOnly: true };
}
