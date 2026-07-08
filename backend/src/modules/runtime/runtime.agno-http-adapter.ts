import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { getRuntimeConfig } from './runtime.config';
import { AgnoHttpRuntimeClient, AgnoHttpRuntimeClientError } from './runtime.agno-http-client';
import { buildAssistantRuntimeSpecV1 } from './runtime.assistant-spec.builder';
import {
  runtimeExecuteRequestSpecVersionV1,
  runtimeExecuteResponseV1Schema,
} from './runtime-contract.schema';
import type {
  RuntimeCapabilitiesResponseV1,
  RuntimeExecuteResponseV1,
  RuntimeHealthResponseV1,
  RuntimeNormalizedEventV1,
} from './runtime-contract.types';
import type {
  RuntimeAdapter,
  RuntimeCapabilities,
  RuntimeExecutionContext,
  RuntimeExecutionResult,
  RuntimeExecutionStatus,
  RuntimeFeatureConfig,
  RuntimeHealth,
  RuntimeNormalizedEvent,
  RuntimeProvider,
} from './runtime.types';

const maxOutputPreviewChars = 800;
const unsafeMetadataFragments = ['authorization', 'apikey', 'api_key', 'baseurl', 'content', 'credential', 'header', 'input', 'instruction', 'output', 'password', 'prompt', 'secret', 'text', 'token'];
const allowedMetadataKeys = new Set([
  'adapterlatencyms',
  'assistantid',
  'assistantpublicationid',
  'assistantspecversion',
  'assistantversionid',
  'blockedbeforeruntime',
  'costcurrency',
  'conversationcontextchars',
  'conversationcontextincluded',
  'conversationcontextmaxmessagechars',
  'conversationcontextmaxmessages',
  'conversationcontextmaxtotalchars',
  'conversationcontextmessagecount',
  'conversationcontexttruncated',
  'descriptorschemahashes',
  'estimatedcostminorunits',
  'externalmcpcalled',
  'externalprovidercalled',
  'failclosed',
  'healthstatus',
  'httpstatus',
  'inputchars',
  'inputhash',
  'inputtokens',
  'latencyms',
  'limitsenforce',
  'maxcontextchars',
  'maxragresults',
  'maxtoolcalls',
  'outputhash',
  'outputtokens',
  'policyfailclosed',
  'policymaxcontextchars',
  'policymaxragresults',
  'policymaxtoolcalls',
  'protocolversion',
  'ragcontextchars',
  'ragmode',
  'ragsourcecount',
  'requestid',
  'requestsent',
  'requestspecversion',
  'responsestatus',
  'retryable',
  'runid',
  'runtimeerrorcode',
  'runtimeeventid',
  'runtimeeventstatus',
  'runtimeeventtype',
  'runtimelatencyms',
  'runtimeprotocolversion',
  'runtimeprovider',
  'runtimespecversion',
  'runtimestatus',
  'sourceids',
  'tenantid',
  'tooldescriptorcount',
  'toolcallsexecuted',
  'toolids',
  'toolmode',
  'totaltokens',
  'traceid',
  'workspaceid',
]);

export class AgnoHttpRuntimeAdapter implements RuntimeAdapter {
  readonly provider: RuntimeProvider = 'agno_http';

  async getCapabilities(): Promise<RuntimeCapabilities> {
    const config = getRuntimeConfig();
    const staticHealth = this.staticHealth(config);
    if (staticHealth.status !== 'healthy') return this.disabledCapabilities(config, staticHealth);

    const client = this.client(config);
    if (!client) return this.disabledCapabilities(config, staticHealth);

    try {
      return normalizeCapabilities(this.provider, await client.getCapabilities(), config);
    } catch {
      return {
        ...this.disabledCapabilities(config, staticHealth),
        status: 'unavailable',
        supportsTextGeneration: false,
        supportsStreaming: false,
        supportsRagContext: false,
        supportsMcpTools: false,
        supportsToolCalling: false,
        supportsSandbox: false,
        supportsCitations: false,
        supportsTraceEvents: false,
      };
    }
  }

  async healthCheck(): Promise<RuntimeHealth> {
    const config = getRuntimeConfig();
    const staticHealth = this.staticHealth(config);
    if (staticHealth.status !== 'healthy') return staticHealth;

    const client = this.client(config);
    if (!client) return staticHealth;

    try {
      return normalizeHealth(this.provider, await client.getHealth());
    } catch (error) {
      return {
        provider: this.provider,
        status: 'unavailable',
        message: 'Agno HTTP runtime healthcheck failed.',
        checkedAt: new Date().toISOString(),
        details: errorDetails(error),
      };
    }
  }

  async execute(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const config = getRuntimeConfig();
    const events: RuntimeNormalizedEvent[] = [
      {
        type: 'provider_selected',
        status: 'running',
        message: 'Runtime provider agno_http selecionado pelo registry.',
        metadata: {
          provider: this.provider,
          traceId: context.traceId,
          runId: context.runId,
        },
      },
    ];
    const staticHealth = this.staticHealth(config);
    if (staticHealth.status !== 'healthy') {
      return failedResult(this.provider, healthErrorCode(staticHealth), staticHealth.message, events, {
        requestSent: false,
        healthStatus: staticHealth.status,
      });
    }

    const client = this.client(config);
    if (!client) {
      return failedResult(this.provider, 'RUNTIME_UNAVAILABLE', 'Agno HTTP runtime client could not be created.', events, {
        requestSent: false,
      });
    }

    let requestBody: { specVersion: typeof runtimeExecuteRequestSpecVersionV1; assistantRuntimeSpec: ReturnType<typeof buildAssistantRuntimeSpecV1> };
    try {
      requestBody = {
        specVersion: runtimeExecuteRequestSpecVersionV1,
        assistantRuntimeSpec: buildAssistantRuntimeSpecV1({
          context,
          timeoutMs: config.agnoHttpTimeoutMs,
        }),
      };
    } catch {
      return failedResult(this.provider, 'RUNTIME_BAD_REQUEST', 'Backend could not build a valid AssistantRuntimeSpecV1.', events, {
        requestSent: false,
      });
    }

    const ragSummary = summarizeRagSpec(requestBody.assistantRuntimeSpec.rag);
    const toolSummary = summarizeToolSpec(
      requestBody.assistantRuntimeSpec.tools,
      requestBody.assistantRuntimeSpec.policy.maxToolCalls,
    );
    const conversationContextSummary = summarizeConversationContextSpec(requestBody.assistantRuntimeSpec.conversationContext);
    const invocationSummary = buildInvocationSummary(
      this.provider,
      requestBody,
      context,
      config,
      ragSummary,
      toolSummary,
      conversationContextSummary,
    );
    if (ragSummary) {
      events.push({
        type: 'rag_context_attached',
        status: 'completed',
        message: 'Contexto RAG governado anexado a AssistantRuntimeSpecV1.',
        metadata: jsonMetadata(ragSummary),
      });
    }

    if (toolSummary) {
      events.push({
        type: 'mcp_tools_attached',
        status: 'completed',
        message: 'Descriptors de tools governados anexados a AssistantRuntimeSpecV1.',
        metadata: jsonMetadata(toolSummary),
      });
    }

    if (conversationContextSummary) {
      events.push({
        type: 'runtime_llm_context_attached',
        status: 'completed',
        message: 'Contexto conversacional governado anexado a AssistantRuntimeSpecV1.',
        metadata: jsonMetadata(conversationContextSummary),
      });
    }

    events.push({
      type: 'agno_request_started',
      status: 'running',
      message: 'Chamada HTTP ao runtime Agno-compatible minimo iniciada.',
      metadata: jsonMetadata({
        ...invocationSummary,
        requestSent: false,
      }),
    });

    const requestStartedAt = Date.now();
    try {
      const response = await client.execute(requestBody);
      const runtimeLatencyMs = Date.now() - requestStartedAt;
      return normalizeExecutionResponse(this.provider, response, invocationSummary, runtimeLatencyMs, [
        ...events,
        {
          type: 'agno_request_completed',
          status: response.status === 'succeeded' ? 'completed' : normalizeRuntimeStatus(response.status),
          message: 'Chamada HTTP ao runtime Agno-compatible minimo concluida.',
          metadata: jsonMetadata({
            ...invocationSummary,
            requestSent: true,
            runtimeStatus: response.status,
            runtimeLatencyMs,
          }),
        },
      ]);
    } catch (error) {
      const runtimeLatencyMs = Date.now() - requestStartedAt;
      const code = errorCode(error);
      const message = errorMessage(error);
      return failedResult(this.provider, code, message, [
        ...events,
        {
          type: 'agno_request_failed',
          status: code === 'RUNTIME_POLICY_BLOCKED' ? 'blocked' : 'failed',
          message,
          metadata: jsonMetadata({
            ...invocationSummary,
            ...errorDetails(error),
            requestSent: true,
            runtimeStatus: code === 'RUNTIME_POLICY_BLOCKED' ? 'blocked' : 'failed',
            runtimeLatencyMs,
            runtimeErrorCode: code,
          }),
        },
      ], {
        ...invocationSummary,
        requestSent: true,
        runtimeLatencyMs,
        runtimeErrorCode: code,
      });
    }
  }

  private client(config: RuntimeFeatureConfig) {
    if (!env.AGNO_RUNTIME_HTTP_BASE_URL || !config.agnoHttpEnabled) return null;
    return new AgnoHttpRuntimeClient({
      baseUrl: env.AGNO_RUNTIME_HTTP_BASE_URL,
      timeoutMs: config.agnoHttpTimeoutMs,
      securityKey: env.AGNO_RUNTIME_HTTP_SECURITY_KEY,
    });
  }

  private staticHealth(config: RuntimeFeatureConfig): RuntimeHealth {
    if (!config.adapterEnabled) {
      return {
        provider: this.provider,
        status: 'disabled',
        message: 'Runtime adapter boundary is disabled by configuration.',
        checkedAt: new Date().toISOString(),
        details: {
          requestSent: false,
          agnoHttpEnabled: config.agnoHttpEnabled,
        },
      };
    }
    if (!config.agnoHttpEnabled) {
      return {
        provider: this.provider,
        status: 'disabled',
        message: 'Agno HTTP runtime adapter is disabled by configuration.',
        checkedAt: new Date().toISOString(),
        details: {
          requestSent: false,
          agnoHttpEnabled: false,
          agnoHttpConfigured: false,
        },
      };
    }
    if (!config.agnoHttpConfigured) {
      return {
        provider: this.provider,
        status: 'misconfigured',
        message: 'Agno HTTP runtime adapter is enabled but AGNO_RUNTIME_HTTP_BASE_URL is missing or invalid.',
        checkedAt: new Date().toISOString(),
        details: {
          requestSent: false,
          agnoHttpEnabled: true,
          agnoHttpConfigured: false,
          baseUrlConfigured: config.agnoHttpBaseUrlConfigured,
          securityKeyConfigured: config.agnoHttpSecurityKeyConfigured,
        },
      };
    }

    return {
      provider: this.provider,
      status: 'healthy',
      message: 'Agno HTTP runtime adapter is configured.',
      checkedAt: new Date().toISOString(),
      details: {
        requestSent: false,
        agnoHttpEnabled: true,
        agnoHttpConfigured: true,
        securityKeyConfigured: config.agnoHttpSecurityKeyConfigured,
      },
    };
  }

  private disabledCapabilities(config: RuntimeFeatureConfig, health: RuntimeHealth): RuntimeCapabilities {
    return {
      provider: this.provider,
      status: health.status,
      supportsTextGeneration: false,
      supportsStreaming: false,
      supportsRagContext: false,
      supportsMcpTools: false,
      supportsToolCalling: false,
      supportsSandbox: config.agnoHttpConfigured ? 'planned' : false,
      supportsExternalProviders: false,
      supportsCitations: false,
      supportsTraceEvents: false,
      maxInputPreviewChars: config.agnoMaxInputPreviewChars,
      maxOutputPreviewChars,
    };
  }
}

type AssistantRuntimeRagSpec = ReturnType<typeof buildAssistantRuntimeSpecV1>['rag'];
type AssistantRuntimeToolSpec = ReturnType<typeof buildAssistantRuntimeSpecV1>['tools'];
type AssistantRuntimeConversationContextSpec = ReturnType<typeof buildAssistantRuntimeSpecV1>['conversationContext'];
type RuntimeExecuteRequestBody = {
  specVersion: typeof runtimeExecuteRequestSpecVersionV1;
  assistantRuntimeSpec: ReturnType<typeof buildAssistantRuntimeSpecV1>;
};

function buildInvocationSummary(
  provider: RuntimeProvider,
  requestBody: RuntimeExecuteRequestBody,
  context: RuntimeExecutionContext,
  config: RuntimeFeatureConfig,
  ragSummary: Record<string, unknown> | undefined,
  toolSummary: Record<string, unknown> | undefined,
  conversationContextSummary: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const spec = requestBody.assistantRuntimeSpec;

  return {
    runtimeProvider: provider,
    runtimeProtocolVersion: spec.specVersion,
    runtimeSpecVersion: spec.specVersion,
    requestSpecVersion: requestBody.specVersion,
    assistantSpecVersion: spec.specVersion,
    traceId: spec.trace.traceId,
    runId: spec.trace.runId,
    requestId: spec.trace.requestId ?? context.requestId,
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    assistantId: context.assistantId,
    assistantVersionId: context.assistantVersionId,
    assistantPublicationId: context.assistantPublicationId,
    timeoutMs: config.agnoHttpTimeoutMs,
    inputHash: context.input.hash,
    policyMaxToolCalls: spec.policy.maxToolCalls,
    policyMaxRagResults: spec.policy.maxRagResults,
    policyMaxContextChars: spec.policy.maxContextChars,
    policyFailClosed: spec.policy.failClosed,
    limitsEnforce: spec.limits.enforce,
    blockedBeforeRuntime: Boolean(spec.limits.blockedBeforeRuntime),
    ragMode: ragSummary?.ragMode ?? 'none',
    ragSourceCount: ragSummary?.ragSourceCount ?? 0,
    ragContextChars: ragSummary?.ragContextChars ?? 0,
    conversationContextIncluded: conversationContextSummary?.conversationContextIncluded ?? false,
    conversationContextMessageCount: conversationContextSummary?.conversationContextMessageCount ?? 0,
    conversationContextChars: conversationContextSummary?.conversationContextChars ?? 0,
    conversationContextTruncated: conversationContextSummary?.conversationContextTruncated ?? false,
    conversationContextMaxMessages: conversationContextSummary?.conversationContextMaxMessages ?? 0,
    conversationContextMaxMessageChars: conversationContextSummary?.conversationContextMaxMessageChars ?? 0,
    conversationContextMaxTotalChars: conversationContextSummary?.conversationContextMaxTotalChars ?? 0,
    toolMode: toolSummary?.toolMode ?? 'none',
    toolDescriptorCount: toolSummary?.toolDescriptorCount ?? 0,
    maxToolCalls: spec.policy.maxToolCalls,
  };
}

function summarizeConversationContextSpec(
  conversationContext: AssistantRuntimeConversationContextSpec,
): Record<string, unknown> | undefined {
  if (!conversationContext || conversationContext.messages.length === 0) return undefined;

  return {
    conversationContextIncluded: true,
    conversationContextMessageCount: conversationContext.messages.length,
    conversationContextChars: conversationContext.summary.totalChars,
    conversationContextTruncated: conversationContext.summary.truncated,
    conversationContextMaxMessages: conversationContext.summary.maxMessages,
    conversationContextMaxMessageChars: conversationContext.summary.maxMessageChars,
    conversationContextMaxTotalChars: conversationContext.summary.maxTotalChars,
  };
}

function summarizeRagSpec(rag: AssistantRuntimeRagSpec): Record<string, unknown> | undefined {
  if (rag.mode !== 'resolved_context' || rag.sources.length === 0) return undefined;
  return {
    ragMode: rag.mode,
    ragSourceCount: rag.sources.length,
    ragContextChars: rag.sources.reduce((total, source) => total + source.excerpt.length, 0),
    sourceIds: rag.sources.map((source) => source.sourceId).slice(0, 10),
  };
}

function summarizeToolSpec(tools: AssistantRuntimeToolSpec, maxToolCalls: number): Record<string, unknown> | undefined {
  if (tools.mode !== 'gateway' || tools.descriptors.length === 0) return undefined;

  return {
    toolMode: tools.mode,
    toolDescriptorCount: tools.descriptors.length,
    maxToolCalls,
    toolIds: tools.descriptors.map((descriptor) => descriptor.toolId).slice(0, 20),
    descriptorSchemaHashes: tools.descriptors
      .map((descriptor) => descriptor.inputSchema ? stableHash(descriptor.inputSchema) : undefined)
      .filter((hash): hash is string => Boolean(hash))
      .slice(0, 20),
  };
}

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeHealth(provider: RuntimeProvider, response: RuntimeHealthResponseV1): RuntimeHealth {
  return {
    provider,
    status: response.status,
    message: response.message ?? `Agno HTTP runtime reported ${response.status}.`,
    checkedAt: new Date().toISOString(),
    details: {
      httpCalled: true,
      runtimeProvider: response.provider,
      protocolVersion: response.protocolVersion,
      runtimeDetails: sanitizeMetadata(response.details),
    },
  };
}

function normalizeCapabilities(
  provider: RuntimeProvider,
  response: RuntimeCapabilitiesResponseV1,
  config: RuntimeFeatureConfig,
): RuntimeCapabilities {
  return {
    provider,
    status: 'healthy',
    supportsTextGeneration: true,
    supportsStreaming: response.supportsStreaming,
    supportsRagContext: response.supportsRagContext,
    supportsMcpTools: false,
    supportsToolCalling: false,
    supportsSandbox: true,
    supportsExternalProviders: false,
    supportsCitations: response.supportsRagContext,
    supportsTraceEvents: true,
    maxInputPreviewChars: response.maxInputChars ?? config.agnoMaxInputPreviewChars,
    maxOutputPreviewChars,
  };
}

function normalizeExecutionResponse(
  provider: RuntimeProvider,
  response: RuntimeExecuteResponseV1,
  invocationSummary: Record<string, unknown>,
  runtimeLatencyMs: number,
  existingEvents: RuntimeNormalizedEvent[],
): RuntimeExecutionResult {
  const parsed = runtimeExecuteResponseV1Schema.parse(response);
  const status = normalizeRuntimeStatus(parsed.status);
  const outputText = parsed.output?.text;
  const outputPreview = outputText?.slice(0, maxOutputPreviewChars);
  const outputHash = outputText ? createHash('sha256').update(outputText).digest('hex') : undefined;
  const usage = normalizeUsage(parsed.usage);
  const metrics = normalizeRuntimeMetrics(parsed, invocationSummary, runtimeLatencyMs);

  return {
    provider,
    status,
    outputPreview,
    outputHash,
    message: parsed.error?.message
      ?? (status === 'completed'
        ? 'Agno HTTP runtime concluiu a execucao.'
        : 'Agno HTTP runtime retornou falha controlada.'),
    errorCode: status === 'completed' ? undefined : parsed.error?.code,
    errorMessage: status === 'completed' ? undefined : parsed.error?.message,
    metadata: jsonMetadata({
      ...invocationSummary,
      responseStatus: parsed.status,
      runtimeStatus: status,
      runtimeErrorCode: parsed.error?.code,
      runtimeLatencyMs,
      usage,
      runtimeUsage: usage,
      ...metrics,
      outputHash,
    }),
    events: [
      ...existingEvents,
      ...normalizeContractEvents(parsed.events),
      {
        type: status === 'completed' ? 'run_completed' : 'run_failed',
        status,
        message: status === 'completed'
          ? 'Run finalizado pelo runtime Agno HTTP.'
          : 'Run nao foi concluido pelo runtime Agno HTTP.',
        metadata: jsonMetadata({
          ...invocationSummary,
          provider,
          runtimeStatus: parsed.status,
          runtimeErrorCode: parsed.error?.code,
          runtimeLatencyMs,
          outputHash,
          usage,
          ...metrics,
        }),
      },
    ],
  };
}

function normalizeUsage(usage: RuntimeExecuteResponseV1['usage']): Record<string, unknown> | undefined {
  if (!usage) return undefined;
  const normalized: Record<string, unknown> = {};
  if (typeof usage.inputTokens === 'number') normalized.inputTokens = usage.inputTokens;
  if (typeof usage.outputTokens === 'number') normalized.outputTokens = usage.outputTokens;
  if (typeof usage.totalTokens === 'number') normalized.totalTokens = usage.totalTokens;
  if (typeof usage.latencyMs === 'number') normalized.latencyMs = usage.latencyMs;
  if (usage.estimatedCostMinorUnits) normalized.estimatedCostMinorUnits = usage.estimatedCostMinorUnits;
  if (usage.costCurrency) normalized.costCurrency = usage.costCurrency;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeRuntimeMetrics(
  parsed: RuntimeExecuteResponseV1,
  invocationSummary: Record<string, unknown>,
  adapterLatencyMs: number,
): Record<string, unknown> {
  const outputMetadata = parsed.output?.metadata;
  return {
    inputTokens: parsed.usage?.inputTokens,
    outputTokens: parsed.usage?.outputTokens,
    totalTokens: parsed.usage?.totalTokens,
    latencyMs: parsed.usage?.latencyMs ?? adapterLatencyMs,
    adapterLatencyMs,
    ragSourceCount: numberValue(invocationSummary.ragSourceCount) ?? 0,
    ragContextChars: numberValue(invocationSummary.ragContextChars) ?? 0,
    conversationContextIncluded: metadataBoolean(invocationSummary, 'conversationContextIncluded') ?? false,
    conversationContextMessageCount: numberValue(invocationSummary.conversationContextMessageCount) ?? 0,
    conversationContextChars: numberValue(invocationSummary.conversationContextChars) ?? 0,
    conversationContextTruncated: metadataBoolean(invocationSummary, 'conversationContextTruncated') ?? false,
    toolDescriptorCount: numberValue(invocationSummary.toolDescriptorCount) ?? 0,
    maxToolCalls: numberValue(invocationSummary.maxToolCalls) ?? 0,
    toolCallsExecuted: metadataNumber(outputMetadata, 'toolCallsExecuted') ?? 0,
    externalMcpCalled: metadataBoolean(outputMetadata, 'externalMcpCalled') ?? false,
    externalProviderCalled: metadataBoolean(outputMetadata, 'externalProviderCalled') ?? false,
  };
}

function metadataNumber(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  return numberValue((metadata as Record<string, unknown>)[key]);
}

function metadataBoolean(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeContractEvents(events: RuntimeNormalizedEventV1[] | undefined): RuntimeNormalizedEvent[] {
  if (!events) return [];
  return events.slice(0, 50).map((event) => ({
    type: normalizeContractEventType(event.type),
    status: normalizeContractEventStatus(event.status),
    message: event.message,
    metadata: jsonMetadata({
      runtimeEventId: event.eventId,
      runtimeEventType: event.type,
      runtimeEventStatus: event.status,
      runtimeMetadata: event.metadata,
    }),
  }));
}

function normalizeContractEventType(type: RuntimeNormalizedEventV1['type']): RuntimeNormalizedEvent['type'] {
  if (type === 'run.started') return 'run_started';
  if (type === 'model.requested') return 'model_started';
  if (type === 'model.completed') return 'model_completed';
  if (type === 'rag.context.attached') return 'rag_context_attached';
  if (type === 'tool.descriptors.attached' || type === 'tool.requested' || type === 'tool.completed' || type === 'tool.blocked') return 'mcp_tools_attached';
  if (type === 'run.completed') return 'run_completed';
  if (type === 'run.failed') return 'run_failed';
  return 'adapter_warning';
}

function normalizeContractEventStatus(status: RuntimeNormalizedEventV1['status']): RuntimeNormalizedEvent['status'] {
  if (status === 'succeeded') return 'completed';
  if (status === 'completed' || status === 'failed' || status === 'blocked' || status === 'cancelled' || status === 'queued' || status === 'running') return status;
  return undefined;
}

function normalizeRuntimeStatus(status: RuntimeExecuteResponseV1['status']): RuntimeExecutionStatus {
  if (status === 'succeeded') return 'completed';
  return status;
}

function failedResult(
  provider: RuntimeProvider,
  errorCode: string,
  message: string,
  events: RuntimeNormalizedEvent[],
  metadata: Record<string, unknown>,
): RuntimeExecutionResult {
  const blocked = errorCode === 'RUNTIME_POLICY_BLOCKED';
  return {
    provider,
    status: blocked ? 'blocked' : 'failed',
    message,
    errorCode,
    errorMessage: message,
    metadata: jsonMetadata(metadata),
    events: [
      ...events,
      {
        type: 'run_failed',
        status: blocked ? 'blocked' : 'failed',
        message: 'Agno HTTP runtime adapter falhou fechado sem fallback automatico.',
        metadata: jsonMetadata({
          provider,
          errorCode,
          ...metadata,
        }),
      },
    ],
  };
}

function healthErrorCode(health: RuntimeHealth) {
  return health.status === 'misconfigured' ? 'RUNTIME_BAD_REQUEST' : 'RUNTIME_UNAVAILABLE';
}

function errorCode(error: unknown) {
  if (error instanceof AgnoHttpRuntimeClientError) return error.code;
  return 'RUNTIME_UNKNOWN_ERROR';
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 300);
  return 'Agno HTTP runtime request failed.';
}

function errorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof AgnoHttpRuntimeClientError) {
    return {
      code: error.code,
      httpStatus: error.httpStatus,
      retryable: error.retryable,
      details: sanitizeMetadata(error.details),
    };
  }
  return {
    code: 'RUNTIME_UNKNOWN_ERROR',
  };
}

function sanitizeMetadata(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 300);
  if (depth >= 4) return '[truncated]';
  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) => sanitizeMetadata(item, depth + 1))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined) as Prisma.InputJsonArray;
  }
  if (typeof value !== 'object') return undefined;

  const sanitized: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    const normalizedKey = key.replace(/[-_\s]/g, '').toLowerCase();
    if (
      !allowedMetadataKeys.has(normalizedKey)
      && unsafeMetadataFragments.some((fragment) => normalizedKey.includes(fragment))
    ) {
      sanitized[key] = '[redacted]';
      continue;
    }
    const sanitizedValue = sanitizeMetadata(item, depth + 1);
    if (sanitizedValue !== undefined) sanitized[key] = sanitizedValue;
  }
  return sanitized as Prisma.InputJsonObject;
}

function jsonMetadata(value: Record<string, unknown>): Prisma.InputJsonObject {
  const sanitized = sanitizeMetadata(value);
  if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
    return sanitized as Prisma.InputJsonObject;
  }
  return {};
}

export const agnoHttpRuntimeAdapter = new AgnoHttpRuntimeAdapter();
