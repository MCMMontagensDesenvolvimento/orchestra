import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  Braces,
  CheckCircle2,
  Clock3,
  Database,
  FilterX,
  Gauge,
  Search,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { AppShell } from '@/components/shared/AppShell';
import { KpiCard } from '@/components/shared/KpiCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { ListLoading, QueryState } from '@/components/shared/QueryState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { safeSummaryPreview } from '@/lib/display-safety';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useRuntimeRunDetail,
  useRuntimeRuns,
  useRuntimeSummary,
} from '@/hooks/queries/useAnalytics';
import type { AgentRunStatus } from '@/types';
import type {
  RuntimeRunDetail,
  RuntimeRunEventMetadata,
  RuntimeRunFilters,
} from '@/services/analytics.service';

type FilterState = {
  status: string;
  runtimeProvider: string;
  ragMode: string;
  responseScopeMode: string;
  fallbackOutsideKnowledgeUsed: string;
  externalProviderCalled: string;
  externalMcpCalled: string;
  usageLimitBlocked: string;
};

const initialFilters: FilterState = {
  status: 'all',
  runtimeProvider: 'all',
  ragMode: 'all',
  responseScopeMode: 'all',
  fallbackOutsideKnowledgeUsed: 'all',
  externalProviderCalled: 'all',
  externalMcpCalled: 'all',
  usageLimitBlocked: 'all',
};

const booleanFilter = (value: string) => value === 'all' ? undefined : value === 'true';

function formatDate(value: string | null) {
  if (!value) return 'Não informado';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(parsed)
    : 'Não informado';
}

function formatInteger(value: number | string | null) {
  if (value === null) return 'Não informado';
  try {
    return new Intl.NumberFormat('pt-BR').format(typeof value === 'string' ? BigInt(value) : value);
  } catch {
    return String(value);
  }
}

function formatLatency(value: number | null) {
  return value === null ? 'Não informado' : `${new Intl.NumberFormat('pt-BR').format(value)} ms`;
}

function formatPersistedCost(currency: string | null, minorUnits: string | null) {
  if (!currency || !minorUnits) return 'Não informado';
  return `${currency} ${formatInteger(minorUnits)} minor units`;
}

function compactId(value: string | null) {
  if (!value) return 'Não informado';
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function humanize(value: string | null) {
  if (!value) return 'Não informado';
  return value.replace(/_/g, ' ');
}

function statusLabel(value: AgentRunStatus) {
  const labels: Record<AgentRunStatus, string> = {
    queued: 'Na fila',
    prechecking: 'Pré-checagem',
    blocked: 'Bloqueado',
    running: 'Em execução',
    completed: 'Concluído',
    failed: 'Falhou',
    cancelled: 'Cancelado',
  };

  return labels[value];
}

function ragModeLabel(value: string | null) {
  if (!value) return 'Não informado';

  const labels: Record<string, string> = {
    none: 'Sem RAG',
    resolved_context: 'Contexto resolvido',
    gateway: 'Gateway RAG',
  };

  return labels[value] ?? humanize(value);
}

function responseScopeLabel(value: string | null) {
  if (!value) return 'Não informado';

  const labels: Record<string, string> = {
    knowledge_only: 'Somente base de conhecimento',
    knowledge_first: 'Priorizar base de conhecimento',
    general_allowed: 'Resposta geral permitida',
  };

  return labels[value] ?? humanize(value);
}

function FlagBadge({ value, trueLabel = 'Sim', falseLabel = 'Não' }: {
  value: boolean | null | undefined;
  trueLabel?: string;
  falseLabel?: string;
}) {
  if (value === null || value === undefined) return <Badge variant="outline">Não informado</Badge>;
  return value
    ? <Badge variant="default">{trueLabel}</Badge>
    : <Badge variant="secondary">{falseLabel}</Badge>;
}

function FilterSelect({ label, value, onValueChange, children }: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </label>
  );
}

export default function AnalyticsPage() {
  const [filterState, setFilterState] = useState<FilterState>(initialFilters);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const filters = useMemo<RuntimeRunFilters>(() => ({
    page,
    perPage: 20,
    status: filterState.status === 'all' ? undefined : filterState.status as AgentRunStatus,
    runtimeProvider: filterState.runtimeProvider === 'all' ? undefined : filterState.runtimeProvider,
    ragMode: filterState.ragMode === 'all' ? undefined : filterState.ragMode,
    responseScopeMode: filterState.responseScopeMode === 'all' ? undefined : filterState.responseScopeMode,
    fallbackOutsideKnowledgeUsed: booleanFilter(filterState.fallbackOutsideKnowledgeUsed),
    externalProviderCalled: booleanFilter(filterState.externalProviderCalled),
    externalMcpCalled: booleanFilter(filterState.externalMcpCalled),
    usageLimitBlocked: booleanFilter(filterState.usageLimitBlocked),
    search: search || undefined,
  }), [filterState, page, search]);

  const runsQuery = useRuntimeRuns(filters);
  const summaryQuery = useRuntimeSummary();
  const runs = runsQuery.data?.data ?? [];
  const pagination = runsQuery.data?.pagination;
  const summary = summaryQuery.data;
  const hasFilters = search !== '' || Object.values(filterState).some((value) => value !== 'all');

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilterState((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const applySearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const clearFilters = () => {
    setFilterState(initialFilters);
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Observabilidade operacional"
          description="Runtime Chat/RAG por run, com metadata allowlistada e escopo do workspace"
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            label="Runs totais"
            value={summaryQuery.isLoading ? '…' : summary?.totalRuns ?? 'Não informado'}
            icon={<Activity className="h-5 w-5" />}
          />
          <KpiCard
            label="Taxa de conclusão"
            value={summaryQuery.isLoading ? '…' : summary?.successRate === null || summary?.successRate === undefined ? 'Não informado' : `${summary.successRate}%`}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <KpiCard
            label="Latência média"
            value={summaryQuery.isLoading ? '…' : formatLatency(summary?.avgLatencyMs ?? null)}
            icon={<Gauge className="h-5 w-5" />}
          />
          <KpiCard
            label="Tokens persistidos"
            value={summaryQuery.isLoading ? '…' : formatInteger(summary?.totalTokens ?? null)}
            icon={<Braces className="h-5 w-5" />}
          />
          <KpiCard
            label="Bloqueados por limite"
            value={summaryQuery.isLoading ? '…' : summary?.usageLimitBlockedRuns ?? 'Não informado'}
            icon={<ShieldCheck className="h-5 w-5" />}
          />
          <KpiCard
            label="Violações monitor_only"
            value={summaryQuery.isLoading ? '…' : summary?.monitorOnlyViolations ?? 'Não informado'}
            icon={<AlertCircle className="h-5 w-5" />}
          />
        </div>

        {summaryQuery.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            <AlertCircle className="h-4 w-4" />
            O resumo não pôde ser carregado; a listagem de runs continua disponível.
          </div>
        )}

        <section className="rounded-lg border bg-card p-4 space-y-4" aria-label="Filtros de runs">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <form onSubmit={applySearch} className="flex flex-1 gap-2">
              <label className="flex-1 space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Buscar em resumo seguro</span>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Resumo tratado da entrada"
                    className="pl-9"
                    maxLength={160}
                  />
                </div>
              </label>
              <Button type="submit" variant="outline" className="mt-6">Buscar</Button>
            </form>
            {hasFilters && (
              <Button type="button" variant="ghost" onClick={clearFilters}>
                <FilterX className="mr-2 h-4 w-4" /> Limpar filtros
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <FilterSelect label="Status" value={filterState.status} onValueChange={(value) => updateFilter('status', value)}>
              <SelectItem value="all">Todos</SelectItem>
              {(['queued', 'prechecking', 'running', 'completed', 'failed', 'blocked', 'cancelled'] as AgentRunStatus[]).map((status) => (
                <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect label="Runtime provider" value={filterState.runtimeProvider} onValueChange={(value) => updateFilter('runtimeProvider', value)}>
              <SelectItem value="all">Todos</SelectItem>
              {['local', 'agno_stub', 'agno_http', 'agno'].map((provider) => (
                <SelectItem key={provider} value={provider}>{provider}</SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect label="Modo RAG" value={filterState.ragMode} onValueChange={(value) => updateFilter('ragMode', value)}>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="none">Sem RAG</SelectItem>
              <SelectItem value="resolved_context">Contexto resolvido</SelectItem>
              <SelectItem value="gateway">Gateway RAG</SelectItem>
            </FilterSelect>
            <FilterSelect label="Escopo da resposta" value={filterState.responseScopeMode} onValueChange={(value) => updateFilter('responseScopeMode', value)}>
              <SelectItem value="all">Todos</SelectItem>
              {['knowledge_only', 'knowledge_first', 'general_allowed'].map((mode) => (
                <SelectItem key={mode} value={mode}>{responseScopeLabel(mode)}</SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect label="Fallback externo" value={filterState.fallbackOutsideKnowledgeUsed} onValueChange={(value) => updateFilter('fallbackOutsideKnowledgeUsed', value)}>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Usado</SelectItem>
              <SelectItem value="false">Não usado</SelectItem>
            </FilterSelect>
            <FilterSelect label="Provider externo" value={filterState.externalProviderCalled} onValueChange={(value) => updateFilter('externalProviderCalled', value)}>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Chamado</SelectItem>
              <SelectItem value="false">Não chamado</SelectItem>
            </FilterSelect>
            <FilterSelect label="MCP externo" value={filterState.externalMcpCalled} onValueChange={(value) => updateFilter('externalMcpCalled', value)}>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Chamado</SelectItem>
              <SelectItem value="false">Não chamado</SelectItem>
            </FilterSelect>
            <FilterSelect label="Bloqueado por limite" value={filterState.usageLimitBlocked} onValueChange={(value) => updateFilter('usageLimitBlocked', value)}>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Não</SelectItem>
            </FilterSelect>
          </div>
        </section>

        <section className="rounded-lg border bg-card" aria-label="Runs recentes">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Runs recentes</h2>
              <p className="text-sm text-muted-foreground">
                {pagination ? `${pagination.total} run(s) no escopo atual` : 'Carregando contagem…'}
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-primary" aria-label="Dados allowlistados" />
          </div>

          <div className="p-4">
            <QueryState
              query={runsQuery}
              isEmpty={runs.length === 0}
              loading={<ListLoading rows={6} />}
              emptyIcon={<Database className="h-6 w-6" />}
              emptyTitle={hasFilters ? 'Nenhum run corresponde aos filtros' : 'Nenhum run registrado'}
              emptyDescription={hasFilters
                ? 'Ajuste ou limpe os filtros para ampliar a busca.'
                : 'Os runs do Runtime Chat/RAG aparecerão aqui quando forem persistidos.'}
              emptyAction={hasFilters ? <Button variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button> : undefined}
              errorTitle="Não foi possível carregar os runs"
              errorDescription="Confira sua permissão audit.read e tente novamente."
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run / resumo seguro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Runtime / LLM</TableHead>
                    <TableHead>RAG / escopo</TableHead>
                    <TableHead>Flags externas</TableHead>
                    <TableHead>Limite de uso</TableHead>
                    <TableHead className="text-right">Latência / tokens</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow
                      key={run.runId}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => setSelectedRunId(run.runId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') setSelectedRunId(run.runId);
                      }}
                    >
                      <TableCell className="max-w-[320px]">
                        <div className="font-mono text-xs text-muted-foreground">{compactId(run.runId)}</div>
                        <div className="mt-1 truncate font-medium" title={run.inputSummary ? 'Resumo tratado da entrada' : undefined}>
                          {safeSummaryPreview(run.inputSummary, 96)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{run.assistantName ?? `Assistente · ${compactId(run.assistantId)}`}</div>
                      </TableCell>
                      <TableCell><StatusBadge status={run.status} /></TableCell>
                      <TableCell>
                        <div className="font-medium">{run.runtimeProvider ?? 'Não informado'}</div>
                        <div className="text-xs text-muted-foreground">{run.llmProvider ?? 'Provider não informado'} · {run.model ?? 'Modelo não informado'}</div>
                      </TableCell>
                      <TableCell>
                        <div>{ragModeLabel(run.ragMode)} <span className="text-muted-foreground">({run.ragSourceCount ?? '—'} fontes)</span></div>
                        <div className="text-xs text-muted-foreground">{responseScopeLabel(run.responseScopeMode)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <FlagBadge value={run.externalProviderCalled} trueLabel="LLM externo" falseLabel="LLM local" />
                          <FlagBadge value={run.externalMcpCalled} trueLabel={run.simulated === false ? 'MCP demo real' : 'MCP controlado'} falseLabel="Sem MCP externo" />
                          {run.mcpRemoteBlocked === true && <Badge variant="destructive">MCP fail-closed</Badge>}
                          {run.fallbackOutsideKnowledgeUsed === true && <Badge variant="outline">Fallback</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{humanize(run.usageLimitMode)}</Badge>
                          <FlagBadge value={run.usageLimitBlocked} trueLabel="Bloqueado" falseLabel="Permitido" />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{humanize(run.usageLimitMetric)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>{formatLatency(run.latencyMs)}</div>
                        <div className="text-xs text-muted-foreground">{formatInteger(run.totalTokens)} tokens</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatDate(run.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </QueryState>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
              <span className="text-muted-foreground">Página {pagination.page} de {pagination.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1 || runsQuery.isFetching} onClick={() => setPage((current) => current - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages || runsQuery.isFetching} onClick={() => setPage((current) => current + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <RuntimeRunDrawer runId={selectedRunId} onOpenChange={(open) => !open && setSelectedRunId(null)} />
    </AppShell>
  );
}

function RuntimeRunDrawer({ runId, onOpenChange }: { runId: string | null; onOpenChange: (open: boolean) => void }) {
  const detailQuery = useRuntimeRunDetail(runId);
  return (
    <Sheet open={Boolean(runId)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Detalhe operacional do run</SheetTitle>
          <SheetDescription>Somente campos allowlistados; nenhum conteúdo bruto é retornado.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="mt-5 h-[calc(100vh-8rem)] pr-4">
          <QueryState
            query={detailQuery}
            loading={<ListLoading rows={7} />}
            errorTitle="Não foi possível carregar o detalhe"
            errorDescription="O run pode estar fora do workspace permitido ou indisponível."
          >
            {detailQuery.data && <RuntimeRunDetailContent run={detailQuery.data} />}
          </QueryState>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon}{title}</h3>
      {children}
    </section>
  );
}

function DataItem({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-words text-sm ${mono ? 'font-mono text-xs' : 'font-medium'}`}>{children}</dd>
    </div>
  );
}

function RuntimeRunDetailContent({ run }: { run: RuntimeRunDetail }) {
  return (
    <div className="space-y-4 pb-8">
      <Section title="Identificação" icon={<Waypoints className="h-4 w-4 text-primary" />}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DataItem label="Run" mono>{compactId(run.runId)}</DataItem>
          <DataItem label="status"><StatusBadge status={run.status} /></DataItem>
          <DataItem label="Trace" mono>{compactId(run.traceId)}</DataItem>
          <DataItem label="Requisição" mono>{compactId(run.requestId)}</DataItem>
          <DataItem label="Assistente">{run.assistantName ?? `Assistente · ${compactId(run.assistantId)}`}</DataItem>
          <DataItem label="Versão">{run.assistantVersion ?? 'Não informado'}</DataItem>
          <DataItem label="Resumo seguro da entrada">{safeSummaryPreview(run.inputSummary, 180)}</DataItem>
          <DataItem label="Criado em">{formatDate(run.createdAt)}</DataItem>
        </dl>
      </Section>

      <Section title="Runtime e provider" icon={<Activity className="h-4 w-4 text-primary" />}>
        <dl className="grid gap-4 sm:grid-cols-3">
          <DataItem label="Runtime provider">{run.runtimeProvider ?? 'Não informado'}</DataItem>
          <DataItem label="LLM provider">{run.llmProvider ?? 'Não informado'}</DataItem>
          <DataItem label="Modelo">{run.model ?? 'Não informado'}</DataItem>
          <DataItem label="Provider externo chamado"><FlagBadge value={run.externalProviderCalled} /></DataItem>
          <DataItem label="Latência">{formatLatency(run.latencyMs)}</DataItem>
          <DataItem label="Intervalo">{formatDate(run.startedAt)} → {formatDate(run.completedAt)}</DataItem>
        </dl>
      </Section>

      <Section title="Escopo da resposta e RAG" icon={<Database className="h-4 w-4 text-primary" />}>
        <dl className="grid gap-4 sm:grid-cols-3">
          <DataItem label="Escopo da resposta">{responseScopeLabel(run.responseScopeMode)}</DataItem>
          <DataItem label="Modo RAG">{ragModeLabel(run.ragMode)}</DataItem>
          <DataItem label="Fontes RAG">{run.ragSourceCount ?? 'Não informado'}</DataItem>
          <DataItem label="Intenção RAG detectada"><FlagBadge value={run.ragIntentDetected} /></DataItem>
          <DataItem label="Motivo para não usar RAG">{humanize(run.ragSkippedReason)}</DataItem>
          <DataItem label="Fallback fora da base"><FlagBadge value={run.fallbackOutsideKnowledgeUsed} /></DataItem>
          <DataItem label="Conteúdo bruto registrado"><FlagBadge value={run.rawContentLogged} /></DataItem>
          <DataItem label="Consulta RAG" mono>{compactId(run.ragQueryId)}</DataItem>
        </dl>
      </Section>

      <Section title="Tools e uso" icon={<Gauge className="h-4 w-4 text-primary" />}>
        <p className="mb-4 text-xs text-muted-foreground">`simulated=false` com `externalMcpCalled=true` identifica a integração HTTP real do demo homologado. Bloqueios permanecem fail-closed e não registram argumentos nem respostas brutas.</p>
        <dl className="grid gap-4 sm:grid-cols-3">
          <DataItem label="MCP externo chamado"><FlagBadge value={run.externalMcpCalled} /></DataItem>
          <DataItem label="Avaliação MCP remoto aplicada"><FlagBadge value={run.mcpRemoteEvaluationApplied} /></DataItem>
          <DataItem label="MCP remoto permitido"><FlagBadge value={run.mcpRemoteAllowed} /></DataItem>
          <DataItem label="MCP remoto bloqueado"><FlagBadge value={run.mcpRemoteBlocked} /></DataItem>
          <DataItem label="MCP remoto somente leitura"><FlagBadge value={run.mcpRemoteReadOnly} /></DataItem>
          <DataItem label="Motivo do bloqueio MCP">{humanize(run.mcpRemoteBlockedReason)}</DataItem>
          <DataItem label="Host MCP remoto" mono>{run.mcpRemoteHost ?? 'Não informado'}</DataItem>
          <DataItem label="Ferramenta MCP" mono>{compactId(run.mcpRemoteToolId)}</DataItem>
          <DataItem label="Risco MCP">{humanize(run.mcpRemoteRiskLevel)}</DataItem>
          <DataItem label="Tamanho da resposta">{run.responseBytes ?? 'Não informado'}</DataItem>
          <DataItem label="Execução simulada"><FlagBadge value={run.simulated} /></DataItem>
          <DataItem label="Chamadas de ferramenta">{run.toolCallsExecuted ?? 'Não informado'}</DataItem>
          <DataItem label="Tokens de entrada">{formatInteger(run.inputTokens)}</DataItem>
          <DataItem label="Tokens de saída">{formatInteger(run.outputTokens)}</DataItem>
          <DataItem label="Tokens totais">{formatInteger(run.totalTokens)}</DataItem>
          <DataItem label="Custo estimado persistido">
            {formatPersistedCost(run.costCurrency, run.costMinorUnits)}
          </DataItem>
        </dl>
      </Section>

      <Section title="Avaliação de custos, quotas e limites" icon={<ShieldCheck className="h-4 w-4 text-primary" />}>
        <dl className="grid gap-4 sm:grid-cols-3">
          <DataItem label="Avaliação de limite aplicada"><FlagBadge value={run.usageLimitEvaluationApplied} /></DataItem>
          <DataItem label="Modo de limite">{humanize(run.usageLimitMode)}</DataItem>
          <DataItem label="Limite excedido"><FlagBadge value={run.usageLimitExceeded} /></DataItem>
          <DataItem label="Limite aplicado"><FlagBadge value={run.usageLimitEnforced} /></DataItem>
          <DataItem label="Bloqueado por limite"><FlagBadge value={run.usageLimitBlocked} /></DataItem>
          <DataItem label="Motivo do limite">{humanize(run.usageLimitReason)}</DataItem>
          <DataItem label="Métrica do limite">{humanize(run.usageLimitMetric)}</DataItem>
          <DataItem label="Escopo do limite">{humanize(run.usageLimitScope)}</DataItem>
          <DataItem label="Janela do limite">{humanize(run.usageLimitWindow)}</DataItem>
          <DataItem label="Uso atual">{formatInteger(run.usageLimitCurrentValue)}</DataItem>
          <DataItem label="Limite configurado">{formatInteger(run.usageLimitThreshold)}</DataItem>
          <DataItem label="Política de limite" mono>{compactId(run.usageLimitPolicyId)}</DataItem>
          <DataItem label="Moeda">{run.costCurrency ?? 'Não informado'}</DataItem>
          <DataItem label="Custo em unidades mínimas">{run.costCurrency && run.costMinorUnits ? formatInteger(run.costMinorUnits) : 'Não informado'}</DataItem>
        </dl>
      </Section>

      <Section title={`Fontes RAG (${run.ragSources.length})`} icon={<Database className="h-4 w-4 text-primary" />}>
        {run.ragSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma fonte RAG persistida para este run.</p>
        ) : (
          <div className="space-y-3">
            {run.ragSources.map((source) => (
              <article key={`${source.ragQueryId}-${source.rank}`} className="rounded-md bg-muted/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">#{source.rank}</Badge>
                  <span className="font-medium">{source.documentTitle ?? 'Documento não informado'}</span>
                  <span className="text-xs text-muted-foreground">{source.sourceLabel ?? 'Fonte não informada'}</span>
                </div>
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                  <span>match: {source.matchType ?? 'não informado'}</span>
                  <span>score: {source.score ?? 'não informado'}</span>
                </div>
                {source.excerpt && <p className="mt-2 text-sm leading-relaxed">{source.excerpt}</p>}
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Eventos principais (${run.events.length})`} icon={<Clock3 className="h-4 w-4 text-primary" />}>
        {run.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento operacional persistido.</p>
        ) : (
          <ol className="space-y-3">
            {run.events.map((event) => (
              <li key={event.id} className="border-l-2 border-primary/30 pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">#{event.sequence}</span>
                  <span className="text-sm font-medium">{event.type ?? 'Evento não informado'}</span>
                  {event.status && <StatusBadge status={event.status} />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
                <EventMetadata metadata={event.metadata} />
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function EventMetadata({ metadata }: { metadata: RuntimeRunEventMetadata }) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return null;
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 rounded bg-muted/50 p-2 text-xs sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex min-w-0 justify-between gap-2">
          <dt className="truncate text-muted-foreground">{key}</dt>
          <dd className="truncate font-medium">{typeof value === 'boolean' ? (value ? 'sim' : 'não') : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
