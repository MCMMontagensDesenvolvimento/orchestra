import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { logger } from '../../infrastructure/logger/logger';
import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import { buildRuntimeExecutionContext } from '../runtime/runtime.context';
import { normalizeRuntimeEvents } from '../runtime/runtime.events';
import { runtimeAdapterRegistry } from '../runtime/runtime.registry';
import { runtimeService } from '../runtime/runtime.service';
import { mapAgentRun, mapAgentRunEvent } from './agent-runs.mapper';
import { agentRunPolicies } from './agent-runs.policy';
import { agentRunsRepository } from './agent-runs.repository';
import type { AgentRunMode, AgentRunsQuery, CreateAgentRunInput } from './agent-runs.schema';
import type { AgentRunEventInput, AgentRunPrecheckSnapshot, PrecheckReason, RequestContext } from './agent-runs.types';

type AssistantForRun = NonNullable<Awaited<ReturnType<typeof agentRunsRepository.findAssistantForRun>>>;
type PolicyForRun = Awaited<ReturnType<typeof agentRunsRepository.getExecutionPolicy>>;

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);
const unsafeMetadataKeys = new Set(['instructions', 'prompt', 'content', 'secret', 'token', 'password', 'apikey', 'apiKey', 'authorization']);
const cancellableStatuses = new Set(['queued', 'prechecking', 'running']);

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 300);
  if (depth >= 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 30)
      .map(([key, item]) => {
        const normalizedKey = key.toLowerCase();
        return [
          key,
          unsafeMetadataKeys.has(key) || unsafeMetadataKeys.has(normalizedKey)
            ? '[redacted]'
            : sanitizeMetadata(item, depth + 1),
        ];
      }),
  );
}

function summarizeInput(input: string) {
  return input.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function mergeRuntimeMetadata(input: {
  metadata?: Prisma.InputJsonValue;
  provider: string;
  runtimeStatus: string;
  inputHash: string;
  outputHash?: string;
  outputPreview?: string;
  runtimeMetadata?: Prisma.InputJsonValue;
  ragSummary?: { ragReady: boolean; knowledgeBindingsCount: number; chunkCount: number; sourceReferenceCount: number; lastRagQueryId: string | null };
  mcpSummary?: { mcpBindingsCount: number; allowedSandboxTools: unknown[]; blockedTools: unknown[]; requiresApproval: unknown[]; lastToolCallIds: string[] };
}): Prisma.InputJsonValue {
  const base = typeof input.metadata === 'object' && input.metadata && !Array.isArray(input.metadata)
    ? input.metadata as Record<string, unknown>
    : {};

  return {
    ...base,
    runtime: {
      provider: input.provider,
      status: input.runtimeStatus,
      inputHash: input.inputHash,
      outputHash: input.outputHash,
      outputPreview: input.outputPreview,
      adapterMetadata: input.runtimeMetadata,
      rag: input.ragSummary,
      mcp: input.mcpSummary
        ? {
          mcpBindingsCount: input.mcpSummary.mcpBindingsCount,
          allowedSandboxTools: input.mcpSummary.allowedSandboxTools.length,
          blockedTools: input.mcpSummary.blockedTools.length,
          requiresApproval: input.mcpSummary.requiresApproval.length,
          lastToolCallIds: input.mcpSummary.lastToolCallIds,
        }
        : undefined,
    },
  } as Prisma.InputJsonValue;
}

async function recordDenied(
  user: AuthenticatedUser,
  workspaceId: string | undefined,
  entityId: string | undefined,
  policy: string,
  context: RequestContext,
) {
  await recordAuditEvent({
    tenantId: user.tenant.id,
    workspaceId,
    actorUserId: user.id,
    action: 'permission_denied',
    entity: 'agent_run',
    entityId,
    metadata: { policy },
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
}

async function assertAllowed(
  allowed: boolean,
  policy: string,
  user: AuthenticatedUser,
  workspaceId: string | undefined,
  entityId: string | undefined,
  context: RequestContext,
) {
  if (allowed) return;
  await recordDenied(user, workspaceId, entityId, policy, context);
  throw new AppError(403, 'FORBIDDEN', 'Permissao insuficiente para esta acao.');
}

async function getAssistantOrThrow(assistantId: string, user: AuthenticatedUser) {
  const assistant = await agentRunsRepository.findAssistantForRun(assistantId, user.tenant.id, userWorkspaceIds(user));
  if (!assistant) {
    throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
  }
  return assistant;
}

async function getRunOrThrow(runId: string, user: AuthenticatedUser) {
  const run = await agentRunsRepository.findById(runId, user.tenant.id, userWorkspaceIds(user));
  if (!run) {
    throw new AppError(404, 'AGENT_RUN_NOT_FOUND', 'Run de agente nao encontrado.');
  }
  return run;
}

function activePublication(assistant: AssistantForRun) {
  return assistant.publications[0] ?? null;
}

async function buildPrecheckSnapshot(
  assistant: AssistantForRun,
  policy: PolicyForRun,
  mode: AgentRunMode,
  context: RequestContext,
) {
  const publication = activePublication(assistant);
  const pendingApprovals = await agentRunsRepository.countPendingApprovals(assistant.id, ['publish', 'enable_execution']);
  const reasons: PrecheckReason[] = [];

  if (assistant.status === 'archived') {
    reasons.push({ code: 'ASSISTANT_ARCHIVED', message: 'Assistente arquivado nao pode executar.' });
  }
  if (mode === 'archived') {
    reasons.push({ code: 'MODE_ARCHIVED', message: 'Modo archived e apenas estado de bloqueio, nao modo executavel.' });
  }
  if (mode === 'blocked') {
    reasons.push({ code: 'MODE_BLOCKED', message: 'Modo blocked impede execucao.' });
  }
  if (mode === 'draft_test' && !policy.allowDraftTesting) {
    reasons.push({ code: 'DRAFT_TESTING_DISABLED', message: 'Testes em draft estao desabilitados pela policy.' });
  }
  if (mode === 'sandbox') {
    if (!policy.sandboxEnabled) reasons.push({ code: 'SANDBOX_DISABLED', message: 'Sandbox esta desabilitado pela policy.' });
    if (!policy.sandboxBlocksExternalTools) reasons.push({ code: 'EXTERNAL_TOOLS_NOT_BLOCKED', message: 'Sandbox deve bloquear tools externas nesta fase.' });
    if (!policy.sandboxBlocksRealProviders) reasons.push({ code: 'REAL_PROVIDERS_NOT_BLOCKED', message: 'Sandbox deve bloquear providers reais nesta fase.' });
    if (!policy.sandboxLogsRequired) reasons.push({ code: 'SANDBOX_LOGS_REQUIRED', message: 'Sandbox exige logs para rastreabilidade.' });
  }
  if (mode === 'published') {
    if (assistant.status !== 'published') reasons.push({ code: 'ASSISTANT_NOT_PUBLISHED', message: 'Assistente nao esta publicado.' });
    if (!publication) reasons.push({ code: 'NO_ACTIVE_PUBLICATION', message: 'O assistente nao possui publicacao ativa.' });
    if (!policy.allowPublishedExecution) reasons.push({ code: 'PUBLISHED_EXECUTION_DISABLED', message: 'Execucao published nao foi liberada pela policy.' });
    if (!policy.isExecutionEnabled) reasons.push({ code: 'EXECUTION_DISABLED', message: 'Execucao esta desabilitada pela policy.' });
    if (pendingApprovals > 0) reasons.push({ code: 'PENDING_APPROVAL', message: 'Ha approval pendente relacionado a publicacao ou execucao.' });
  }

  return {
    canExecute: reasons.length === 0,
    mode,
    reasons,
    requestId: context.requestId,
  } satisfies AgentRunPrecheckSnapshot;
}

function baseEvents(input: {
  mode: AgentRunMode;
  source: string;
  traceId: string;
  assistantId: string;
}): AgentRunEventInput[] {
  return [
    {
      type: 'run.requested',
      status: 'queued',
      message: 'Run solicitado pelo control plane.',
      metadata: {
        mode: input.mode,
        source: input.source,
        traceId: input.traceId,
        assistantId: input.assistantId,
      },
    },
    {
      type: 'run.precheck_started',
      status: 'prechecking',
      message: 'Precheck obrigatorio iniciado.',
      metadata: {
        mode: input.mode,
      },
    },
  ];
}

async function recordRunAudit(input: {
  user: AuthenticatedUser;
  assistant: Pick<AssistantForRun, 'id' | 'workspaceId'>;
  runId: string;
  traceId: string;
  action: string;
  mode: AgentRunMode;
  status?: string;
  context: RequestContext;
  metadata?: Prisma.InputJsonValue;
}) {
  await recordAuditEvent({
    tenantId: input.user.tenant.id,
    workspaceId: input.assistant.workspaceId,
    actorUserId: input.user.id,
    action: input.action,
    entity: 'agent_run',
    entityId: input.runId,
    metadata: {
      assistantId: input.assistant.id,
      mode: input.mode,
      status: input.status,
      traceId: input.traceId,
      ...(typeof input.metadata === 'object' && input.metadata ? input.metadata : {}),
    },
    requestId: input.context.requestId,
    ipAddress: input.context.ipAddress,
    userAgent: input.context.userAgent,
  });
}

function selectedVersionId(assistant: AssistantForRun, mode: AgentRunMode) {
  const publication = activePublication(assistant);
  if (mode === 'published' && publication) return publication.assistantVersionId;
  return assistant.versions[0]?.id ?? null;
}

export const agentRunsService = {
  async createForAssistant(assistantId: string, input: CreateAgentRunInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    await assertAllowed(
      agentRunPolicies.canCreateAgentRun(user, assistant),
      'canCreateAgentRun',
      user,
      assistant.workspaceId,
      assistant.id,
      context,
    );
    await assertAllowed(
      agentRunPolicies.canRunPrecheck(user, assistant),
      'canRunPrecheck',
      user,
      assistant.workspaceId,
      assistant.id,
      context,
    );
    if (input.mode === 'sandbox') {
      await assertAllowed(
        agentRunPolicies.canRunSandbox(user, assistant),
        'canRunSandbox',
        user,
        assistant.workspaceId,
        assistant.id,
        context,
      );
    }
    if (input.mode === 'published') {
      await assertAllowed(
        agentRunPolicies.canRunPublished(user, assistant),
        'canRunPublished',
        user,
        assistant.workspaceId,
        assistant.id,
        context,
      );
    }

    const runId = randomUUID();
    const traceId = `trace_${randomUUID()}`;
    const policy = await agentRunsRepository.getExecutionPolicy(assistant);
    const precheck = await buildPrecheckSnapshot(assistant, policy, input.mode, context);
    const publication = activePublication(assistant);
    const assistantVersionId = selectedVersionId(assistant, input.mode);
    const assistantPublicationId = input.mode === 'published' ? publication?.id ?? null : null;
    const sanitizedMetadata = sanitizeMetadata(input.metadata) as Prisma.InputJsonValue | undefined;
    const requestedEvents = baseEvents({ mode: input.mode, source: input.source, traceId, assistantId: assistant.id });
    const runtimeProvider = runtimeAdapterRegistry.currentProvider();

    await recordRunAudit({ user, assistant, runId, traceId, action: 'agent_run_requested', mode: input.mode, status: 'queued', context });

    if (!precheck.canExecute) {
      const firstReason = precheck.reasons[0];
      const now = new Date();
      const run = await agentRunsRepository.createRun({
        id: runId,
        tenantId: user.tenant.id,
        workspaceId: assistant.workspaceId,
        assistantId: assistant.id,
        assistantVersionId,
        assistantPublicationId,
        requestedById: user.id,
        status: 'blocked',
        mode: input.mode,
        source: input.source,
        inputSummary: summarizeInput(input.input),
        requestId: context.requestId,
        traceId,
        blockedAt: now,
        errorCode: firstReason?.code,
        errorMessage: firstReason?.message,
        precheckSnapshot: precheck as unknown as Prisma.InputJsonValue,
        metadata: mergeRuntimeMetadata({
          metadata: sanitizedMetadata,
          provider: runtimeProvider,
          runtimeStatus: 'blocked',
          inputHash: 'not_computed_precheck_blocked',
        }),
        events: [
          ...requestedEvents,
          {
            type: 'run.precheck_failed',
            status: 'blocked',
            message: 'Precheck bloqueou a execucao.',
            metadata: { reasons: precheck.reasons.map((reason) => reason.code) },
          },
          {
            type: 'run.blocked',
            status: 'blocked',
            message: firstReason?.message ?? 'Execucao bloqueada por governanca.',
            metadata: { traceId },
          },
        ],
      });

      await recordRunAudit({
        user,
        assistant,
        runId,
        traceId,
        action: 'runtime_execution_blocked',
        mode: input.mode,
        status: 'blocked',
        context,
        metadata: { provider: runtimeProvider, reasons: precheck.reasons.map((reason) => reason.code) },
      });
      await recordRunAudit({
        user,
        assistant,
        runId,
        traceId,
        action: 'agent_run_blocked',
        mode: input.mode,
        status: 'blocked',
        context,
        metadata: { reasons: precheck.reasons.map((reason) => reason.code) },
      });
      logger.info({ requestId: context.requestId, traceId, runId, assistantId: assistant.id, status: 'blocked' }, 'agent run blocked');
      return mapAgentRun(run);
    }

    await recordRunAudit({ user, assistant, runId, traceId, action: 'agent_run_precheck_passed', mode: input.mode, status: 'prechecking', context });
    const runtimeContext = await buildRuntimeExecutionContext({
      runId,
      traceId,
      requestId: context.requestId,
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      userId: user.id,
      assistant,
      assistantVersionId,
      assistantPublicationId,
      executionMode: input.mode,
      provider: runtimeProvider,
      input: input.input,
      executionPolicy: policy as unknown as Record<string, unknown>,
      precheckSnapshot: precheck,
      metadata: sanitizedMetadata,
    });
    const adapterHealth = await runtimeService.health(user, context);
    await recordRunAudit({
      user,
      assistant,
      runId,
      traceId,
      action: 'runtime_adapter_resolved',
      mode: input.mode,
      status: adapterHealth.status,
      context,
      metadata: { provider: runtimeProvider, healthStatus: adapterHealth.status },
    });
    await recordRunAudit({
      user,
      assistant,
      runId,
      traceId,
      action: 'runtime_execution_started',
      mode: input.mode,
      status: 'running',
      context,
      metadata: { provider: runtimeProvider },
    });
    const runtimeResult = await runtimeService.execute(runtimeContext);
    const normalizedRuntimeEvents = normalizeRuntimeEvents(runtimeResult);
    const now = new Date();
    const isFailed = runtimeResult.status === 'failed';
    const isBlocked = runtimeResult.status === 'blocked';
    const run = await agentRunsRepository.createRun({
      id: runId,
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      assistantId: assistant.id,
      assistantVersionId,
      assistantPublicationId,
      requestedById: user.id,
      status: runtimeResult.status,
      mode: input.mode,
      source: input.source,
      inputSummary: summarizeInput(input.input),
      requestId: context.requestId,
      traceId,
      startedAt: now,
      completedAt: isFailed || isBlocked ? undefined : now,
      failedAt: isFailed ? now : undefined,
      blockedAt: isBlocked ? now : undefined,
      errorCode: runtimeResult.errorCode,
      errorMessage: runtimeResult.errorMessage,
      precheckSnapshot: precheck as unknown as Prisma.InputJsonValue,
      metadata: mergeRuntimeMetadata({
        metadata: sanitizedMetadata,
        provider: runtimeResult.provider,
        runtimeStatus: runtimeResult.status,
        inputHash: runtimeContext.input.hash,
        outputHash: runtimeResult.outputHash,
        outputPreview: runtimeResult.outputPreview,
        runtimeMetadata: runtimeResult.metadata,
        ragSummary: {
          ragReady: runtimeContext.rag.ragReady,
          knowledgeBindingsCount: runtimeContext.rag.knowledgeBindingsCount,
          chunkCount: runtimeContext.rag.chunkCount,
          sourceReferenceCount: runtimeContext.rag.sourceReferenceCount,
          lastRagQueryId: runtimeContext.rag.lastRagQueryId,
        },
        mcpSummary: runtimeContext.mcp,
      }),
      events: [
        ...requestedEvents,
        {
          type: 'run.precheck_passed',
          status: 'running',
          message: 'Precheck aprovado.',
          metadata: { traceId, runtimeProvider },
        },
        ...normalizedRuntimeEvents,
      ],
    });

    await recordRunAudit({ user, assistant, runId, traceId, action: 'agent_run_started', mode: input.mode, status: 'running', context });
    await recordRunAudit({
      user,
      assistant,
      runId,
      traceId,
      action: isBlocked
        ? 'runtime_execution_blocked'
        : isFailed
          ? 'runtime_execution_failed'
          : 'runtime_execution_completed',
      mode: input.mode,
      status: runtimeResult.status,
      context,
      metadata: { provider: runtimeResult.provider },
    });
    await recordRunAudit({
      user,
      assistant,
      runId,
      traceId,
      action: isBlocked
        ? 'agent_run_blocked'
        : isFailed
          ? 'agent_run_failed'
          : 'agent_run_completed',
      mode: input.mode,
      status: runtimeResult.status,
      context,
    });
    logger.info(
      { requestId: context.requestId, traceId, runId, assistantId: assistant.id, status: runtimeResult.status },
      isBlocked ? 'agent run blocked by runtime' : 'agent run completed',
    );
    return mapAgentRun(run);
  },

  async listByAssistant(assistantId: string, user: AuthenticatedUser, query: AgentRunsQuery, context: RequestContext) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    await assertAllowed(agentRunPolicies.canReadAgentRun(user, assistant), 'canReadAgentRun', user, assistant.workspaceId, assistant.id, context);
    const result = await agentRunsRepository.listByAssistant(user.tenant.id, userWorkspaceIds(user), assistant.id, query);
    return {
      data: result.data.map(mapAgentRun),
      pagination: paginationMeta(query, result.total),
    };
  },

  async list(user: AuthenticatedUser, query: AgentRunsQuery) {
    const result = await agentRunsRepository.list(user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapAgentRun),
      pagination: paginationMeta(query, result.total),
    };
  },

  async get(runId: string, user: AuthenticatedUser, context: RequestContext) {
    const run = await getRunOrThrow(runId, user);
    await assertAllowed(agentRunPolicies.canReadAgentRun(user, run), 'canReadAgentRun', user, run.workspaceId, run.id, context);
    return mapAgentRun(run);
  },

  async events(runId: string, user: AuthenticatedUser, context: RequestContext) {
    const run = await getRunOrThrow(runId, user);
    await assertAllowed(agentRunPolicies.canReadAgentRun(user, run), 'canReadAgentRun', user, run.workspaceId, run.id, context);
    const events = await agentRunsRepository.listEvents(run.id, user.tenant.id, userWorkspaceIds(user));
    return events.map(mapAgentRunEvent);
  },

  async cancel(runId: string, user: AuthenticatedUser, context: RequestContext) {
    const run = await getRunOrThrow(runId, user);
    await assertAllowed(agentRunPolicies.canCancelAgentRun(user, run), 'canCancelAgentRun', user, run.workspaceId, run.id, context);
    if (!cancellableStatuses.has(run.status)) {
      throw new AppError(409, 'RUN_NOT_CANCELLABLE', 'Run nao pode ser cancelado no status atual.');
    }

    const runtimeResult = await runtimeService.cancel({ runId: run.id, traceId: run.traceId });
    const cancelledAt = new Date();
    const updated = await agentRunsRepository.updateRun(run.id, {
      status: 'cancelled',
      cancelledAt,
      completedAt: null,
      failedAt: null,
    });
    await agentRunsRepository.appendEvents(updated, normalizeRuntimeEvents(runtimeResult));
    const refreshed = await getRunOrThrow(run.id, user);
    await recordRunAudit({
      user,
      assistant: { id: run.assistantId, workspaceId: run.workspaceId },
      runId: run.id,
      traceId: run.traceId,
      action: 'agent_run_cancelled',
      mode: run.mode as AgentRunMode,
      status: 'cancelled',
      context,
    });
    logger.info({ requestId: context.requestId, traceId: run.traceId, runId: run.id, status: 'cancelled' }, 'agent run cancelled');
    return mapAgentRun(refreshed);
  },
};
