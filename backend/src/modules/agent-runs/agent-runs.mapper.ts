import type { AgentRun, AgentRunEvent } from '@prisma/client';

export function mapAgentRunEvent(event: AgentRunEvent) {
  return {
    id: event.id,
    agentRunId: event.agentRunId,
    tenantId: event.tenantId,
    workspaceId: event.workspaceId,
    type: event.type,
    sequence: event.sequence,
    status: event.status,
    message: event.message,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}

export function mapAgentRun(run: AgentRun & { events?: AgentRunEvent[] }) {
  return {
    id: run.id,
    tenantId: run.tenantId,
    workspaceId: run.workspaceId,
    assistantId: run.assistantId,
    assistantVersionId: run.assistantVersionId,
    assistantPublicationId: run.assistantPublicationId,
    conversationId: run.conversationId,
    requestedById: run.requestedById,
    status: run.status,
    mode: run.mode,
    source: run.source,
    inputSummary: run.inputSummary,
    requestId: run.requestId,
    traceId: run.traceId,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    failedAt: run.failedAt?.toISOString() ?? null,
    cancelledAt: run.cancelledAt?.toISOString() ?? null,
    blockedAt: run.blockedAt?.toISOString() ?? null,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    precheckSnapshot: run.precheckSnapshot,
    metadata: run.metadata,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    events: run.events?.map(mapAgentRunEvent),
  };
}
