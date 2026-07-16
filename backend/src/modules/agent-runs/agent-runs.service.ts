import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { logger } from '../../infrastructure/logger/logger';
import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import { recordAiUsageEvent } from '../ai-observability/ai-observability.service';
import { knowledgeService } from '../knowledge/knowledge.service';
import { buildAssistantRuntimeSpecV1 } from '../runtime/runtime.assistant-spec.builder';
import { getRuntimeConfig } from '../runtime/runtime.config';
import { buildRuntimeExecutionContext } from '../runtime/runtime.context';
import type {
  RuntimeConversationContext,
  RuntimeExecutionContext,
  RuntimeExecutionResult,
  RuntimeProvider,
  RuntimeResolvedRagContext,
} from '../runtime/runtime.types';
import { normalizeRuntimeEvents } from '../runtime/runtime.events';
import { runtimeAdapterRegistry } from '../runtime/runtime.registry';
import { runtimeService } from '../runtime/runtime.service';
import { getRuntimeToolGatewayConfig } from '../runtime/runtime.tool-gateway.config';
import { runtimeToolGatewayService } from '../runtime/runtime.tool-gateway.service';
import { mapAgentRun, mapAgentRunEvent } from './agent-runs.mapper';
import { agentRunPolicies } from './agent-runs.policy';
import { agentRunsRepository } from './agent-runs.repository';
import type { AgentRunMode, AgentRunsQuery, CreateAgentRunInput } from './agent-runs.schema';
import type { AgentRunEventInput, AgentRunPrecheckSnapshot, PrecheckReason, RequestContext } from './agent-runs.types';

type AssistantForRun = NonNullable<Awaited<ReturnType<typeof agentRunsRepository.findAssistantForRun>>>;
type PolicyForRun = Awaited<ReturnType<typeof agentRunsRepository.getExecutionPolicy>>;

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);
const unsafeMetadataFragments = [
  'apikey',
  'api_key',
  'argument',
  'authorization',
  'baseurl',
  'connectionstring',
  'content',
  'cookie',
  'credential',
  'descriptor',
  'endpoint',
  'header',
  'password',
  'payload',
  'prompt',
  'providerapikey',
  'rawdocuments',
  'rawmcpserverconfig',
  'rawprompt',
  'rawproviderresponse',
  'rawresponse',
  'rawtool',
  'rawtoolmanifest',
  'instructions',
  'schema',
  'secret',
  'secretref',
  'stack',
  'token',
  'toolargs',
  'tooloutput',
  'url',
];
const cancellableStatuses = new Set(['queued', 'prechecking', 'running']);
const allowedMetadataMetricKeys = new Set(['inputtokens', 'outputtokens', 'totaltokens', 'maxtokens', 'tooldescriptorcount']);

function isUnsafeMetadataKey(key: string) {
  const normalizedKey = key.replace(/[-_\s]/g, '').toLowerCase();
  if (allowedMetadataMetricKeys.has(normalizedKey)) return false;
  return unsafeMetadataFragments.some((fragment) => normalizedKey.includes(fragment));
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 300);
  if (depth >= 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value !== 'object') return undefined;

  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, 60)
    .map(([key, item]) => [
      key,
      isUnsafeMetadataKey(key)
        ? '[redacted]'
        : sanitizeMetadata(item, depth + 1),
    ] as const)
    .filter(([, item]) => typeof item !== 'undefined');

  return Object.fromEntries(entries);
}

function summarizeInput(input: string) {
  return input.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function mergeRuntimeMetadata(input: {
  metadata?: Prisma.InputJsonValue;
  provider: string;
  runtimeStatus: string;
  requestId: string;
  traceId: string;
  runId: string;
  tenantId: string;
  workspaceId: string;
  assistantId: string;
  assistantVersionId: string | null;
  assistantPublicationId: string | null;
  actorUserId: string;
  inputHash: string;
  outputHash?: string;
  errorCode?: string;
  runtimeMetadata?: Prisma.InputJsonValue;
  ragSummary?: { ragReady: boolean; knowledgeBindingsCount: number; chunkCount: number; sourceReferenceCount: number; lastRagQueryId: string | null };
  mcpSummary?: { mcpBindingsCount: number; allowedSandboxTools: unknown[]; blockedTools: unknown[]; requiresApproval: unknown[]; lastToolCallIds: string[] };
}): Prisma.InputJsonValue {
  const base = typeof input.metadata === 'object' && input.metadata && !Array.isArray(input.metadata)
    ? input.metadata as Record<string, unknown>
    : {};
  const adapterMetadata = asRecord(input.runtimeMetadata);
  const usage = runtimeUsage(adapterMetadata);
  const summary = runtimeObservationSummary(adapterMetadata);

  return sanitizeMetadata({
    ...base,
    runtime: {
      provider: input.provider,
      status: input.runtimeStatus,
      protocolVersion: stringValue(adapterMetadata?.runtimeProtocolVersion ?? adapterMetadata?.protocolVersion),
      specVersion: stringValue(adapterMetadata?.runtimeSpecVersion ?? adapterMetadata?.assistantSpecVersion),
      traceId: input.traceId,
      runId: input.runId,
      requestId: input.requestId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      assistantId: input.assistantId,
      assistantVersionId: input.assistantVersionId,
      assistantPublicationId: input.assistantPublicationId,
      actorUserId: input.actorUserId,
      inputHash: input.inputHash,
      outputHash: input.outputHash,
      errorCode: input.errorCode,
      latencyMs: numberValue(adapterMetadata?.runtimeLatencyMs ?? adapterMetadata?.latencyMs),
      usage,
      ...summary,
      policy: {
        maxContextChars: numberValue(adapterMetadata?.policyMaxContextChars),
        maxRagResults: numberValue(adapterMetadata?.policyMaxRagResults),
        maxToolCalls: numberValue(adapterMetadata?.policyMaxToolCalls ?? adapterMetadata?.maxToolCalls),
        failClosed: booleanValue(adapterMetadata?.policyFailClosed),
      },
      limits: {
        enforce: booleanValue(adapterMetadata?.limitsEnforce),
        blockedBeforeRuntime: booleanValue(adapterMetadata?.blockedBeforeRuntime),
        timeoutMs: numberValue(adapterMetadata?.timeoutMs),
      },
      adapterMetadata: input.provider === 'agno_http' ? undefined : input.runtimeMetadata,
      rag: input.ragSummary
        ? {
          ragReady: input.ragSummary.ragReady,
          knowledgeBindingsCount: input.ragSummary.knowledgeBindingsCount,
          chunkCount: input.ragSummary.chunkCount,
          sourceReferenceCount: input.ragSummary.sourceReferenceCount,
          lastRagQueryId: input.ragSummary.lastRagQueryId,
        }
        : undefined,
      mcp: input.mcpSummary
        ? {
          mcpBindingsCount: input.mcpSummary.mcpBindingsCount,
          allowedSandboxTools: input.mcpSummary.allowedSandboxTools.length,
          blockedTools: input.mcpSummary.blockedTools.length,
          requiresApproval: input.mcpSummary.requiresApproval.length,
          lastToolCallCount: input.mcpSummary.lastToolCallIds.length,
        }
        : undefined,
    },
  }) as Prisma.InputJsonValue;
}

function runtimeObservationSummary(metadata: Record<string, unknown> | undefined) {
  return {
    ragMode: stringValue(metadata?.ragMode),
    ragQueryId: stringValue(metadata?.ragQueryId),
    retrievalMode: stringValue(metadata?.retrievalMode),
    ragSourceCount: numberValue(metadata?.ragSourceCount),
    selectedSourceCount: numberValue(metadata?.selectedSourceCount),
    ragContextChars: numberValue(metadata?.ragContextChars),
    maxRagResults: numberValue(metadata?.policyMaxRagResults ?? metadata?.maxRagResults),
    requestSent: booleanValue(metadata?.requestSent),
    failedClosed: booleanValue(metadata?.failedClosed),
    conversationContextIncluded: booleanValue(metadata?.conversationContextIncluded),
    conversationContextMessageCount: numberValue(metadata?.conversationContextMessageCount),
    conversationContextChars: numberValue(metadata?.conversationContextChars),
    conversationContextTruncated: booleanValue(metadata?.conversationContextTruncated),
    toolDescriptorCount: numberValue(metadata?.toolDescriptorCount),
    approvalRequiredCount: numberValue(metadata?.approvalRequiredCount),
    maxToolCalls: numberValue(metadata?.maxToolCalls ?? metadata?.policyMaxToolCalls),
    toolCallsExecuted: numberValue(metadata?.toolCallsExecuted),
    externalMcpCalled: booleanValue(metadata?.externalMcpCalled),
    externalProviderCalled: booleanValue(metadata?.externalProviderCalled),
  };
}

function runtimeUsage(metadata: Record<string, unknown> | undefined) {
  const usage = asRecord(metadata?.runtimeUsage) ?? asRecord(metadata?.usage);
  if (!usage) return undefined;
  const normalized = {
    inputTokens: numberValue(usage.inputTokens),
    outputTokens: numberValue(usage.outputTokens),
    totalTokens: numberValue(usage.totalTokens),
    latencyMs: numberValue(usage.latencyMs),
  };
  return Object.values(normalized).some((value) => typeof value !== 'undefined') ? normalized : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.slice(0, 160) : undefined;
}

function runtimeRagQueryText(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim().slice(0, 500);
  return normalized.length >= 2 ? normalized : undefined;
}

function toResolvedRagContext(
  result: Awaited<ReturnType<typeof knowledgeService.queryRag>>,
): RuntimeResolvedRagContext {
  const status = result.status === 'completed'
    ? 'completed'
    : result.status === 'no_results'
      ? 'no_results'
      : 'blocked';
  const sourceReferences: RuntimeResolvedRagContext['sourceReferences'] = result.sources.map((source) => {
    const metadata = asRecord(source.metadata);
    return {
      id: source.sourceReferenceId ?? source.id,
      label: source.citationLabel || `Fonte ${source.rank}`,
      documentId: source.documentId,
      chunkId: source.chunkId,
      documentTitle: source.documentTitle,
      sourceName: stringValue(metadata?.sourceName) ?? sourceNameFromUri(stringValue(source.sourceUri)),
      sourceType: stringValue(source.sourceType) ?? stringValue(metadata?.sourceType) ?? null,
      sectionTitle: stringValue(source.sectionTitle) ?? stringValue(metadata?.sectionTitle) ?? null,
      pageNumber: numberValue(source.pageNumber) ?? null,
      excerpt: source.excerpt,
      score: numberValue(source.score) ?? null,
      rank: numberValue(source.rank) ?? null,
      matchType: stringValue(source.matchType) ?? null,
      retrievalMode: stringValue(result.retrievalMode) ?? null,
      ragQueryId: result.queryId,
    };
  });

  return {
    queryId: result.queryId,
    status,
    sourceReferences,
  };
}

function sourceNameFromUri(value: string | undefined) {
  if (!value) return undefined;
  if (/^(?:internal|localhost|private):/i.test(value)) return undefined;
  const withoutQuery = value.split(/[?#]/)[0] ?? value;
  const parts = withoutQuery.split(/[\\/]/).filter(Boolean);
  const lastPart = parts[parts.length - 1] ?? withoutQuery;
  const normalized = lastPart
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/[^A-Za-z0-9._ -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, 160) : undefined;
}

function ragRetrievalFailedResult(provider: RuntimeProvider): RuntimeExecutionResult {
  const message = 'Orchestra could not resolve governed RAG context before runtime execution.';
  const metadata = {
    requestSent: false,
    failedClosed: true,
    ragMode: 'none',
    ragSourceCount: 0,
    ragContextChars: 0,
  };

  return {
    provider,
    status: 'failed',
    message,
    errorCode: 'RUNTIME_RAG_RETRIEVAL_FAILED',
    errorMessage: message,
    metadata,
    events: [
      {
        type: 'provider_selected',
        status: 'running',
        message: 'Runtime provider selected by the Orchestra control plane.',
        metadata: { provider },
      },
      {
        type: 'run_failed',
        status: 'failed',
        message: 'Governed RAG retrieval failed closed before runtime execution.',
        metadata: {
          provider,
          errorCode: 'RUNTIME_RAG_RETRIEVAL_FAILED',
          ...metadata,
        },
      },
    ],
  };
}

function unexpectedRuntimeFailureResult(provider: RuntimeProvider): RuntimeExecutionResult {
  const message = 'Runtime execution failed closed.';
  const metadata = {
    requestSent: true,
    failedClosed: true,
    toolCallsExecuted: 0,
    externalMcpCalled: false,
  };

  return {
    provider,
    status: 'failed',
    message,
    errorCode: 'RUNTIME_UNKNOWN_ERROR',
    errorMessage: message,
    metadata,
    events: [
      {
        type: 'provider_selected',
        status: 'running',
        message: 'Runtime provider selected by the Orchestra control plane.',
        metadata: { provider },
      },
      {
        type: 'run_failed',
        status: 'failed',
        message,
        metadata: {
          provider,
          errorCode: 'RUNTIME_UNKNOWN_ERROR',
          ...metadata,
        },
      },
    ],
  };
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

function conversationContextEvents(metadata: Prisma.InputJsonValue | undefined): AgentRunEventInput[] {
  const summary = asRecord(asRecord(metadata)?.conversationContextSummary);
  if (!summary) return [];

  return [
    {
      type: 'run.conversation_context_selected',
      status: 'queued',
      message: 'Contexto conversacional governado avaliado pelo backend.',
      metadata: {
        conversationContext: {
          included: booleanValue(summary.included) ?? false,
          messageCount: numberValue(summary.messageCount) ?? 0,
          totalChars: numberValue(summary.totalChars) ?? 0,
          truncated: booleanValue(summary.truncated) ?? false,
          limits: {
            maxMessages: numberValue(summary.maxMessages),
            maxMessageChars: numberValue(summary.maxMessageChars),
            maxTotalChars: numberValue(summary.maxTotalChars),
          },
        },
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
    metadata: sanitizeMetadata({
      assistantId: input.assistant.id,
      mode: input.mode,
      status: input.status,
      traceId: input.traceId,
      ...(typeof input.metadata === 'object' && input.metadata ? input.metadata : {}),
    }) as Prisma.InputJsonValue,
    requestId: input.context.requestId,
    ipAddress: input.context.ipAddress,
    userAgent: input.context.userAgent,
  });
}

async function recordRuntimeUsageEvent(input: {
  user: AuthenticatedUser;
  assistant: Pick<AssistantForRun, 'id' | 'workspaceId'>;
  runId: string;
  traceId: string;
  requestId: string;
  runtimeContext: RuntimeExecutionContext;
  runtimeResult: RuntimeExecutionResult;
  startedAt: Date;
  completedAt: Date;
}) {
  const runtimeMetadata = asRecord(input.runtimeResult.metadata);
  const usage = runtimeUsage(runtimeMetadata) as Record<string, unknown> | undefined;
  const summary = runtimeObservationSummary(runtimeMetadata);

  try {
    await recordAiUsageEvent({
      tenantId: input.user.tenant.id,
      workspaceId: input.assistant.workspaceId,
      assistantId: input.assistant.id,
      userId: input.user.id,
      runId: input.runId,
      traceId: input.traceId,
      source: 'runtime_adapter',
      operation: 'agent_run.runtime_execute',
      provider: input.runtimeResult.provider,
      model: input.runtimeContext.compiledPrompt.modelName,
      status: usageStatus(input.runtimeResult.status),
      blockedReason: input.runtimeResult.status === 'blocked' ? input.runtimeResult.errorCode : undefined,
      errorCode: input.runtimeResult.errorCode,
      errorMessage: input.runtimeResult.errorMessage,
      inputTokens: numberValue(usage?.inputTokens),
      outputTokens: numberValue(usage?.outputTokens),
      totalTokens: numberValue(usage?.totalTokens),
      latencyMs: numberValue(usage?.latencyMs) ?? numberValue(runtimeMetadata?.runtimeLatencyMs ?? runtimeMetadata?.latencyMs),
      metadata: {
        runtimeProvider: input.runtimeResult.provider,
        runtimeStatus: input.runtimeResult.status,
        requestId: input.requestId,
        traceId: input.traceId,
        runId: input.runId,
        inputHash: input.runtimeContext.input.hash,
        ...summary,
        policy: {
          maxContextChars: numberValue(runtimeMetadata?.policyMaxContextChars),
          maxRagResults: numberValue(runtimeMetadata?.policyMaxRagResults),
          maxToolCalls: numberValue(runtimeMetadata?.policyMaxToolCalls ?? runtimeMetadata?.maxToolCalls),
        },
      },
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    });
  } catch (error) {
    logger.warn({
      traceId: input.traceId,
      runId: input.runId,
      error: error instanceof Error ? error.message : 'unknown',
    }, 'failed to record runtime usage event');
  }
}

function usageStatus(status: RuntimeExecutionResult['status']) {
  if (status === 'completed') return 'succeeded';
  return status;
}

function selectedVersionId(assistant: AssistantForRun, mode: AgentRunMode) {
  const publication = activePublication(assistant);
  if (mode === 'published' && publication) return publication.assistantVersionId;
  return assistant.versions[0]?.id ?? null;
}

export const agentRunsService = {
  async createForAssistant(
    assistantId: string,
    input: CreateAgentRunInput,
    user: AuthenticatedUser,
    context: RequestContext,
    options: {
      conversationId?: string | null;
      conversationContext?: RuntimeConversationContext;
      onRuntimeResult?: (result: RuntimeExecutionResult) => void;
    } = {},
  ) {
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
    const requestedEvents = [
      ...baseEvents({ mode: input.mode, source: input.source, traceId, assistantId: assistant.id }),
      ...conversationContextEvents(sanitizedMetadata),
    ];
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
        conversationId: options.conversationId,
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
          requestId: context.requestId,
          traceId,
          runId,
          tenantId: user.tenant.id,
          workspaceId: assistant.workspaceId,
          assistantId: assistant.id,
          assistantVersionId,
          assistantPublicationId,
          actorUserId: user.id,
          inputHash: 'not_computed_precheck_blocked',
          errorCode: firstReason?.code,
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
        action: 'runtime_policy_blocked',
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
    const runtimeConfig = getRuntimeConfig();
    let resolvedRag: RuntimeResolvedRagContext | undefined;
    let ragResolutionFailure: RuntimeExecutionResult | undefined;

    if (
      runtimeProvider === 'agno_http'
      && runtimeConfig.agnoHttpEnabled
      && runtimeConfig.agnoHttpConfigured
      && runtimeConfig.agnoHttpRagContextEnabled
    ) {
      resolvedRag = {
        queryId: null,
        status: 'no_results',
        sourceReferences: [],
      };
      const query = runtimeRagQueryText(input.input);
      if (query) {
        try {
          const ragResult = await knowledgeService.queryRag(assistant.id, {
            query,
            limit: Math.max(1, Math.min(runtimeConfig.agnoHttpMaxRagSources, 20)),
            includeArchived: false,
            ...(assistantVersionId ? { assistantVersionId } : {}),
            traceId,
          }, user, context);
          resolvedRag = toResolvedRagContext(ragResult);
          await recordRunAudit({
            user,
            assistant,
            runId,
            traceId,
            action: 'runtime_rag_retrieval_resolved',
            mode: input.mode,
            status: ragResult.status,
            context,
            metadata: {
              provider: runtimeProvider,
              ragQueryId: ragResult.queryId,
              retrievalMode: ragResult.retrievalMode,
              ragSourceCount: resolvedRag.sourceReferences.length,
              selectedSourceCount: resolvedRag.sourceReferences.length,
              resultTitles: resolvedRag.sourceReferences
                .map((source) => source.documentTitle)
                .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
              resultLabels: resolvedRag.sourceReferences.map((source) => source.label).filter(Boolean),
              matchTypes: resolvedRag.sourceReferences
                .map((source) => source.matchType)
                .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
              ranks: resolvedRag.sourceReferences
                .map((source) => source.rank)
                .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
            },
          });
        } catch {
          ragResolutionFailure = ragRetrievalFailedResult(runtimeProvider);
          await recordRunAudit({
            user,
            assistant,
            runId,
            traceId,
            action: 'runtime_rag_retrieval_failed',
            mode: input.mode,
            status: 'failed',
            context,
            metadata: {
              provider: runtimeProvider,
              requestSent: false,
              failedClosed: true,
            },
          });
        }
      }
    }

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
      conversationContext: options.conversationContext,
      resolvedRag,
    });
    let runtimeResult: RuntimeExecutionResult;
    let gatewayRunPersisted = false;
    let gatewayRunActivated = false;
    const gatewayConfig = getRuntimeToolGatewayConfig();
    let gatewaySpec: ReturnType<typeof buildAssistantRuntimeSpecV1> | undefined;
    if (!ragResolutionFailure && runtimeProvider === 'agno_http' && gatewayConfig.enabled) {
      try {
        const candidateSpec = buildAssistantRuntimeSpecV1({
          context: runtimeContext,
          timeoutMs: runtimeConfig.agnoHttpTimeoutMs,
        });
        gatewaySpec = candidateSpec.tools.enabled && candidateSpec.tools.mode === 'gateway'
          ? candidateSpec
          : undefined;
      } catch {
        gatewaySpec = undefined;
      }
    }
    if (ragResolutionFailure) {
      runtimeResult = ragResolutionFailure;
    } else {
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
      if (gatewaySpec) {
        const startedAt = new Date();
        await agentRunsRepository.createRun({
          id: runId,
          tenantId: user.tenant.id,
          workspaceId: assistant.workspaceId,
          assistantId: assistant.id,
          assistantVersionId,
          assistantPublicationId,
          conversationId: options.conversationId,
          requestedById: user.id,
          status: 'running',
          mode: input.mode,
          source: input.source,
          inputSummary: summarizeInput(input.input),
          requestId: context.requestId,
          traceId,
          startedAt,
          precheckSnapshot: precheck as unknown as Prisma.InputJsonValue,
          metadata: mergeRuntimeMetadata({
            metadata: sanitizedMetadata,
            provider: runtimeProvider,
            runtimeStatus: 'running',
            requestId: context.requestId,
            traceId,
            runId,
            tenantId: user.tenant.id,
            workspaceId: assistant.workspaceId,
            assistantId: assistant.id,
            assistantVersionId,
            assistantPublicationId,
            actorUserId: user.id,
            inputHash: runtimeContext.input.hash,
            runtimeMetadata: {
              runtimeSpecVersion: gatewaySpec.specVersion,
              policyMaxToolCalls: gatewaySpec.policy.maxToolCalls,
              toolDescriptorCount: gatewaySpec.tools.descriptors.length,
              toolCallsExecuted: 0,
              externalMcpCalled: false,
            },
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
          ],
        });
        gatewayRunPersisted = true;
        runtimeToolGatewayService.activateRun(gatewaySpec, {
          provider: 'agno_http',
          assistantPublicationId,
        });
        gatewayRunActivated = true;
      }
      try {
        runtimeResult = await runtimeService.execute(runtimeContext);
      } catch (error) {
        if (!gatewayRunPersisted) throw error;
        runtimeResult = unexpectedRuntimeFailureResult(runtimeProvider);
      } finally {
        if (gatewayRunActivated) runtimeToolGatewayService.deactivateRun(runId);
      }
    }
    options.onRuntimeResult?.(runtimeResult);
    const normalizedRuntimeEvents = normalizeRuntimeEvents(runtimeResult);
    const now = new Date();
    const isFailed = runtimeResult.status === 'failed';
    const isBlocked = runtimeResult.status === 'blocked';
    const finalMetadata = mergeRuntimeMetadata({
      metadata: sanitizedMetadata,
      provider: runtimeResult.provider,
      runtimeStatus: runtimeResult.status,
      requestId: context.requestId,
      traceId,
      runId,
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      assistantId: assistant.id,
      assistantVersionId,
      assistantPublicationId,
      actorUserId: user.id,
      inputHash: runtimeContext.input.hash,
      outputHash: runtimeResult.outputHash,
      errorCode: runtimeResult.errorCode,
      runtimeMetadata: runtimeResult.metadata,
      ragSummary: {
        ragReady: runtimeContext.rag.ragReady,
        knowledgeBindingsCount: runtimeContext.rag.knowledgeBindingsCount,
        chunkCount: runtimeContext.rag.chunkCount,
        sourceReferenceCount: runtimeContext.rag.sourceReferenceCount,
        lastRagQueryId: runtimeContext.rag.lastRagQueryId,
      },
      mcpSummary: runtimeContext.mcp,
    });
    const finalEvents = [
      ...requestedEvents,
      {
        type: 'run.precheck_passed',
        status: 'running',
        message: 'Precheck aprovado.',
        metadata: { traceId, runtimeProvider },
      },
      ...normalizedRuntimeEvents,
    ];
    const run = gatewayRunPersisted
      ? await agentRunsRepository.finalizeRun(runId, {
        status: runtimeResult.status,
        completedAt: isFailed || isBlocked ? null : now,
        failedAt: isFailed ? now : null,
        blockedAt: isBlocked ? now : null,
        errorCode: runtimeResult.errorCode ?? null,
        errorMessage: runtimeResult.errorMessage ?? null,
        metadata: finalMetadata,
      }, normalizedRuntimeEvents)
      : await agentRunsRepository.createRun({
      id: runId,
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      assistantId: assistant.id,
      assistantVersionId,
      assistantPublicationId,
      conversationId: options.conversationId,
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
      metadata: finalMetadata,
      events: finalEvents,
    });

    if (runtimeContext.rag.lastRagQueryId) {
      try {
        await knowledgeService.linkRagQueryToAgentRun(runtimeContext.rag.lastRagQueryId, run.id, user, context);
      } catch (error) {
        logger.warn({
          requestId: context.requestId,
          traceId,
          runId: run.id,
          ragQueryId: runtimeContext.rag.lastRagQueryId,
          error: error instanceof Error ? error.message : 'unknown',
        }, 'failed to link RAG query to agent run');
      }
    }

    await recordRuntimeUsageEvent({
      user,
      assistant,
      runId,
      traceId,
      requestId: context.requestId,
      runtimeContext,
      runtimeResult,
      startedAt: now,
      completedAt: now,
    });

    const runtimeMetadata = asRecord(runtimeResult.metadata);
    const runtimeSummary = runtimeObservationSummary(runtimeMetadata);
    if (runtimeResult.provider === 'agno_http' && numberValue(runtimeSummary.ragSourceCount) && numberValue(runtimeSummary.ragSourceCount)! > 0) {
      await recordRunAudit({
        user,
        assistant,
        runId,
        traceId,
        action: 'runtime_rag_context_attached',
        mode: input.mode,
        status: runtimeResult.status,
        context,
        metadata: {
          provider: runtimeResult.provider,
          ragSourceCount: runtimeSummary.ragSourceCount,
          ragContextChars: runtimeSummary.ragContextChars,
        },
      });
    }
    if (runtimeResult.provider === 'agno_http' && numberValue(runtimeSummary.toolDescriptorCount) && numberValue(runtimeSummary.toolDescriptorCount)! > 0) {
      await recordRunAudit({
        user,
        assistant,
        runId,
        traceId,
        action: 'runtime_tool_descriptors_attached',
        mode: input.mode,
        status: runtimeResult.status,
        context,
        metadata: {
          provider: runtimeResult.provider,
          toolDescriptorCount: runtimeSummary.toolDescriptorCount,
          maxToolCalls: runtimeSummary.maxToolCalls,
        },
      });
    }
    if (isBlocked && runtimeResult.errorCode === 'RUNTIME_POLICY_BLOCKED') {
      await recordRunAudit({
        user,
        assistant,
        runId,
        traceId,
        action: 'runtime_policy_blocked',
        mode: input.mode,
        status: 'blocked',
        context,
        metadata: { provider: runtimeResult.provider, errorCode: runtimeResult.errorCode },
      });
    }

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
