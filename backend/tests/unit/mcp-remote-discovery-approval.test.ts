import { describe, expect, it, vi } from 'vitest';
import { McpRemoteDiscoveryApprovalService } from '../../src/modules/mcp/remote/mcp-remote-discovery-approval.service';
import type {
  McpRemoteDiscoveredTool,
  McpRemoteDiscoveredToolRiskLevel,
  McpRemoteDiscoveryOutput,
  McpRemoteDiscoveryReviewInput,
} from '../../src/modules/mcp/remote/mcp-remote.types';

const defaultPolicy = {
  allowRuntimeExecution: false,
  sandboxOnly: true,
  blockedByDefault: true,
} as const;

function tool(overrides: Partial<McpRemoteDiscoveredTool> = {}): McpRemoteDiscoveredTool {
  return {
    externalName: 'read_status',
    displayName: 'Read Status',
    description: 'Read a status value.',
    specHash: 'hash_read_status',
    inferredRiskLevel: 'low',
    requiresApproval: false,
    defaultPolicy,
    ...overrides,
  };
}

function readiness() {
  return {
    status: 'ready' as const,
    failClosed: false,
    remoteEnabled: true,
    discoveryEnabled: true,
    executionEnabled: false,
    serverId: '00000000-0000-0000-0000-000000000701',
    reason: 'Ready for governed discovery.',
    checks: [],
    credentialsConfigured: false,
    authType: 'none',
    timeoutMs: 5000,
  };
}

function discovery(overrides: Partial<McpRemoteDiscoveryOutput> = {}): McpRemoteDiscoveryOutput {
  return {
    serverId: '00000000-0000-0000-0000-000000000701',
    status: 'completed',
    discoveredAt: '2026-06-26T18:00:00.000Z',
    protocolVersion: '2026-06-26',
    specHash: 'discovery_hash',
    tools: [],
    diff: {
      added: [],
      changed: [],
      removed: [],
    },
    warnings: [],
    readiness: readiness(),
    sanitizedMetadata: {
      executionBlocked: true,
      transportCalled: true,
    },
    ...overrides,
  };
}

function reviewInput(overrides: Partial<McpRemoteDiscoveryReviewInput> = {}): McpRemoteDiscoveryReviewInput {
  return {
    tenantId: '00000000-0000-0000-0000-000000000010',
    workspaceId: '00000000-0000-0000-0000-000000000020',
    requestedByUserId: '00000000-0000-0000-0000-000000000030',
    requestId: 'req_review_package',
    discovery: discovery(),
    ...overrides,
  };
}

function packageFor(input: McpRemoteDiscoveryReviewInput) {
  return new McpRemoteDiscoveryApprovalService().createReviewPackage(input);
}

describe('MCP remote discovery approval review package', () => {
  it('creates a blocked review package when discovery is blocked', () => {
    const result = packageFor(reviewInput({
      discovery: discovery({
        status: 'blocked',
        readiness: { ...readiness(), status: 'disabled', failClosed: true },
      }),
    }));

    expect(result.decision).toMatchObject({
      status: 'blocked',
      requiresHumanReview: false,
    });
    expect(result.proposedActions).toEqual([]);
    expect(result.applyPlan).toMatchObject({ status: 'blocked', canApply: false });
  });

  it('creates a blocked review package when discovery failed', () => {
    const result = packageFor(reviewInput({
      discovery: discovery({
        status: 'failed',
        warnings: [{ code: 'MCP_REMOTE_DISCOVERY_FAILED', message: 'Discovery failed.' }],
      }),
    }));

    expect(result.decision.status).toBe('blocked');
    expect(result.summary.status).toBe('failed');
    expect(result.auditEvent.decisionStatus).toBe('blocked');
  });

  it('returns no_changes and keep_existing actions when there is no diff', () => {
    const existing = tool({ specHash: 'hash_read_status' });
    const result = packageFor(reviewInput({
      discovery: discovery({
        tools: [existing],
      }),
      existingTools: [{ externalName: existing.externalName, specHash: existing.specHash }],
    }));

    expect(result.decision.status).toBe('no_changes');
    expect(result.proposedActions).toEqual([
      expect.objectContaining({
        type: 'keep_existing',
        externalName: 'read_status',
        canApplyAutomatically: false,
      }),
    ]);
  });

  it('keeps a low risk added tool blocked by default and pending human review', () => {
    const added = tool({ externalName: 'read_version', displayName: 'Read Version', specHash: 'hash_read_version' });
    const result = packageFor(reviewInput({
      discovery: discovery({
        tools: [added],
        diff: { added: [added.externalName], changed: [], removed: [] },
      }),
    }));

    expect(result.decision.status).toBe('pending_human_review');
    expect(result.decision.requiresHumanReview).toBe(true);
    expect(result.proposedActions[0]).toMatchObject({
      type: 'propose_add',
      riskLevel: 'low',
      canApplyAutomatically: false,
      defaultPolicy,
    });
  });

  it('can mark low and medium additions approved for future import only with explicit policy', () => {
    const added = tool({
      externalName: 'search_workspace_records',
      displayName: 'Search Workspace Records',
      specHash: 'hash_search_workspace_records',
      inferredRiskLevel: 'medium',
      requiresApproval: true,
    });
    const result = packageFor(reviewInput({
      discovery: discovery({
        tools: [added],
        diff: { added: [added.externalName], changed: [], removed: [] },
      }),
      approvalPolicy: {
        blockedByDefault: false,
        allowAutoApproveLowRisk: true,
        allowAutoApproveMediumRisk: true,
      },
    }));

    expect(result.decision).toMatchObject({
      status: 'approved_for_future_import',
      requiresHumanReview: false,
    });
    expect(result.applyPlan.canApply).toBe(false);
    expect(result.proposedActions[0].canApplyAutomatically).toBe(false);
  });

  it('requires human review for high risk added tools', () => {
    const added = toolWithRisk('create_invoice', 'high');
    const result = packageFor(reviewInput({
      discovery: discovery({
        tools: [added],
        diff: { added: [added.externalName], changed: [], removed: [] },
      }),
    }));

    expect(result.decision.status).toBe('pending_human_review');
    expect(result.decision.reasons).toContain('At least one discovered tool is high risk.');
    expect(result.humanReview.required).toBe(true);
  });

  it('requires human review for critical risk added tools', () => {
    const added = toolWithRisk('delete_admin_permission', 'critical');
    const result = packageFor(reviewInput({
      discovery: discovery({
        tools: [added],
        diff: { added: [added.externalName], changed: [], removed: [] },
      }),
    }));

    expect(result.decision.status).toBe('pending_human_review');
    expect(result.decision.reasons).toContain('At least one discovered tool is critical risk.');
    expect(result.humanReview.required).toBe(true);
  });

  it('requires human review for changed and removed tools', () => {
    const changed = toolWithRisk('search_workspace_records', 'medium', 'new_hash');
    const result = packageFor(reviewInput({
      discovery: discovery({
        tools: [changed],
        diff: { added: [], changed: [changed.externalName], removed: ['old_remote_tool'] },
      }),
      existingTools: [
        { externalName: changed.externalName, specHash: 'old_hash' },
        { externalName: 'old_remote_tool', specHash: 'removed_hash' },
      ],
    }));

    expect(result.decision.status).toBe('pending_human_review');
    expect(result.decision.reasons).toEqual(expect.arrayContaining([
      'At least one existing tool descriptor changed.',
      'At least one existing tool is absent from the latest discovery snapshot.',
    ]));
  });

  it('creates proposed actions for added, changed and removed tools', () => {
    const added = toolWithRisk('read_version', 'low', 'hash_read_version');
    const changed = toolWithRisk('search_workspace_records', 'medium', 'new_hash');
    const result = packageFor(reviewInput({
      discovery: discovery({
        tools: [added, changed],
        diff: { added: [added.externalName], changed: [changed.externalName], removed: ['old_remote_tool'] },
      }),
      existingTools: [
        { externalName: changed.externalName, specHash: 'old_hash' },
        { externalName: 'old_remote_tool', specHash: 'removed_hash' },
      ],
    }));

    expect(result.proposedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'propose_add', externalName: added.externalName, canApplyAutomatically: false }),
      expect.objectContaining({ type: 'propose_update', externalName: changed.externalName, previousSpecHash: 'old_hash', canApplyAutomatically: false }),
      expect.objectContaining({ type: 'propose_remove', externalName: 'old_remote_tool', previousSpecHash: 'removed_hash', canApplyAutomatically: false }),
    ]));
  });

  it('creates deterministic snapshot hashes for the same review input', () => {
    const added = toolWithRisk('read_version', 'low', 'hash_read_version');
    const input = reviewInput({
      discovery: discovery({
        tools: [added],
        diff: { added: [added.externalName], changed: [], removed: [] },
      }),
    });

    const first = packageFor(input);
    const second = packageFor(input);

    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(first.snapshotId).toBe(second.snapshotId);
    expect(first.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps audit event free of sensitive payload fields', () => {
    const added = toolWithRisk('read_version', 'low', 'hash_read_version');
    const result = packageFor(reviewInput({
      discovery: discovery({
        tools: [added],
        diff: { added: [added.externalName], changed: [], removed: [] },
        warnings: [
          { code: 'TOKEN_WARNING', message: 'token password credential apiKey secretRef embedded in https://user:pass@example.invalid' },
        ],
        sanitizedMetadata: {
          secretRef: 'vault://mcp/raw-reference',
          credentialValue: 'raw-token-fixture',
          safe: 'ok',
        },
      }),
    }));
    const serialized = JSON.stringify(result.auditEvent).toLowerCase();

    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('apikey');
    expect(serialized).not.toContain('credential');
    expect(serialized).not.toContain('secretref');
    expect(serialized).not.toContain('vault://');
    expect(serialized).not.toContain('https://user:pass@example.invalid');
  });

  it('does not call network APIs or execute tools while creating a review package', () => {
    const fetchMock = vi.fn();
    const executeTool = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const added = toolWithRisk('read_version', 'low', 'hash_read_version');

    packageFor(reviewInput({
      discovery: discovery({
        tools: [added],
        diff: { added: [added.externalName], changed: [], removed: [] },
      }),
    }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(executeTool).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

function toolWithRisk(externalName: string, riskLevel: McpRemoteDiscoveredToolRiskLevel, specHash = `hash_${externalName}`) {
  return tool({
    externalName,
    displayName: externalName.replace(/_/g, ' '),
    specHash,
    inferredRiskLevel: riskLevel,
    requiresApproval: riskLevel !== 'low',
  });
}
