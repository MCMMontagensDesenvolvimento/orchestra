import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import {
  AgnoRuntimeClient,
  AgnoRuntimeClientError,
  type AgnoRuntimeCapabilitiesResponse,
  type AgnoRuntimeEvent,
  type AgnoRuntimeHealthResponse,
  type AgnoRuntimeRequest,
  type AgnoRuntimeResponse,
} from './runtime.agno-client';
import type {
  RuntimeAdapter,
  RuntimeCapabilities,
  RuntimeExecutionContext,
  RuntimeExecutionResult,
  RuntimeExecutionStatus,
  RuntimeFeatureConfig,
  RuntimeHealth,
  RuntimeHealthStatus,
  RuntimeNormalizedEvent,
  RuntimeProvider,
} from './runtime.types';
import { getRuntimeConfig } from './runtime.config';

const unsafeMetadataFragments = ['authorization', 'apikey', 'api_key', 'content', 'credential', 'input', 'instruction', 'output', 'password', 'prompt', 'secret', 'text', 'token'];

export class AgnoRuntimeAdapter implements RuntimeAdapter {
  readonly provider: RuntimeProvider;

  constructor(provider: RuntimeProvider = 'agno_stub') {
    this.provider = provider;
  }

  async getCapabilities(): Promise<RuntimeCapabilities> {
    const config = getRuntimeConfig();
    if (this.provider === 'agno_stub') return this.stubCapabilities(config);
    const unavailable = this.disabledCapabilities(config, this.staticHealth(config));
    const client = this.client(config);
    if (!client || !config.agnoEnabled || !config.agnoConfigured) {
      return unavailable;
    }
    if (!config.agnoHealthcheckEnabled) return this.plannedCapabilities(config, 'degraded');

    try {
      return normalizeCapabilities(this.provider, await client.getCapabilities(), config);
    } catch {
      return {
        ...unavailable,
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
    if (this.provider === 'agno_stub') return this.stubHealth(config);
    const staticHealth = this.staticHealth(config);
    const client = this.client(config);
    if (!client || staticHealth.status !== 'healthy') return staticHealth;
    if (!config.agnoHealthcheckEnabled) {
      return {
        provider: this.provider,
        status: 'degraded',
        message: 'Agno local runtime is configured, but healthcheck HTTP is disabled.',
        checkedAt: new Date().toISOString(),
        details: {
          agnoEnabled: true,
          agnoConfigured: true,
          agnoExecutionEnabled: config.agnoExecutionEnabled,
          httpCalled: false,
        },
      };
    }

    try {
      return normalizeHealth(this.provider, await client.getHealth());
    } catch (error) {
      return {
        provider: this.provider,
        status: 'unavailable',
        message: 'Agno local runtime healthcheck failed.',
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
        message: 'Runtime provider Agno selecionado pelo registry.',
        metadata: {
          provider: this.provider,
          mode: context.executionMode,
          traceId: context.traceId,
        },
      },
    ];

    if (this.provider === 'agno_stub') {
      return failedResult(this.provider, 'AGNO_ADAPTER_STUB', 'Agno stub nao executa runs HTTP.', events, {
        requestSent: false,
      });
    }
    if (!config.adapterEnabled) {
      return failedResult(this.provider, 'RUNTIME_ADAPTER_DISABLED', 'Runtime adapter boundary esta desabilitado.', events, {
        requestSent: false,
      });
    }
    if (!config.agnoEnabled) {
      return failedResult(this.provider, 'AGNO_ADAPTER_DISABLED', 'Agno local runtime esta desabilitado por configuracao.', events, {
        agnoEnabled: false,
        requestSent: false,
      });
    }
    if (!config.agnoExecutionEnabled) {
      return failedResult(this.provider, 'AGNO_EXECUTION_DISABLED', 'Execucao via Agno local runtime esta desabilitada por configuracao.', events, {
        agnoExecutionEnabled: false,
        requestSent: false,
      });
    }
    if (!config.agnoConfigured || !env.AGNO_BASE_URL) {
      return failedResult(this.provider, 'AGNO_ADAPTER_MISCONFIGURED', 'Agno local runtime esta habilitado, mas AGNO_BASE_URL nao foi configurado.', events, {
        agnoConfigured: false,
        requestSent: false,
      });
    }
    if (config.agnoRequireSandbox && context.executionMode !== 'sandbox') {
      return failedResult(this.provider, 'AGNO_SANDBOX_REQUIRED', 'Agno local runtime exige executionMode sandbox nesta fase.', events, {
        executionMode: context.executionMode,
        sandboxRequired: true,
        requestSent: false,
      });
    }

    const health = await this.healthCheck();
    events.push({
      type: 'agno_health_checked',
      status: health.status === 'healthy' || (!config.agnoHealthcheckEnabled && health.status === 'degraded') ? 'completed' : 'failed',
      message: health.message,
      metadata: {
        healthStatus: health.status,
        healthcheckEnabled: config.agnoHealthcheckEnabled,
      },
    });
    if (config.agnoHealthcheckEnabled && health.status !== 'healthy') {
      return failedResult(this.provider, 'AGNO_HEALTHCHECK_FAILED', health.message, events, {
        healthStatus: health.status,
        requestSent: false,
      });
    }

    events.push(
      {
        type: 'run_started',
        status: 'running',
        message: 'Agno local runtime recebeu contexto governado.',
        metadata: {
          provider: this.provider,
          mode: context.executionMode,
          traceId: context.traceId,
        },
      },
      {
        type: 'prompt_compiled',
        status: 'running',
        message: 'Prompt governado anexado ao payload Agno como preview.',
        metadata: context.compiledPrompt,
      },
    );
    if (config.agnoSendRagContext) {
      events.push({
        type: 'rag_context_attached',
        status: 'running',
        message: 'Contexto RAG governado anexado ao payload Agno.',
        metadata: {
          ragReady: context.rag.ragReady,
          knowledgeBindingsCount: context.rag.knowledgeBindingsCount,
          chunkCount: context.rag.chunkCount,
          sourceReferenceCount: context.rag.sourceReferenceCount,
          sourceCountSent: context.rag.sourceReferences.length,
        },
      });
    }
    if (config.agnoSendMcpToolDescriptors) {
      events.push({
        type: 'mcp_tools_attached',
        status: 'running',
        message: 'Descriptors MCP governados anexados sem tool calling autonomo.',
        metadata: {
          mcpBindingsCount: context.mcp.mcpBindingsCount,
          allowedSandboxTools: context.mcp.allowedSandboxTools.length,
          blockedTools: context.mcp.blockedTools.length,
          requiresApproval: context.mcp.requiresApproval.length,
          toolCallingEnabled: false,
        },
      });
    }

    const client = this.client(config);
    if (!client) {
      return failedResult(this.provider, 'AGNO_ADAPTER_MISCONFIGURED', 'Agno local runtime client nao pode ser criado.', events, {
        requestSent: false,
      });
    }

    const payload = buildAgnoRequest(context, config);
    events.push({
      type: 'agno_request_started',
      status: 'running',
      message: 'Chamada HTTP ao Agno local runtime iniciada.',
      metadata: {
        path: config.agnoExecutePath,
        timeoutMs: config.agnoTimeoutMs,
        inputHash: context.input.hash,
        ragSourcesSent: payload.ragContext?.sources.length ?? 0,
        mcpDescriptorsSent: payload.mcpContext?.tools.length ?? 0,
      },
    });

    try {
      const response = await client.executeRun(payload);
      return normalizeAgnoExecutionResponse(this.provider, response, config, events);
    } catch (error) {
      return failedResult(this.provider, errorCode(error), errorMessage(error), [
        ...events,
        {
          type: 'agno_request_failed',
          status: 'failed',
          message: 'Chamada HTTP ao Agno local runtime falhou.',
          metadata: jsonMetadata({
            ...errorDetails(error),
            requestSent: true,
          }),
        },
      ], {
        requestSent: true,
      });
    }
  }

  private client(config: RuntimeFeatureConfig) {
    if (!env.AGNO_BASE_URL) return null;
    return new AgnoRuntimeClient({
      baseUrl: env.AGNO_BASE_URL,
      apiKey: env.AGNO_API_KEY,
      timeoutMs: config.agnoTimeoutMs,
      healthPath: config.agnoHealthPath,
      capabilitiesPath: config.agnoCapabilitiesPath,
      executePath: config.agnoExecutePath,
    });
  }

  private staticHealth(config: RuntimeFeatureConfig): RuntimeHealth {
    const checkedAt = new Date().toISOString();
    if (!config.agnoEnabled) {
      return {
        provider: this.provider,
        status: 'disabled',
        message: 'Agno local runtime adapter is disabled by configuration.',
        checkedAt,
        details: {
          agnoEnabled: false,
          agnoConfigured: false,
          httpCalled: false,
        },
      };
    }

    if (!config.agnoConfigured) {
      return {
        provider: this.provider,
        status: 'misconfigured',
        message: 'Agno local runtime adapter is enabled but AGNO_BASE_URL is missing.',
        checkedAt,
        details: {
          agnoEnabled: true,
          agnoConfigured: false,
          baseUrlConfigured: config.agnoBaseUrlConfigured,
          apiKeyConfigured: config.agnoApiKeyConfigured,
          httpCalled: false,
        },
      };
    }

    return {
      provider: this.provider,
      status: 'healthy',
      message: 'Agno local runtime adapter is configured.',
      checkedAt,
      details: {
        agnoEnabled: true,
        agnoConfigured: true,
        agnoExecutionEnabled: config.agnoExecutionEnabled,
        apiKeyConfigured: config.agnoApiKeyConfigured,
        httpCalled: false,
      },
    };
  }

  private stubHealth(config: RuntimeFeatureConfig): RuntimeHealth {
    return {
      provider: this.provider,
      status: 'disabled',
      message: 'Agno stub remains disabled and does not execute HTTP calls.',
      checkedAt: new Date().toISOString(),
      details: {
        agnoEnabled: config.agnoEnabled,
        agnoConfigured: config.agnoConfigured,
        realAgnoCalled: false,
      },
    };
  }

  private stubCapabilities(config: RuntimeFeatureConfig): RuntimeCapabilities {
    return {
      provider: this.provider,
      status: 'disabled',
      supportsTextGeneration: 'planned',
      supportsStreaming: 'planned',
      supportsRagContext: 'planned',
      supportsMcpTools: 'planned',
      supportsToolCalling: 'planned',
      supportsSandbox: 'planned',
      supportsExternalProviders: false,
      supportsCitations: 'planned',
      supportsTraceEvents: 'planned',
      maxInputPreviewChars: config.agnoMaxInputPreviewChars,
      maxOutputPreviewChars: config.agnoMaxOutputPreviewChars,
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
      supportsSandbox: config.agnoConfigured ? 'planned' : false,
      supportsExternalProviders: false,
      supportsCitations: false,
      supportsTraceEvents: false,
      maxInputPreviewChars: config.agnoMaxInputPreviewChars,
      maxOutputPreviewChars: config.agnoMaxOutputPreviewChars,
    };
  }

  private plannedCapabilities(config: RuntimeFeatureConfig, status: RuntimeHealthStatus): RuntimeCapabilities {
    return {
      provider: this.provider,
      status,
      supportsTextGeneration: 'planned',
      supportsStreaming: false,
      supportsRagContext: config.agnoSendRagContext ? 'planned' : false,
      supportsMcpTools: config.agnoSendMcpToolDescriptors ? 'planned' : false,
      supportsToolCalling: false,
      supportsSandbox: true,
      supportsExternalProviders: false,
      supportsCitations: config.agnoSendRagContext ? 'planned' : false,
      supportsTraceEvents: 'planned',
      maxInputPreviewChars: config.agnoMaxInputPreviewChars,
      maxOutputPreviewChars: config.agnoMaxOutputPreviewChars,
    };
  }
}

function normalizeHealth(provider: RuntimeProvider, response: AgnoRuntimeHealthResponse): RuntimeHealth {
  const status = normalizeHealthStatus(response.status);
  return {
    provider,
    status,
    message: typeof response.message === 'string' ? response.message : `Agno local runtime reported ${status}.`,
    checkedAt: new Date().toISOString(),
    details: {
      provider: typeof response.provider === 'string' ? response.provider : undefined,
      version: typeof response.version === 'string' ? response.version : undefined,
      capabilities: sanitizeMetadata(response.capabilities),
      httpCalled: true,
    },
  };
}

function normalizeCapabilities(
  provider: RuntimeProvider,
  response: AgnoRuntimeCapabilitiesResponse,
  config: RuntimeFeatureConfig,
): RuntimeCapabilities {
  return {
    provider,
    status: 'healthy',
    supportsTextGeneration: response.supportsTextGeneration ?? true,
    supportsStreaming: response.supportsStreaming ?? false,
    supportsRagContext: response.supportsRagContext ?? true,
    supportsMcpTools: response.supportsMcpTools ?? false,
    supportsToolCalling: response.supportsToolCalling ?? false,
    supportsSandbox: response.supportsSandbox ?? true,
    supportsExternalProviders: false,
    supportsCitations: response.supportsCitations ?? true,
    supportsTraceEvents: response.supportsTraceEvents ?? true,
    maxInputPreviewChars: config.agnoMaxInputPreviewChars,
    maxOutputPreviewChars: config.agnoMaxOutputPreviewChars,
  };
}

function buildAgnoRequest(context: RuntimeExecutionContext, config: RuntimeFeatureConfig): AgnoRuntimeRequest {
  const tools = config.agnoSendMcpToolDescriptors
    ? context.mcp.allowedSandboxTools.map((tool) => ({
      serverId: tool.serverId,
      toolId: tool.toolId,
      name: tool.name,
      riskLevel: tool.riskLevel,
      requiresApproval: tool.requiresApproval,
      executionMode: tool.executionMode,
    }))
    : [];

  return {
    runId: context.runId,
    traceId: context.traceId,
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    assistantId: context.assistantId,
    assistantVersionId: context.assistantVersionId,
    executionMode: context.executionMode,
    input: {
      text: context.input.preview.slice(0, config.agnoMaxInputPreviewChars),
      hash: context.input.hash,
      preview: context.input.preview.slice(0, config.agnoMaxInputPreviewChars),
    },
    assistant: {
      name: context.assistant.name,
      instructions: (context.compiledPrompt.instructionsPreview ?? '').slice(0, 1500),
      temperature: context.compiledPrompt.temperature ?? null,
      modelProvider: context.compiledPrompt.modelProvider,
      modelName: context.compiledPrompt.modelName,
    },
    policySnapshot: {
      mode: context.executionMode,
      requiresApproval: false,
      externalToolsAllowed: false,
      remoteMcpAllowed: false,
      sandboxRequired: config.agnoRequireSandbox,
    },
    ragContext: config.agnoSendRagContext
      ? {
        enabled: context.rag.ragReady,
        queryId: context.rag.lastRagQueryId,
        sources: context.rag.sourceReferences.slice(0, 5).map((source) => ({
          citationLabel: source.label,
          documentTitle: source.documentTitle,
          excerpt: source.excerpt?.slice(0, 500),
          sourceUri: source.sourceUri,
        })),
      }
      : undefined,
    mcpContext: {
      enabled: config.agnoSendMcpToolDescriptors,
      tools,
      toolCallingEnabled: false,
    },
    metadata: {
      orchestraRuntimeContractVersion: 'v1',
      realExternalProvidersAllowed: false,
      localRuntimeOnly: true,
    },
  };
}

function normalizeAgnoExecutionResponse(
  provider: RuntimeProvider,
  response: AgnoRuntimeResponse,
  config: RuntimeFeatureConfig,
  existingEvents: RuntimeNormalizedEvent[],
): RuntimeExecutionResult {
  const status = normalizeExecutionStatus(response.status, response.output);
  const outputText = outputCandidate(response);
  const outputPreview = outputText?.slice(0, config.agnoMaxOutputPreviewChars);
  const outputHash = typeof response.output?.hash === 'string'
    ? response.output.hash
    : outputText
      ? createHash('sha256').update(outputText).digest('hex')
      : undefined;
  const runtimeEvents = normalizeAgnoEvents(response.events);
  const completionEvent: RuntimeNormalizedEvent = {
    type: status === 'completed' ? 'run_completed' : 'run_failed',
    status,
    message: status === 'completed'
      ? 'Run finalizado pelo Agno local runtime.'
      : 'Run retornou falha pelo Agno local runtime.',
    metadata: jsonMetadata({
      provider,
      outputHash,
    }),
  };
  const events: RuntimeNormalizedEvent[] = [
    ...existingEvents,
    ...runtimeEvents,
    {
      type: 'agno_request_completed',
      status,
      message: 'Chamada HTTP ao Agno local runtime concluida.',
      metadata: jsonMetadata({
        provider,
        runtimeStatus: status,
        outputHash,
        usage: response.usage,
      }),
    },
  ];
  if (!events.some((event) => event.type === completionEvent.type)) events.push(completionEvent);

  return {
    provider,
    status,
    outputPreview,
    outputHash,
    message: typeof response.message === 'string'
      ? response.message.slice(0, 300)
      : status === 'completed'
        ? 'Agno local runtime concluiu a execucao.'
        : 'Agno local runtime retornou falha controlada.',
    events,
    errorCode: status === 'failed' ? 'AGNO_RUNTIME_FAILED' : undefined,
    errorMessage: status === 'failed' ? 'Agno local runtime retornou status failed.' : undefined,
    metadata: sanitizeMetadata({
      responseMetadata: response.metadata,
      usage: response.usage,
    }),
  };
}

function normalizeAgnoEvents(events: AgnoRuntimeEvent[] | undefined): RuntimeNormalizedEvent[] {
  if (!Array.isArray(events)) return [];
  return events.slice(0, 25).map((event) => ({
    type: normalizeAgnoEventType(event.type),
    status: normalizeEventStatus(event.status),
    message: typeof event.message === 'string' ? event.message.slice(0, 300) : undefined,
    metadata: sanitizeMetadata(event.metadata),
  }));
}

function normalizeAgnoEventType(type: string | undefined): RuntimeNormalizedEvent['type'] {
  const normalized = (type ?? '').replace(/[.-]/g, '_');
  if (normalized === 'agno_health_checked') return 'agno_health_checked';
  if (normalized === 'agno_request_started') return 'agno_request_started';
  if (normalized === 'agno_request_completed') return 'agno_request_completed';
  if (normalized === 'agno_request_failed') return 'agno_request_failed';
  if (normalized === 'run_started') return 'run_started';
  if (normalized === 'prompt_compiled') return 'prompt_compiled';
  if (normalized === 'rag_context_attached') return 'rag_context_attached';
  if (normalized === 'mcp_tools_attached') return 'mcp_tools_attached';
  if (normalized === 'model_started') return 'model_started';
  if (normalized === 'model_completed') return 'model_completed';
  if (normalized === 'run_completed') return 'run_completed';
  if (normalized === 'run_failed') return 'run_failed';
  return 'adapter_warning';
}

function normalizeEventStatus(status: string | undefined): RuntimeNormalizedEvent['status'] {
  if (status === 'completed' || status === 'failed' || status === 'blocked' || status === 'cancelled') return status;
  if (status === 'running' || status === 'queued' || status === 'prechecking') return status;
  return undefined;
}

function normalizeExecutionStatus(status: string | undefined, output: AgnoRuntimeResponse['output']): RuntimeExecutionStatus {
  if (status === undefined || status === null) return output ? 'completed' : 'completed';
  if (status === 'completed' || status === 'failed' || status === 'blocked' || status === 'cancelled') return status;
  throw new AgnoRuntimeClientError({
    code: 'AGNO_RUNTIME_INVALID_RESPONSE',
    message: `Agno runtime returned unsupported status "${status}".`,
  });
}

function normalizeHealthStatus(status: string | undefined): RuntimeHealthStatus {
  const normalized = (status ?? 'healthy').toLowerCase();
  if (normalized === 'ok') return 'healthy';
  if (normalized === 'healthy' || normalized === 'degraded' || normalized === 'disabled' || normalized === 'misconfigured' || normalized === 'unavailable') {
    return normalized;
  }
  return 'degraded';
}

function outputCandidate(response: AgnoRuntimeResponse) {
  if (typeof response.output?.preview === 'string') return response.output.preview;
  if (typeof response.output?.text === 'string') return response.output.text;
  return undefined;
}

function failedResult(
  provider: RuntimeProvider,
  errorCode: string,
  message: string,
  events: RuntimeNormalizedEvent[],
  metadata: Record<string, unknown>,
): RuntimeExecutionResult {
  return {
    provider,
    status: 'failed',
    message,
    errorCode,
    errorMessage: message,
    events: [
      ...events,
      {
        type: 'agno_request_failed',
        status: 'failed',
        message,
        metadata: jsonMetadata(metadata),
      },
      {
        type: 'run_failed',
        status: 'failed',
        message: 'Agno runtime adapter falhou fechado sem fallback automatico.',
        metadata: jsonMetadata({
          provider,
          errorCode,
          ...metadata,
        }),
      },
    ],
  };
}

function errorCode(error: unknown) {
  if (error instanceof AgnoRuntimeClientError) return error.code;
  return 'AGNO_RUNTIME_ERROR';
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 300);
  return 'Agno runtime request failed.';
}

function errorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof AgnoRuntimeClientError) {
    return {
      code: error.code,
      statusCode: error.statusCode,
      retryable: error.retryable,
      details: sanitizeMetadata(error.details),
    };
  }
  return {
    code: 'AGNO_RUNTIME_ERROR',
    message: errorMessage(error),
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
    const normalizedKey = key.toLowerCase();
    if (unsafeMetadataFragments.some((fragment) => normalizedKey.includes(fragment))) {
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

export const agnoRuntimeAdapter = new AgnoRuntimeAdapter('agno');
export const agnoStubRuntimeAdapter = new AgnoRuntimeAdapter('agno_stub');
