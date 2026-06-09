import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { useAssistants } from '@/hooks/queries/useAssistants';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import {
  Plus, Bot, MessageSquare, DollarSign, ThumbsUp,
  LayoutGrid, List, Search, SlidersHorizontal, ArrowUpDown,
  MoreHorizontal, Edit, Copy, Play, Archive, Send, Eye,
  ChevronDown, X
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { AssistantStatus } from '@/types';

type ViewMode = 'cards' | 'table';
type SortField = 'name' | 'conversations' | 'costThisMonth' | 'satisfaction' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const areas = ['Todos', 'Recursos Humanos', 'Jurídico', 'Financeiro', 'Comercial', 'Compliance', 'Operações', 'TI'];
// `owners` é derivado dos assistentes (mock/API) dentro do componente.
const statusFilters: { label: string; value: AssistantStatus | 'all' }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Publicados', value: 'published' },
  { label: 'Rascunhos', value: 'draft' },
  { label: 'Arquivados', value: 'archived' },
];

export default function AssistantsPage() {
  const assistantsQuery = useAssistants();
  const mockAssistants = assistantsQuery.data ?? [];
  const owners = ['Todos', ...Array.from(new Set(mockAssistants.map(a => a.owner)))];
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
  }, [statusFilter, areaFilter, ownerFilter, searchQuery, sortField, sortDir]);

  const activeFilterCount = [statusFilter !== 'all', areaFilter !== 'Todos', ownerFilter !== 'Todos'].filter(Boolean).length;

  const handleAction = (action: string, name: string) => {
    toast.success(`${action}: ${name}`, { description: 'Ação executada com sucesso (mock)' });
  };

  return (
    <AppShell>
      <div className="space-y-5 animate-fade-in">
        <PageHeader title="Assistants" description={`${filtered.length} assistente${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}>
          <Link to="/app/assistants/new">
            <Button><Plus className="h-4 w-4 mr-1.5" />Criar Assistente</Button>
          </Link>
        </PageHeader>

        {/* Search + view toggle + filter toggle */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 flex-1 max-w-md">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome, descrição ou área..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-primary text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`rounded px-2.5 py-1.5 transition-colors ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`rounded px-2.5 py-1.5 transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="rounded-lg border bg-card p-4 animate-fade-in">
            <div className="flex flex-wrap gap-6">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {statusFilters.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setStatusFilter(f.value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === f.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-neutral'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Área</label>
                <div className="flex flex-wrap gap-1.5">
                  {areas.map(a => (
                    <button
                      key={a}
                      onClick={() => setAreaFilter(a)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${areaFilter === a ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-neutral'}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Responsável</label>
                <div className="flex flex-wrap gap-1.5">
                  {owners.map(o => (
                    <button
                      key={o}
                      onClick={() => setOwnerFilter(o)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${ownerFilter === o ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-neutral'}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setStatusFilter('all'); setAreaFilter('Todos'); setOwnerFilter('Todos'); }}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        )}

        {/* Sort controls */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowUpDown className="h-3 w-3" />
          <span>Ordenar por:</span>
          {([
            ['updatedAt', 'Atualização'],
            ['name', 'Nome'],
            ['conversations', 'Conversas'],
            ['costThisMonth', 'Custo'],
            ['satisfaction', 'Satisfação'],
          ] as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`rounded px-2 py-0.5 transition-colors ${sortField === field ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
            >
              {label} {sortField === field && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
          ))}
        </div>

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
        {/* Cards view */}
        {viewMode === 'cards' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(a => (
              <div key={a.id} className="group rounded-lg border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30">
                <div className="flex items-start justify-between">
                  <Link to={`/assistants/${a.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors truncate">{a.name}</h3>
                      <p className="text-xs text-muted-foreground">{a.area} · {a.owner}</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={a.status} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-1 hover:bg-muted transition-colors text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/assistants/${a.id}`}><Eye className="h-3.5 w-3.5 mr-2" />Ver detalhes</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/assistants/${a.id}/edit`}><Edit className="h-3.5 w-3.5 mr-2" />Editar</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction('Duplicado', a.name)}>
                          <Copy className="h-3.5 w-3.5 mr-2" />Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/chat/${a.id}`}><Play className="h-3.5 w-3.5 mr-2" />Testar</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {a.status === 'draft' && (
                          <DropdownMenuItem onClick={() => handleAction('Publicado', a.name)}>
                            <Send className="h-3.5 w-3.5 mr-2" />Publicar
                          </DropdownMenuItem>
                        )}
                        {a.status === 'published' && (
                          <DropdownMenuItem onClick={() => handleAction('Arquivado', a.name)}>
                            <Archive className="h-3.5 w-3.5 mr-2" />Arquivar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{a.conversations.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />R$ {a.costThisMonth.toFixed(0)}</span>
                    {a.satisfaction > 0 && <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{a.satisfaction}%</span>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">v{a.version}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{a.model}</span>
                  <span className="text-[10px] text-muted-foreground">T: {a.temperature}</span>
                  {a.environment && (
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${a.environment === 'production' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {a.environment}
                    </span>
                  )}
                </div>
              </div>
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
                        <Link to={`/assistants/${a.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
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
                      <td className="px-4 py-3 text-right font-medium">{a.conversations.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">R$ {a.costThisMonth.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        {a.satisfaction > 0 ? (
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
                              <Link to={`/assistants/${a.id}`}><Eye className="h-3.5 w-3.5 mr-2" />Ver detalhes</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/assistants/${a.id}/edit`}><Edit className="h-3.5 w-3.5 mr-2" />Editar</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAction('Duplicado', a.name)}>
                              <Copy className="h-3.5 w-3.5 mr-2" />Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/chat/${a.id}`}><Play className="h-3.5 w-3.5 mr-2" />Testar</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {a.status === 'draft' && (
                              <DropdownMenuItem onClick={() => handleAction('Publicado', a.name)}>
                                <Send className="h-3.5 w-3.5 mr-2" />Publicar
                              </DropdownMenuItem>
                            )}
                            {a.status !== 'archived' && (
                              <DropdownMenuItem onClick={() => handleAction('Arquivado', a.name)} className="text-destructive">
                                <Archive className="h-3.5 w-3.5 mr-2" />Arquivar
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
