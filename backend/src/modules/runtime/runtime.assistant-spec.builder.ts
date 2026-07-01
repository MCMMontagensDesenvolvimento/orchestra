import {
  assistantRuntimeSpecVersionV1,
  containsUnsafeRuntimeContractPayload,
  parseAssistantRuntimeSpecV1,
  sanitizeRuntimeContractMetadata,
} from './runtime-contract.schema';
import type { AssistantRuntimeSpecV1, RuntimeRagSource } from './runtime-contract.types';
import { getRuntimeConfig } from './runtime.config';
import type { RuntimeExecutionContext, RuntimeFeatureConfig } from './runtime.types';

type RuntimeRagSourceReference = RuntimeExecutionContext['rag']['sourceReferences'][number];

interface BuildAssistantRuntimeSpecInput {
  context: RuntimeExecutionContext;
  timeoutMs: number;
  maxInputChars?: number;
}

const defaultModelProvider = 'local';
const defaultModelName = 'deterministic-sandbox';
const defaultMaxContextChars = 16000;
const defaultMaxRagSources = 5;
const defaultMaxRagExcerptChars = 1200;
const defaultMaxRagContextChars = 6000;
const contractMaxRagExcerptChars = 4000;

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
  const config = getRuntimeConfig();
  const governedRag = buildGovernedRagSpec(context.rag, config);

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
      maxRagResults: governedRag.maxRagResults,
      maxContextChars: governedRag.maxContextChars,
      failClosed: true,
    },
    instructions: instructions ? { system: instructions } : {},
    rag: governedRag.spec,
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

interface GovernedRagSpec {
  spec: AssistantRuntimeSpecV1['rag'];
  maxRagResults: number;
  maxContextChars: number;
}

function disabledRagSpec(): GovernedRagSpec {
  return {
    spec: {
      enabled: false,
      mode: 'none',
      sources: [],
    },
    maxRagResults: 0,
    maxContextChars: defaultMaxContextChars,
  };
}

function buildGovernedRagSpec(
  rag: RuntimeExecutionContext['rag'],
  config: RuntimeFeatureConfig,
): GovernedRagSpec {
  if (!config.agnoHttpRagContextEnabled || !rag.ragReady || rag.sourceReferences.length === 0) {
    return disabledRagSpec();
  }

  const maxSources = boundedPositiveInteger(config.agnoHttpMaxRagSources, defaultMaxRagSources, 100);
  const maxExcerptChars = boundedPositiveInteger(
    config.agnoHttpMaxRagExcerptChars,
    defaultMaxRagExcerptChars,
    contractMaxRagExcerptChars,
  );
  const maxContextChars = boundedPositiveInteger(
    config.agnoHttpMaxRagContextChars,
    defaultMaxRagContextChars,
    200000,
  );
  const sources: RuntimeRagSource[] = [];
  let contextChars = 0;

  for (const [index, reference] of rag.sourceReferences.entries()) {
    if (sources.length >= maxSources) break;
    const remainingContextChars = maxContextChars - contextChars;
    if (remainingContextChars <= 0) break;

    const source = buildGovernedRagSource(reference, index + 1, {
      lastRagQueryId: rag.lastRagQueryId,
      maxExcerptChars,
      remainingContextChars,
    });
    if (!source) continue;

    sources.push(source);
    contextChars += source.excerpt.length;
  }

  if (sources.length === 0) return disabledRagSpec();

  return {
    spec: {
      enabled: true,
      mode: 'resolved_context',
      sources,
    },
    maxRagResults: maxSources,
    maxContextChars,
  };
}

function buildGovernedRagSource(
  reference: RuntimeRagSourceReference,
  sourceIndex: number,
  limits: { lastRagQueryId: string | null; maxExcerptChars: number; remainingContextChars: number },
): RuntimeRagSource | null {
  const sourceId = safeId(reference.id);
  const rawExcerpt = textOrUndefined(reference.excerpt);
  if (!sourceId || !rawExcerpt || containsUnsafeRuntimeContractPayload(rawExcerpt)) return null;

  const excerpt = truncateText(rawExcerpt, Math.min(limits.maxExcerptChars, limits.remainingContextChars));
  if (!excerpt) return null;

  const source: RuntimeRagSource = {
    sourceId,
    excerpt,
  };

  const documentId = safeId(reference.documentId);
  if (documentId) source.documentId = documentId;

  const chunkId = safeId(reference.chunkId);
  if (chunkId) source.chunkId = chunkId;

  const title = safeOptionalText(reference.documentTitle ?? reference.label, 240);
  if (title) source.title = title;

  const score = validScore(reference.score);
  if (typeof score === 'number') source.score = score;

  const metadata = safeMetadataRecord({
    citationLabel: safeOptionalText(reference.label, 80),
    sourceIndex,
    lastRagQueryId: safeId(limits.lastRagQueryId),
  });
  if (metadata) source.metadata = metadata as RuntimeRagSource['metadata'];

  return containsUnsafeRuntimeContractPayload(source) ? null : source;
}

function boundedPositiveInteger(value: number, fallback: number, max: number) {
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return Math.min(value, max);
}

function safeId(value: string | null | undefined) {
  const normalized = safeOptionalText(value, 160);
  return normalized && !containsUnsafeRuntimeContractPayload(normalized) ? normalized : undefined;
}

function safeOptionalText(value: string | null | undefined, maxChars: number) {
  const normalized = textOrUndefined(value);
  if (!normalized || containsUnsafeRuntimeContractPayload(normalized)) return undefined;
  return truncateText(normalized, maxChars);
}

function truncateText(value: string, maxChars: number) {
  if (maxChars <= 0) return undefined;
  const truncated = value.slice(0, maxChars).trim();
  return truncated.length > 0 ? truncated : undefined;
}

function validScore(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : undefined;
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
