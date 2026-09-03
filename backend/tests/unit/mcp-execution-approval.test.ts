import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  repository: {
    findRequestTarget: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    decide: vi.fn(),
    expireIfNeeded: vi.fn(),
    expireForAssistant: vi.fn(),
    claim: vi.fn(),
    findClaimedForGateway: vi.fn(),
    consume: vi.fn(),
    correlateConsumedToolCall: vi.fn(),
  },
  recordAuditEvent: vi.fn(),
}));

vi.mock('../../src/modules/mcp/mcp-execution-approval.repository', () => ({
  mcpExecutionApprovalRepository: mocks.repository,
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

import { createAgentRunSchema } from '../../src/modules/agent-runs/agent-runs.schema';
import { mcpExecutionApprovalService } from '../../src/modules/mcp/mcp-execution-approval.service';

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const userId = '00000000-0000-0000-0000-000000000030';
const assistantId = '00000000-0000-0000-0000-000000000101';
const versionId = '00000000-0000-0000-0000-000000000201';
const serverId = '00000000-0000-0000-0000-000000000301';
const toolId = '00000000-0000-0000-0000-000000000401';
const bindingId = '00000000-0000-0000-0000-000000000501';
const approvalId = '00000000-0000-0000-0000-000000000601';
const runId = '00000000-0000-0000-0000-000000000701';

const user = {
  id: userId,
  email: 'operator@example.test',
  name: 'Operator',
  tenant: { id: tenantId, name: 'Tenant', slug: 'tenant' },
  workspaces: [{ id: workspaceId, name: 'Workspace', slug: 'workspace' }],
  roles: ['creator_owner'],
  permissions: [],
};
const requestContext = { requestId: 'req-mcp-approval' };

function targetFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: assistantId,
    tenantId,
    workspaceId,
    status: 'published',
    publications: [{ id: 'publication-1', assistantVersionId: versionId }],
    mcpBindings: [{
      id: bindingId,
      tenantId,
      workspaceId,
      assistantId,
      mcpServerId: serverId,
      mcpToolId: toolId,
      isEnabled: false,
      mode: 'disabled',
      requiresApprovalOverride: true,
      server: {
        id: serverId,
        tenantId,
        workspaceId,
        serverType: 'remote',
        status: 'disabled',
        riskLevel: 'low',
        deletedAt: null,
      },
      tool: {
        id: toolId,
        tenantId,
        workspaceId,
        mcpServerId: serverId,
        name: 'corporate.status.read',
        riskLevel: 'low',
        requiresApproval: true,
        isEnabled: false,
        deletedAt: null,
        metadata: { readOnly: true },
        policies: [{ requiresApproval: true }],
      },
    }],
    ...overrides,
  };
}

function approvalFixture(status = 'pending', overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-09-03T12:00:00.000Z');
  return {
    id: approvalId,
    tenantId,
    workspaceId,
    assistantId,
    assistantVersionId: versionId,
    mcpServerId: serverId,
    mcpToolId: toolId,
    assistantMcpBindingId: bindingId,
    requestedById: userId,
    decidedById: null,
    status,
    reason: 'Run status read once.',
    decisionReason: null,
    claimedByAgentRunId: null,
    consumedByToolCallId: null,
    approvedAt: null,
    expiresAt: null,
    claimedAt: null,
    consumedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    requestedBy: { id: userId, name: user.name, email: user.email },
    decidedBy: null,
    server: { id: serverId, name: 'Remote', serverType: 'remote', status: 'active' },
    tool: { id: toolId, name: 'corporate.status.read', riskLevel: 'low', requiresApproval: true },
    assistantMcpBinding: { id: bindingId, isEnabled: true, mode: 'enabled_placeholder', requiresApprovalOverride: true },
    ...overrides,
  };
}

describe('MCP execution approval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repository.findRequestTarget.mockResolvedValue(targetFixture());
    mocks.repository.create.mockImplementation(async (input) => approvalFixture('pending', input));
    mocks.repository.expireForAssistant.mockResolvedValue([]);
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it('creates a pending approval from a valid exact governed binding', async () => {
    const approval = await mcpExecutionApprovalService.create(
      assistantId,
      { mcpToolId: toolId, reason: 'Run status read once.' },
      user,
      requestContext,
    );

    expect(approval.status).toBe('pending');
    expect(mocks.repository.create).toHaveBeenCalledWith(expect.objectContaining({
      assistantId,
      assistantVersionId: versionId,
      mcpServerId: serverId,
      mcpToolId: toolId,
      assistantMcpBindingId: bindingId,
      requestedById: userId,
    }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mcp_execution_approval_requested',
      entity: 'mcp_execution_approval',
    }));
  });

  it('rejects a request for a tool without an exact binding', async () => {
    mocks.repository.findRequestTarget.mockResolvedValue(targetFixture({ mcpBindings: [] }));

    await expect(mcpExecutionApprovalService.create(
      assistantId,
      { mcpToolId: toolId },
      user,
      requestContext,
    )).rejects.toMatchObject({ code: 'MCP_EXECUTION_APPROVAL_BINDING_REQUIRED' });
    expect(mocks.repository.create).not.toHaveBeenCalled();
  });

  it('rejects a tool without explicit READ-ONLY metadata', async () => {
    const target = targetFixture();
    target.mcpBindings[0].tool.metadata = { readOnly: false };
    mocks.repository.findRequestTarget.mockResolvedValue(target);

    await expect(mcpExecutionApprovalService.create(
      assistantId,
      { mcpToolId: toolId },
      user,
      requestContext,
    )).rejects.toMatchObject({ code: 'MCP_EXECUTION_APPROVAL_READ_ONLY_REQUIRED' });
  });

  it('approves only pending requests and sets a ten-minute expiry', async () => {
    const now = new Date('2026-09-03T15:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.repository.findById.mockResolvedValue(approvalFixture('pending'));
    mocks.repository.decide.mockImplementation(async (input) => approvalFixture('approved', {
      decidedById: userId,
      approvedAt: input.approvedAt,
      expiresAt: input.expiresAt,
    }));

    try {
      const approval = await mcpExecutionApprovalService.approve(
        assistantId,
        approvalId,
        { decisionReason: 'Approved for one governed read.' },
        user,
        requestContext,
      );
      expect(approval.status).toBe('approved');
      expect(new Date(approval.expiresAt!).getTime() - new Date(approval.approvedAt!).getTime()).toBe(600_000);
      expect(mocks.repository.decide).toHaveBeenCalledWith(expect.objectContaining({
        fromStatuses: ['pending'],
        status: 'approved',
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a pending approval terminally', async () => {
    mocks.repository.findById.mockResolvedValue(approvalFixture('pending'));
    mocks.repository.decide.mockResolvedValue(approvalFixture('rejected', { rejectedAt: new Date() }));

    const approval = await mcpExecutionApprovalService.reject(
      assistantId,
      approvalId,
      { decisionReason: 'Not authorized.' },
      user,
      requestContext,
    );

    expect(approval.status).toBe('rejected');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mcp_execution_approval_rejected',
    }));
  });

  it('cancels a pending or approved request without making it reusable', async () => {
    mocks.repository.findById.mockResolvedValue(approvalFixture('approved', {
      approvedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }));
    mocks.repository.decide.mockResolvedValue(approvalFixture('cancelled', { cancelledAt: new Date() }));

    const approval = await mcpExecutionApprovalService.cancel(
      assistantId,
      approvalId,
      {},
      user,
      requestContext,
    );

    expect(approval.status).toBe('cancelled');
    expect(mocks.repository.decide).toHaveBeenCalledWith(expect.objectContaining({
      fromStatuses: ['pending', 'approved'],
      status: 'cancelled',
    }));
  });

  it('expires an approved grant instead of claiming it', async () => {
    const expiredAt = new Date(Date.now() - 1_000);
    mocks.repository.findById.mockResolvedValue(approvalFixture('approved', { expiresAt: expiredAt }));
    mocks.repository.expireIfNeeded.mockResolvedValue(approvalFixture('expired', { expiresAt: expiredAt }));

    const claimed = await mcpExecutionApprovalService.claimForAgentRun({
      approvalId,
      agentRunId: runId,
      tenantId,
      workspaceId,
      assistantId,
      assistantVersionId: versionId,
      actorUserId: userId,
      context: requestContext,
    });

    expect(claimed).toBeNull();
    expect(mocks.repository.claim).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mcp_execution_approval_expired',
    }));
  });

  it('allows exactly one atomic claim and refuses reuse by a second run', async () => {
    const approved = approvalFixture('approved', { expiresAt: new Date(Date.now() + 60_000) });
    const claimed = approvalFixture('claimed', {
      expiresAt: approved.expiresAt,
      claimedByAgentRunId: runId,
      claimedAt: new Date(),
    });
    mocks.repository.findById.mockResolvedValue(approved);
    mocks.repository.claim.mockResolvedValueOnce(claimed).mockResolvedValueOnce(null);

    const first = await mcpExecutionApprovalService.claimForAgentRun({
      approvalId,
      agentRunId: runId,
      tenantId,
      workspaceId,
      assistantId,
      assistantVersionId: versionId,
      actorUserId: userId,
      context: requestContext,
    });
    const second = await mcpExecutionApprovalService.claimForAgentRun({
      approvalId,
      agentRunId: '00000000-0000-0000-0000-000000000702',
      tenantId,
      workspaceId,
      assistantId,
      assistantVersionId: versionId,
      actorUserId: userId,
      context: requestContext,
    });

    expect(first?.status).toBe('claimed');
    expect(second).toBeNull();
    expect(mocks.repository.claim).toHaveBeenCalledTimes(2);
  });

  it('refuses an approval bound to another assistant version', async () => {
    mocks.repository.findById.mockResolvedValue(approvalFixture('approved', {
      expiresAt: new Date(Date.now() + 60_000),
    }));

    const result = await mcpExecutionApprovalService.claimForAgentRun({
      approvalId,
      agentRunId: runId,
      tenantId,
      workspaceId,
      assistantId,
      assistantVersionId: '00000000-0000-0000-0000-000000000299',
      actorUserId: userId,
      context: requestContext,
    });

    expect(result).toBeNull();
    expect(mocks.repository.claim).not.toHaveBeenCalled();
  });

  it('does not accept a separate mcpToolId when creating an AgentRun', () => {
    const parsed = createAgentRunSchema.safeParse({
      mode: 'published',
      input: 'Read status.',
      mcpExecutionApprovalId: approvalId,
      mcpToolId: toolId,
    });

    expect(parsed.success).toBe(false);
  });
});
