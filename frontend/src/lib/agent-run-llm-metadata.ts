import type {
  AgentRun,
  AgentRunEvent,
  AgentRunLlmUsage,
  LlmProvider,
} from '@/types';

export interface AgentRunLlmSummary extends AgentRunLlmUsage {
  runtimeProvider?: string;
  runtimeStatus?: string;
  provider?: LlmProvider;
  model?: string;
  externalProviderCalled?: boolean;
  selectionReason?: string;
  latencyMs?: number;
  providerStatus?: string;
  failedClosed?: boolean;
  simulated?: boolean;
}

export interface AgentRunEventLlmSummary extends AgentRunLlmUsage {
  runtimeProvider?: string;
  provider?: LlmProvider;
  providerStatus?: string;
  model?: string;
  externalProviderCalled?: boolean;
  selectionReason?: string;
  latencyMs?: number;
  failedClosed?: boolean;
  simulated?: boolean;
}

export interface AgentRunConversationContextSummary {
  included?: boolean;
  messageCount?: number;
  totalChars?: number;
  truncated?: boolean;
  maxMessages?: number;
  maxMessageChars?: number;
  maxTotalChars?: number;
}

export type AgentRunEventTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface AgentRunEventPresentation {
  label: string;
  tone: AgentRunEventTone;
}

const numberFormatter = new Intl.NumberFormat('pt-BR');
const safeMessageEventTypes = new Set([
  'runtime.provider_selected',
  'runtime.model_started',
  'runtime.model_completed',
  'runtime.run_completed',
  'run.completed',
]);

const eventPresentations: Record<string, AgentRunEventPresentation> = {
  'run.conversation_context_selected': { label: 'Contexto conversacional avaliado', tone: 'info' },
  'llm.provider_selected': { label: 'Provider LLM selecionado', tone: 'info' },
  'llm.generation_started': { label: 'Geração LLM iniciada', tone: 'info' },
  'llm.generation_completed': { label: 'Geração LLM concluída', tone: 'success' },
  'llm.generation_failed': { label: 'Geração LLM falhou', tone: 'danger' },
  'llm.generation_blocked': { label: 'Geração LLM bloqueada', tone: 'warning' },
  'runtime.provider_selected': { label: 'Runtime selecionado', tone: 'info' },
  'runtime.model_started': { label: 'Modelo iniciado', tone: 'info' },
  'runtime.model_completed': { label: 'Modelo finalizado', tone: 'success' },
  'runtime.run_completed': { label: 'Run concluído', tone: 'success' },
  'runtime.run_failed': { label: 'Run falhou no runtime', tone: 'danger' },
  'run.blocked': { label: 'Run bloqueado', tone: 'warning' },
  'run.failed': { label: 'Run falhou', tone: 'danger' },
  'run.completed': { label: 'Run concluído', tone: 'success' },
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function safeString(value: unknown, maxLength = 100): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function safeBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
  return values.find((value) => value !== undefined);
}

function usageFrom(...sources: Array<Record<string, unknown> | undefined>): AgentRunLlmUsage {
  for (const source of sources) {
    if (!source) continue;
    const usage = asRecord(source.usage);
    const inputTokens = firstDefined(safeNumber(source.inputTokens), safeNumber(usage?.inputTokens));
    const outputTokens = firstDefined(safeNumber(source.outputTokens), safeNumber(usage?.outputTokens));
    const totalTokens = firstDefined(safeNumber(source.totalTokens), safeNumber(usage?.totalTokens));

    if (inputTokens !== undefined || outputTokens !== undefined || totalTokens !== undefined) {
      return { inputTokens, outputTokens, totalTokens };
    }
  }

  return {};
}

function contextSummaryFrom(source?: Record<string, unknown>): AgentRunConversationContextSummary {
  const nested = asRecord(source?.conversationContext);
  const summary = asRecord(source?.conversationContextSummary);
  const limits = asRecord(nested?.limits) ?? asRecord(summary?.limits);

  return {
    included: firstDefined(
      safeBoolean(source?.conversationContextIncluded),
      safeBoolean(nested?.included),
      safeBoolean(summary?.included),
    ),
    messageCount: firstDefined(
      safeNumber(source?.conversationContextMessageCount),
      safeNumber(nested?.messageCount),
      safeNumber(summary?.messageCount),
    ),
    totalChars: firstDefined(
      safeNumber(source?.conversationContextChars),
      safeNumber(nested?.totalChars),
      safeNumber(summary?.totalChars),
    ),
    truncated: firstDefined(
      safeBoolean(source?.conversationContextTruncated),
      safeBoolean(nested?.truncated),
      safeBoolean(summary?.truncated),
    ),
    maxMessages: firstDefined(
      safeNumber(source?.conversationContextMaxMessages),
      safeNumber(limits?.maxMessages),
      safeNumber(summary?.maxMessages),
    ),
    maxMessageChars: firstDefined(
      safeNumber(source?.conversationContextMaxMessageChars),
      safeNumber(limits?.maxMessageChars),
      safeNumber(summary?.maxMessageChars),
    ),
    maxTotalChars: firstDefined(
      safeNumber(source?.conversationContextMaxTotalChars),
      safeNumber(limits?.maxTotalChars),
      safeNumber(summary?.maxTotalChars),
    ),
  };
}

function mergeContextSummaries(
  ...sources: AgentRunConversationContextSummary[]
): AgentRunConversationContextSummary {
  return {
    included: firstDefined(...sources.map((source) => source.included)),
    messageCount: firstDefined(...sources.map((source) => source.messageCount)),
    totalChars: firstDefined(...sources.map((source) => source.totalChars)),
    truncated: firstDefined(...sources.map((source) => source.truncated)),
    maxMessages: firstDefined(...sources.map((source) => source.maxMessages)),
    maxMessageChars: firstDefined(...sources.map((source) => source.maxMessageChars)),
    maxTotalChars: firstDefined(...sources.map((source) => source.maxTotalChars)),
  };
}

export function getAgentRunEventLlmSummary(event: AgentRunEvent): AgentRunEventLlmSummary {
  const metadata = asRecord(event.metadata);
  const usage = usageFrom(metadata);

  return {
    runtimeProvider: safeString(metadata?.provider),
    provider: safeString(metadata?.llmProvider) as LlmProvider | undefined,
    providerStatus: safeString(metadata?.providerStatus),
    model: safeString(metadata?.model),
    externalProviderCalled: firstDefined(
      safeBoolean(metadata?.externalProviderCalled),
      safeBoolean(metadata?.externalProvidersCalled),
    ),
    selectionReason: firstDefined(
      safeString(metadata?.llmSelectionReason),
      safeString(metadata?.reason),
    ),
    latencyMs: firstDefined(
      safeNumber(metadata?.llmLatencyMs),
      safeNumber(metadata?.latencyMs),
    ),
    failedClosed: safeBoolean(metadata?.failedClosed),
    simulated: safeBoolean(metadata?.simulated),
    ...usage,
  };
}

export function getAgentRunEventConversationContextSummary(event: AgentRunEvent): AgentRunConversationContextSummary {
  return contextSummaryFrom(asRecord(event.metadata));
}

export function getAgentRunLlmSummary(run: AgentRun): AgentRunLlmSummary {
  const metadata = asRecord(run.metadata);
  const runtime = asRecord(metadata?.runtime);
  const adapter = asRecord(runtime?.adapterMetadata);
  const llm = asRecord(adapter?.llm);
  const eventSummaries = (run.events ?? []).map(getAgentRunEventLlmSummary);
  const providerEvent = eventSummaries.find((event) => event.provider || event.selectionReason);
  const completionEvent = [...eventSummaries].reverse().find((event) =>
    event.latencyMs !== undefined
    || event.inputTokens !== undefined
    || event.outputTokens !== undefined
    || event.totalTokens !== undefined,
  );
  const usage = usageFrom(llm, adapter, asRecord(completionEvent));

  return {
    runtimeProvider: firstDefined(
      safeString(runtime?.provider),
      eventSummaries.find((event) => event.runtimeProvider)?.runtimeProvider,
    ),
    runtimeStatus: safeString(runtime?.status),
    provider: firstDefined(
      safeString(adapter?.llmProvider) as LlmProvider | undefined,
      safeString(llm?.provider) as LlmProvider | undefined,
      providerEvent?.provider,
    ),
    model: firstDefined(
      safeString(adapter?.llmModel),
      providerEvent?.model,
      completionEvent?.model,
    ),
    externalProviderCalled: firstDefined(
      safeBoolean(llm?.externalProviderCalled),
      safeBoolean(adapter?.externalProviderCalled),
      completionEvent?.externalProviderCalled,
      providerEvent?.externalProviderCalled,
    ),
    selectionReason: firstDefined(
      safeString(adapter?.llmSelectionReason),
      providerEvent?.selectionReason,
    ),
    latencyMs: firstDefined(
      safeNumber(adapter?.llmLatencyMs),
      safeNumber(llm?.latencyMs),
      completionEvent?.latencyMs,
    ),
    providerStatus: safeString(llm?.providerStatus),
    failedClosed: firstDefined(
      safeBoolean(llm?.failedClosed),
      completionEvent?.failedClosed,
      providerEvent?.failedClosed,
    ),
    simulated: firstDefined(
      safeBoolean(llm?.simulated),
      completionEvent?.simulated,
      providerEvent?.simulated,
    ),
    ...usage,
  };
}

export function getAgentRunConversationContextSummary(run: AgentRun): AgentRunConversationContextSummary {
  const metadata = asRecord(run.metadata);
  const runtime = asRecord(metadata?.runtime);
  const adapter = asRecord(runtime?.adapterMetadata);
  const eventSummary = (run.events ?? [])
    .map(getAgentRunEventConversationContextSummary)
    .find(hasAgentRunConversationContextSummary);

  return mergeContextSummaries(
    contextSummaryFrom(runtime),
    contextSummaryFrom(adapter),
    contextSummaryFrom(metadata),
    eventSummary ?? {},
  );
}

export function hasAgentRunLlmSummary(summary: AgentRunLlmSummary | AgentRunEventLlmSummary) {
  return Object.values(summary).some((value) => value !== undefined);
}

export function hasAgentRunConversationContextSummary(summary: AgentRunConversationContextSummary) {
  return Object.values(summary).some((value) => value !== undefined);
}

export function llmProviderLabel(provider?: string) {
  if (provider === 'local_deterministic') return 'Provider local';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'azure_openai') return 'Azure OpenAI';
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'agno_local') return 'Agno local';
  return provider ? provider.slice(0, 60) : 'Não informado';
}

export function llmSelectionReasonLabel(reason?: string) {
  if (!reason) return undefined;
  const labels: Record<string, string> = {
    sandbox_blocks_real_providers: 'Sandbox bloqueou provider real',
    assistant_policy_opt_in: 'Provider selecionado por policy',
    assistant_policy_default_local: 'Policy manteve provider local',
  };

  if (labels[reason]) return labels[reason];
  if (reason.toLowerCase().includes('fallback')) return 'Fallback local_deterministic';
  if (reason.toLowerCase().includes('policy') && reason.toLowerCase().includes('block')) {
    return 'Policy bloqueou provider real';
  }
  return reason.replace(/[_-]+/g, ' ').slice(0, 80);
}

export function getAgentRunEventPresentation(event: AgentRunEvent): AgentRunEventPresentation {
  const knownPresentation = eventPresentations[event.type];
  if (knownPresentation) return knownPresentation;

  if (event.status === 'completed') return { label: 'Evento concluído', tone: 'success' };
  if (event.status === 'failed') return { label: 'Evento falhou', tone: 'danger' };
  if (event.status === 'blocked') return { label: 'Evento bloqueado', tone: 'warning' };
  if (event.status === 'running' || event.status === 'queued' || event.status === 'prechecking') {
    return { label: 'Evento em andamento', tone: 'info' };
  }
  return { label: 'Evento de execução', tone: 'neutral' };
}

export function formatLlmLatency(latencyMs?: number) {
  if (latencyMs === undefined) return undefined;
  if (latencyMs < 1000) return `${Math.round(latencyMs)} ms`;
  return `${(latencyMs / 1000).toFixed(latencyMs >= 10000 ? 1 : 2)} s`;
}

export function formatTokenCount(value?: number) {
  return value === undefined ? undefined : numberFormatter.format(value);
}

export function isLlmTimelineEvent(event: AgentRunEvent) {
  return event.type.startsWith('llm.')
    || event.type === 'runtime.provider_selected'
    || event.type === 'runtime.model_started'
    || event.type === 'runtime.model_completed'
    || event.type === 'run.conversation_context_selected';
}

export function visibleAgentRunEvents(events: AgentRunEvent[]) {
  const relevant = events.filter((event) =>
    isLlmTimelineEvent(event)
    || event.type === 'runtime.run_failed'
    || event.type === 'runtime.run_completed'
    || event.type === 'run.blocked'
    || event.type === 'run.failed'
    || event.type === 'run.completed',
  );

  return (relevant.length > 0 ? relevant : events).slice(0, 8);
}

export function safeAgentRunEventMessage(event: AgentRunEvent) {
  if (!safeMessageEventTypes.has(event.type)) return undefined;
  return safeString(event.message, 180);
}
