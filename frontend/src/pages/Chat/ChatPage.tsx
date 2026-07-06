import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Bot,
  History,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { AppShell } from '@/components/shared/AppShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ListLoading, QueryState } from '@/components/shared/QueryState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  useAgentRunEvents,
  useAssistantRuns,
  useCreateAgentRunMutation,
} from '@/hooks/queries/useAgentRuns';
import {
  useAssistant,
  useAssistantActivePublication,
  useAssistants,
} from '@/hooks/queries/useAssistants';
import { isApiError } from '@/services/api/api-error';
import { HttpStatus } from '@/services/api/http-status';
import type {
  AgentRun,
  AgentRunEvent,
  AgentRunStatus,
  Assistant,
  AssistantPublication,
} from '@/types';

type ChatMessageTone = 'default' | 'blocked' | 'error' | 'pending';

interface LocalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isRetry?: boolean;
  retryInput?: string;
  tone?: ChatMessageTone;
  run?: AgentRun;
}

interface TechnicalRow {
  label: string;
  value: string;
}

const chatRoute = (assistantId: string) => `/app/chat/${assistantId}`;

export default function ChatPage() {
  const { assistantId } = useParams();

  if (!assistantId) return <ChatAssistantCatalog />;

  return <AssistantRunChat assistantId={assistantId} />;
}

function ChatAssistantCatalog() {
  const assistantsQuery = useAssistants();

  const publishedAssistants = useMemo(
    () => (assistantsQuery.data ?? []).filter((assistant) => assistant.status === 'published'),
    [assistantsQuery.data],
  );

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione um assistente publicado para iniciar uma execucao governada.
          </p>
        </div>

        <QueryState
          query={assistantsQuery}
          isEmpty={publishedAssistants.length === 0}
          loading={<ListLoading rows={3} />}
          emptyIcon={<Bot className="h-6 w-6" />}
          emptyTitle="Nenhum assistente publicado"
          emptyDescription="Publique um assistente para iniciar o chat."
          emptyAction={(
            <Link to="/app/assistants">
              <Button variant="outline">Ver assistentes</Button>
            </Link>
          )}
          errorTitle="Nao foi possivel carregar os assistentes"
          errorDescription="Tente novamente em instantes."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publishedAssistants.map((assistant) => (
              <Link
                key={assistant.id}
                to={chatRoute(assistant.id)}
                className="rounded-lg border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{assistant.name}</h2>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {assistant.area}
                    </p>
                  </div>
                </div>

                {assistant.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    {assistant.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <StatusBadge status={assistant.status} />
                  <Badge variant="secondary" className="max-w-[12rem] truncate">
                    {assistant.model}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </QueryState>
      </div>
    </AppShell>
  );
}

function AssistantRunChat({ assistantId }: { assistantId: string }) {
  const assistantQuery = useAssistant(assistantId);
  const activePublicationQuery = useAssistantActivePublication(assistantId);
  const assistantRunsQuery = useAssistantRuns(assistantId);
  const createRunMutation = useCreateAgentRunMutation();

  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);

  const historyRuns = useMemo(
    () => (assistantRunsQuery.data ?? []).filter((run) => run.assistantId === assistantId).slice(0, 8),
    [assistantId, assistantRunsQuery.data],
  );

  if (assistantQuery.isLoading) {
    return (
      <AppShell>
        <ChatLoadingState />
      </AppShell>
    );
  }

  if (assistantQuery.isError) {
    return (
      <AppShell>
        <AssistantLoadError error={assistantQuery.error} onRetry={() => assistantQuery.refetch()} />
      </AppShell>
    );
  }

  const assistant = assistantQuery.data;

  if (!assistant) {
    return (
      <AppShell>
        <AssistantNotFound />
      </AppShell>
    );
  }

  if (activePublicationQuery.isLoading) {
    return (
      <AppShell>
        <ChatLoadingState assistant={assistant} />
      </AppShell>
    );
  }

  if (activePublicationQuery.isError) {
    if (
      isApiError(activePublicationQuery.error)
      && activePublicationQuery.error.status === HttpStatus.NOT_FOUND
    ) {
      return (
        <AppShell>
          <AssistantNotReady assistant={assistant} />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <PublicationLoadError
          error={activePublicationQuery.error}
          onRetry={() => activePublicationQuery.refetch()}
        />
      </AppShell>
    );
  }

  const activePublication = typeof activePublicationQuery.data !== 'undefined'
    ? activePublicationQuery.data
    : assistant.activePublication ?? null;

  const assistantReady = assistant.status === 'published' && Boolean(activePublication);

  if (!assistantReady) {
    return (
      <AppShell>
        <AssistantNotReady assistant={assistant} />
      </AppShell>
    );
  }

  const sendInput = async (rawInput: string, options?: { retry?: boolean }) => {
    const input = rawInput.trim();

    if (!input || createRunMutation.isPending) return;

    const userMessage: LocalChatMessage = {
      id: `user-${Date.now()}-${messages.length}`,
      role: 'user',
      content: input,
      createdAt: new Date().toISOString(),
      isRetry: Boolean(options?.retry),
    };

    setMessages((current) => [...current, userMessage]);
    if (!options?.retry) setInputValue('');

    try {
      const run = await createRunMutation.mutateAsync({
        assistantId,
        input: {
          mode: 'published',
          input,
          source: 'frontend-chat',
          metadata: {
            origin: 'chat-ui',
            assistantId,
            route: chatRoute(assistantId),
          },
        },
      });

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${run.id}-${Date.now()}`,
          role: 'assistant',
          content: assistantMessageFromRun(run),
          createdAt: new Date().toISOString(),
          retryInput: canRetryRun(run) ? input : undefined,
          tone: toneFromRun(run),
          run,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: apiErrorMessage(error),
          createdAt: new Date().toISOString(),
          retryInput: input,
          tone: 'error',
        },
      ]);
    }
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendInput(inputValue);
  };

  return (
    <AppShell>
      <div className="grid min-h-[34rem] gap-4 lg:h-[calc(100dvh-7.5rem)] lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-h-[34rem] flex-col overflow-hidden rounded-lg border bg-card animate-fade-in">
          <ChatHeader assistant={assistant} activePublication={activePublication} />

          <ScrollArea className="flex-1 bg-background/50">
            <div className="p-3 sm:p-5">
              {messages.length === 0 ? (
                <ChatEmptyState assistant={assistant} />
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <ChatMessageBubble
                      key={message.id}
                      message={message}
                      isSending={createRunMutation.isPending}
                      onRetry={(retryInput) => { void sendInput(retryInput, { retry: true }); }}
                    />
                  ))}
                </div>
              )}

              {createRunMutation.isPending && (
                <div className="mt-4 flex justify-start">
                  <div className="max-w-[85%] rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Enviando para o backend Orchestra e aguardando o AgentRun...
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <form onSubmit={submitMessage} className="border-t bg-card p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Mensagem para o assistente"
                aria-label="Mensagem"
                className="max-h-40 min-h-[44px] resize-none"
                disabled={createRunMutation.isPending}
              />

              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 shrink-0"
                disabled={!inputValue.trim() || createRunMutation.isPending}
                aria-label="Enviar mensagem"
              >
                {createRunMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>

        <AssistantRunsPanel
          runs={historyRuns}
          isError={assistantRunsQuery.isError}
          isFetching={assistantRunsQuery.isFetching}
          isLoading={assistantRunsQuery.isLoading}
          onRefresh={() => assistantRunsQuery.refetch()}
        />
      </div>
    </AppShell>
  );
}

function ChatHeader({
  assistant,
  activePublication,
}: {
  assistant: Assistant;
  activePublication: AssistantPublication | null;
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{assistant.name}</h1>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={assistant.status} />
            <Badge variant={activePublication ? 'secondary' : 'outline'}>
              {activePublication ? 'Publicacao ativa' : 'Sem publicacao ativa'}
            </Badge>
            <span className="truncate">{assistant.model}</span>
            <span>v{assistant.version}</span>
          </div>
        </div>
      </div>

      <Link to="/app/chat">
        <Button variant="outline" size="sm">Trocar</Button>
      </Link>
    </div>
  );
}

function ChatEmptyState({ assistant }: { assistant: Assistant }) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <MessageSquare className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Conversa pronta para homologacao</h2>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Envie uma mensagem para executar {assistant.name} pelo contrato real de AgentRun.
        O resultado e os identificadores tecnicos ficarao disponiveis na resposta.
      </p>
    </div>
  );
}

function ChatMessageBubble({
  message,
  isSending,
  onRetry,
}: {
  message: LocalChatMessage;
  isSending: boolean;
  onRetry: (input: string) => void;
}) {
  const isUser = message.role === 'user';

  const toneClass = message.tone === 'error'
    ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : message.tone === 'blocked'
      ? 'border-yellow-500/30 bg-yellow-500/10 text-foreground'
      : message.tone === 'pending'
        ? 'border-blue-500/30 bg-blue-500/10 text-foreground'
        : isUser
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-lg border px-4 py-3 shadow-sm sm:max-w-[76%] ${toneClass}`}>
        {message.isRetry && (
          <div className="mb-2 text-[11px] font-medium opacity-80">Reenvio manual</div>
        )}

        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </div>

        {!isUser && message.retryInput && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 h-8 gap-2"
            disabled={isSending}
            onClick={() => onRetry(message.retryInput!)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reenviar
          </Button>
        )}

        {message.run && <RunDetails run={message.run} />}
      </div>
    </div>
  );
}

function RunDetails({ run }: { run: AgentRun }) {
  const rows = technicalRows(run);

  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">Detalhes tecnicos</summary>

      <dl className="mt-2 grid gap-1">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="font-medium text-foreground/70">{row.label}</dt>
            <dd className="break-all font-mono">{row.value}</dd>
          </div>
        ))}
      </dl>

      <RunEventsPanel run={run} />
    </details>
  );
}

function RunEventsPanel({ run }: { run: AgentRun }) {
  const [loadEvents, setLoadEvents] = useState(false);
  const eventsQuery = useAgentRunEvents(loadEvents ? run.id : undefined);
  const events = loadEvents ? eventsQuery.data ?? [] : [];

  return (
    <div className="mt-3 border-t pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium text-foreground/70">Eventos</span>
        {!loadEvents && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setLoadEvents(true)}
          >
            Carregar eventos
          </Button>
        )}
      </div>

      {loadEvents && eventsQuery.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando eventos...
        </div>
      )}

      {loadEvents && eventsQuery.isError && (
        <p className="text-destructive">Nao foi possivel carregar eventos deste run.</p>
      )}

      {loadEvents && !eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 && (
        <p>Nenhum evento retornado pelo backend.</p>
      )}

      {events.length > 0 && (
        <div className="space-y-2">
          {events
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((event) => (
              <RunEventItem key={event.id} event={event} />
            ))}
        </div>
      )}
    </div>
  );
}

function RunEventItem({ event }: { event: AgentRunEvent }) {
  const metadataRows = safeEventMetadataRows(event);

  return (
    <div className="rounded-md border bg-background/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">#{event.sequence}</Badge>
        <span className="font-mono text-[11px] text-foreground">{event.type}</span>
        {event.status && <StatusBadge status={event.status} />}
      </div>

      {event.message && (
        <p className="mt-1 text-foreground/80">{safeString(event.message, 180)}</p>
      )}

      {metadataRows.length > 0 && (
        <dl className="mt-2 grid gap-1">
          {metadataRows.map((row) => (
            <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-2">
              <dt className="font-medium text-foreground/70">{row.label}</dt>
              <dd className="break-all font-mono">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function AssistantRunsPanel({
  runs,
  isError,
  isFetching,
  isLoading,
  onRefresh,
}: {
  runs: AgentRun[];
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  onRefresh: () => unknown;
}) {
  return (
    <aside className="flex min-h-[22rem] flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Ultimos runs</h2>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => { void onRefresh(); }}
          disabled={isFetching}
          aria-label="Recarregar runs"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {isLoading && <ListLoading rows={4} />}

          {isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Nao foi possivel carregar o historico de runs.
            </div>
          )}

          {!isLoading && !isError && runs.length === 0 && (
            <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
              Nenhum run recente retornado pelo backend.
            </div>
          )}

          {!isLoading && !isError && runs.map((run) => (
            <div key={run.id} className="rounded-lg border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={run.status} />
                <span className="text-[11px] text-muted-foreground">{formatDateTime(run.createdAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline">{run.mode}</Badge>
                <span>{run.source}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {run.inputSummary || `runId=${run.id}`}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

function AssistantNotReady({ assistant }: { assistant: Assistant }) {
  const title = assistant.status === 'published'
    ? 'Assistente sem publicacao ativa'
    : 'Assistente ainda nao publicado';

  const description = assistant.status === 'published'
    ? 'Publique novamente ou verifique a publicacao ativa antes de testar no chat.'
    : 'Somente assistentes publicados podem executar em mode published.';

  return (
    <EmptyState
      icon={<AlertCircle className="h-6 w-6" />}
      title={title}
      description={description}
      action={(
        <Link to={`/app/assistants/${assistant.id}`}>
          <Button variant="outline">Abrir assistente</Button>
        </Link>
      )}
    />
  );
}

function AssistantLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isApiError(error) && error.status === HttpStatus.NOT_FOUND) return <AssistantNotFound />;

  if (isApiError(error) && error.status === HttpStatus.FORBIDDEN) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Sem acesso ao assistente"
        description="Sua sessao nao tem permissao para abrir este chat."
      />
    );
  }

  return (
    <EmptyState
      icon={<AlertCircle className="h-6 w-6" />}
      title="Nao foi possivel carregar o assistente"
      description="Tente novamente em instantes."
      action={(
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      )}
    />
  );
}

function PublicationLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isApiError(error) && error.status === HttpStatus.FORBIDDEN) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Sem acesso a publicacao"
        description="Sua sessao nao tem permissao para consultar a publicacao ativa deste assistente."
      />
    );
  }

  return (
    <EmptyState
      icon={<AlertCircle className="h-6 w-6" />}
      title="Nao foi possivel carregar a publicacao ativa"
      description="Tente novamente em instantes."
      action={(
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      )}
    />
  );
}

function AssistantNotFound() {
  return (
    <EmptyState
      icon={<Bot className="h-6 w-6" />}
      title="Assistente nao encontrado"
      description="Verifique o identificador do assistente ou volte para a lista."
      action={(
        <Link to="/app/assistants">
          <Button variant="outline">Ver assistentes</Button>
        </Link>
      )}
    />
  );
}

function ChatLoadingState({ assistant }: { assistant?: Assistant }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <Skeleton className="h-10 w-10 rounded-lg" />

        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {assistant ? 'Carregando publicacao ativa...' : 'Carregando assistente...'}
        </div>

        <ListLoading rows={4} />
      </div>
    </div>
  );
}

function assistantMessageFromRun(run: AgentRun) {
  if (run.status === 'completed') {
    return extractAssistantText(run)
      ?? `Run concluido pelo backend Orchestra. Nao houve campo textual publico claro para exibir. runId=${run.id}${run.requestId ? ` requestId=${run.requestId}` : ''}`;
  }

  if (run.status === 'blocked') {
    const code = run.errorCode ?? firstPrecheckReason(run)?.code ?? 'POLICY_BLOCKED';
    const message = run.errorMessage ?? firstPrecheckReason(run)?.message ?? 'Execucao bloqueada por policy.';
    const reasons = (run.precheckSnapshot?.reasons ?? [])
      .slice(0, 4)
      .map((reason) => `- ${reason.code}: ${reason.message}`)
      .join('\n');

    return [
      'Execucao bloqueada por policy governada.',
      `Codigo: ${code}`,
      `Mensagem: ${message}`,
      reasons ? `Motivos:\n${reasons}` : undefined,
    ].filter(Boolean).join('\n');
  }

  if (run.status === 'failed') {
    return [
      'Nao foi possivel concluir a execucao.',
      run.errorCode ? `Codigo: ${run.errorCode}` : undefined,
      run.errorMessage ? `Mensagem: ${safeString(run.errorMessage, 220)}` : undefined,
      run.requestId ? `requestId=${run.requestId}` : undefined,
    ].filter(Boolean).join('\n');
  }

  if (run.status === 'cancelled') {
    return `Run cancelado pelo backend Orchestra. runId=${run.id}${run.requestId ? ` requestId=${run.requestId}` : ''}`;
  }

  return [
    `Run retornou status ${statusLabel(run.status)}.`,
    'A execucao ainda nao chegou a um estado final na resposta recebida.',
    `runId=${run.id}`,
    run.requestId ? `requestId=${run.requestId}` : undefined,
  ].filter(Boolean).join('\n');
}

function apiErrorMessage(error: unknown) {
  if (!isApiError(error)) return 'Nao foi possivel enviar a mensagem. Tente novamente.';

  const requestId = error.requestId ? ` requestId=${error.requestId}` : '';

  if (error.status === HttpStatus.FORBIDDEN) {
    return `Sem permissao para executar este assistente.${requestId}`;
  }

  if (error.status === HttpStatus.NOT_FOUND) {
    return `Assistente ou run nao encontrado.${requestId}`;
  }

  return `Nao foi possivel executar o assistente.${error.code ? ` codigo=${error.code}` : ''}${requestId}`;
}

function extractAssistantText(run: AgentRun) {
  const runRecord = run as unknown as Record<string, unknown>;
  const metadata = asRecord(run.metadata);
  const runtime = runtimeMetadata(run);
  const result = asRecord(runRecord.result);
  const output = asRecord(runRecord.output);
  const response = asRecord(runRecord.response);

  return firstSafeText(
    runtime?.outputPreview,
    runRecord.outputPreview,
    runRecord.outputText,
    runRecord.responseText,
    runRecord.answer,
    runRecord.content,
    runRecord.text,
    result?.outputPreview,
    result?.outputText,
    result?.response,
    result?.answer,
    output?.text,
    output?.content,
    response?.text,
    response?.content,
    metadata?.outputPreview,
  );
}

function technicalRows(run: AgentRun): TechnicalRow[] {
  const runtime = runtimeMetadata(run);
  const adapter = asRecord(runtime?.adapterMetadata);
  const usage = asRecord(runtime?.usage);

  return [
    row('runId', run.id),
    row('traceId', run.traceId),
    row('requestId', run.requestId),
    row('status', run.status),
    row('mode', run.mode),
    row('source', run.source),
    row('runtime provider', runtime?.provider),
    row('protocolVersion', runtime?.protocolVersion),
    row('specVersion', runtime?.specVersion),
    row('latencyMs', firstValue(runtime?.latencyMs, usage?.latencyMs, adapter?.llmLatencyMs)),
    row('externalProviderCalled', firstValue(runtime?.externalProviderCalled, adapter?.externalProviderCalled)),
    row('externalMcpCalled', runtime?.externalMcpCalled),
    row('toolCallsExecuted', runtime?.toolCallsExecuted),
    row('ragSourceCount', runtime?.ragSourceCount),
    row('ragContextChars', runtime?.ragContextChars),
  ].filter((item): item is TechnicalRow => Boolean(item));
}

function safeEventMetadataRows(event: AgentRunEvent): TechnicalRow[] {
  const metadata = asRecord(event.metadata);

  if (!metadata) return [];

  return [
    row('provider', metadata.provider),
    row('llmProvider', metadata.llmProvider),
    row('model', metadata.model),
    row('traceId', metadata.traceId),
    row('runtimeStatus', metadata.runtimeStatus),
    row('runtimeErrorCode', metadata.runtimeErrorCode),
    row('latencyMs', firstValue(metadata.latencyMs, metadata.llmLatencyMs)),
    row('inputTokens', metadata.inputTokens),
    row('outputTokens', metadata.outputTokens),
    row('totalTokens', metadata.totalTokens),
    row('externalProviderCalled', firstValue(metadata.externalProviderCalled, metadata.externalProvidersCalled)),
    row('externalMcpCalled', metadata.externalMcpCalled),
    row('toolCallsExecuted', metadata.toolCallsExecuted),
    row('ragSourceCount', metadata.ragSourceCount),
    row('reason', firstValue(metadata.reason, metadata.llmSelectionReason)),
    row('simulated', metadata.simulated),
    row('failClosed', firstValue(metadata.failClosed, metadata.policyFailClosed, metadata.failedClosed)),
  ].filter((item): item is TechnicalRow => Boolean(item)).slice(0, 10);
}

function row(label: string, value: unknown): TechnicalRow | undefined {
  const formatted = safeValue(value);

  if (formatted === undefined) return undefined;

  return { label, value: formatted };
}

function firstPrecheckReason(run: AgentRun) {
  return run.precheckSnapshot?.reasons?.[0];
}

function runtimeMetadata(run: AgentRun) {
  return asRecord(asRecord(run.metadata)?.runtime);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function firstValue(...values: unknown[]) {
  return values.find((value) => isPresent(value));
}

function firstSafeText(...values: unknown[]) {
  for (const value of values) {
    const text = safeString(value, 4000);

    if (text) return text;
  }

  return undefined;
}

function safeValue(value: unknown) {
  if (!isPresent(value)) return undefined;

  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  return safeString(value);
}

function safeString(value: unknown, maxLength = 160) {
  if (typeof value !== 'string') return undefined;

  const normalized = value.replace(/\s+/g, ' ').trim();

  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function isPresent(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

function canRetryRun(run: AgentRun) {
  return run.status === 'blocked' || run.status === 'failed';
}

function toneFromRun(run: AgentRun): ChatMessageTone {
  if (run.status === 'blocked') return 'blocked';
  if (run.status === 'failed' || run.status === 'cancelled') return 'error';
  if (run.status === 'queued' || run.status === 'prechecking' || run.status === 'running') return 'pending';
  return 'default';
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(status: AgentRunStatus) {
  const labels: Record<AgentRunStatus, string> = {
    queued: 'na fila',
    prechecking: 'em precheck',
    blocked: 'bloqueado',
    running: 'em execucao',
    completed: 'concluido',
    failed: 'falhou',
    cancelled: 'cancelado',
  };

  return labels[status] ?? status;
}
