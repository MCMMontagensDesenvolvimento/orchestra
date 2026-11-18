import { compactTechnicalId } from '@/lib/display-safety';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Search,
  Archive,
  ArrowLeftRight,
  Check,
  Copy,
  Info,
  UserRound,
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
import { OrchestraPageBanner } from '@/components/shared/OrchestraPageBanner';
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
import { useCurrentSession } from '@/hooks/queries/useAuth';
import { useRecentHomeConversations } from '@/hooks/queries/useRecentHomeConversations';
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

type ChatCatalogView = 'todos' | 'recentes' | 'assistentes';

function normalizeChatSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function formatChatRecentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  const now = new Date();
  const calendarDay = (day: Date) => `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  if (calendarDay(date) === calendarDay(now)) return `Hoje, ${time}`;
  if (calendarDay(date) === calendarDay(yesterday)) return `Ontem, ${time}`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function ChatAssistantCatalog() {
  const assistantsQuery = useAssistants();
  const sessionQuery = useCurrentSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const requestedView = searchParams.get('visao');
  const view: ChatCatalogView = requestedView === 'recentes' || requestedView === 'assistentes' ? requestedView : 'todos';

  const session = sessionQuery.data;
  const permissions = session?.permissions ?? [];
  const canReadAssistants = permissions.includes('assistants.read');
  const canStartChat = canReadAssistants && permissions.includes('agent_runs.create');
  const canReadChat = canReadAssistants && (canStartChat || permissions.includes('agent_runs.read'));
  const workspaceIds = session?.workspaces.map((workspace) => workspace.id) ?? [];
  const workspaceSet = new Set(workspaceIds);
  const availableAssistants = (canReadAssistants ? (assistantsQuery.data ?? []) : []).filter((assistant) =>
    assistant.status === 'published'
    && assistant.activePublication?.status === 'active'
    && assistant.executionPolicy?.isExecutionEnabled !== false
    && (!assistant.workspaceId || workspaceSet.has(assistant.workspaceId)),
  );
  const recent = useRecentHomeConversations(
    canReadChat ? availableAssistants : [],
    session?.user.id,
    workspaceIds,
    canReadChat && !assistantsQuery.isError,
    50,
  );
  const needle = normalizeChatSearch(search.trim());
  const filteredAssistants = availableAssistants.filter((assistant) =>
    normalizeChatSearch(`${assistant.name} ${assistant.description} ${assistant.area}`).includes(needle),
  );
  const filteredConversations = recent.items.filter((conversation) =>
    normalizeChatSearch(`${conversation.title} ${conversation.assistantName}`).includes(needle),
  );
  const showAssistants = view !== 'recentes';
  const showRecent = view !== 'assistentes';
  const displayedConversations = view === 'todos' ? filteredConversations.slice(0, 3) : filteredConversations;

  const setView = (next: ChatCatalogView) => {
    const updated = new URLSearchParams(searchParams);
    if (next === 'todos') updated.delete('visao');
    else updated.set('visao', next);
    setSearchParams(updated);
  };

  return (
    <AppShell>
      <div className="orchestra-front-page space-y-5 animate-fade-in pb-5">
        <OrchestraPageBanner labelledBy="chat-catalog-title">
          <div className="orchestra-banner-heading">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageSquare className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 id="chat-catalog-title" className="text-2xl font-bold tracking-tight">Minhas conversas</h1>
                <p className="mt-1 text-sm text-muted-foreground">Escolha um assistente e comece uma nova conversa.</p>
              </div>
            </div>
          </div>
          <label className="orchestra-banner-toolbar orchestra-search-field flex min-h-10 w-full max-w-4xl items-center gap-2 rounded-lg border bg-white px-3 shadow-sm">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Buscar assistentes ou conversas</span>
              <input type="search" aria-label="Buscar assistentes ou conversas" value={search}
                onChange={(event) => setSearch(event.target.value)} placeholder="Buscar assistentes ou conversas..."
                className="w-full min-w-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
            </label>
        </OrchestraPageBanner>

        <nav aria-label="Filtrar conversas e assistentes" className="flex flex-wrap items-center gap-2">
          {([
            { key: 'todos', label: 'Todos' },
            { key: 'recentes', label: 'Recentes' },
            { key: 'assistentes', label: 'Assistentes publicados' },
          ] as const).map((item) => (
            <button key={item.key} type="button" aria-pressed={view === item.key}
              onClick={() => setView(item.key)}
              className={`inline-flex min-h-9 items-center rounded-full border px-4 text-xs font-semibold transition-colors ${view === item.key ? 'border-primary/15 bg-primary/10 text-primary' : 'bg-white text-foreground hover:border-primary/30'}`}>
              {item.label}
            </button>
          ))}
        </nav>

        <QueryState query={sessionQuery} loading={<ListLoading rows={3} />}
          errorTitle="Não foi possível consultar sua sessão" errorDescription="Atualize a página e tente novamente.">
          <QueryState query={assistantsQuery} loading={<ListLoading rows={3} />}
            errorTitle="Não foi possível carregar os assistentes" errorDescription="Tente novamente em instantes.">
            {showAssistants && (
              <section aria-label="Assistentes disponíveis" className="space-y-3">
                {filteredAssistants.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-white p-6 text-sm text-muted-foreground" role="status">
                    {availableAssistants.length === 0 ? 'Nenhum assistente disponível para conversar no momento.' : 'Nenhum assistente encontrado para essa busca.'}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredAssistants.map((assistant) => (
                      <article key={assistant.id} className="flex min-h-[190px] flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/25 hover:shadow-md">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Bot className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2 className="line-clamp-2 text-sm font-semibold leading-snug" title={assistant.name}>{assistant.name}</h2>
                          </div>
                        </div>
                        <p className="mt-2 line-clamp-3 min-h-10 text-xs leading-relaxed text-muted-foreground">
                          {assistant.description || 'Sem descrição cadastrada.'}
                        </p>
                        <div className="mt-auto flex flex-wrap items-center gap-2 py-2">
                          <StatusBadge status={assistant.status} />
                          {assistant.model && <Badge variant="secondary" className="max-w-[10rem] truncate text-[10px]">{assistant.model}</Badge>}
                        </div>
                        {canStartChat ? (
                          <Link to={chatRoute(assistant.id)} className="flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary/[0.09] px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.16]">
                            Iniciar conversa <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        ) : (
                          <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">Sem permissão para iniciar conversas</p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {showRecent && canReadChat && (
              <section aria-labelledby="chat-recent-heading" className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <h2 id="chat-recent-heading" className="text-lg font-semibold tracking-tight">Conversas recentes</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">Continue de onde parou.</p>
                    </div>
                  </div>
                  {view === 'todos' && (
                    <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline" onClick={() => setView('recentes')}>
                      Ver mais conversas <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                {recent.isPartialError && (
                  <p role="alert" className="text-xs text-destructive">Parte do histórico não pôde ser consultada. Os registros exibidos podem estar incompletos.</p>
                )}
                {recent.isError ? (
                  <div role="alert" className="rounded-xl border bg-white px-4 py-5 text-sm text-destructive">Não foi possível carregar as conversas recentes.</div>
                ) : recent.isLoading ? (
                  <ListLoading rows={3} />
                ) : displayedConversations.length === 0 ? (
                  <div role="status" className="rounded-xl border border-dashed bg-white px-4 py-6 text-sm text-muted-foreground">
                    {needle ? 'Nenhuma conversa encontrada para essa busca.' : 'Você ainda não possui conversas recentes para exibir.'}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                    {displayedConversations.map((conversation) => (
                      <Link key={conversation.id} to={`${chatRoute(conversation.assistantId)}?conversationId=${encodeURIComponent(conversation.id)}`}
                        className="flex min-w-0 items-center gap-3 border-b px-3 py-2.5 transition-colors hover:bg-muted/50 last:border-b-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-white text-muted-foreground">
                          <MessageSquare className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="orchestra-history-title truncate text-xs font-semibold text-foreground">{conversation.title || 'Conversa sem título'}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{conversation.assistantName}</p>
                        </div>
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{formatChatRecentDate(conversation.updatedAt)}</span>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}
            {!canReadChat && !canStartChat && (
              <div role="status" className="rounded-xl border border-dashed bg-white px-4 py-6 text-sm text-muted-foreground">
                Sua sessão não possui permissão para acessar conversas.
              </div>
            )}
          </QueryState>
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
      <div className="grid min-h-[34rem] gap-3 lg:h-[calc(100dvh-7.5rem)] lg:grid-cols-[17rem_minmax(0,1fr)]">
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

        <div className="flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm animate-fade-in">
          <ChatHeader assistant={assistant} activePublication={activePublication} />

          <ScrollArea className="min-h-0 flex-1 bg-white">
            <div className="p-3 pb-8 sm:p-5 sm:pb-8">
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
                <div className="space-y-5">
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

          <form onSubmit={submitMessage} className="border-t bg-white px-3 py-2.5">
            <div className="flex items-end gap-2">
              <Textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key !== 'Enter'
                    || event.shiftKey
                    || event.ctrlKey
                    || event.altKey
                    || event.metaKey
                    || event.repeat
                    || event.nativeEvent.isComposing
                    || event.keyCode === 229
                  ) return;

                  event.preventDefault();
                  void sendInput(inputValue);
                }}
                placeholder="Mensagem para o assistente"
                aria-label="Mensagem"
                aria-describedby="chat-composer-help"
                className="max-h-36 min-h-[42px] resize-none bg-background"
                disabled={!selectedConversationId || selectedConversationArchived || sendMessageMutation.isPending}
              />

              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 shrink-0"
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
            <p id="chat-composer-help" className="mt-1.5 text-[11px] text-muted-foreground">
              Enter para enviar · Shift+Enter para nova linha
            </p>
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
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold sm:text-base">{assistant.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <StatusBadge status={assistant.status} />
            <Badge variant={activePublication ? 'secondary' : 'outline'} className="text-[10px]">
              {activePublication ? 'Publicacao ativa' : 'Sem publicacao ativa'}
            </Badge>
            <span className="truncate">{assistant.model}</span>
            <span>v{assistant.version}</span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <details className="relative group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Detalhes
          </summary>
          <div className="absolute right-0 top-full z-20 mt-2 w-64 max-w-[85vw] rounded-xl border bg-white p-3 text-xs shadow-lg">
            <p className="mb-2 font-semibold">Informações do assistente</p>
            <dl className="space-y-1.5 text-muted-foreground">
              <div className="flex justify-between gap-3"><dt>Status</dt><dd className="text-right text-foreground">{assistant.status === 'published' ? 'Publicado' : assistant.status}</dd></div>
              <div className="flex justify-between gap-3"><dt>Publicação</dt><dd className="text-right text-foreground">{activePublication ? 'Ativa' : 'Indisponível'}</dd></div>
              <div className="flex justify-between gap-3"><dt>Modelo</dt><dd className="truncate text-right text-foreground" title={assistant.model}>{assistant.model}</dd></div>
              <div className="flex justify-between gap-3"><dt>Versão</dt><dd className="text-right text-foreground">v{assistant.version}</dd></div>
            </dl>
          </div>
        </details>
        <Link to="/app/chat" className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted">
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
          Trocar assistente
        </Link>
      </div>
    </header>
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
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const toneClass = message.tone === 'error'
    ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : message.tone === 'blocked'
      ? 'border-yellow-500/30 bg-yellow-500/10 text-foreground'
      : message.tone === 'pending'
        ? 'border-blue-500/30 bg-blue-500/10 text-foreground'
        : isUser
          ? 'border-[#FFDFD0] bg-[#FFF0E9] text-foreground'
          : 'border-[#E9EBEF] bg-[#F7F8FA] text-foreground';

  const copyResponse = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText(message.content);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <div data-testid={`chat-message-${message.role}`} className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 max-w-[88%] sm:max-w-[78%]">
        <p className={`mb-1.5 px-1 text-[11px] text-muted-foreground ${isUser ? 'text-right' : 'text-left'}`}>
          {formatChatRecentDate(message.createdAt)}
        </p>
        <div className={`rounded-xl border px-3.5 py-3 text-sm leading-relaxed shadow-sm ${toneClass}`}>
          {message.isRetry && <p className="mb-2 text-[11px] font-medium opacity-80">Reenvio manual</p>}
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
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
        {!isUser && message.content && (
          <div className="mt-1.5 flex items-center gap-1 px-1">
            <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Copiar resposta" onClick={() => { void copyResponse(); }}>
              {copyState === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copyState === 'copied' ? 'Copiado' : copyState === 'error' ? 'Cópia indisponível' : 'Copiar'}
            </button>
          </div>
        )}
      </div>
      {isUser && (
        <div className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
          <UserRound className="h-4 w-4" />
        </div>
      )}
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

function conversationDayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  const now = new Date();
  const calendarDay = (day: Date) => `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
  if (calendarDay(date) === calendarDay(now)) return 'Hoje';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (calendarDay(date) === calendarDay(yesterday)) return 'Ontem';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function conversationClock(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--:--'
    : new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
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
  const [search, setSearch] = useState('');
  const groups = useMemo(() => {
    const needle = normalizeChatSearch(search.trim());
    const filtered = [...conversations]
      .filter((conversation) => !conversation.archivedAt)
      .filter((conversation) => normalizeChatSearch(`${conversation.title ?? ''} ${conversation.lastMessage ?? ''}`).includes(needle))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const result: { label: string; items: ChatConversation[] }[] = [];
    for (const conversation of filtered) {
      const label = conversationDayLabel(conversation.updatedAt);
      let group = result.find((item) => item.label === label);
      if (!group) {
        group = { label, items: [] };
        result.push(group);
      }
      group.items.push(conversation);
    }
    return result;
  }, [conversations, search]);

  return (
    <aside aria-label="Histórico de conversas" className="flex min-h-[22rem] min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Conversas</h2>
        </div>
        <div className="flex items-center gap-0.5">
          {selectedConversationId && (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onArchiveSelected}
              disabled={isArchiving} aria-label="Arquivar conversa" title="Arquivar conversa selecionada">
              {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => { void onRefresh(); }} disabled={isFetching} aria-label="Recarregar conversas">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <div className="space-y-2 border-b p-2.5">
        <Button type="button" className="h-9 w-full gap-2" onClick={onNew} disabled={isCreating}>
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Nova conversa
        </Button>
        <label className="orchestra-search-field flex h-9 items-center gap-2 rounded-lg border bg-white px-2.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Buscar conversas</span>
          <input type="search" aria-label="Buscar conversas" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar conversas..." className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
        </label>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="pb-3">
          {isLoading && <div className="p-3"><ListLoading rows={4} /></div>}
          {isError && <p role="alert" className="m-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">Não foi possível carregar as conversas.</p>}
          {!isLoading && !isError && groups.length === 0 && (
            <p role="status" className="m-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              {search ? 'Nenhuma conversa encontrada para essa busca.' : 'Nenhuma conversa ativa.'}
            </p>
          )}
          {!isLoading && !isError && groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h3 className="border-b bg-muted/25 px-3 py-2 text-[11px] font-semibold text-muted-foreground">{group.label}</h3>
              <div className="divide-y">
                {group.items.map((conversation) => (
                  <button key={conversation.id} type="button" aria-current={conversation.id === selectedConversationId ? 'true' : undefined}
                    onClick={() => onSelect(conversation.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-primary/[0.06] ${conversation.id === selectedConversationId ? 'bg-primary/[0.10] text-primary' : 'text-foreground'}`}>
                    <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold" title={conversation.title ?? ''}>{conversation.title || 'Conversa sem título'}</span>
                      <span className="mt-0.5 block text-[11px] opacity-75">{conversationClock(conversation.updatedAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
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
  if (!isApiError(error)) return 'Não foi possível enviar a mensagem. Tente novamente.';

  const requestReference = error.requestId
    ? ` Referência: ${compactTechnicalId(error.requestId)}.`
    : '';

  if (error.status === HttpStatus.FORBIDDEN) {
    return `Sem permissão para executar este assistente.${requestReference}`;
  }

  if (error.status === HttpStatus.NOT_FOUND) {
    return `Conversa ou assistente não encontrado.${requestReference}`;
  }

  const errorCode = error.code ? ` Código: ${error.code}.` : '';

  return `Não foi possível enviar a mensagem.${errorCode}${requestReference}`;
}

function runRuntimeRows(run: AgentRun): TechnicalRow[] {
  const runtime = runtimeMetadata(run);
  const adapter = asRecord(runtime?.adapterMetadata);
  const usage = asRecord(runtime?.usage);

  return [
    row('runId', compactTechnicalId(run.id)),
    row('traceId', run.traceId ? compactTechnicalId(run.traceId) : undefined),
    row('requestId', run.requestId ? compactTechnicalId(run.requestId) : undefined),
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
    row('requestSent', runtime?.requestSent),
    row('failClosed', runtime?.failedClosed),
    row('externalProviderCalled', firstValue(runtime?.externalProviderCalled, adapter?.externalProviderCalled)),
    row('externalMcpCalled', runtime?.externalMcpCalled),
    row('toolDescriptorCount', runtime?.toolDescriptorCount),
    row('maxToolCalls', runtime?.maxToolCalls),
    row('toolCallsExecuted', runtime?.toolCallsExecuted),
    row('approvalRequiredCount', runtime?.approvalRequiredCount),
    row('ragMode', runtime?.ragMode),
    row('ragSourceCount', runtime?.ragSourceCount),
    row('ragContextChars', runtime?.ragContextChars),
    row('maxRagResults', runtime?.maxRagResults),
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
    row(
      'traceId',
      typeof metadata.traceId === 'string'
        ? compactTechnicalId(metadata.traceId)
        : metadata.traceId,
    ),
    row('runtimeStatus', metadata.runtimeStatus),
    row('runtimeErrorCode', metadata.runtimeErrorCode),
    row('latencyMs', formatLlmLatency(llmSummary.latencyMs) ?? llmSummary.latencyMs),
    row('inputTokens', llmSummary.inputTokens),
    row('outputTokens', llmSummary.outputTokens),
    row('totalTokens', llmSummary.totalTokens),
    row('externalProviderCalled', llmSummary.externalProviderCalled),
    row('externalMcpCalled', metadata.externalMcpCalled),
    row('toolDescriptorCount', metadata.toolDescriptorCount),
    row('maxToolCalls', metadata.maxToolCalls),
    row('toolCallsExecuted', metadata.toolCallsExecuted),
    row('approvalRequiredCount', metadata.approvalRequiredCount),
    row('ragMode', metadata.ragMode),
    row('ragSourceCount', metadata.ragSourceCount),
    row('ragContextChars', metadata.ragContextChars),
    row('maxRagResults', metadata.maxRagResults),
    row('reason', llmSelectionReasonLabel(llmSummary.selectionReason) ?? llmSummary.selectionReason),
    row('simulated', llmSummary.simulated),
    row('failClosed', llmSummary.failedClosed),
    ...conversationContextRows(contextSummary),
  ].filter((item): item is TechnicalRow => Boolean(item)).slice(0, 18);
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
