import { describe, expect, it } from 'vitest';

import type { McpRemoteImportPlan } from '@/services/mcp.service';
import {
  buildMcpRemoteManualApplyPayload,
  isMcpRemoteManualApplyReady,
} from './mcpRemoteApproval';

function planFixture(
  overrides: Partial<McpRemoteImportPlan> = {},
): McpRemoteImportPlan {
  return {
    planId: 'mcp_remote_catalog_import_plan_aaaaaaaaaaaaaaaaaaaaaaaa',
    planHash: 'a'.repeat(64),
    snapshotId: 'mcp_remote_discovery_bbbbbbbbbbbbbbbbbbbbbbbb',
    snapshotHash: 'b'.repeat(64),
    serverId: '00000000-0000-0000-0000-000000000701',
    tenantId: '00000000-0000-0000-0000-000000000010',
    workspaceId: '00000000-0000-0000-0000-000000000020',
    requestedByUserId: '00000000-0000-0000-0000-000000000001',
    requestId: 'req_frontend_manual_apply',
    createdAt: '2026-08-28T17:34:29.059Z',
    sourceDecisionStatus: 'pending_human_review',
    status: 'pending_approval',
    operations: [
      {
        operationId: 'mcp_remote_catalog_op_aaaaaaaaaaaaaaaaaaaaaaaa',
        type: 'create_tool_draft',
        externalName: 'corporate.status.read',
        displayName: 'Corporate Status Read',
        reason: 'Nova ferramenta descoberta.',
        riskLevel: 'low',
        requiresApproval: true,
        canApply: false,
        canApplyAutomatically: false,
        specHash: 'c'.repeat(64),
        previousSpecHash: null,
        policyDraft: {
          allowRuntimeExecution: false,
          sandboxOnly: true,
          blockedByDefault: true,
          approvalMode: 'manual',
          runtimeEnabled: false,
          remoteExecutionEnabled: false,
        },
        validationMessages: [],
      },
    ],
    summary: {
      totalOperations: 1,
      create: 1,
      update: 0,
      deprecate: 0,
      noop: 0,
      blocked: 0,
    },
    riskSummary: {
      low: 1,
      medium: 0,
      high: 0,
      critical: 0,
    },
    validation: {
      valid: true,
      errors: [],
      warnings: [],
    },
    preflight: {
      canApply: false,
      canApplyAutomatically: false,
      requiresManualApproval: true,
      checks: [],
    },
    sanitizedMetadata: {
      noRuntimePublish: true,
      noToolExecution: true,
    },
    ...overrides,
  };
}

describe('MCP remote manual approval UI guard', () => {
  it('creates only the public Manual Apply payload', () => {
    const payload = buildMcpRemoteManualApplyPayload(
      planFixture(),
      '  Aprovação corporativa read-only.  ',
    );

    expect(payload).toEqual({
      planId: 'mcp_remote_catalog_import_plan_aaaaaaaaaaaaaaaaaaaaaaaa',
      planHash: 'a'.repeat(64),
      confirmManualApply: true,
      approvalReason: 'Aprovação corporativa read-only.',
    });

    expect(Object.keys(payload).sort()).toEqual([
      'approvalReason',
      'confirmManualApply',
      'planHash',
      'planId',
    ]);
  });

  it('rejects a short approval reason', () => {
    expect(() => buildMcpRemoteManualApplyPayload(
      planFixture(),
      'curto',
    )).toThrow(/pelo menos 8 caracteres/i);
  });

  it('rejects a plan that attempts to open runtime execution', () => {
    const plan = planFixture();

    plan.operations[0].policyDraft.runtimeEnabled = true;

    expect(isMcpRemoteManualApplyReady(plan)).toBe(false);
    expect(() => buildMcpRemoteManualApplyPayload(
      plan,
      'Aprovação governada.',
    )).toThrow(/não está apto/i);
  });
});
