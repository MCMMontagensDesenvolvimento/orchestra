import { createHash } from 'crypto';
import type {
  McpRemoteDiscoveredTool,
  McpRemoteDiscoveredToolRiskLevel,
  McpRemoteDiscoveryApprovalDecision,
  McpRemoteDiscoveryHumanReviewRequirement,
  McpRemoteDiscoveryProposedAction,
  McpRemoteDiscoveryProposedActionType,
  McpRemoteDiscoveryReviewInput,
  McpRemoteDiscoveryReviewPackage,
  McpRemoteExistingToolSpec,
} from './mcp-remote.types';

const unsafeKeyFragments = ['authorization', 'baseurl', 'cookie', 'credential', 'password', 'privatekey', 'secret', 'secretref', 'token', 'apikey'];
const defaultPolicy = {
  allowRuntimeExecution: false,
  sandboxOnly: true,
  blockedByDefault: true,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeForHash(item));
  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const child = normalizeForHash(value[key]);
      if (typeof child !== 'undefined') normalized[key] = child;
    }
    return normalized;
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForHash(value));
}

function sha256(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function isUnsafeKey(key: string) {
  const normalized = key.replace(/[-_\s]/g, '').toLowerCase();
  return unsafeKeyFragments.some((fragment) => normalized.includes(fragment));
}

function containsUnsafeText(value: unknown) {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return unsafeKeyFragments.some((fragment) => normalized.includes(fragment));
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return containsUnsafeText(value) ? '[redacted]' : value.slice(0, 300);
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return undefined;
  if (depth > 5) return '[omitted]';
  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizeMetadata(item, depth + 1))
      .filter((item) => typeof item !== 'undefined');
  }
  if (!isRecord(value)) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (isUnsafeKey(key)) continue;
    const sanitizedValue = sanitizeMetadata(value[key], depth + 1);
    if (typeof sanitizedValue !== 'undefined') sanitized[key] = sanitizedValue;
  }
  return sanitized;
}

function riskSummary(tools: McpRemoteDiscoveredTool[]) {
  return tools.reduce(
    (summary, tool) => {
      summary[tool.inferredRiskLevel] += 1;
      return summary;
    },
    { low: 0, medium: 0, high: 0, critical: 0 },
  );
}

function existingToolMap(existingTools: McpRemoteExistingToolSpec[] | undefined) {
  return new Map((existingTools ?? []).map((tool) => [tool.externalName, tool]));
}

function discoveryToolMap(tools: McpRemoteDiscoveredTool[]) {
  return new Map(tools.map((tool) => [tool.externalName, tool]));
}

function toolAction(type: McpRemoteDiscoveryProposedActionType, tool: McpRemoteDiscoveredTool, reason: string, previousSpecHash?: string | null): McpRemoteDiscoveryProposedAction {
  return {
    type,
    externalName: tool.externalName,
    specHash: tool.specHash,
    ...(typeof previousSpecHash !== 'undefined' ? { previousSpecHash } : {}),
    riskLevel: tool.inferredRiskLevel,
    requiresApproval: tool.requiresApproval,
    canApplyAutomatically: false,
    reason,
    defaultPolicy,
  };
}

function removedAction(externalName: string, previousSpecHash?: string | null): McpRemoteDiscoveryProposedAction {
  return {
    type: 'propose_remove',
    externalName,
    ...(typeof previousSpecHash !== 'undefined' ? { previousSpecHash } : {}),
    requiresApproval: true,
    canApplyAutomatically: false,
    reason: 'Existing tool was not returned by the latest governed discovery snapshot.',
  };
}

function blockedAction(tool: McpRemoteDiscoveredTool): McpRemoteDiscoveryProposedAction {
  return {
    type: 'blocked',
    externalName: tool.externalName,
    specHash: tool.specHash,
    riskLevel: tool.inferredRiskLevel,
    requiresApproval: true,
    canApplyAutomatically: false,
    reason: 'Discovery did not complete, so this tool cannot be proposed for future import.',
    defaultPolicy,
  };
}

function proposedActions(input: McpRemoteDiscoveryReviewInput): McpRemoteDiscoveryProposedAction[] {
  const discovery = input.discovery;
  if (discovery.status !== 'completed') {
    return discovery.tools.map((tool) => blockedAction(tool)).sort((left, right) => left.externalName.localeCompare(right.externalName));
  }

  const tools = discoveryToolMap(discovery.tools);
  const existing = existingToolMap(input.existingTools);
  const actions: McpRemoteDiscoveryProposedAction[] = [];

  for (const externalName of discovery.diff.added) {
    const tool = tools.get(externalName);
    if (tool) actions.push(toolAction('propose_add', tool, 'Tool was discovered remotely and is not present in the governed catalog snapshot.'));
  }

  for (const externalName of discovery.diff.changed) {
    const tool = tools.get(externalName);
    if (tool) {
      actions.push(toolAction(
        'propose_update',
        tool,
        'Tool descriptor changed compared to the governed catalog snapshot.',
        existing.get(externalName)?.specHash ?? null,
      ));
    }
  }

  for (const externalName of discovery.diff.removed) {
    actions.push(removedAction(externalName, existing.get(externalName)?.specHash ?? null));
  }

  const changedNames = new Set([...discovery.diff.added, ...discovery.diff.changed, ...discovery.diff.removed]);
  for (const tool of discovery.tools) {
    if (!changedNames.has(tool.externalName)) {
      actions.push(toolAction('keep_existing', tool, 'Tool descriptor is unchanged in the latest governed discovery snapshot.', existing.get(tool.externalName)?.specHash ?? null));
    }
  }

  return actions.sort((left, right) => {
    const byName = left.externalName.localeCompare(right.externalName);
    return byName === 0 ? left.type.localeCompare(right.type) : byName;
  });
}

function hasChanges(input: McpRemoteDiscoveryReviewInput) {
  return input.discovery.diff.added.length > 0 || input.discovery.diff.changed.length > 0 || input.discovery.diff.removed.length > 0;
}

function maxRiskLevel(tools: McpRemoteDiscoveredTool[]): McpRemoteDiscoveredToolRiskLevel | null {
  const order: McpRemoteDiscoveredToolRiskLevel[] = ['low', 'medium', 'high', 'critical'];
  return tools.reduce<McpRemoteDiscoveredToolRiskLevel | null>((max, tool) => {
    if (!max) return tool.inferredRiskLevel;
    return order.indexOf(tool.inferredRiskLevel) > order.indexOf(max) ? tool.inferredRiskLevel : max;
  }, null);
}

function canAutoApproveAddedTools(input: McpRemoteDiscoveryReviewInput) {
  const policy = input.approvalPolicy;
  if (!policy || policy.blockedByDefault !== false) return false;
  const changedOrRemoved = input.discovery.diff.changed.length > 0 || input.discovery.diff.removed.length > 0;
  if (changedOrRemoved) return false;
  const addedTools = input.discovery.tools.filter((tool) => input.discovery.diff.added.includes(tool.externalName));
  if (addedTools.length === 0) return false;
  const risk = maxRiskLevel(addedTools);
  if (risk === 'high' || risk === 'critical') return false;
  if (risk === 'medium') return Boolean(policy.allowAutoApproveLowRisk && policy.allowAutoApproveMediumRisk);
  return risk === 'low' && Boolean(policy.allowAutoApproveLowRisk);
}

function approvalDecision(input: McpRemoteDiscoveryReviewInput): McpRemoteDiscoveryApprovalDecision {
  const discovery = input.discovery;
  const reasons: string[] = [];

  if (discovery.status !== 'completed') {
    return {
      status: 'blocked',
      requiresHumanReview: false,
      reasons: [`Discovery status "${discovery.status}" blocks review approval.`],
    };
  }

  if (!hasChanges(input)) {
    return {
      status: 'no_changes',
      requiresHumanReview: false,
      reasons: ['Discovery snapshot has no added, changed or removed tools.'],
    };
  }

  if (discovery.warnings.length > 0) {
    reasons.push('Discovery returned warnings; review is required before any future import.');
  }
  if (discovery.tools.some((tool) => tool.inferredRiskLevel === 'critical')) {
    reasons.push('At least one discovered tool is critical risk.');
  }
  if (discovery.tools.some((tool) => tool.inferredRiskLevel === 'high')) {
    reasons.push('At least one discovered tool is high risk.');
  }
  if (discovery.diff.changed.length > 0) {
    reasons.push('At least one existing tool descriptor changed.');
  }
  if (discovery.diff.removed.length > 0) {
    reasons.push('At least one existing tool is absent from the latest discovery snapshot.');
  }

  if (reasons.length === 0 && canAutoApproveAddedTools(input)) {
    return {
      status: 'approved_for_future_import',
      requiresHumanReview: false,
      reasons: ['Approval policy explicitly allows this low or medium risk addition set for future import review.'],
    };
  }

  if (reasons.length === 0) {
    reasons.push('Default policy requires human review before future import.');
  }

  return {
    status: 'pending_human_review',
    requiresHumanReview: true,
    reasons,
  };
}

function humanReviewRequirement(decision: McpRemoteDiscoveryApprovalDecision, actions: McpRemoteDiscoveryProposedAction[]): McpRemoteDiscoveryHumanReviewRequirement {
  return {
    required: decision.requiresHumanReview,
    reasons: decision.requiresHumanReview ? decision.reasons : [],
    riskLevels: [...new Set(actions.map((action) => action.riskLevel).filter((risk): risk is McpRemoteDiscoveredToolRiskLevel => Boolean(risk)))].sort(),
    actionTypes: [...new Set(actions.map((action) => action.type))].sort(),
  };
}

function counts(input: McpRemoteDiscoveryReviewInput, actions: McpRemoteDiscoveryProposedAction[]) {
  return {
    totalTools: input.discovery.tools.length,
    added: input.discovery.diff.added.length,
    changed: input.discovery.diff.changed.length,
    removed: input.discovery.diff.removed.length,
    warnings: input.discovery.warnings.length,
    proposedActions: actions.length,
  };
}

function packageMetadata(input: McpRemoteDiscoveryReviewInput, decision: McpRemoteDiscoveryApprovalDecision) {
  return sanitizeMetadata({
    source: 'mcp_remote_discovery_11d',
    noCatalogImport: true,
    noRuntimePublish: true,
    noToolExecution: true,
    autoApplyDisabled: true,
    warningCodes: input.discovery.warnings.map((warning) => warning.code),
    discoveryStatus: input.discovery.status,
    decisionStatus: decision.status,
  }) as Record<string, unknown>;
}

export class McpRemoteDiscoveryApprovalService {
  createReviewPackage(input: McpRemoteDiscoveryReviewInput): McpRemoteDiscoveryReviewPackage {
    const actions = proposedActions(input);
    const decision = approvalDecision(input);
    const summary = {
      status: input.discovery.status,
      totalTools: input.discovery.tools.length,
      added: input.discovery.diff.added.length,
      changed: input.discovery.diff.changed.length,
      removed: input.discovery.diff.removed.length,
      warnings: input.discovery.warnings.length,
    };
    const risks = riskSummary(input.discovery.tools);
    const sanitizedMetadata = packageMetadata(input, decision);
    const snapshotPayload = {
      serverId: input.discovery.serverId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      requestedByUserId: input.requestedByUserId,
      requestId: input.requestId,
      discoveredAt: input.discovery.discoveredAt,
      discoverySpecHash: input.discovery.specHash,
      summary,
      riskSummary: risks,
      diff: input.discovery.diff,
      proposedActions: actions,
      decision,
      sanitizedMetadata,
    };
    const snapshotHash = sha256(snapshotPayload);
    const auditCounts = counts(input, actions);

    return {
      snapshotId: `mcp_remote_discovery_${snapshotHash.slice(0, 24)}`,
      serverId: input.discovery.serverId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      requestedByUserId: input.requestedByUserId,
      requestId: input.requestId,
      discoveredAt: input.discovery.discoveredAt,
      ...(input.discovery.specHash ? { discoverySpecHash: input.discovery.specHash } : {}),
      snapshotHash,
      summary,
      riskSummary: risks,
      diff: {
        added: [...input.discovery.diff.added].sort(),
        changed: [...input.discovery.diff.changed].sort(),
        removed: [...input.discovery.diff.removed].sort(),
      },
      proposedActions: actions,
      decision,
      humanReview: humanReviewRequirement(decision, actions),
      applyPlan: {
        status: 'blocked',
        canApply: false,
        reason: '11D only creates a review package; catalog import and runtime enablement remain blocked.',
        proposedActions: actions,
      },
      auditEvent: {
        type: 'mcp.remote.discovery.review_package_created',
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        serverId: input.discovery.serverId,
        requestId: input.requestId,
        snapshotHash,
        decisionStatus: decision.status,
        counts: auditCounts,
        diff: {
          added: [...input.discovery.diff.added].sort(),
          changed: [...input.discovery.diff.changed].sort(),
          removed: [...input.discovery.diff.removed].sort(),
        },
        riskSummary: risks,
        metadata: {
          noCatalogImport: true,
          noRuntimePublish: true,
          noToolExecution: true,
          warningCount: input.discovery.warnings.length,
        },
      },
      sanitizedMetadata,
    };
  }

  createReviewPackageForDiscovery(input: McpRemoteDiscoveryReviewInput): McpRemoteDiscoveryReviewPackage {
    return this.createReviewPackage(input);
  }
}

export const mcpRemoteDiscoveryApprovalService = new McpRemoteDiscoveryApprovalService();
