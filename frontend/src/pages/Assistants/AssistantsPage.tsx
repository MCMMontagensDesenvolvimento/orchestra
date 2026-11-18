import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/shared/AppShell';
import { OrchestraPageBanner } from '@/components/shared/OrchestraPageBanner';
import { env } from '@/lib/env';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  useArchiveAssistantMutation,
  useAssistants,
  usePublishAssistantMutation,
  useRestoreAssistantMutation,
  useUnpublishAssistantMutation,
} from '@/hooks/queries/useAssistants';
import { useCurrentSession } from '@/hooks/queries/useAuth';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import {
  Plus, Bot, MessageSquare, DollarSign, ThumbsUp,
  LayoutGrid, List, Search, SlidersHorizontal, ArrowUpDown,
  MoreHorizontal, Edit, Copy, Play, Archive, Send, Eye, RotateCcw, Undo2,
  ChevronDown, X, ShieldCheck, BookOpen, Layers3, Laptop
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { AssistantStatus } from '@/types';

type ViewMode = 'cards' | 'table';
type SortField = 'name' | 'conversations' | 'costThisMonth' | 'satisfaction' | 'updatedAt';
type SortDir = 'asc' | 'desc';

// `owners` é derivado dos assistentes (mock/API) dentro do componente.
const statusFilters: { label: string; value: AssistantStatus | 'all' }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Publicados', value: 'published' },
  { label: 'Rascunhos', value: 'draft' },
  { label: 'Em teste', value: 'testing' },
  { label: 'Aguardando aprovação', value: 'pending_approval' },
  { label: 'Arquivados', value: 'archived' },
];

function CatalogAssistantIcon({ assistant }: { assistant: { name: string; area: string } }) {
  const context = `${assistant.name} ${assistant.area}`.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const Icon = /isolamento|seguranca|sst|compliance/.test(context) ? ShieldCheck
    : /rag|conhecimento|document/.test(context) ? BookOpen
      : /homolog|e2e|teste/.test(context) ? Layers3
        : /corporate|readonly|mcp|integrac/.test(context) ? Laptop : Bot;
  return <Icon className="h-5 w-5" aria-hidden="true" />;
}

export default function AssistantsPage() {
  const assistantsQuery = useAssistants();
  const { data: session } = useCurrentSession();
  const publishMutation = usePublishAssistantMutation();
  const unpublishMutation = useUnpublishAssistantMutation();
  const archiveMutation = useArchiveAssistantMutation();
  const restoreMutation = useRestoreAssistantMutation();
  const mockAssistants = useMemo(() => assistantsQuery.data ?? [], [assistantsQuery.data]);
  const owners = ['Todos', ...Array.from(new Set(mockAssistants.map(a => a.owner).filter(Boolean)))];
  const areas = ['Todos', ...Array.from(new Set(mockAssistants.map(a => a.area).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [statusFilter, setStatusFilter] = useState<AssistantStatus | 'all'>('all');
  const [areaFilter, setAreaFilter] = useState('Todos');
  const [ownerFilter, setOwnerFilter] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showFilters, setShowFilters] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let result = [...mockAssistants];
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    if (areaFilter !== 'Todos') result = result.filter(a => a.area === areaFilter);
    if (ownerFilter !== 'Todos') result = result.filter(a => a.owner === ownerFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.area.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'updatedAt') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      else cmp = (a[sortField] as number) - (b[sortField] as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [mockAssistants, statusFilter, areaFilter, ownerFilter, searchQuery, sortField, sortDir]);

  const advancedFilterCount = [areaFilter !== 'Todos', ownerFilter !== 'Todos', !(['all', 'published', 'draft'] as string[]).includes(statusFilter)].filter(Boolean).length;
  const statusTabs: { label: string; value: AssistantStatus | 'all'; count: number }[] = [
    { label: 'Todos', value: 'all', count: mockAssistants.length },
    { label: 'Publicados', value: 'published', count: mockAssistants.filter(a => a.status === 'published').length },
    { label: 'Rascunhos', value: 'draft', count: mockAssistants.filter(a => a.status === 'draft').length },
  ];

  const hasPermission = (permission: string) => session?.permissions.includes(permission) ?? false;

  const handleAction = (action: string, name: string) => {
    toast.success(`${action}: ${name}`);
  };

  const handleAssistantAction = async (
    action: 'publish' | 'unpublish' | 'archive' | 'restore',
    assistant: { id: string; name: string },
  ) => {
    try {
      if (action === 'publish') await publishMutation.mutateAsync(assistant.id);
      if (action === 'unpublish') await unpublishMutation.mutateAsync(assistant.id);
      if (action === 'archive') await archiveMutation.mutateAsync(assistant.id);
      if (action === 'restore') await restoreMutation.mutateAsync(assistant.id);
      const labels = {
        publish: 'Publicado',
        unpublish: 'Despublicado',
        archive: 'Arquivado',
        restore: 'Restaurado',
      };
      toast.success(`${labels[action]}: ${assistant.name}`);
    } catch (error) {
      toast.error('Nao foi possivel executar a acao', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  return (
    <AppShell>
      <div className="orchestra-front-page space-y-4 animate-fade-in pb-5">
        <OrchestraPageBanner labelledBy="catalog-heading">
          <div className="orchestra-banner-heading flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bot className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h1 id="catalog-heading" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Assistentes</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">Gerencie e acompanhe os assistentes de IA da MCM.</p>
              </div>
            </div>
            <Button asChild className="shrink-0 shadow-sm">
              <Link to="/app/assistants/new"><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />Criar Assistente</Link>
            </Button>
          </div>
          <div className="orchestra-banner-toolbar flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-1">
              <label className="orchestra-search-field flex min-h-10 w-full min-w-0 max-w-xl flex-1 items-center gap-2 rounded-lg border bg-white px-3 shadow-sm sm:w-auto">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Buscar assistentes</span>
                <input
                  type="search"
                  aria-label="Buscar assistentes"
                  placeholder="Buscar por nome, descrição ou área..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full min-w-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} aria-label="Limpar busca" className="rounded p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={showFilters}
                onClick={() => setShowFilters(!showFilters)}
                className="h-10 bg-white"
              >
                <SlidersHorizontal className="mr-1.5 h-4 w-4" aria-hidden="true" />Filtros
                {advancedFilterCount > 0 && <span className="ml-1 rounded bg-primary/10 px-1.5 text-xs text-primary">{advancedFilterCount}</span>}
              </Button>
            </div>
            <div className="inline-flex h-10 items-center gap-0.5 rounded-lg border bg-white p-1" role="group" aria-label="Modo de visualização">
              <button type="button" aria-label="Visualizar cards" aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}
                className={`rounded-md p-2 transition-colors ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Visualizar tabela" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}
                className={`rounded-md p-2 transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <List className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </OrchestraPageBanner>

        <div className="flex min-w-0 gap-3 overflow-x-auto border-b border-border/80" role="group" aria-label="Filtrar por status">
          {statusTabs.map(tab => (
            <button
              type="button"
              key={tab.value}
              aria-pressed={statusFilter === tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm font-medium transition-colors ${statusFilter === tab.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
              <span className={`rounded-md px-1.5 py-0.5 text-xs ${statusFilter === tab.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {showFilters && (
          <div id="catalog-advanced-filters" className="space-y-4 rounded-xl border bg-white p-4 shadow-sm animate-fade-in">
            <div className="flex flex-wrap gap-5">
              <div className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outros estados</span>
                <div className="flex flex-wrap gap-1.5">
                  {statusFilters.map(option => (
                    <button type="button" key={option.value} onClick={() => setStatusFilter(option.value)}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${statusFilter === option.value ? 'bg-primary/10 font-semibold text-primary' : 'bg-muted/70 text-muted-foreground hover:text-foreground'}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Área</span>
                <div className="flex flex-wrap gap-1.5">
                  {areas.map(area => (
                    <button type="button" key={area} onClick={() => setAreaFilter(area)}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${areaFilter === area ? 'bg-primary/10 font-semibold text-primary' : 'bg-muted/70 text-muted-foreground hover:text-foreground'}`}>
                      {area}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsável</span>
                <div className="flex flex-wrap gap-1.5">
                  {owners.map(owner => (
                    <button type="button" key={owner} onClick={() => setOwnerFilter(owner)}
                      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${ownerFilter === owner ? 'bg-primary/10 font-semibold text-primary' : 'bg-muted/70 text-muted-foreground hover:text-foreground'}`}>
                      {owner}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
              <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
              <span className="font-semibold">Ordenar por:</span>
              {([
                ['updatedAt', 'Atualização'],
                ['name', 'Nome'],
                ['conversations', 'Conversas'],
                ['costThisMonth', 'Custo'],
                ['satisfaction', 'Satisfação'],
              ] as [SortField, string][]).filter(([field]) => env.useMocks || ['updatedAt', 'name'].includes(field)).map(([field, label]) => (
                <button type="button" key={field} onClick={() => toggleSort(field)}
                  className={`rounded-md px-2 py-1 transition-colors ${sortField === field ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'}`}>
                  {label} {sortField === field && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              ))}
              {(statusFilter !== 'all' || areaFilter !== 'Todos' || ownerFilter !== 'Todos') && (
                <button type="button" onClick={() => { setStatusFilter('all'); setAreaFilter('Todos'); setOwnerFilter('Todos'); }}
                  className="ml-auto font-semibold text-primary hover:underline">
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        )}

        <QueryState
          query={assistantsQuery}
          isEmpty={mockAssistants.length === 0}
          loading={<ListLoading rows={6} />}
          emptyIcon={<Bot className="h-6 w-6" />}
          emptyTitle="Nenhum assistente cadastrado"
          emptyDescription="Crie seu primeiro assistente para começar a orquestrar conhecimento, ferramentas e conversas."
          emptyAction={
            <Link to="/app/assistants/new">
              <Button><Plus className="h-4 w-4 mr-1" />Criar assistente</Button>
            </Link>
          }
          errorTitle="Não foi possível carregar os assistentes"
          errorDescription="Houve um problema ao buscar a lista. Tente novamente em instantes."
        >
        {/* Cards do catálogo: proporção e hierarquia próximas ao mockup Maria */}
        {viewMode === 'cards' && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(a => (
              <article key={a.id} className="group flex min-h-[173px] flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/25 hover:shadow-md">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CatalogAssistantIcon assistant={a} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/app/assistants/${a.id}`} title={a.name} className="orchestra-card-title block truncate text-sm font-semibold text-foreground transition-colors hover:text-primary">
                      {a.name}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.area ? `${a.area} · ` : ''}{a.owner}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge status={a.status} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-1 hover:bg-muted transition-colors text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/app/assistants/${a.id}`}><Eye className="h-3.5 w-3.5 mr-2" />Ver detalhes</Link>
                        </DropdownMenuItem>
                        {hasPermission('assistants.update') && (
                          <DropdownMenuItem asChild>
                            <Link to={`/app/assistants/${a.id}/edit`}><Edit className="h-3.5 w-3.5 mr-2" />Editar</Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleAction('Duplicado', a.name)}>
                          <Copy className="h-3.5 w-3.5 mr-2" />Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/app/chat/${a.id}`}><Play className="h-3.5 w-3.5 mr-2" />Testar</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {a.status !== 'published' && a.status !== 'archived' && hasPermission('assistants.publish') && (
                          <DropdownMenuItem onClick={() => { void handleAssistantAction('publish', a); }}>
                            <Send className="h-3.5 w-3.5 mr-2" />Publicar
                          </DropdownMenuItem>
                        )}
                        {a.status === 'published' && hasPermission('assistants.unpublish') && (
                          <DropdownMenuItem onClick={() => { void handleAssistantAction('unpublish', a); }}>
                            <Undo2 className="h-3.5 w-3.5 mr-2" />Despublicar
                          </DropdownMenuItem>
                        )}
                        {a.status !== 'archived' && hasPermission('assistants.archive') && (
                          <DropdownMenuItem onClick={() => { void handleAssistantAction('archive', a); }}>
                            <Archive className="h-3.5 w-3.5 mr-2" />Arquivar
                          </DropdownMenuItem>
                        )}
                        {a.status === 'archived' && hasPermission('assistants.restore') && (
                          <DropdownMenuItem onClick={() => { void handleAssistantAction('restore', a); }}>
                            <RotateCcw className="h-3.5 w-3.5 mr-2" />Restaurar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
                  {a.description || 'Descrição não informada.'}
                </p>
                <div className="mt-auto border-t border-border/70 pt-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />{env.useMocks ? `${a.conversations.toLocaleString()} conversas` : '— conversas'}</span>
                      <span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" aria-hidden="true" />{env.useMocks ? `R$ ${a.costThisMonth.toFixed(0)}` : '— custo'}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">v{a.version}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="max-w-[11rem] truncate rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground" title={a.model}>
                      {a.model === 'not-configured' ? 'Modelo não configurado' : a.model}
                    </span>
                    {a.environment && (
                      <span className={`rounded-md px-2 py-0.5 text-[10px] ${a.environment === 'production' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        {a.environment}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Table view */}
        {viewMode === 'table' && (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <button className="flex items-center gap-1" onClick={() => toggleSort('name')}>
                        Assistente {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Área</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Owner</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Modelo</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort('conversations')}>
                        Conversas {sortField === 'conversations' && (sortDir === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort('costThisMonth')}>
                        Custo {sortField === 'costThisMonth' && (sortDir === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort('satisfaction')}>
                        Satisf. {sortField === 'satisfaction' && (sortDir === 'asc' ? '↑' : '↓')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Versão</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/app/assistants/${a.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{a.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{a.description}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                      <td className="px-4 py-3 text-xs">{a.area}</td>
                      <td className="px-4 py-3 text-xs">{a.owner}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{a.model}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{env.useMocks ? a.conversations.toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-right">{env.useMocks ? `R$ ${a.costThisMonth.toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {env.useMocks && a.satisfaction > 0 ? (
                          <span className="flex items-center justify-end gap-1"><ThumbsUp className="h-3 w-3 text-success" />{a.satisfaction}%</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">v{a.version}</td>
                      <td className="px-4 py-3 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="rounded p-1.5 hover:bg-muted transition-colors text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/app/assistants/${a.id}`}><Eye className="h-3.5 w-3.5 mr-2" />Ver detalhes</Link>
                            </DropdownMenuItem>
                            {hasPermission('assistants.update') && (
                              <DropdownMenuItem asChild>
                                <Link to={`/app/assistants/${a.id}/edit`}><Edit className="h-3.5 w-3.5 mr-2" />Editar</Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleAction('Duplicado', a.name)}>
                              <Copy className="h-3.5 w-3.5 mr-2" />Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/app/chat/${a.id}`}><Play className="h-3.5 w-3.5 mr-2" />Testar</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {a.status !== 'published' && a.status !== 'archived' && hasPermission('assistants.publish') && (
                              <DropdownMenuItem onClick={() => { void handleAssistantAction('publish', a); }}>
                                <Send className="h-3.5 w-3.5 mr-2" />Publicar
                              </DropdownMenuItem>
                            )}
                            {a.status === 'published' && hasPermission('assistants.unpublish') && (
                              <DropdownMenuItem onClick={() => { void handleAssistantAction('unpublish', a); }}>
                                <Undo2 className="h-3.5 w-3.5 mr-2" />Despublicar
                              </DropdownMenuItem>
                            )}
                            {a.status !== 'archived' && hasPermission('assistants.archive') && (
                              <DropdownMenuItem onClick={() => { void handleAssistantAction('archive', a); }} className="text-destructive">
                                <Archive className="h-3.5 w-3.5 mr-2" />Arquivar
                              </DropdownMenuItem>
                            )}
                            {a.status === 'archived' && hasPermission('assistants.restore') && (
                              <DropdownMenuItem onClick={() => { void handleAssistantAction('restore', a); }}>
                                <RotateCcw className="h-3.5 w-3.5 mr-2" />Restaurar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filtered.length === 0 && mockAssistants.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
              <Bot className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold">Nenhum assistente encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">Tente ajustar os filtros ou crie um novo assistente.</p>
            <Link to="/app/assistants/new" className="mt-4">
              <Button><Plus className="h-4 w-4 mr-1" />Criar Assistente</Button>
            </Link>
          </div>
        )}
        </QueryState>
      </div>
    </AppShell>
  );
}
