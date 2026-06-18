import type {
  AgentRunEvent,
  AgentRunStatus,
} from '@/types';
import {
  formatLlmLatency,
  formatTokenCount,
  getAgentRunEventLlmSummary,
  getAgentRunEventPresentation,
  llmProviderLabel,
  llmSelectionReasonLabel,
  safeAgentRunEventMessage,
  visibleAgentRunEvents,
  type AgentRunEventLlmSummary,
  type AgentRunEventTone,
  type AgentRunLlmSummary,
} from '@/lib/agent-run-llm-metadata';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Circle,
  EyeOff,
  GitBranch,
  Play,
  Server,
  XCircle,
} from 'lucide-react';

type LlmMetadataSummary = AgentRunLlmSummary | AgentRunEventLlmSummary;

const toneClasses: Record<AgentRunEventTone, string> = {
  neutral: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  info: 'border-info/30 bg-info/10 text-info',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
};

function EventIcon({ type, tone }: { type: string; tone: AgentRunEventTone }) {
  const className = 'h-3.5 w-3.5';
  if (type === 'runtime.provider_selected') return <Server className={className} />;
  if (type === 'llm.provider_selected') return <GitBranch className={className} />;
  if (type === 'llm.generation_started' || type === 'runtime.model_started') return <Play className={className} />;
  if (type.startsWith('llm.') || type.startsWith('runtime.model')) return <Bot className={className} />;
  if (tone === 'success') return <CheckCircle className={className} />;
  if (tone === 'warning') return <AlertTriangle className={className} />;
  if (tone === 'danger') return <XCircle className={className} />;
  return <Circle className={className} />;
}

function isExternalProviderBlocked(
  summary: LlmMetadataSummary,
  fallback: AgentRunLlmSummary,
  event?: AgentRunEvent,
) {
  const canUseFallback = !event
    || event.type.startsWith('llm.')
    || event.type === 'runtime.model_started'
    || event.type === 'runtime.model_completed';
  const explainsBlocking = !event
    || event.type === 'llm.provider_selected'
    || event.type === 'llm.generation_blocked'
    || event.type === 'llm.generation_failed';
  const called = summary.externalProviderCalled
    ?? (canUseFallback ? fallback.externalProviderCalled : undefined);
  if (called !== false) return false;

  const reason = summary.selectionReason
    ?? (canUseFallback ? fallback.selectionReason : undefined)
    ?? '';
  return summary.failedClosed === true
    || (explainsBlocking && fallback.failedClosed === true)
    || event?.status === 'blocked'
    || event?.type === 'llm.generation_blocked'
    || (explainsBlocking && reason === 'sandbox_blocks_real_providers')
    || (explainsBlocking && reason.includes('policy') && reason.includes('block'));
}

export function AgentRunLlmBadges({
  summary,
  fallbackSummary,
  event,
  showRuntimeProvider = false,
  showProviderStatus = false,
}: {
  summary: LlmMetadataSummary;
  fallbackSummary?: AgentRunLlmSummary;
  event?: AgentRunEvent;
  showRuntimeProvider?: boolean;
  showProviderStatus?: boolean;
}) {
  const fallback = fallbackSummary ?? (summary as AgentRunLlmSummary);
  const canUseFallback = !event
    || event.type.startsWith('llm.')
    || event.type === 'runtime.model_started'
    || event.type === 'runtime.model_completed';
  const canUseFallbackReason = !event
    || event.type === 'llm.provider_selected'
    || event.type === 'llm.generation_blocked'
    || event.type === 'llm.generation_failed';
  const externalProviderCalled = summary.externalProviderCalled
    ?? (canUseFallback ? fallback.externalProviderCalled : undefined);
  const selectionReason = summary.selectionReason
    ?? (canUseFallbackReason ? fallback.selectionReason : undefined);
  const blocked = isExternalProviderBlocked(summary, fallback, event);
  const fallbackFailClosed = Boolean(
    event
    && (event.type === 'llm.generation_failed' || event.type === 'llm.generation_blocked')
    && fallback.failedClosed === true,
  );
  const inputTokens = formatTokenCount(summary.inputTokens);
  const outputTokens = formatTokenCount(summary.outputTokens);
  const totalTokens = formatTokenCount(summary.totalTokens);
  const latency = formatLlmLatency(summary.latencyMs);
  const isLocal = summary.provider === 'local_deterministic' || summary.provider === 'agno_local';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showRuntimeProvider && summary.runtimeProvider && (
        <Badge variant="outline" className="text-[10px]">
          Runtime: <span className="ml-1 font-mono">{summary.runtimeProvider}</span>
        </Badge>
      )}
      {summary.provider && (
        <Badge variant={isLocal ? 'secondary' : 'default'} className="text-[10px]">
          {llmProviderLabel(summary.provider)}
        </Badge>
      )}
      {summary.model && (
        <Badge variant="outline" className="max-w-full text-[10px]">
          Modelo: <span className="ml-1 max-w-56 truncate font-mono">{summary.model}</span>
        </Badge>
      )}
      {externalProviderCalled === true && (
        <Badge variant="default" className="text-[10px]">Provider externo chamado</Badge>
      )}
      {externalProviderCalled === false && blocked && (
        <Badge variant="destructive" className="text-[10px]">Provider externo bloqueado</Badge>
      )}
      {externalProviderCalled === false && !blocked && (
        <Badge variant="outline" className="text-[10px]">Provider externo não chamado</Badge>
      )}
      {selectionReason && (
        <Badge variant="outline" className="text-[10px]">
          {llmSelectionReasonLabel(selectionReason)}
        </Badge>
      )}
      {showProviderStatus && summary.providerStatus && (
        <StatusBadge status={summary.providerStatus} className="text-[10px]" />
      )}
      {(summary.failedClosed === true || fallbackFailClosed) && (
        <Badge variant="destructive" className="text-[10px]">Fail-closed</Badge>
      )}
      {summary.simulated === true && (
        <Badge variant="secondary" className="text-[10px]">Simulado</Badge>
      )}
      {latency && <Badge variant="secondary" className="text-[10px]">Latência: {latency}</Badge>}
      {inputTokens && <Badge variant="outline" className="text-[10px]">Entrada: {inputTokens} tokens</Badge>}
      {outputTokens && <Badge variant="outline" className="text-[10px]">Saída: {outputTokens} tokens</Badge>}
      {totalTokens && <Badge variant="outline" className="text-[10px]">Total: {totalTokens} tokens</Badge>}
    </div>
  );
}

export function AgentRunLlmTimeline({
  events,
  runSummary,
  runStatus,
}: {
  events: AgentRunEvent[];
  runSummary: AgentRunLlmSummary;
  runStatus: AgentRunStatus | string;
}) {
  const visibleEvents = visibleAgentRunEvents(events);
  const omittedCount = Math.max(0, events.length - visibleEvents.length);

  if (events.length === 0) {
    return (
      <div className="mt-3 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold">Timeline LLM</p>
          <StatusBadge status={runStatus} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Nenhum evento informado para este run.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t pt-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Timeline LLM</p>
          <p className="text-[10px] text-muted-foreground">
            Jornada sanitizada de seleção, geração e conclusão.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Status final</span>
          <StatusBadge status={runStatus} />
        </div>
      </div>

      <div className="relative">
        <div className="absolute bottom-4 left-[13px] top-4 w-px bg-border" aria-hidden="true" />
        <ol className="space-y-0">
          {visibleEvents.map((event, index) => {
            const presentation = getAgentRunEventPresentation(event);
            const summary = getAgentRunEventLlmSummary(event);
            const safeMessage = safeAgentRunEventMessage(event);
            const isLast = index === visibleEvents.length - 1;

            return (
              <li key={event.id} className={`relative pl-9 ${isLast ? '' : 'pb-4'}`}>
                <span
                  className={`absolute left-0 top-0.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border ${toneClasses[presentation.tone]}`}
                  aria-hidden="true"
                >
                  <EventIcon type={event.type} tone={presentation.tone} />
                </span>
                <div className={`min-w-0 ${isLast ? '' : 'border-b pb-4'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{presentation.label}</p>
                      <p className="break-all font-mono text-[10px] text-muted-foreground">{event.type}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">#{event.sequence}</span>
                      {event.status && <StatusBadge status={event.status} className="text-[10px]" />}
                    </div>
                  </div>
                  {safeMessage && <p className="mt-1 text-xs text-muted-foreground">{safeMessage}</p>}
                  <div className="mt-2">
                    <AgentRunLlmBadges
                      summary={summary}
                      fallbackSummary={runSummary}
                      event={event}
                      showRuntimeProvider={event.type === 'runtime.provider_selected'}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {omittedCount > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t pt-3 text-[10px] text-muted-foreground">
          <EyeOff className="h-3.5 w-3.5" />
          <span>
            {omittedCount} evento{omittedCount === 1 ? ' técnico omitido' : 's técnicos omitidos'} por segurança ou compactação.
          </span>
        </div>
      )}
    </div>
  );
}
