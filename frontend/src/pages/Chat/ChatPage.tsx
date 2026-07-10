import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  Bot,
  Loader2,
  MessageSquare,
  Plus,
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
} from '@/hooks/queries/useAgentRuns';
import {
  useArchiveChatConversationMutation,
  useChatConversation,
  useChatConversations,
  useCreateChatConversationMutation,
  useSendChatMessageMutation,
} from '@/hooks/queries/useChatConversations';
import {
  useAssistant,
  useAssistantActivePublication,
  useAssistants,
} from '@/hooks/queries/useAssistants';
import { isApiError } from '@/services/api/api-error';
import { HttpStatus } from '@/services/api/http-status';
import {
  formatLlmLatency,
  getAgentRunConversationContextSummary,
  getAgentRunEventConversationContextSummary,
  getAgentRunEventLlmSummary,
  getAgentRunLlmSummary,
  hasAgentRunConversationContextSummary,
  hasAgentRunLlmSummary,
  llmProviderLabel,
  llmSelectionReasonLabel,
  type AgentRunConversationContextSummary,
  type AgentRunEventLlmSummary,
  type AgentRunLlmSummary,
} from '@/lib/agent-run-llm-metadata';
import type {
  AgentRun,
  AgentRunEvent,
  Assistant,
  AssistantPublication,
  ChatConversation,
  ChatMessage,
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
const safeChatEventMessageTypes = new Set([
  'run.requested',
  'run.precheck_started',
  'run.precheck_passed',
  'runtime.provider_selected',
  'runtime.model_started',
  'runtime.model_completed',
  'runtime.run_completed',
  'run.completed',
]);

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
  const [searchParams, setSearchParams] = useSearchParams();
  const assistantQuery = useAssistant(assistantId);
  const activePublicationQuery = useAssistantActivePublication(assistantId);
  const conversationsQuery = useChatConversations(assistantId);
  const selectedConversationId = searchParams.get('conversationId') ?? undefined;
  const conversationQuery = useChatConversation(selectedConversationId);
  const createConversationMutation = useCreateChatConversationMutation();
  const sendMessageMutation = useSendChatMessageMutation();
  const archiveConversationMutation = useArchiveChatConversationMutation();

  const [inputValue, setInputValue] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);

  const conversations = conversationsQuery.data ?? [];
  const selectedConversation = conversationQuery.data;
  const selectedConversationArchived = Boolean(selectedConversation?.archivedAt);
  const messages = useMemo(
    () => toLocalMessages(selectedConversation?.messages ?? []),
    [selectedConversation?.messages],
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

    if (!input || !selectedConversationId || selectedConversationArchived || sendMessageMutation.isPending) return;
    if (!options?.retry) setInputValue('');
    setSendError(null);

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversationId,
        input,
      });
    } catch (error) {
      setSendError(apiErrorMessage(error));
    }
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendInput(inputValue);
  };

  const selectConversation = (conversationId: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (conversationId) {
      next.set('conversationId', conversationId);
    } else {
      next.delete('conversationId');
    }
    setSearchParams(next, { replace: true });
    setSendError(null);
  };

  const createConversation = async () => {
    const conversation = await createConversationMutation.mutateAsync({ assistantId });
    selectConversation(conversation.id);
  };

  const archiveSelectedConversation = async () => {
    if (!selectedConversationId) return;
    await archiveConversationMutation.mutateAsync(selectedConversationId);
    selectConversation(null);
  };

  return (
    <AppShell>
      <div className="grid min-h-[34rem] gap-4 lg:h-[calc(100dvh-7.5rem)] lg:grid-cols-[20rem_minmax(0,1fr)]">
        <ConversationsPanel
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          isError={conversationsQuery.isError}
          isFetching={conversationsQuery.isFetching}
          isLoading={conversationsQuery.isLoading}
          isCreating={createConversationMutation.isPending}
          isArchiving={archiveConversationMutation.isPending}
          onRefresh={() => conversationsQuery.refetch()}
          onNew={() => { void createConversation(); }}
          onSelect={selectConversation}
          onArchiveSelected={() => { void archiveSelectedConversation(); }}
        />

        <div className="flex min-h-[34rem] flex-col overflow-hidden rounded-lg border bg-card animate-fade-in">
          <ChatHeader assistant={assistant} activePublication={activePublication} />

          <ScrollArea className="flex-1 bg-background/50">
            <div className="p-3 sm:p-5">
              {!selectedConversationId ? (
                <NoConversationSelected
                  assistant={assistant}
                  isCreating={createConversationMutation.isPending}
                  onNew={() => { void createConversation(); }}
                />
              ) : conversationQuery.isLoading ? (
                <ListLoading rows={4} />
              ) : conversationQuery.isError ? (
                <ConversationLoadError onRetry={() => conversationQuery.refetch()} />
              ) : messages.length === 0 ? (
                <ChatEmptyState assistant={assistant} />
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <ChatMessageBubble
                      key={message.id}
                      message={message}
                      isSending={sendMessageMutation.isPending}
                      onRetry={(retryInput) => { void sendInput(retryInput, { retry: true }); }}
                    />
                  ))}
                </div>
              )}

              {sendMessageMutation.isPending && (
                <div className="mt-4 flex justify-start">
                  <div className="max-w-[85%] rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Enviando para o backend Orchestra e aguardando o AgentRun...
                  </div>
                </div>
              )}

              {sendError && (
                <div className="mt-4 flex justify-start">
                  <div className="max-w-[85%] rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm">
                    {sendError}
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
                disabled={!selectedConversationId || selectedConversationArchived || sendMessageMutation.isPending}
              />

              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 shrink-0"
                disabled={!selectedConversationId || selectedConversationArchived || !inputValue.trim() || sendMessageMutation.isPending}
                aria-label="Enviar mensagem"
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
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
      <h2 className="mt-4 text-lg font-semibold">Conversa pronta</h2>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Envie uma mensagem para conversar com {assistant.name}.
      </p>
    </div>
  );
}

function NoConversationSelected({
  assistant,
  isCreating,
  onNew,
}: {
  assistant: Assistant;
  isCreating: boolean;
  onNew: () => void;
}) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <MessageSquare className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Inicie uma conversa</h2>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Crie uma conversa privada com {assistant.name} ou abra uma conversa existente no painel lateral.
      </p>
      <Button type="button" className="mt-4 gap-2" onClick={onNew} disabled={isCreating}>
        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Nova conversa
      </Button>
    </div>
  );
}

function ConversationLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-center px-4 py-12 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold">Nao foi possivel abrir a conversa</h2>
      <Button type="button" variant="outline" className="mt-4 gap-2" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </Button>
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
  const runtimeRows = runRuntimeRows(run);
  const contextSummary = getAgentRunConversationContextSummary(run);
  const contextRows = conversationContextRows(contextSummary);
  const llmSummary = getAgentRunLlmSummary(run);
  const llmRows = llmProviderRows(llmSummary);

  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">Detalhes tecnicos</summary>

      <div className="mt-2 space-y-3">
        <RunObservationSection title="Runtime" rows={runtimeRows} />
        {hasAgentRunConversationContextSummary(contextSummary) && (
          <RunObservationSection title="Contexto conversacional" rows={contextRows} />
        )}
        {hasAgentRunLlmSummary(llmSummary) && (
          <RunObservationSection title="Provider LLM" rows={llmRows} />
        )}
      </div>

      <RunEventsPanel run={run} />
    </details>
  );
}

function RunObservationSection({ title, rows }: { title: string; rows: TechnicalRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section>
      <p className="mb-1 font-medium text-foreground/80">{title}</p>
      <dl className="grid gap-1">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="font-medium text-foreground/70">{row.label}</dt>
            <dd className="break-all font-mono">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
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
  const safeMessage = safeChatEventMessage(event);

  return (
    <div className="rounded-md border bg-background/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">#{event.sequence}</Badge>
        <span className="font-mono text-[11px] text-foreground">{event.type}</span>
        {event.status && <StatusBadge status={event.status} />}
      </div>

      {safeMessage && (
        <p className="mt-1 text-foreground/80">{safeMessage}</p>
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

function safeChatEventMessage(event: AgentRunEvent) {
  if (!safeChatEventMessageTypes.has(event.type)) return undefined;
  return safeString(event.message, 180);
}

function ConversationsPanel({
  conversations,
  selectedConversationId,
  isError,
  isFetching,
  isLoading,
  isCreating,
  isArchiving,
  onRefresh,
  onNew,
  onSelect,
  onArchiveSelected,
}: {
  conversations: ChatConversation[];
  selectedConversationId?: string;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  isCreating: boolean;
  isArchiving: boolean;
  onRefresh: () => unknown;
  onNew: () => void;
  onSelect: (conversationId: string | null) => void;
  onArchiveSelected: () => void;
}) {
  return (
    <aside className="flex min-h-[22rem] flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Conversas</h2>
        </div>

        <div className="flex items-center gap-1">
          {selectedConversationId && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onArchiveSelected}
              disabled={isArchiving}
              aria-label="Arquivar conversa"
            >
              {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => { void onRefresh(); }}
            disabled={isFetching}
            aria-label="Recarregar conversas"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="border-b p-3">
        <Button type="button" variant="outline" className="w-full gap-2" onClick={onNew} disabled={isCreating}>
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Nova conversa
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {isLoading && <ListLoading rows={4} />}

          {isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Nao foi possivel carregar as conversas.
            </div>
          )}

          {!isLoading && !isError && conversations.length === 0 && (
            <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
              Nenhuma conversa ativa.
            </div>
          )}

          {!isLoading && !isError && conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={`w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/40 ${
                conversation.id === selectedConversationId
                  ? 'border-primary/50 bg-primary/5'
                  : 'bg-background'
              }`}
              onClick={() => onSelect(conversation.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="min-w-0 truncate text-sm font-medium">{conversation.title}</h3>
                <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(conversation.updatedAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline">{conversation.visibility}</Badge>
                <span>{conversation.messageCount} mensagens</span>
              </div>
              {conversation.lastMessage && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {conversation.lastMessage}
                </p>
              )}
            </button>
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

function toLocalMessages(messages: ChatMessage[]): LocalChatMessage[] {
  return messages.map((message, index) => {
    const run = message.agentRun ?? undefined;
    const previousUserMessage = messages
      .slice(0, index)
      .reverse()
      .find((item) => item.role === 'user');

    return {
      id: message.id,
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.content,
      createdAt: message.createdAt,
      retryInput: message.role !== 'user' && run && canRetryRun(run)
        ? previousUserMessage?.content
        : undefined,
      tone: run ? toneFromRun(run) : undefined,
      run,
    };
  });
}

function apiErrorMessage(error: unknown) {
  if (!isApiError(error)) return 'Nao foi possivel enviar a mensagem. Tente novamente.';

  const requestId = error.requestId ? ` requestId=${error.requestId}` : '';

  if (error.status === HttpStatus.FORBIDDEN) {
    return `Sem permissao para executar este assistente.${requestId}`;
  }

  if (error.status === HttpStatus.NOT_FOUND) {
    return `Conversa ou assistente nao encontrado.${requestId}`;
  }

  return `Nao foi possivel enviar a mensagem.${error.code ? ` codigo=${error.code}` : ''}${requestId}`;
}

function runRuntimeRows(run: AgentRun): TechnicalRow[] {
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
    row('inputHash', runtime?.inputHash),
    row('outputHash', runtime?.outputHash),
    row('errorCode', firstValue(run.errorCode, runtime?.errorCode)),
    row('latencyMs', firstValue(runtime?.latencyMs, usage?.latencyMs, adapter?.llmLatencyMs)),
    row('externalProviderCalled', firstValue(runtime?.externalProviderCalled, adapter?.externalProviderCalled)),
    row('externalMcpCalled', runtime?.externalMcpCalled),
    row('toolCallsExecuted', runtime?.toolCallsExecuted),
    row('ragSourceCount', runtime?.ragSourceCount),
    row('ragContextChars', runtime?.ragContextChars),
  ].filter((item): item is TechnicalRow => Boolean(item));
}

function conversationContextRows(summary: AgentRunConversationContextSummary): TechnicalRow[] {
  return [
    row('contexto anexado', summary.included),
    row('mensagens', summary.messageCount),
    row('caracteres', summary.totalChars),
    row('truncado', summary.truncated),
    row('limite mensagens', summary.maxMessages),
    row('limite msg chars', summary.maxMessageChars),
    row('limite total', summary.maxTotalChars),
  ].filter((item): item is TechnicalRow => Boolean(item));
}

function llmProviderRows(summary: AgentRunLlmSummary | AgentRunEventLlmSummary): TechnicalRow[] {
  return [
    row('llmProvider', summary.provider ? llmProviderLabel(summary.provider) : undefined),
    row('model', summary.model),
    row('externalProviderCalled', summary.externalProviderCalled),
    row('latencyMs', formatLlmLatency(summary.latencyMs) ?? summary.latencyMs),
    row('providerStatus', summary.providerStatus),
    row('reason', llmSelectionReasonLabel(summary.selectionReason) ?? summary.selectionReason),
    row('simulado', summary.simulated),
    row('failClosed', summary.failedClosed),
  ].filter((item): item is TechnicalRow => Boolean(item));
}

function safeEventMetadataRows(event: AgentRunEvent): TechnicalRow[] {
  const metadata = asRecord(event.metadata);

  if (!metadata) return [];

  const llmSummary = getAgentRunEventLlmSummary(event);
  const contextSummary = getAgentRunEventConversationContextSummary(event);

  return [
    row('provider', metadata.provider),
    row('llmProvider', llmSummary.provider ? llmProviderLabel(llmSummary.provider) : undefined),
    row('model', llmSummary.model),
    row('traceId', metadata.traceId),
    row('runtimeStatus', metadata.runtimeStatus),
    row('runtimeErrorCode', metadata.runtimeErrorCode),
    row('latencyMs', formatLlmLatency(llmSummary.latencyMs) ?? llmSummary.latencyMs),
    row('inputTokens', llmSummary.inputTokens),
    row('outputTokens', llmSummary.outputTokens),
    row('totalTokens', llmSummary.totalTokens),
    row('externalProviderCalled', llmSummary.externalProviderCalled),
    row('externalMcpCalled', metadata.externalMcpCalled),
    row('toolCallsExecuted', metadata.toolCallsExecuted),
    row('ragSourceCount', metadata.ragSourceCount),
    row('reason', llmSelectionReasonLabel(llmSummary.selectionReason) ?? llmSummary.selectionReason),
    row('simulated', llmSummary.simulated),
    row('failClosed', llmSummary.failedClosed),
    ...conversationContextRows(contextSummary),
  ].filter((item): item is TechnicalRow => Boolean(item)).slice(0, 14);
}

function row(label: string, value: unknown): TechnicalRow | undefined {
  const formatted = safeValue(value);

  if (formatted === undefined) return undefined;

  return { label, value: formatted };
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
