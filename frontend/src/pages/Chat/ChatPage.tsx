import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Bot,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { AppShell } from '@/components/shared/AppShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ListLoading, QueryState } from '@/components/shared/QueryState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCreateAgentRunMutation } from '@/hooks/queries/useAgentRuns';
import {
  useAssistant,
  useAssistantActivePublication,
  useAssistants,
} from '@/hooks/queries/useAssistants';
import { isApiError } from '@/services/api/api-error';
import { HttpStatus } from '@/services/api/http-status';
import type { AgentRun, AgentRunStatus, Assistant } from '@/types';

type ChatMessageTone = 'default' | 'blocked' | 'error';

interface LocalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  tone?: ChatMessageTone;
  run?: AgentRun;
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
            Selecione um assistente publicado.
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
  const createRunMutation = useCreateAgentRunMutation();

  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);

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

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const input = inputValue.trim();

    if (!input || createRunMutation.isPending) return;

    const userMessage: LocalChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    setInputValue('');

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
          id: `assistant-${run.id}`,
          role: 'assistant',
          content: assistantMessageFromRun(run),
          createdAt: new Date().toISOString(),
          tone: run.status === 'blocked' ? 'blocked' : run.status === 'failed' ? 'error' : 'default',
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
          tone: 'error',
        },
      ]);
    }
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-7.5rem)] min-h-[34rem] flex-col overflow-hidden rounded-lg border bg-card animate-fade-in">
        <ChatHeader assistant={assistant} />

        <div className="flex-1 overflow-auto bg-background/50 p-3 sm:p-5">
          {messages.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title="Conversa pronta"
              description="Envie uma mensagem para executar o assistente publicado."
            />
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} />
              ))}
            </div>
          )}

          {createRunMutation.isPending && (
            <div className="mt-4 flex justify-start">
              <div className="max-w-[85%] rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Executando run...
              </div>
            </div>
          )}
        </div>

        <form onSubmit={sendMessage} className="border-t bg-card p-3">
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
    </AppShell>
  );
}

function ChatHeader({ assistant }: { assistant: Assistant }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{assistant.name}</h1>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={assistant.status} />
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

function ChatMessageBubble({ message }: { message: LocalChatMessage }) {
  const isUser = message.role === 'user';

  const toneClass = message.tone === 'error'
    ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : message.tone === 'blocked'
      ? 'border-yellow-500/30 bg-yellow-500/10 text-foreground'
      : isUser
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-card';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg border px-4 py-3 shadow-sm sm:max-w-[75%] ${toneClass}`}>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </div>

        {message.run && <RunDetails run={message.run} />}
      </div>
    </div>
  );
}

function RunDetails({ run }: { run: AgentRun }) {
  const runtime = runtimeMetadata(run);
  const runtimeProvider = safeString(runtime?.provider);

  const rows = [
    ['status', run.status],
    ['runId', run.id],
    ['traceId', run.traceId],
    ['requestId', run.requestId],
    ['runtime', runtimeProvider],
  ].filter(([, value]) => Boolean(value));

  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">Detalhes tecnicos</summary>

      <dl className="mt-2 grid gap-1">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="font-medium text-foreground/70">{label}</dt>
            <dd className="break-all font-mono">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
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
        <Skeleton className="h-9 w-9 rounded-lg" />

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

    return `Execucao bloqueada (${code}). ${message}`;
  }

  if (run.status === 'failed') {
    const requestId = run.requestId ? ` requestId=${run.requestId}` : '';

    return `Nao foi possivel concluir a execucao.${run.errorCode ? ` codigo=${run.errorCode}` : ''}${requestId}`;
  }

  return `Run retornou status ${statusLabel(run.status)}. runId=${run.id}`;
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
  const runtime = runtimeMetadata(run);
  const result = asRecord(runRecord.result);
  const output = asRecord(runRecord.output);

  return firstSafeText(
    runRecord.outputText,
    runRecord.outputPreview,
    runRecord.responseText,
    runRecord.response,
    runRecord.answer,
    runRecord.content,
    result?.outputText,
    result?.outputPreview,
    result?.response,
    output?.text,
    output?.content,
    runtime?.outputPreview,
  );
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

function firstSafeText(...values: unknown[]) {
  for (const value of values) {
    const text = safeString(value, 4000);

    if (text) return text;
  }

  return undefined;
}

function safeString(value: unknown, maxLength = 160) {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();

  return normalized ? normalized.slice(0, maxLength) : undefined;
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
