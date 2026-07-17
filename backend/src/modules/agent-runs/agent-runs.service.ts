import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { logger } from '../../infrastructure/logger/logger';
import { AppError } from '../../shared/errors/app-error';
import { responseScopeModeFromMetadata, type ResponseScopeMode } from '../../shared/policies/response-scope';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import { recordAiUsageEvent } from '../ai-observability/ai-observability.service';
import { evaluateAiUsageLimits } from '../ai-observability/ai-usage-limits.service';
import type {
  AiUsageLimitDecision,
  AiUsageLimitEvaluation,
} from '../ai-observability/ai-usage-limits.types';
import { knowledgeService } from '../knowledge/knowledge.service';
import { buildAssistantRuntimeSpecV1 } from '../runtime/runtime.assistant-spec.builder';
import { getRuntimeConfig } from '../runtime/runtime.config';
import { buildRuntimeExecutionContext } from '../runtime/runtime.context';
import type {
  RuntimeConversationContext,
  RuntimeExecutionContext,
  RuntimeExecutionResult,
  RuntimeProvider,
  RuntimeResponseScopeSummary,
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
type RuntimeSummaryForRun = Awaited<ReturnType<typeof agentRunsRepository.getRuntimeContextSummary>>;

interface UsageLimitMetadata {
  usageLimitEvaluationApplied: boolean;
  usageLimitMode: 'monitor_only' | 'enforce' | null;
  usageLimitExceeded: boolean;
  usageLimitEnforced: boolean;
  usageLimitBlocked: boolean;
  usageLimitMetric: string | null;
  usageLimitScope: string | null;
  usageLimitPolicyId: string | null;
  usageLimitWindow: string | null;
  usageLimitCurrentValue: string | null;
  usageLimitThreshold: string | null;
  usageLimitReason: 'not_applicable' | 'within_limit' | 'warning_threshold_reached' | 'limit_exceeded' | 'evaluator_error';
}

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
const allowedMetadataMetricKeys = new Set([
  'inputtokens',
  'outputtokens',
  'totaltokens',
  'maxtokens',
  'tooldescriptorcount',
  'rawcontentlogged',
]);

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
  responseScopeSummary?: RuntimeResponseScopeSummary;
  usageLimitMetadata?: UsageLimitMetadata;
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
      responseScopeMode: input.responseScopeSummary ? input.responseScopeSummary.mode : stringValue(adapterMetadata?.responseScopeMode),
      ragIntentDetected: input.responseScopeSummary ? input.responseScopeSummary.ragIntentDetected : booleanValue(adapterMetadata?.ragIntentDetected),
      ragSkippedReason: input.responseScopeSummary ? input.responseScopeSummary.ragSkippedReason : stringValue(adapterMetadata?.ragSkippedReason) ?? null,
      fallbackOutsideKnowledgeUsed: input.responseScopeSummary ? input.responseScopeSummary.fallbackOutsideKnowledgeUsed : booleanValue(adapterMetadata?.fallbackOutsideKnowledgeUsed),
      rawContentLogged: input.responseScopeSummary ? input.responseScopeSummary.rawContentLogged : booleanValue(adapterMetadata?.rawContentLogged) ?? false,
      ...input.usageLimitMetadata,
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
    estimatedCostMinorUnits: costMinorUnitsValue(usage.estimatedCostMinorUnits),
    costCurrency: costCurrencyValue(usage.costCurrency),
  };
  return Object.values(normalized).some((value) => typeof value !== 'undefined') ? normalized : undefined;
}

function costMinorUnitsValue(value: unknown) {
  if (typeof value === 'string' && /^\d{1,30}$/.test(value)) return value;
  if (typeof value === 'bigint' && value >= 0n) return value.toString();
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return undefined;
}

function costCurrencyValue(value: unknown) {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : undefined;
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

function responseScopeModeFromPolicy(policy: PolicyForRun | Record<string, unknown>): ResponseScopeMode {
  return responseScopeModeFromMetadata(asRecord((policy as Record<string, unknown>).metadata));
}

const ragIntentSignalPatterns = [
  /\bbase\b/,
  /\bbase de conhecimento\b/,
  /\bsegundo\b/,
  /\bdocumentos?\b/,
  /\bfontes?\b/,
  /\bfaq\b/,
  /\bpoliticas?\b/,
  /\bprocedimentos?\b/,
  /\bmanuais?\b/,
  /\bhomologacao\b/,
  /\b16i\b/,
];

const clearlyGeneralQuestionPatterns = [
  /\bquantos estados\b.*\bbrasil\b/,
  /\blist(?:e|a|ar)?\b.*\bestados\b.*\bbrasil\b/,
  /\btodos os estados\b.*\bbrasil\b/,
  /\bestados brasileiros\b/,
  /\bquem descobriu\b.*\bbrasil\b/,
];

const responseScopeQuestionPatterns = [
  /\b(?:pode|posso|consegue|voce pode|voces podem)\b.*\b(?:procurar|buscar|responder|usar|consultar)\b.*\bfora da base\b/,
  /\bfora da base de conhecimento\b/,
  /\bconhecimento geral\b/,
  /\bvoce pode\b.*\bbase\b/,
  /\bso(?:mente)?\b.*\bbase\b/,
];

const simpleGreetingOrThanksPatterns = [
  /^(?:oi|ola|bom dia|boa tarde|boa noite)$/,
  /^(?:obrigado|obrigada|valeu)$/,
];

const sourceHintStopWords = new Set([
  'base',
  'conhecimento',
  'documento',
  'documentos',
  'fonte',
  'fontes',
  'manual',
  'politica',
  'politicas',
  'procedimento',
  'procedimentos',
  'txt',
  'md',
  'csv',
  'pdf',
]);

function normalizeIntentText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasExplicitRagSignal(normalizedQuery: string) {
  return ragIntentSignalPatterns.some((pattern) => pattern.test(normalizedQuery));
}

function isClearlyGeneralQuestion(normalizedQuery: string) {
  return clearlyGeneralQuestionPatterns.some((pattern) => pattern.test(normalizedQuery));
}

function isResponseScopeQuestion(normalizedQuery: string) {
  return responseScopeQuestionPatterns.some((pattern) => pattern.test(normalizedQuery));
}

function isSimpleGreetingOrThanks(normalizedQuery: string) {
  return simpleGreetingOrThanksPatterns.some((pattern) => pattern.test(normalizedQuery));
}

function hasRuntimeKnowledgeBindings(summary: RuntimeSummaryForRun | undefined) {
  return Boolean(summary && (
    summary.knowledgeBindingsCount > 0
    || summary.sourceReferenceCount > 0
    || summary.chunkCount > 0
    || summary.sourceReferences.length > 0
  ));
}

function sourceHintsFromSummary(summary: RuntimeSummaryForRun | undefined) {
  if (!summary) return [];
  return summary.sourceReferences.flatMap((reference) => [
    reference.label,
    reference.document?.title,
    reference.sectionTitle,
    sourceNameFromUri(reference.sourceUri ?? undefined),
  ]).filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function hasSourceHintMatch(normalizedQuery: string, summary: RuntimeSummaryForRun | undefined) {
  const queryTerms = new Set(normalizedQuery.split(' ').filter(Boolean));
  return sourceHintsFromSummary(summary).some((hint) => {
    const normalizedHint = normalizeIntentText(hint);
    if (!normalizedHint) return false;
    if (normalizedHint.length >= 4 && normalizedQuery.includes(normalizedHint)) return true;
    return normalizedHint
      .split(' ')
      .filter((term) => term.length >= 3 && !sourceHintStopWords.has(term))
      .some((term) => queryTerms.has(term));
  });
}

function detectRuntimeRagIntent(input: {
  query: string | undefined;
  responseScopeMode: ResponseScopeMode;
  runtimeSummary?: RuntimeSummaryForRun;
}): { detected: boolean; reason: string | null } {
  if (!input.query) return { detected: false, reason: 'empty_query' };
  const normalizedQuery = normalizeIntentText(input.query);
  if (isResponseScopeQuestion(normalizedQuery)) {
    return { detected: false, reason: 'response_scope_question' };
  }
  const explicitSignal = hasExplicitRagSignal(normalizedQuery);
  if (
    input.responseScopeMode !== 'knowledge_only'
    && !explicitSignal
    && isClearlyGeneralQuestion(normalizedQuery)
  ) {
    return { detected: false, reason: 'general_question_no_knowledge_signal' };
  }
  if (input.responseScopeMode === 'knowledge_only') {
    return { detected: true, reason: 'response_scope_knowledge_only' };
  }
  if (explicitSignal) return { detected: true, reason: 'explicit_knowledge_signal' };
  if (isSimpleGreetingOrThanks(normalizedQuery)) {
    return { detected: false, reason: 'simple_greeting_or_thanks' };
  }
  if (hasSourceHintMatch(normalizedQuery, input.runtimeSummary)) {
    return { detected: true, reason: 'source_label_match' };
  }
  if (hasRuntimeKnowledgeBindings(input.runtimeSummary)) {
    return { detected: true, reason: 'non_general_query_with_knowledge_bindings' };
  }
  return { detected: false, reason: 'no_knowledge_intent_detected' };
}

function hasResolvedRag(resolvedRag: RuntimeResolvedRagContext | undefined) {
  return resolvedRag?.status === 'completed' && resolvedRag.sourceReferences.length > 0;
}

function shouldMarkFallbackOutsideKnowledge(
  responseScopeMode: ResponseScopeMode,
  resolvedRag: RuntimeResolvedRagContext | undefined,
) {
  return responseScopeMode === 'knowledge_first' && !hasResolvedRag(resolvedRag);
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

function primaryUsageLimitDecision(decisions: AiUsageLimitDecision[]) {
  return decisions.find((decision) => decision.status === 'blocked')
    ?? decisions.find((decision) => decision.wouldExceed)
    ?? decisions.find((decision) => decision.wouldWarn)
    ?? decisions.find((decision) => decision.mode === 'enforce')
    ?? decisions[0];
}

function usageLimitMetadataFromEvaluation(evaluation: AiUsageLimitEvaluation): UsageLimitMetadata {
  const primary = primaryUsageLimitDecision(evaluation.decisions);
  const exceeded = evaluation.decisions.some((decision) => decision.wouldExceed);
  const enforced = evaluation.decisions.some((decision) => decision.mode === 'enforce');
  return {
    usageLimitEvaluationApplied: evaluation.decisions.length > 0,
    usageLimitMode: primary?.mode ?? null,
    usageLimitExceeded: exceeded,
    usageLimitEnforced: enforced,
    usageLimitBlocked: !evaluation.allowed,
    usageLimitMetric: primary?.metric ?? null,
    usageLimitScope: primary?.scopeType ?? null,
    usageLimitPolicyId: primary?.policyId ?? null,
    usageLimitWindow: primary?.period ?? null,
    usageLimitCurrentValue: primary?.currentValue.toString() ?? null,
    usageLimitThreshold: primary?.limitValue.toString() ?? null,
    usageLimitReason: primary?.reason ?? 'not_applicable',
  };
}

function usageLimitEvaluatorErrorMetadata(): UsageLimitMetadata {
  return {
    usageLimitEvaluationApplied: false,
    usageLimitMode: null,
    usageLimitExceeded: false,
    usageLimitEnforced: false,
    usageLimitBlocked: false,
    usageLimitMetric: null,
    usageLimitScope: null,
    usageLimitPolicyId: null,
    usageLimitWindow: null,
    usageLimitCurrentValue: null,
    usageLimitThreshold: null,
    usageLimitReason: 'evaluator_error',
  };
}

function usageLimitEvents(metadata: UsageLimitMetadata): AgentRunEventInput[] {
  const events: AgentRunEventInput[] = [{
    type: 'run.usage_limit_evaluated',
    status: 'prechecking',
    message: metadata.usageLimitReason === 'evaluator_error'
      ? 'Avaliacao de limite indisponivel; execucao mantida em fail-open auditavel.'
      : 'Limites de uso governados avaliados antes do runtime.',
    metadata: metadata as unknown as Prisma.InputJsonValue,
  }];
  if (metadata.usageLimitExceeded && metadata.usageLimitMode === 'monitor_only') {
    events.push({
      type: 'run.usage_limit_violation',
      status: 'prechecking',
      message: 'Limite monitor_only excedido; execucao permitida.',
      metadata: metadata as unknown as Prisma.InputJsonValue,
    });
  }
  if (metadata.usageLimitBlocked) {
    events.push({
      type: 'run.usage_limit_blocked',
      status: 'blocked',
      message: 'Execucao bloqueada por limite de uso governado.',
      metadata: metadata as unknown as Prisma.InputJsonValue,
    });
  }
  return events;
}

async function evaluateRunUsageLimits(input: {
  user: AuthenticatedUser;
  assistant: AssistantForRun;
  runId: string;
  traceId: string;
  mode: AgentRunMode;
  context: RequestContext;
  runtimeProvider: RuntimeProvider;
  model: string | null;
}) {
  try {
    const evaluation = await evaluateAiUsageLimits({
      tenantId: input.user.tenant.id,
      workspaceId: input.assistant.workspaceId,
      assistantId: input.assistant.id,
      userId: input.user.id,
      source: 'runtime_adapter',
      operation: 'agent_run.runtime_execute',
      provider: input.runtimeProvider,
      model: input.model,
      projectedUsage: { runCount: 1n },
    });
    const metadata = usageLimitMetadataFromEvaluation(evaluation);
    await recordRunAudit({
      user: input.user,
      assistant: input.assistant,
      runId: input.runId,
      traceId: input.traceId,
      action: 'agent_run_usage_limit_evaluated',
      mode: input.mode,
      status: evaluation.status,
      context: input.context,
      metadata: metadata as unknown as Prisma.InputJsonValue,
    });
    if (metadata.usageLimitExceeded && metadata.usageLimitMode === 'monitor_only') {
      await recordRunAudit({
        user: input.user,
        assistant: input.assistant,
        runId: input.runId,
        traceId: input.traceId,
        action: 'agent_run_usage_limit_monitor_violation',
        mode: input.mode,
        status: 'warn',
        context: input.context,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      });
    }
    if (metadata.usageLimitBlocked) {
      await recordRunAudit({
        user: input.user,
        assistant: input.assistant,
        runId: input.runId,
        traceId: input.traceId,
        action: 'agent_run_usage_limit_blocked',
        mode: input.mode,
        status: 'blocked',
        context: input.context,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      });
    }
    return { metadata, events: usageLimitEvents(metadata) };
  } catch (error) {
    const metadata = usageLimitEvaluatorErrorMetadata();
    await recordRunAudit({
      user: input.user,
      assistant: input.assistant,
      runId: input.runId,
      traceId: input.traceId,
      action: 'agent_run_usage_limit_evaluator_failed',
      mode: input.mode,
      status: 'error',
      context: input.context,
      metadata: metadata as unknown as Prisma.InputJsonValue,
    });
    logger.warn({
      requestId: input.context.requestId,
      traceId: input.traceId,
      runId: input.runId,
      errorName: error instanceof Error ? error.name : 'unknown',
    }, 'usage limit evaluator failed open');
    return { metadata, events: usageLimitEvents(metadata) };
  }
}

async function recordUsageLimitBlockedEvent(input: {
  user: AuthenticatedUser;
  assistant: Pick<AssistantForRun, 'id' | 'workspaceId'>;
  runId: string;
  traceId: string;
  runtimeProvider: RuntimeProvider;
  model: string | null;
  metadata: UsageLimitMetadata;
  occurredAt: Date;
}) {
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
      provider: input.runtimeProvider,
      model: input.model,
      status: 'blocked',
      blockedReason: 'AI_USAGE_LIMIT_EXCEEDED',
      errorCode: 'AI_USAGE_LIMIT_EXCEEDED',
      metadata: input.metadata,
      startedAt: input.occurredAt,
      completedAt: input.occurredAt,
    });
  } catch (error) {
    logger.warn({
      traceId: input.traceId,
      runId: input.runId,
      errorName: error instanceof Error ? error.name : 'unknown',
    }, 'failed to record usage limit blocked event');
  }
}

async function recordRuntimeUsageEvent(input: {
  user: AuthenticatedUser;
  assistant: Pick<AssistantForRun, 'id' | 'workspaceId'>;
  runId: string;
  traceId: string;
  requestId: string;
  runtimeContext: RuntimeExecutionContext;
  runtimeResult: RuntimeExecutionResult;
  usageLimitMetadata: UsageLimitMetadata;
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
      costCurrency: costCurrencyValue(usage?.costCurrency),
      estimatedCostMinorUnits: costMinorUnitsValue(usage?.estimatedCostMinorUnits),
      metadata: {
        runtimeProvider: input.runtimeResult.provider,
        runtimeStatus: input.runtimeResult.status,
        requestId: input.requestId,
        traceId: input.traceId,
        runId: input.runId,
        inputHash: input.runtimeContext.input.hash,
        ...input.usageLimitMetadata,
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
    const selectedVersion = assistant.versions.find((version) => version.id === assistantVersionId)
      ?? assistant.versions[0];
    const usageLimitModel = selectedVersion?.modelName ?? null;

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
    const usageLimitPrecheck = await evaluateRunUsageLimits({
      user,
      assistant,
      runId,
      traceId,
      mode: input.mode,
      context,
      runtimeProvider,
      model: usageLimitModel,
    });
    if (usageLimitPrecheck.metadata.usageLimitBlocked) {
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
        requestId: context.requestId,
        traceId,
        blockedAt: now,
        errorCode: 'AI_USAGE_LIMIT_EXCEEDED',
        errorMessage: 'Execucao bloqueada por limite de uso governado.',
        precheckSnapshot: precheck as unknown as Prisma.InputJsonValue,
        metadata: mergeRuntimeMetadata({
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
          inputHash: 'not_computed_usage_limit_blocked',
          errorCode: 'AI_USAGE_LIMIT_EXCEEDED',
          usageLimitMetadata: usageLimitPrecheck.metadata,
        }),
        events: [
          ...requestedEvents,
          {
            type: 'run.precheck_passed',
            status: 'prechecking',
            message: 'Precheck estrutural aprovado.',
            metadata: { traceId, runtimeProvider },
          },
          ...usageLimitPrecheck.events,
        ],
      });
      await recordUsageLimitBlockedEvent({
        user,
        assistant,
        runId,
        traceId,
        runtimeProvider,
        model: usageLimitModel,
        metadata: usageLimitPrecheck.metadata,
        occurredAt: now,
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
        metadata: usageLimitPrecheck.metadata as unknown as Prisma.InputJsonValue,
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
        metadata: usageLimitPrecheck.metadata as unknown as Prisma.InputJsonValue,
      });
      logger.info({
        requestId: context.requestId,
        traceId,
        runId,
        assistantId: assistant.id,
        status: 'blocked',
        blockedReason: 'AI_USAGE_LIMIT_EXCEEDED',
      }, 'agent run blocked by usage limit');
      return mapAgentRun(run);
    }
    const runtimeConfig = getRuntimeConfig();
    const responseScopeMode = responseScopeModeFromPolicy(policy);
    let runtimeSummary: RuntimeSummaryForRun | undefined;
    let resolvedRag: RuntimeResolvedRagContext | undefined;
    let ragResolutionFailure: RuntimeExecutionResult | undefined;
    let responseScopeSummary: RuntimeResponseScopeSummary = {
      mode: responseScopeMode,
      ragIntentDetected: false,
      ragSkippedReason: null,
      fallbackOutsideKnowledgeUsed: responseScopeMode === 'knowledge_first',
      rawContentLogged: false,
    };

    if (
      runtimeProvider === 'agno_http'
      && runtimeConfig.agnoHttpEnabled
      && runtimeConfig.agnoHttpConfigured
      && runtimeConfig.agnoHttpRagContextEnabled
    ) {
      runtimeSummary = await agentRunsRepository.getRuntimeContextSummary({
        tenantId: user.tenant.id,
        workspaceId: assistant.workspaceId,
        assistantId: assistant.id,
      });
      resolvedRag = {
        queryId: null,
        status: 'no_results',
        sourceReferences: [],
      };
      const query = runtimeRagQueryText(input.input);
      const ragIntent = detectRuntimeRagIntent({
        query,
        responseScopeMode,
        runtimeSummary,
      });
      responseScopeSummary = {
        mode: responseScopeMode,
        ragIntentDetected: ragIntent.detected,
        ragSkippedReason: ragIntent.detected ? null : ragIntent.reason,
        fallbackOutsideKnowledgeUsed: responseScopeMode === 'knowledge_first',
        rawContentLogged: false,
      };
      if (query && ragIntent.detected) {
        try {
          const ragResult = await knowledgeService.queryRag(assistant.id, {
            query,
            limit: Math.max(1, Math.min(runtimeConfig.agnoHttpMaxRagSources, 20)),
            includeArchived: false,
            ...(assistantVersionId ? { assistantVersionId } : {}),
            traceId,
          }, user, context);
          resolvedRag = toResolvedRagContext(ragResult);
          responseScopeSummary = {
            ...responseScopeSummary,
            fallbackOutsideKnowledgeUsed: shouldMarkFallbackOutsideKnowledge(responseScopeMode, resolvedRag),
          };
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
              responseScopeMode,
              ragIntentDetected: responseScopeSummary.ragIntentDetected,
              ragSkippedReason: responseScopeSummary.ragSkippedReason,
              fallbackOutsideKnowledgeUsed: responseScopeSummary.fallbackOutsideKnowledgeUsed,
              rawContentLogged: false,
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
      } else {
        responseScopeSummary = {
          ...responseScopeSummary,
          fallbackOutsideKnowledgeUsed: shouldMarkFallbackOutsideKnowledge(responseScopeMode, resolvedRag),
        };
        await recordRunAudit({
          user,
          assistant,
          runId,
          traceId,
          action: 'runtime_rag_retrieval_skipped',
          mode: input.mode,
          status: 'no_results',
          context,
          metadata: {
            provider: runtimeProvider,
            responseScopeMode,
            ragIntentDetected: responseScopeSummary.ragIntentDetected,
            ragSkippedReason: responseScopeSummary.ragSkippedReason ?? 'no_knowledge_intent_detected',
            fallbackOutsideKnowledgeUsed: responseScopeSummary.fallbackOutsideKnowledgeUsed,
            rawContentLogged: false,
          },
        });
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
      responseScope: responseScopeSummary,
      runtimeSummary,
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
            usageLimitMetadata: usageLimitPrecheck.metadata,
          }),
          events: [
            ...requestedEvents,
            {
              type: 'run.precheck_passed',
              status: 'running',
              message: 'Precheck aprovado.',
              metadata: { traceId, runtimeProvider },
            },
            ...usageLimitPrecheck.events,
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
      responseScopeSummary: runtimeContext.responseScope,
      usageLimitMetadata: usageLimitPrecheck.metadata,
    });
    const finalEvents = [
      ...requestedEvents,
      {
        type: 'run.precheck_passed',
        status: 'running',
        message: 'Precheck aprovado.',
        metadata: { traceId, runtimeProvider },
      },
      ...usageLimitPrecheck.events,
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
      usageLimitMetadata: usageLimitPrecheck.metadata,
      startedAt: now,
      completedAt: now,
    });

    const runtimeMetadata = asRecord(runtimeResult.metadata);
    const runtimeObservation = runtimeObservationSummary(runtimeMetadata);
    if (runtimeResult.provider === 'agno_http' && numberValue(runtimeObservation.ragSourceCount) && numberValue(runtimeObservation.ragSourceCount)! > 0) {
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
          ragSourceCount: runtimeObservation.ragSourceCount,
          ragContextChars: runtimeObservation.ragContextChars,
        },
      });
    }
    if (runtimeResult.provider === 'agno_http' && numberValue(runtimeObservation.toolDescriptorCount) && numberValue(runtimeObservation.toolDescriptorCount)! > 0) {
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
          toolDescriptorCount: runtimeObservation.toolDescriptorCount,
          maxToolCalls: runtimeObservation.maxToolCalls,
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
