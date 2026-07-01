import {
  assistantRuntimeSpecVersionV1,
  parseAssistantRuntimeSpecV1,
  sanitizeRuntimeContractMetadata,
} from './runtime-contract.schema';
import type { AssistantRuntimeSpecV1 } from './runtime-contract.types';
import type { RuntimeExecutionContext } from './runtime.types';

interface BuildAssistantRuntimeSpecInput {
  context: RuntimeExecutionContext;
  timeoutMs: number;
  maxInputChars?: number;
}

const defaultModelProvider = 'local';
const defaultModelName = 'deterministic-sandbox';
const defaultMaxContextChars = 16000;

export function buildAssistantRuntimeSpecV1(input: BuildAssistantRuntimeSpecInput): AssistantRuntimeSpecV1 {
  const context = input.context;
  const message = textOrFallback(context.input.raw, context.input.preview, 'No user input provided.')
    .slice(0, input.maxInputChars ?? defaultMaxContextChars);
  const instructions = textOrUndefined(context.compiledPrompt.instructionsPreview);
  const metadata = safeMetadataRecord({
    source: 'orchestra_backend',
    adapter: 'agno_http',
    inputHash: context.input.hash,
    executionMode: context.executionMode,
    requestMetadata: context.metadata,
  });

  const spec: Record<string, unknown> = {
    specVersion: assistantRuntimeSpecVersionV1,
    trace: {
      traceId: context.traceId,
      runId: context.runId,
      requestId: context.requestId,
    },
    tenant: {
      id: context.tenantId,
    },
    workspace: {
      id: context.workspaceId || null,
    },
    actor: {
      userId: context.userId,
    },
    assistant: {
      id: context.assistantId,
      ...(context.assistantVersionId ? { versionId: context.assistantVersionId } : {}),
      ...(textOrUndefined(context.assistant.name) ? { name: textOrUndefined(context.assistant.name) } : {}),
      ...(textOrUndefined(context.assistant.status) ? { status: textOrUndefined(context.assistant.status) } : {}),
    },
    input: {
      message,
      metadata: {
        inputHash: context.input.hash,
      },
    },
    model: {
      provider: resolveModelProvider(context),
      model: resolveModelName(context),
      ...(validTemperature(context.compiledPrompt.temperature) ? { temperature: context.compiledPrompt.temperature } : {}),
    },
    policy: {
      executionMode: 'sync',
      streaming: false,
      timeoutMs: input.timeoutMs,
      maxToolCalls: 0,
      maxRagResults: 0,
      maxContextChars: defaultMaxContextChars,
      failClosed: true,
    },
    instructions: instructions ? { system: instructions } : {},
    rag: {
      enabled: false,
      mode: 'none',
      sources: [],
    },
    tools: {
      enabled: false,
      mode: 'none',
      descriptors: [],
    },
    observability: {
      usageEventEnabled: true,
      auditEnabled: true,
      qualityEvaluationEnabled: false,
    },
    limits: {
      enforce: true,
      blockedBeforeRuntime: !context.precheckSnapshot.canExecute,
    },
    ...(metadata ? { metadata } : {}),
  };

  return parseAssistantRuntimeSpecV1(spec);
}

function resolveModelProvider(context: RuntimeExecutionContext) {
  return textOrUndefined(context.compiledPrompt.modelProvider)
    ?? textOrUndefined(context.llmPolicySnapshot.defaultLlmProvider)
    ?? defaultModelProvider;
}

function resolveModelName(context: RuntimeExecutionContext) {
  return textOrUndefined(context.compiledPrompt.modelName) ?? defaultModelName;
}

function textOrFallback(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = textOrUndefined(value);
    if (normalized) return normalized;
  }
  return 'No value provided.';
}

function textOrUndefined(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return normalized.length > 0 ? normalized : undefined;
}

function validTemperature(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2;
}

function safeMetadataRecord(value: unknown): Record<string, unknown> | undefined {
  const sanitized = sanitizeRuntimeContractMetadata(value);
  if (!isRecord(sanitized)) return undefined;
  const entries = Object.entries(sanitized).filter(([, item]) => typeof item !== 'undefined');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
