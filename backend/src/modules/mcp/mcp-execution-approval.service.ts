import type { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import { mapMcpExecutionApproval } from './mcp-execution-approval.mapper';
import {
  mcpExecutionApprovalRepository,
  type McpExecutionApprovalScope,
  type McpExecutionApprovalWithRelations,
} from './mcp-execution-approval.repository';
import type {
  McpExecutionApprovalsQuery,
  McpExecutionApprovalCreateInput,
  McpExecutionApprovalDecisionInput,
} from './mcp-execution-approval.schema';

const approvalTtlMs = 10 * 60 * 1000;
const remoteServerTypes = new Set(['remote', 'external']);

export interface McpExecutionApprovalRequestContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface McpExecutionApprovalClaimInput {
  approvalId: string;
  agentRunId: string;
  tenantId: string;
  workspaceId: string;
  assistantId: string;
  assistantVersionId: string;
  actorUserId: string;
  context: McpExecutionApprovalRequestContext;
}

export interface McpExecutionApprovalGatewayInput extends McpExecutionApprovalScope {
  actorUserId: string;
  context: McpExecutionApprovalRequestContext;
}

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isReadOnlyMetadata(value: unknown) {
  return isRecord(value) && value.readOnly === true;
}

async function audit(input: {
  action: string;
  approval: Pick<
    McpExecutionApprovalWithRelations,
    'id' | 'tenantId' | 'workspaceId' | 'assistantId' | 'assistantVersionId' | 'mcpServerId' | 'mcpToolId' | 'assistantMcpBindingId'
  >;
  actorUserId?: string;
  agentRunId?: string;
  toolCallId?: string;
  context: McpExecutionApprovalRequestContext;
}) {
  await recordAuditEvent({
    tenantId: input.approval.tenantId,
    workspaceId: input.approval.workspaceId,
    actorUserId: input.actorUserId,
    action: input.action,
    entity: 'mcp_execution_approval',
    entityId: input.approval.id,
    metadata: {
      assistantId: input.approval.assistantId,
      assistantVersionId: input.approval.assistantVersionId,
      mcpServerId: input.approval.mcpServerId,
      mcpToolId: input.approval.mcpToolId,
      assistantMcpBindingId: input.approval.assistantMcpBindingId,
      ...(input.agentRunId ? { agentRunId: input.agentRunId } : {}),
      ...(input.toolCallId ? { toolCallId: input.toolCallId } : {}),
    } satisfies Prisma.InputJsonObject,
    requestId: input.context.requestId,
    ipAddress: input.context.ipAddress,
    userAgent: input.context.userAgent,
  });
}

async function expireAndAuditIfNeeded(
  approval: McpExecutionApprovalWithRelations,
  actorUserId: string | undefined,
  context: McpExecutionApprovalRequestContext,
  now = new Date(),
) {
  if (
    approval.status !== 'approved'
    && approval.status !== 'claimed'
  ) return approval;
  if (!approval.expiresAt || approval.expiresAt.getTime() > now.getTime()) return approval;

  const expired = await mcpExecutionApprovalRepository.expireIfNeeded(approval.id, now);
  if (!expired) return approval;
  await audit({
    action: 'mcp_execution_approval_expired',
    approval: expired,
    actorUserId,
    agentRunId: expired.claimedByAgentRunId ?? undefined,
    context,
  });
  return expired;
}

function assertPending(approval: McpExecutionApprovalWithRelations) {
  if (approval.status !== 'pending') {
    throw new AppError(409, 'MCP_EXECUTION_APPROVAL_INVALID_STATE', 'Approval MCP não está pendente.');
  }
}

async function findApprovalOrThrow(
  assistantId: string,
  approvalId: string,
  user: AuthenticatedUser,
) {
  const approval = await mcpExecutionApprovalRepository.findById(
    approvalId,
    assistantId,
    user.tenant.id,
    userWorkspaceIds(user),
  );
  if (!approval) {
    throw new AppError(404, 'MCP_EXECUTION_APPROVAL_NOT_FOUND', 'Approval MCP não encontrado.');
  }
  return approval;
}

export const mcpExecutionApprovalService = {
  async list(
    assistantId: string,
    query: McpExecutionApprovalsQuery,
    user: AuthenticatedUser,
    context: McpExecutionApprovalRequestContext,
  ) {
    const target = await mcpExecutionApprovalRepository.findRequestTarget(
      assistantId,
      query.mcpToolId ?? '00000000-0000-0000-0000-000000000000',
      user.tenant.id,
      userWorkspaceIds(user),
    );
    if (!target) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente não encontrado.');
    }

    const expired = await mcpExecutionApprovalRepository.expireForAssistant(
      assistantId,
      user.tenant.id,
      userWorkspaceIds(user),
      new Date(),
    );
    await Promise.all(expired.map((approval) => audit({
      action: 'mcp_execution_approval_expired',
      approval,
      actorUserId: user.id,
      agentRunId: approval.claimedByAgentRunId ?? undefined,
      context,
    })));

    const result = await mcpExecutionApprovalRepository.list(
      assistantId,
      user.tenant.id,
      userWorkspaceIds(user),
      query,
    );
    return {
      data: result.data.map(mapMcpExecutionApproval),
      pagination: paginationMeta(query, result.total),
    };
  },

  async create(
    assistantId: string,
    input: McpExecutionApprovalCreateInput,
    user: AuthenticatedUser,
    context: McpExecutionApprovalRequestContext,
  ) {
    const target = await mcpExecutionApprovalRepository.findRequestTarget(
      assistantId,
      input.mcpToolId,
      user.tenant.id,
      userWorkspaceIds(user),
    );
    if (!target) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente não encontrado.');
    }

    const publication = target.publications[0];
    if (!publication) {
      throw new AppError(
        409,
        'MCP_EXECUTION_APPROVAL_VERSION_UNAVAILABLE',
        'O assistente precisa ter uma versão publicada ativa para solicitar o approval MCP.',
      );
    }
    const binding = target.mcpBindings.find((item) => item.mcpToolId === input.mcpToolId);
    if (!binding || !binding.tool || binding.tool.id !== input.mcpToolId) {
      throw new AppError(
        409,
        'MCP_EXECUTION_APPROVAL_BINDING_REQUIRED',
        'A tool precisa possuir binding exato com o assistente.',
      );
    }
    const tool = binding.tool;
    const server = binding.server;
    if (
      tool.tenantId !== target.tenantId
      || tool.workspaceId !== target.workspaceId
      || server.tenantId !== target.tenantId
      || server.workspaceId !== target.workspaceId
      || tool.mcpServerId !== server.id
      || binding.mcpServerId !== server.id
    ) {
      throw new AppError(409, 'MCP_EXECUTION_APPROVAL_SCOPE_MISMATCH', 'Binding, tool e server estão fora do escopo do assistente.');
    }
    if (tool.deletedAt || tool.riskLevel !== 'low') {
      throw new AppError(409, 'MCP_EXECUTION_APPROVAL_TOOL_NOT_ELIGIBLE', 'Somente tools low risk e não removidas podem receber approval MCP.');
    }
    if (!remoteServerTypes.has(server.serverType) || server.deletedAt) {
      throw new AppError(409, 'MCP_EXECUTION_APPROVAL_REMOTE_REQUIRED', 'O approval MCP exige um server remoto válido.');
    }
    if (!isReadOnlyMetadata(tool.metadata)) {
      throw new AppError(409, 'MCP_EXECUTION_APPROVAL_READ_ONLY_REQUIRED', 'A tool precisa declarar metadata READ-ONLY.');
    }
    if (tool.requiresApproval !== true && binding.requiresApprovalOverride !== true) {
      throw new AppError(409, 'MCP_EXECUTION_APPROVAL_NOT_REQUIRED', 'A tool ou seu binding precisa continuar exigindo approval.');
    }

    const approval = await mcpExecutionApprovalRepository.create({
      tenantId: target.tenantId,
      workspaceId: target.workspaceId,
      assistantId: target.id,
      assistantVersionId: publication.assistantVersionId,
      mcpServerId: server.id,
      mcpToolId: tool.id,
      assistantMcpBindingId: binding.id,
      requestedById: user.id,
      reason: input.reason,
      metadata: {
        readOnlyAtRequest: true,
        riskLevelAtRequest: 'low',
        ttlMinutes: 10,
      },
    });
    await audit({
      action: 'mcp_execution_approval_requested',
      approval,
      actorUserId: user.id,
      context,
    });
    return mapMcpExecutionApproval(approval);
  },

  async approve(
    assistantId: string,
    approvalId: string,
    input: McpExecutionApprovalDecisionInput,
    user: AuthenticatedUser,
    context: McpExecutionApprovalRequestContext,
  ) {
    const current = await findApprovalOrThrow(assistantId, approvalId, user);
    assertPending(current);
    const approvedAt = new Date();
    const approval = await mcpExecutionApprovalRepository.decide({
      approvalId,
      assistantId,
      tenantId: user.tenant.id,
      workspaceIds: userWorkspaceIds(user),
      fromStatuses: ['pending'],
      status: 'approved',
      decidedById: user.id,
      decisionReason: input.decisionReason,
      approvedAt,
      expiresAt: new Date(approvedAt.getTime() + approvalTtlMs),
    });
    if (!approval) {
      throw new AppError(409, 'MCP_EXECUTION_APPROVAL_INVALID_STATE', 'Approval MCP não pôde ser aprovado.');
    }
    await audit({ action: 'mcp_execution_approval_approved', approval, actorUserId: user.id, context });
    return mapMcpExecutionApproval(approval);
  },

  async reject(
    assistantId: string,
    approvalId: string,
    input: McpExecutionApprovalDecisionInput,
    user: AuthenticatedUser,
    context: McpExecutionApprovalRequestContext,
  ) {
    const current = await findApprovalOrThrow(assistantId, approvalId, user);
    assertPending(current);
    const approval = await mcpExecutionApprovalRepository.decide({
      approvalId,
      assistantId,
      tenantId: user.tenant.id,
      workspaceIds: userWorkspaceIds(user),
      fromStatuses: ['pending'],
      status: 'rejected',
      decidedById: user.id,
      decisionReason: input.decisionReason,
      rejectedAt: new Date(),
    });
    if (!approval) {
      throw new AppError(409, 'MCP_EXECUTION_APPROVAL_INVALID_STATE', 'Approval MCP não pôde ser rejeitado.');
    }
    await audit({ action: 'mcp_execution_approval_rejected', approval, actorUserId: user.id, context });
    return mapMcpExecutionApproval(approval);
  },

  async cancel(
    assistantId: string,
    approvalId: string,
    input: McpExecutionApprovalDecisionInput,
    user: AuthenticatedUser,
    context: McpExecutionApprovalRequestContext,
  ) {
    let current = await findApprovalOrThrow(assistantId, approvalId, user);
    current = await expireAndAuditIfNeeded(current, user.id, context);
    if (current.status !== 'pending' && current.status !== 'approved') {
      throw new AppError(409, 'MCP_EXECUTION_APPROVAL_INVALID_STATE', 'Approval MCP não pode ser cancelado neste estado.');
    }
    const approval = await mcpExecutionApprovalRepository.decide({
      approvalId,
      assistantId,
      tenantId: user.tenant.id,
      workspaceIds: userWorkspaceIds(user),
      fromStatuses: ['pending', 'approved'],
      status: 'cancelled',
      decidedById: user.id,
      decisionReason: input.decisionReason,
      cancelledAt: new Date(),
    });
    if (!approval) {
      throw new AppError(409, 'MCP_EXECUTION_APPROVAL_INVALID_STATE', 'Approval MCP não pôde ser cancelado.');
    }
    await audit({ action: 'mcp_execution_approval_cancelled', approval, actorUserId: user.id, context });
    return mapMcpExecutionApproval(approval);
  },

  async claimForAgentRun(input: McpExecutionApprovalClaimInput) {
    let approval = await mcpExecutionApprovalRepository.findById(
      input.approvalId,
      input.assistantId,
      input.tenantId,
      [input.workspaceId],
    );
    if (!approval) return null;
    approval = await expireAndAuditIfNeeded(approval, input.actorUserId, input.context);
    if (
      approval.status !== 'approved'
      || approval.tenantId !== input.tenantId
      || approval.workspaceId !== input.workspaceId
      || approval.assistantId !== input.assistantId
      || approval.assistantVersionId !== input.assistantVersionId
    ) return null;

    const claimed = await mcpExecutionApprovalRepository.claim({
      approvalId: approval.id,
      tenantId: approval.tenantId,
      workspaceId: approval.workspaceId,
      assistantId: approval.assistantId,
      assistantVersionId: approval.assistantVersionId,
      mcpServerId: approval.mcpServerId,
      mcpToolId: approval.mcpToolId,
      assistantMcpBindingId: approval.assistantMcpBindingId,
      agentRunId: input.agentRunId,
      now: new Date(),
    });
    if (!claimed) return null;
    await audit({
      action: 'mcp_execution_approval_claimed',
      approval: claimed,
      actorUserId: input.actorUserId,
      agentRunId: input.agentRunId,
      context: input.context,
    });
    return claimed;
  },

  async validateClaimedForGateway(input: McpExecutionApprovalGatewayInput) {
    const approval = await mcpExecutionApprovalRepository.findClaimedForGateway({
      ...input,
      now: new Date(),
    });
    if (!approval) return null;
    const current = await expireAndAuditIfNeeded(approval, input.actorUserId, input.context);
    return current.status === 'claimed' ? current : null;
  },

  async consumeForGateway(input: McpExecutionApprovalGatewayInput & { toolCallId: string }) {
    const approval = await mcpExecutionApprovalRepository.consume({
      ...input,
      toolCallId: input.toolCallId,
      now: new Date(),
    });
    if (!approval) return null;
    await audit({
      action: 'mcp_execution_approval_consumed',
      approval,
      actorUserId: input.actorUserId,
      agentRunId: input.agentRunId,
      toolCallId: input.toolCallId,
      context: input.context,
    });
    return approval;
  },

  correlateConsumedToolCall(agentRunId: string, toolCallId: string) {
    return mcpExecutionApprovalRepository.correlateConsumedToolCall(agentRunId, toolCallId);
  },
};
