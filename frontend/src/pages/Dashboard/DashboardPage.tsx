import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard,
  ArrowRight,
  ClipboardList,
  Coins,
  HardHat,
  MessageSquare,
  MessageSquareText,
  Search,
} from 'lucide-react';
import { AppShell } from '@/components/shared/AppShell';
import { OrchestraPageBanner } from '@/components/shared/OrchestraPageBanner';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { Button } from '@/components/ui/button';
import { useAssistants } from '@/hooks/queries/useAssistants';
import { useCurrentSession } from '@/hooks/queries/useAuth';
import { useRecentHomeConversations } from '@/hooks/queries/useRecentHomeConversations';
import type { Assistant } from '@/types';

function searchable(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function AssistantIcon({ assistant }: { assistant: Assistant }) {
  const context = searchable(`${assistant.area} ${assistant.name}`);
  const Icon = /sst|seguranca|epis?\b|saude/.test(context)
    ? HardHat
    : /projeto|planejamento/.test(context)
      ? ClipboardList
      : /custo|financeir|orcamento|rateio/.test(context)
        ? Coins
        : MessageSquareText;
  return <Icon className="h-6 w-6" aria-hidden="true" />;
}

function formatConversationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const calendarDate = (day: Date) => `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  if (calendarDate(date) === calendarDate(now)) return `Hoje, ${time}`;
  if (calendarDate(date) === calendarDate(yesterday)) return `Ontem, ${time}`;
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
  return `${day}, ${time}`;
}

export default function DashboardPage() {
  const assistantsQuery = useAssistants();
  const sessionQuery = useCurrentSession();
  const [search, setSearch] = useState('');
  const session = sessionQuery.data;
  const firstName = session?.user.name.trim().split(/\s+/)[0] || null;
  const permissions = session?.permissions ?? [];
  const canViewCatalog = permissions.includes('assistants.read');
  const canStartChat = canViewCatalog && permissions.includes('agent_runs.create');
  const canViewChat = canViewCatalog && (canStartChat || permissions.includes('agent_runs.read'));
  const workspaceIds = session?.workspaces.map((workspace) => workspace.id) ?? [];
  const allowedWorkspaces = new Set(workspaceIds);

  const publishedAssistants = (assistantsQuery.data ?? []).filter((assistant) =>
    assistant.status === 'published'
    && assistant.activePublication?.status === 'active'
    && (!assistant.workspaceId || allowedWorkspaces.has(assistant.workspaceId)),
  );
  const availableAssistants = canStartChat
    ? publishedAssistants.filter((assistant) => assistant.executionPolicy?.isExecutionEnabled !== false)
    : [];
  const query = searchable(search.trim());
  const visibleAssistants = availableAssistants.filter((assistant) =>
    searchable(`${assistant.name} ${assistant.description}`).includes(query),
  );
  const recent = useRecentHomeConversations(
    canViewChat ? publishedAssistants : [],
    session?.user.id,
    workspaceIds,
    canViewChat && !assistantsQuery.isError,
  );

  return (
    <AppShell>
      <div className="orchestra-front-page w-full space-y-7 animate-fade-in pb-4">
        <OrchestraPageBanner>
          <div className="orchestra-banner-heading">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LayoutDashboard className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {firstName ? `Olá, ${firstName}!` : 'Olá!'}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  Como a inteligência artificial pode ajudar você hoje?
                </p>
              </div>
            </div>
          </div>
          <label className="orchestra-banner-toolbar orchestra-search-field flex w-full max-w-[85%] items-center gap-3 rounded-xl border border-input bg-white px-4 py-3 shadow-sm max-lg:max-w-full">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Buscar assistentes na Home</span>
              <input
                type="search"
                aria-label="Buscar assistentes na Home"
                placeholder="Buscar um assistente..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
        </OrchestraPageBanner>

        <section aria-labelledby="home-assistants-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-start gap-3">
              <MessageSquareText className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 id="home-assistants-heading" className="text-xl font-semibold tracking-tight">Assistentes disponíveis</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Escolha um assistente para começar.</p>
              </div>
            </div>
            {canViewCatalog && (
              <Link to="/app/assistants" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Ver todos os assistentes <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>

          <QueryState
            query={assistantsQuery}
            loading={<ListLoading rows={3} />}
            errorTitle="Não foi possível carregar os assistentes"
            errorDescription="Verifique sua conexão e tente novamente."
          >
            {availableAssistants.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center" role="status">
                <h3 className="font-semibold">Nenhum assistente disponível no momento</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Os assistentes publicados e autorizados aparecerão aqui quando estiverem disponíveis para conversar.
                </p>
              </div>
            ) : visibleAssistants.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center" role="status">
                <h3 className="font-semibold">Nenhum assistente encontrado para essa busca</h3>
                <p className="mt-1 text-sm text-muted-foreground">Experimente outro nome ou descrição.</p>
                <Button className="mt-4" variant="outline" size="sm" onClick={() => setSearch('')}>Limpar busca</Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleAssistants.map((assistant) => (
                  <article key={assistant.id} className="flex min-h-[164px] flex-col rounded-2xl border bg-card p-4 shadow-sm transition-all hover:border-primary/25 hover:shadow-md">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/5 to-primary/15 text-primary">
                        <AssistantIcon assistant={assistant} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 text-sm font-semibold leading-snug" title={assistant.name}>{assistant.name}</h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {assistant.description || 'Sem descrição cadastrada.'}
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/app/chat/${assistant.id}`}
                      className="mt-auto flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary/[0.075] px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.13] focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Iniciar conversa <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </QueryState>
        </section>

        <section aria-labelledby="home-conversations-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 id="home-conversations-heading" className="text-xl font-semibold tracking-tight">Suas conversas</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Continue de onde parou.</p>
              </div>
            </div>
            {canViewChat && (
              <Link to="/app/chat" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Ir para minhas conversas <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>

          {!canViewChat ? (
            <div className="rounded-2xl border bg-card px-5 py-6 text-sm text-muted-foreground" role="status">
              O histórico de conversas não está disponível para este perfil.
            </div>
          ) : recent.isLoading ? (
            <ListLoading rows={3} />
          ) : recent.isError && recent.items.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-5 py-6" role="status">
              <p className="text-sm text-muted-foreground">Não foi possível carregar suas conversas recentes.</p>
              <Button variant="outline" size="sm" onClick={recent.refresh}>Tentar novamente</Button>
            </div>
          ) : recent.items.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-5 py-6" role="status">
              <p className="text-sm text-muted-foreground">Nenhuma conversa recente para exibir.</p>
              <Link to="/app/chat" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Escolher um assistente <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              {recent.items.map((item) => (
                <Link
                  key={item.id}
                  to={`/app/chat/${item.assistantId}?conversationId=${encodeURIComponent(item.id)}`}
                  className="group flex min-w-0 items-center gap-3 border-b border-border/70 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/50 sm:gap-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white text-muted-foreground">
                    <MessageSquare className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="orchestra-history-title truncate text-sm font-semibold text-foreground">{item.title || 'Conversa sem título'}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.assistantName}</p>
                  </div>
                  <time dateTime={item.updatedAt} className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {formatConversationDate(item.updatedAt)}
                  </time>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/[0.075] text-primary transition-colors group-hover:bg-primary/[0.14]">
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          )}
          {recent.isPartialError && (
            <p role="status" className="text-xs text-muted-foreground">
              Algumas conversas não puderam ser consultadas agora.
              <button type="button" className="ml-1 font-semibold text-primary hover:underline" onClick={recent.refresh}>
                Tentar novamente
              </button>
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
