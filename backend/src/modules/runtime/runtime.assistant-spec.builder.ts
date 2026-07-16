import {
  assistantRuntimeSpecVersionV1,
  containsUnsafeRuntimeContractPayload,
  parseAssistantRuntimeSpecV1,
  sanitizeRuntimeContractMetadata,
} from './runtime-contract.schema';
import type {
  AssistantRuntimeSpecV1,
  RuntimeConversationContextV1,
  RuntimeRagSource,
  RuntimeToolDescriptor,
} from './runtime-contract.types';
import { getRuntimeConfig } from './runtime.config';
import type { RuntimeExecutionContext, RuntimeFeatureConfig } from './runtime.types';

type RuntimeRagSourceReference = RuntimeExecutionContext['rag']['sourceReferences'][number];
type RuntimeMcpToolReference = RuntimeExecutionContext['mcp']['allowedSandboxTools'][number];

interface BuildAssistantRuntimeSpecInput {
  context: RuntimeExecutionContext;
  timeoutMs: number;
  maxInputChars?: number;
}

const defaultModelProvider = 'local_deterministic';
const defaultModelName = 'deterministic-sandbox';
const defaultMaxContextChars = 16000;
const defaultMaxRagSources = 5;
const defaultMaxRagExcerptChars = 1200;
const defaultMaxRagContextChars = 6000;
const contractMaxRagExcerptChars = 4000;
const defaultMaxToolDescriptors = 8;
const defaultMaxToolSchemaChars = 6000;
const contractMaxToolDescriptionChars = 1000;
const contractMaxToolSchemaChars = 8000;
const ragGroundingInstructions = [
  'Quando houver contexto RAG governado, responda usando exclusivamente o contexto RAG fornecido quando ele contiver a resposta.',
  'Se a resposta estiver no contexto RAG, responda diretamente.',
  'Nao diga que nao tem acesso quando o contexto RAG contem a informacao.',
  'Nao substitua o contexto RAG pelo historico conversacional.',
  'Se houver conflito entre historico conversacional e RAG, use RAG.',
  'Se o contexto RAG nao contiver a resposta, diga que nao encontrou na base.',
].join(' ');
const knowledgeNotFoundMessage = 'Não encontrei essa informação na base de conhecimento vinculada.';

export function buildAssistantRuntimeSpecV1(input: BuildAssistantRuntimeSpecInput): AssistantRuntimeSpecV1 {
  const context = input.context;
  const modelSelection = resolveModelSelection(context);
  const message = textOrFallback(context.input.raw, context.input.preview, 'No user input provided.')
    .slice(0, input.maxInputChars ?? defaultMaxContextChars);
  const baseInstructions = textOrUndefined(context.compiledPrompt.instructionsPreview);
  const metadata = safeMetadataRecord({
    source: 'orchestra_backend',
    adapter: 'agno_http',
    inputHash: context.input.hash,
    executionMode: context.executionMode,
    responseScopeMode: context.responseScope.mode,
    ragIntentDetected: context.responseScope.ragIntentDetected,
    ragSkippedReason: context.responseScope.ragSkippedReason,
    fallbackOutsideKnowledgeUsed: context.responseScope.fallbackOutsideKnowledgeUsed,
    rawContentLogged: false,
    llmSelectionReason: modelSelection.reason,
    requestMetadata: context.metadata,
    conversationContextSummary: context.conversationContext?.summary,
  });
  const config = getRuntimeConfig();
  const governedRag = buildGovernedRagSpec(context.rag, config);
  const governedTools = buildGovernedToolSpec(context.mcp, config);
  const governedConversationContext = buildGovernedConversationContextSpec(context.conversationContext);
  const maxConversationContextChars = governedConversationContext?.summary.maxTotalChars ?? 0;
  const instructions = buildSystemInstructions(baseInstructions, governedRag.spec, context.responseScope);

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
    ...(governedConversationContext ? { conversationContext: governedConversationContext } : {}),
    model: {
      provider: modelSelection.provider,
      model: modelSelection.model,
      ...(validTemperature(context.compiledPrompt.temperature) ? { temperature: context.compiledPrompt.temperature } : {}),
    },
    policy: {
      executionMode: 'sync',
      streaming: false,
      timeoutMs: input.timeoutMs,
      maxToolCalls: governedTools.maxToolCalls,
      maxRagResults: governedRag.maxRagResults,
      maxContextChars: Math.max(governedRag.maxContextChars, maxConversationContextChars),
      failClosed: true,
    },
    instructions: instructions ? { system: instructions } : {},
    rag: governedRag.spec,
    tools: governedTools.spec,
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

function buildSystemInstructions(
  baseInstructions: string | undefined,
  rag: AssistantRuntimeSpecV1['rag'],
  responseScope: RuntimeExecutionContext['responseScope'],
) {
  const segments = [
    baseInstructions,
    buildResponseScopeInstructions(responseScope, rag),
    rag.enabled && rag.mode === 'resolved_context' && rag.sources.length > 0 ? ragGroundingInstructions : undefined,
  ].filter((segment): segment is string => Boolean(segment));
  const combined = segments.join('\n\n').slice(0, 12000).trim();
  return combined || undefined;
}

function buildResponseScopeInstructions(
  responseScope: RuntimeExecutionContext['responseScope'],
  rag: AssistantRuntimeSpecV1['rag'],
) {
  const hasRagContext = rag.enabled && rag.mode === 'resolved_context' && rag.sources.length > 0;
  if (responseScope.mode === 'knowledge_only') {
    return [
      'Escopo de resposta: knowledge_only.',
      'Responda somente com informacoes presentes no contexto RAG governado da base vinculada.',
      `Se nao houver contexto RAG ou se o contexto nao contiver a resposta, responda: "${knowledgeNotFoundMessage}"`,
      'Nao use conhecimento geral, historico conversacional ou suposicoes para complementar lacunas da base.',
      'Se o usuario perguntar se pode procurar fora da base, responda que este assistente esta limitado a base vinculada.',
      `Contexto RAG anexado nesta execucao: ${hasRagContext ? 'sim' : 'nao'}.`,
    ].join(' ');
  }
  if (responseScope.mode === 'knowledge_first') {
    return [
      'Escopo de resposta: knowledge_first.',
      'Priorize a base de conhecimento vinculada sempre que houver intencao de consulta a base, documentos, FAQ, politicas, procedimentos, manuais, fontes ou labels de arquivo.',
      `Se nao houver contexto RAG relevante, voce pode responder com conhecimento geral, mas inicie a resposta com: "${knowledgeNotFoundMessage} Pelo conhecimento geral do modelo, ..."`,
      'Quando houver contexto RAG com a resposta, nao use conhecimento geral para substituir a base.',
      'Se o usuario perguntar se pode procurar fora da base, explique que pode complementar fora da base somente quando a base nao trouxer a informacao.',
      `Contexto RAG anexado nesta execucao: ${hasRagContext ? 'sim' : 'nao'}.`,
    ].join(' ');
  }
  return [
    'Escopo de resposta: general_allowed.',
    'Voce pode responder perguntas gerais normalmente com conhecimento geral.',
    'Use contexto RAG quando ele for fornecido ou quando a pergunta tratar claramente da base, documentos, FAQ, politicas, procedimentos, manuais, fontes ou labels de arquivo.',
    `Se a pergunta for sobre a base vinculada e nao houver contexto RAG relevante, responda que nao encontrou na base: "${knowledgeNotFoundMessage}"`,
    'Se o usuario perguntar se pode procurar fora da base, explique que este modo permite conhecimento geral quando a pergunta nao exige resposta exclusiva da base.',
    `Contexto RAG anexado nesta execucao: ${hasRagContext ? 'sim' : 'nao'}.`,
  ].join(' ');
}

function resolveModelSelection(context: RuntimeExecutionContext) {
  const policy = context.llmPolicySnapshot;
  const externalProvider = policy.defaultLlmProvider;
  const externalProviderAllowed = context.executionMode !== 'sandbox'
    && policy.allowExternalLlmProviders
    && externalProvider !== null
    && policy.allowedLlmProviders.includes(externalProvider);

  if (externalProviderAllowed) {
    const configuredProvider = textOrUndefined(context.compiledPrompt.modelProvider);
    const configuredModel = textOrUndefined(context.compiledPrompt.modelName);
    if (configuredProvider !== externalProvider || !configuredModel) {
      throw new Error('Assistant model provider and model must match the governed external LLM policy.');
    }

    return {
      provider: externalProvider,
      model: configuredModel,
      reason: 'assistant_policy_opt_in',
    };
  }

  return {
    provider: defaultModelProvider,
    model: defaultModelName,
    reason: context.executionMode === 'sandbox'
      ? 'sandbox_blocks_real_providers'
      : 'assistant_policy_default_local',
  };
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

function buildGovernedConversationContextSpec(
  context: RuntimeExecutionContext['conversationContext'],
): RuntimeConversationContextV1 | undefined {
  if (!context?.summary.included || context.messages.length === 0) return undefined;

  const maxMessages = boundedPositiveInteger(context.summary.maxMessages, 12, 50);
  const maxMessageChars = boundedPositiveInteger(context.summary.maxMessageChars, 1200, 4000);
  const maxTotalChars = boundedPositiveInteger(context.summary.maxTotalChars, 6000, 20000);
  const messages: RuntimeConversationContextV1['messages'] = [];
  let totalChars = 0;
  let truncated = context.summary.truncated || context.messages.length > maxMessages;

  for (const message of context.messages.slice(-maxMessages)) {
    const remainingChars = maxTotalChars - totalChars;
    if (remainingChars <= 0) {
      truncated = true;
      break;
    }

    const content = safeConversationContextContent(message.content, Math.min(maxMessageChars, remainingChars));
    if (!content || (message.role !== 'user' && message.role !== 'assistant')) continue;

    if (content.length < textOrFallback(message.content).length) truncated = true;
    messages.push({
      role: message.role,
      content,
    });
    totalChars += content.length;
  }

  if (messages.length === 0 || totalChars === 0) return undefined;

  return {
    messages,
    summary: {
      enabled: true,
      included: true,
      messageCount: messages.length,
      totalChars,
      truncated,
      maxMessages,
      maxMessageChars,
      maxTotalChars,
    },
  };
}

function safeConversationContextContent(value: string | null | undefined, maxChars: number) {
  const normalized = textOrUndefined(value);
  if (!normalized || containsUnsafeRuntimeContractPayload(normalized)) return undefined;
  const truncated = truncateText(normalized, maxChars);
  return truncated && !containsUnsafeRuntimeContractPayload(truncated) ? truncated : undefined;
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
  limits: { maxExcerptChars: number; remainingContextChars: number },
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
    documentTitle: safeOptionalText(reference.documentTitle, 240),
    sourceType: safeOptionalText(reference.sourceType, 80),
    sourceName: safeSourceName(reference.sourceName ?? reference.sourceUri ?? reference.documentTitle ?? reference.label),
    sectionTitle: safeOptionalText(reference.sectionTitle, 160),
    pageNumber: typeof reference.pageNumber === 'number' && Number.isInteger(reference.pageNumber) ? reference.pageNumber : undefined,
    rank: typeof reference.rank === 'number' && Number.isInteger(reference.rank) ? reference.rank : sourceIndex,
    matchType: safeOptionalText(reference.matchType, 120),
    retrievalMode: safeOptionalText(reference.retrievalMode, 120),
    ragQueryId: safeOptionalText(reference.ragQueryId, 160),
    sourceIndex,
  });
  if (metadata) source.metadata = metadata as RuntimeRagSource['metadata'];

  return containsUnsafeRuntimeContractPayload(source) ? null : source;
}

function safeSourceName(value: string | null | undefined) {
  const raw = textOrUndefined(value);
  if (!raw) return undefined;
  if (/^(?:internal|localhost|private):/i.test(raw)) return undefined;
  const withoutQuery = raw.split(/[?#]/)[0] ?? raw;
  const parts = withoutQuery.split(/[\\/]/).filter(Boolean);
  const lastPart = parts[parts.length - 1] ?? withoutQuery;
  const normalized = lastPart
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/[^A-Za-z0-9._ -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return safeOptionalText(normalized, 160);
}


interface GovernedToolSpec {
  spec: AssistantRuntimeSpecV1['tools'];
  maxToolCalls: number;
}

function disabledToolSpec(): GovernedToolSpec {
  return {
    spec: {
      enabled: false,
      mode: 'none',
      descriptors: [],
    },
    maxToolCalls: 0,
  };
}

function buildGovernedToolSpec(
  mcp: RuntimeExecutionContext['mcp'],
  config: RuntimeFeatureConfig,
): GovernedToolSpec {
  if (!config.agnoHttpToolsEnabled || mcp.allowedSandboxTools.length === 0) {
    return disabledToolSpec();
  }

  const maxDescriptors = boundedPositiveInteger(
    config.agnoHttpMaxToolDescriptors,
    defaultMaxToolDescriptors,
    50,
  );
  const maxToolCalls = boundedNonNegativeInteger(config.agnoHttpMaxToolCalls, 0, 50);
  const maxSchemaChars = boundedPositiveInteger(
    config.agnoHttpMaxToolSchemaChars,
    defaultMaxToolSchemaChars,
    contractMaxToolSchemaChars,
  );
  const descriptors: RuntimeToolDescriptor[] = [];

  for (const [index, tool] of mcp.allowedSandboxTools.entries()) {
    if (descriptors.length >= maxDescriptors) break;

    const descriptor = buildGovernedToolDescriptor(tool, index + 1, maxSchemaChars);
    if (!descriptor) continue;

    descriptors.push(descriptor);
  }

  if (descriptors.length === 0) return disabledToolSpec();

  return {
    spec: {
      enabled: true,
      mode: 'gateway',
      descriptors,
    },
    maxToolCalls,
  };
}

function buildGovernedToolDescriptor(
  tool: RuntimeMcpToolReference,
  descriptorIndex: number,
  maxSchemaChars: number,
): RuntimeToolDescriptor | null {
  if (tool.requiresApproval || tool.riskLevel !== 'low') return null;

  const toolId = safeId(tool.toolId) ?? safeId(tool.id);
  const name = safeOptionalText(tool.name, 120);
  if (!toolId || !name) return null;

  const inputSchema = safeToolInputSchema(tool.inputSchema, maxSchemaChars);
  if (inputSchema === null) return null;

  const descriptor: RuntimeToolDescriptor = {
    toolId,
    name,
    riskLevel: normalizeToolRiskLevel(tool.riskLevel),
    approvalRequired: Boolean(tool.requiresApproval),
    gatewayRef: {
      type: 'orchestra_tool_gateway',
      action: 'mcp.tool.execute',
    },
  };

  const description = safeOptionalText(tool.description, contractMaxToolDescriptionChars);
  if (description) descriptor.description = description;
  if (inputSchema) descriptor.inputSchema = inputSchema as RuntimeToolDescriptor['inputSchema'];

  const metadata = safeMetadataRecord({
    bindingId: safeId(tool.id),
    descriptorIndex,
    source: 'orchestra_mcp_catalog',
  });
  if (metadata) descriptor.metadata = metadata as RuntimeToolDescriptor['metadata'];

  return containsUnsafeRuntimeContractPayload(descriptor) ? null : descriptor;
}

function normalizeToolRiskLevel(value: string): RuntimeToolDescriptor['riskLevel'] {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'medium';
}

function safeToolInputSchema(value: unknown, maxSchemaChars: number): Record<string, unknown> | null | undefined {
  if (value == null) return undefined;

  const sanitized = sanitizeRuntimeContractMetadata(value);
  if (!isRecord(sanitized)) return null;
  if (containsUnsafeRuntimeContractPayload(sanitized)) return null;
  if (approximateJsonSize(sanitized) > maxSchemaChars) return null;

  return sanitized;
}

function boundedNonNegativeInteger(value: number, fallback: number, max: number) {
  if (!Number.isInteger(value) || value < 0) return fallback;
  return Math.min(value, max);
}

function approximateJsonSize(value: unknown) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
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
