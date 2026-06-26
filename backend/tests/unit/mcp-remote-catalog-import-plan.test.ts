import { describe, expect, it, vi } from 'vitest';
import { McpRemoteCatalogImportPlanService } from '../../src/modules/mcp/remote/mcp-remote-catalog-import-plan.service';
import type {
  McpRemoteCatalogImportPlanInput,
  McpRemoteDiscoveredToolRiskLevel,
  McpRemoteDiscoveryApprovalDecisionStatus,
  McpRemoteDiscoveryProposedAction,
  McpRemoteDiscoveryProposedActionType,
  McpRemoteDiscoveryReviewPackage,
} from '../../src/modules/mcp/remote/mcp-remote.types';

const closedDefaultPolicy = {
  allowRuntimeExecution: false,
  sandboxOnly: true,
  blockedByDefault: true,
} as const;

function proposedAction(
  type: McpRemoteDiscoveryProposedActionType,
  externalName: string,
  overrides: Partial<McpRemoteDiscoveryProposedAction> = {},
): McpRemoteDiscoveryProposedAction {
  const riskLevel = overrides.riskLevel ?? 'low';
  return {
    type,
    externalName,
    specHash: `hash_${externalName}`,
    previousSpecHash: type === 'propose_update' || type === 'propose_remove' ? `previous_${externalName}` : null,
    riskLevel,
    requiresApproval: riskLevel !== 'low',
    canApplyAutomatically: false,
    reason: `${type} for ${externalName}`,
    defaultPolicy: closedDefaultPolicy,
    ...overrides,
  };
}

function reviewPackage(
  decisionStatus: McpRemoteDiscoveryApprovalDecisionStatus,
  actions: McpRemoteDiscoveryProposedAction[] = [],
  overrides: Partial<McpRemoteDiscoveryReviewPackage> = {},
): McpRemoteDiscoveryReviewPackage {
  return {
    snapshotId: 'mcp_remote_discovery_snapshot_001',
    serverId: '00000000-0000-0000-0000-000000000701',
    tenantId: '00000000-0000-0000-0000-000000000010',
    workspaceId: '00000000-0000-0000-0000-000000000020',
    requestedByUserId: '00000000-0000-0000-0000-000000000030',
    requestId: 'req_import_plan',
    discoveredAt: '2026-06-26T18:00:00.000Z',
    discoverySpecHash: 'discovery_hash',
    snapshotHash: 'snapshot_hash_001',
    summary: {
      status: 'completed',
      totalTools: actions.length,
      added: actions.filter((action) => action.type === 'propose_add').length,
      changed: actions.filter((action) => action.type === 'propose_update').length,
      removed: actions.filter((action) => action.type === 'propose_remove').length,
      warnings: 0,
    },
    riskSummary: riskSummary(actions),
    diff: {
      added: actions.filter((action) => action.type === 'propose_add').map((action) => action.externalName),
      changed: actions.filter((action) => action.type === 'propose_update').map((action) => action.externalName),
      removed: actions.filter((action) => action.type === 'propose_remove').map((action) => action.externalName),
    },
    proposedActions: actions,
    decision: {
      status: decisionStatus,
      requiresHumanReview: decisionStatus === 'pending_human_review',
      reasons: [`decision ${decisionStatus}`],
    },
    humanReview: {
      required: decisionStatus === 'pending_human_review',
      reasons: decisionStatus === 'pending_human_review' ? ['manual review required'] : [],
      riskLevels: [...new Set(actions.map((action) => action.riskLevel).filter((risk): risk is McpRemoteDiscoveredToolRiskLevel => Boolean(risk)))],
      actionTypes: [...new Set(actions.map((action) => action.type))],
    },
    applyPlan: {
      status: 'blocked',
      canApply: false,
      reason: 'review package only',
      proposedActions: actions,
    },
    auditEvent: {
      type: 'mcp.remote.discovery.review_package_created',
      tenantId: '00000000-0000-0000-0000-000000000010',
      workspaceId: '00000000-0000-0000-0000-000000000020',
      serverId: '00000000-0000-0000-0000-000000000701',
      requestId: 'req_import_plan',
      snapshotHash: 'snapshot_hash_001',
      decisionStatus,
      counts: {},
      diff: {
        added: [],
        changed: [],
        removed: [],
      },
      riskSummary: riskSummary(actions),
      metadata: {},
    },
    sanitizedMetadata: {
      noCatalogImport: true,
      noRuntimePublish: true,
    },
    ...overrides,
  };
}

function planInput(review: McpRemoteDiscoveryReviewPackage, overrides: Partial<McpRemoteCatalogImportPlanInput> = {}): McpRemoteCatalogImportPlanInput {
  return {
    reviewPackage: review,
    createdAt: '2026-06-26T19:00:00.000Z',
    ...overrides,
  };
}

function createPlan(input: McpRemoteCatalogImportPlanInput) {
  return new McpRemoteCatalogImportPlanService().createImportPlan(input);
}

describe('MCP remote catalog import plan', () => {
  it('creates a blocked import plan from a blocked review package', () => {
    const plan = createPlan(planInput(reviewPackage('blocked')));

    expect(plan.status).toBe('blocked');
    expect(plan.preflight.canApply).toBe(false);
    expect(plan.preflight.checks).toContainEqual(expect.objectContaining({ name: 'decision', status: 'fail' }));
  });

  it('creates a pending_approval plan from pending human review', () => {
    const action = proposedAction('propose_add', 'search_records', { riskLevel: 'medium', requiresApproval: true });
    const plan = createPlan(planInput(reviewPackage('pending_human_review', [action])));

    expect(plan.status).toBe('pending_approval');
    expect(plan.preflight.requiresManualApproval).toBe(true);
    expect(plan.operations[0]).toMatchObject({ type: 'create_tool_draft', canApply: false });
  });

  it('creates ready_for_manual_apply from approved future import without allowing apply', () => {
    const action = proposedAction('propose_add', 'read_version');
    const plan = createPlan(planInput(reviewPackage('approved_for_future_import', [action])));

    expect(plan.status).toBe('ready_for_manual_apply');
    expect(plan.preflight.canApply).toBe(false);
    expect(plan.preflight.canApplyAutomatically).toBe(false);
    expect(plan.operations[0]).toMatchObject({ canApply: false, canApplyAutomatically: false });
  });

  it('creates no_changes with noop operations', () => {
    const action = proposedAction('keep_existing', 'read_version');
    const plan = createPlan(planInput(reviewPackage('no_changes', [action])));

    expect(plan.status).toBe('no_changes');
    expect(plan.operations).toEqual([
      expect.objectContaining({ type: 'noop', externalName: 'read_version' }),
    ]);
    expect(plan.summary.noop).toBe(1);
  });

  it('maps proposed actions to catalog import operations', () => {
    const actions = [
      proposedAction('propose_add', 'create_me'),
      proposedAction('propose_update', 'update_me'),
      proposedAction('propose_remove', 'remove_me'),
      proposedAction('keep_existing', 'keep_me'),
      proposedAction('blocked', 'blocked_me'),
    ];
    const plan = createPlan(planInput(reviewPackage('pending_human_review', actions)));

    expect(plan.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ externalName: 'create_me', type: 'create_tool_draft' }),
      expect.objectContaining({ externalName: 'update_me', type: 'update_tool_draft' }),
      expect.objectContaining({ externalName: 'remove_me', type: 'deprecate_tool_draft' }),
      expect.objectContaining({ externalName: 'keep_me', type: 'noop' }),
      expect.objectContaining({ externalName: 'blocked_me', type: 'blocked' }),
    ]));
  });

  it('keeps every operation non-applicable and every policy draft closed', () => {
    const actions = [
      proposedAction('propose_add', 'create_me'),
      proposedAction('propose_update', 'update_me'),
      proposedAction('propose_remove', 'remove_me'),
    ];
    const plan = createPlan(planInput(reviewPackage('pending_human_review', actions)));

    expect(plan.operations.every((operation) => operation.canApply === false)).toBe(true);
    expect(plan.operations.every((operation) => operation.canApplyAutomatically === false)).toBe(true);
    expect(plan.operations.every((operation) => operation.policyDraft.allowRuntimeExecution === false)).toBe(true);
    expect(plan.operations.every((operation) => operation.policyDraft.sandboxOnly === true)).toBe(true);
    expect(plan.operations.every((operation) => operation.policyDraft.blockedByDefault === true)).toBe(true);
    expect(plan.operations.every((operation) => operation.policyDraft.requiresApproval === true)).toBe(true);
    expect(plan.operations.every((operation) => operation.policyDraft.remoteExecutionEnabled === false)).toBe(true);
    expect(plan.operations.every((operation) => operation.policyDraft.runtimeEnabled === false)).toBe(true);
  });

  it('creates deterministic plan hashes for the same input', () => {
    const action = proposedAction('propose_add', 'read_version');
    const input = planInput(reviewPackage('approved_for_future_import', [action]));

    const first = createPlan(input);
    const second = createPlan(input);

    expect(first.planHash).toBe(second.planHash);
    expect(first.planId).toBe(second.planId);
    expect(first.planHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps audit events free of sensitive payload fields', () => {
    const action = proposedAction('propose_add', 'read_version', {
      reason: 'token password credential apiKey secretRef baseUrl https://user:pass@example.invalid',
    });
    const plan = createPlan(planInput(reviewPackage('approved_for_future_import', [action], {
      sanitizedMetadata: {
        secretRef: 'vault://mcp/raw-reference',
        credentialValue: 'raw-token-fixture',
      },
    })));
    const serialized = JSON.stringify(plan.auditEvent).toLowerCase();

    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('apikey');
    expect(serialized).not.toContain('credential');
    expect(serialized).not.toContain('secretref');
    expect(serialized).not.toContain('baseurl');
    expect(serialized).not.toContain('vault://');
    expect(serialized).not.toContain('https://user:pass@example.invalid');
  });

  it('sanitizes catalog drafts and metadata', () => {
    const action = proposedAction('propose_add', 'read_version', {
      reason: 'token password credential apiKey secretRef baseUrl https://user:pass@example.invalid',
    });
    const plan = createPlan(planInput(reviewPackage('approved_for_future_import', [action])));
    const serializedDraft = JSON.stringify(plan.operations[0].catalogDraft).toLowerCase();

    expect(serializedDraft).not.toContain('token password');
    expect(serializedDraft).not.toContain('apikey');
    expect(serializedDraft).not.toContain('secretref');
    expect(serializedDraft).not.toContain('baseurl');
    expect(plan.operations[0].reason).toBe('Reason omitted by sanitizer.');
  });

  it('does not call network APIs, execute tools or persist while creating a plan', () => {
    const fetchMock = vi.fn();
    const executeTool = vi.fn();
    const persistPlan = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    createPlan(planInput(reviewPackage('approved_for_future_import', [
      proposedAction('propose_add', 'read_version'),
    ])));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(executeTool).not.toHaveBeenCalled();
    expect(persistPlan).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('adds conservative validation and preflight warnings for high and critical risk operations', () => {
    const actions = [
      proposedAction('propose_add', 'send_email', { riskLevel: 'high', requiresApproval: true }),
      proposedAction('propose_add', 'delete_admin_permission', { riskLevel: 'critical', requiresApproval: true }),
    ];
    const plan = createPlan(planInput(reviewPackage('pending_human_review', actions)));

    expect(plan.validation.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MCP_REMOTE_IMPORT_HIGH_RISK_CONSERVATIVE' }),
      expect.objectContaining({ code: 'MCP_REMOTE_IMPORT_CRITICAL_RISK_CONSERVATIVE' }),
    ]));
    expect(plan.preflight.checks).toContainEqual(expect.objectContaining({ name: 'risk', status: 'warning' }));
  });

  it('fails validation when high or critical risk lacks human review', () => {
    const action = proposedAction('propose_add', 'delete_admin_permission', { riskLevel: 'critical', requiresApproval: true });
    const review = reviewPackage('approved_for_future_import', [action]);
    const plan = createPlan(planInput(review));

    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.errors).toContainEqual(expect.objectContaining({
      code: 'MCP_REMOTE_IMPORT_CRITICAL_RISK_REVIEW_REQUIRED',
    }));
  });

  it('fails validation for duplicate external names', () => {
    const plan = createPlan(planInput(reviewPackage('pending_human_review', [
      proposedAction('propose_add', 'duplicate_tool'),
      proposedAction('propose_update', 'duplicate_tool'),
    ])));

    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.errors).toContainEqual(expect.objectContaining({
      code: 'MCP_REMOTE_IMPORT_DUPLICATE_TOOL',
    }));
  });
});

function riskSummary(actions: McpRemoteDiscoveryProposedAction[]) {
  return actions.reduce(
    (summary, action) => {
      if (action.riskLevel) summary[action.riskLevel] += 1;
      return summary;
    },
    { low: 0, medium: 0, high: 0, critical: 0 },
  );
}
