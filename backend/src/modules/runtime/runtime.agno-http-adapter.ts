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
  'descriptorschemahashes',
  'inputtokens',
  'maxtoolcalls',
  'outputmetadata',
  'outputtokens',
  'ragcontextchars',
  'ragmode',
  'ragsourcecount',
  'sourceids',
  'tooldescriptorcount',
  'toolids',
  'toolmode',
  'totaltokens',
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

    events.push({
      type: 'agno_request_started',
      status: 'running',
      message: 'Chamada HTTP ao runtime Agno-compatible minimo iniciada.',
      metadata: {
        requestSpecVersion: requestBody.specVersion,
        assistantSpecVersion: requestBody.assistantRuntimeSpec.specVersion,
        timeoutMs: config.agnoHttpTimeoutMs,
        inputHash: context.input.hash,
        ...(ragSummary ?? {}),
        ...(toolSummary ?? {}),
      },
    });

    try {
      const response = await client.execute(requestBody);
      return normalizeExecutionResponse(this.provider, response, [
        ...events,
        {
          type: 'agno_request_completed',
          status: response.status === 'succeeded' ? 'completed' : normalizeRuntimeStatus(response.status),
          message: 'Chamada HTTP ao runtime Agno-compatible minimo concluida.',
          metadata: {
            requestSent: true,
            runtimeStatus: response.status,
          },
        },
      ]);
    } catch (error) {
      return failedResult(this.provider, errorCode(error), errorMessage(error), [
        ...events,
        {
          type: 'agno_request_failed',
          status: errorCode(error) === 'RUNTIME_POLICY_BLOCKED' ? 'blocked' : 'failed',
          message: errorMessage(error),
          metadata: {
            ...errorDetails(error),
            requestSent: true,
          },
        },
      ], {
        requestSent: true,
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
  existingEvents: RuntimeNormalizedEvent[],
): RuntimeExecutionResult {
  const parsed = runtimeExecuteResponseV1Schema.parse(response);
  const status = normalizeRuntimeStatus(parsed.status);
  const outputText = parsed.output?.text;
  const outputPreview = outputText?.slice(0, maxOutputPreviewChars);
  const outputHash = outputText ? createHash('sha256').update(outputText).digest('hex') : undefined;

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
      responseStatus: parsed.status,
      usage: parsed.usage,
      outputMetadata: parsed.output?.metadata,
      externalProviderCalled: false,
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
          provider,
          runtimeStatus: parsed.status,
          errorCode: parsed.error?.code,
          outputHash,
        }),
      },
    ],
  };
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
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
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
