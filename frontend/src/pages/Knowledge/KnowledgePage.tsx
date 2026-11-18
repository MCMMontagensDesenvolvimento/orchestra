import { useState, useMemo, useEffect, type Dispatch, type SetStateAction } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shared/AppShell';
import { OrchestraPageBanner } from '@/components/shared/OrchestraPageBanner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  useArchiveKnowledgeBaseMutation,
  useRestoreKnowledgeBaseMutation,
  useArchivedKnowledgeBases,
  useCreateKnowledgeBaseMutation,
  useKnowledgeBases,
  useUpdateKnowledgeBaseMutation,
} from '@/hooks/queries/useKnowledge';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { Plus, Search, Database, LayoutGrid, List, MoreHorizontal, Eye, Pencil, Trash2, Copy, RefreshCw, FileText, Filter, X, ShieldCheck, BookOpen, Layers3, RotateCcw } from 'lucide-react';
import type { KnowledgeBase, DataClassification, ConnectorType, RetentionPeriod } from '@/types';
import type { KnowledgeBasePayload } from '@/services/knowledge.service';
import { toast } from '@/hooks/use-toast';

const classificationColors: Record<DataClassification, string> = {
  'Público': 'bg-success/10 text-success border-success/20',
  'Interno': 'bg-info/10 text-info border-info/20',
  'Confidencial': 'bg-warning/10 text-warning border-warning/20',
  'Restrito': 'bg-destructive/10 text-destructive border-destructive/20',
};

const connectorLabels: Record<ConnectorType, string> = {
  upload: 'Upload Manual',
  sharepoint: 'SharePoint',
  confluence: 'Confluence',
  google_drive: 'Google Drive',
  s3: 'Amazon S3',
  api: 'API REST',
};

const defaultFormData = {
  name: '',
  description: '',
  classification: 'Interno' as DataClassification,
  connectorType: 'upload' as ConnectorType,
  embeddingModel: 'placeholder-not-configured',
  chunkSize: '512',
  chunkOverlap: '64',
  retention: '2 anos' as RetentionPeriod,
};

function mapClassificationToApi(classification: DataClassification): KnowledgeBasePayload['dataClassification'] {
  if (classification === 'Público') return 'public';
  if (classification === 'Interno') return 'internal';
  if (classification === 'Confidencial') return 'confidential';
  return 'sensitive';
}

function buildKnowledgePayload(formData: typeof defaultFormData): KnowledgeBasePayload {
  return {
    name: formData.name.trim(),
    description: formData.description.trim() || undefined,
    visibility: 'workspace',
    dataClassification: mapClassificationToApi(formData.classification),
    metadata: {
      connectorType: formData.connectorType,
      embeddingModel: formData.embeddingModel,
      chunkSize: Number(formData.chunkSize),
      chunkOverlap: Number(formData.chunkOverlap),
      retention: formData.retention,
      phase: 'catalog_placeholder',
    },
  };
}

function KnowledgeFormFields({ formData, setFormData }: {
  formData: typeof defaultFormData;
  setFormData: Dispatch<SetStateAction<typeof defaultFormData>>;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nome da Base</Label>
        <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Políticas de RH 2026" />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Descreva o conteúdo e propósito desta base..." rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Classificação</Label>
          <Select value={formData.classification} onValueChange={v => setFormData(p => ({ ...p, classification: v as DataClassification }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Público">Público</SelectItem>
              <SelectItem value="Interno">Interno</SelectItem>
              <SelectItem value="Confidencial">Confidencial</SelectItem>
              <SelectItem value="Restrito">Restrito</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Conector</Label>
          <Select value={formData.connectorType} onValueChange={v => setFormData(p => ({ ...p, connectorType: v as ConnectorType }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upload">Upload Manual</SelectItem>
              <SelectItem value="sharepoint">SharePoint</SelectItem>
              <SelectItem value="confluence">Confluence</SelectItem>
              <SelectItem value="google_drive">Google Drive</SelectItem>
              <SelectItem value="s3">Amazon S3</SelectItem>
              <SelectItem value="api">API REST</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Referência de embedding</Label>
          <Select value={formData.embeddingModel} onValueChange={v => setFormData(p => ({ ...p, embeddingModel: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="placeholder-not-configured">Placeholder não configurado</SelectItem>
              <SelectItem value="future-provider-managed">Futuro provider governado</SelectItem>
              <SelectItem value="external-reference-only">Referência externa apenas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Retenção</Label>
          <Select value={formData.retention} onValueChange={v => setFormData(p => ({ ...p, retention: v as RetentionPeriod }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6 meses">6 meses</SelectItem>
              <SelectItem value="1 ano">1 ano</SelectItem>
              <SelectItem value="2 anos">2 anos</SelectItem>
              <SelectItem value="5 anos">5 anos</SelectItem>
              <SelectItem value="Indefinido">Indefinido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Chunk Size (tokens)</Label>
          <Input type="number" value={formData.chunkSize} onChange={e => setFormData(p => ({ ...p, chunkSize: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Chunk Overlap (tokens)</Label>
          <Input type="number" value={formData.chunkOverlap} onChange={e => setFormData(p => ({ ...p, chunkOverlap: e.target.value }))} />
        </div>
      </div>
    </div>
  );
}

function searchable(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function CatalogKnowledgeIcon({ base }: { base: KnowledgeBase }) {
  const name = searchable(base.name);
  const Icon = /norma|seguranca|procedimento/.test(name) ? FileText
    : /manual|guia|politica|rh/.test(name) ? BookOpen
      : /projeto|obra/.test(name) ? Database : Layers3;
  return <Icon className="h-6 w-6" aria-hidden="true" />;
}

/** A API de bases distingue active/archived; não confundir com ingestão dos documentos. */
function CatalogKnowledgeStatus({ status }: { status: KnowledgeBase['status'] }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />Ativa
    </span>
  );
  if (status === 'archived') return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />Arquivada
    </span>
  );
  return <StatusBadge status={status} />;
}

export default function KnowledgePage() {
  const knowledgeQuery = useKnowledgeBases();
  const createKnowledgeBaseMutation = useCreateKnowledgeBaseMutation();
  const updateKnowledgeBaseMutation = useUpdateKnowledgeBaseMutation();
  const archiveKnowledgeBaseMutation = useArchiveKnowledgeBaseMutation();
  const restoreKnowledgeBaseMutation = useRestoreKnowledgeBaseMutation();
  const mockKnowledgeBases = useMemo(() => knowledgeQuery.data ?? [], [knowledgeQuery.data]);
  const navigate = useNavigate();
  const [bases, setBases] = useState<KnowledgeBase[]>(mockKnowledgeBases);
  // Sincroniza estado local quando o mock/API resolve (delay simulado).
  useEffect(() => { setBases(mockKnowledgeBases); }, [mockKnowledgeBases]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  // Consultar também as arquivadas para que 'Todas' represente o catálogo completo.
  const archivedQuery = useArchivedKnowledgeBases(true);
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedBase, setSelectedBase] = useState<KnowledgeBase | null>(null);
  const [formData, setFormData] = useState(defaultFormData);

  const allBases = useMemo(() => {
    const activeIds = new Set(bases.map((kb) => kb.id));
    const archived = (archivedQuery.data ?? []).filter((kb) => !activeIds.has(kb.id));
    return [...bases, ...archived];
  }, [bases, archivedQuery.data]);

  const selectedBases = useMemo(
    () => filterStatus === 'archived'
      ? (archivedQuery.data ?? [])
      : filterStatus === 'all' ? allBases : bases,
    [filterStatus, archivedQuery.data, allBases, bases],
  );
  const filtered = useMemo(() => {
    const query = searchable(search.trim());
    return selectedBases.filter((kb) => {
      const matchSearch = !query || searchable(`${kb.name} ${kb.description}`).includes(query);
      const matchStatus = filterStatus === 'all' || kb.status === filterStatus;
      const matchClass = filterClassification === 'all' || kb.classification === filterClassification;
      return matchSearch && matchStatus && matchClass;
    });
  }, [selectedBases, search, filterStatus, filterClassification]);

  const catalogTabs: { value: string; label: string; count: number | null }[] = [
    { value: 'all', label: 'Todas', count: archivedQuery.isSuccess ? allBases.length : null },
    { value: 'completed', label: 'Ativas', count: bases.filter((kb) => kb.status === 'completed').length },
    { value: 'archived', label: 'Arquivadas', count: archivedQuery.isSuccess ? (archivedQuery.data?.length ?? 0) : null },
  ];

  const handleCreate = async () => {
    try {
      const newBase = await createKnowledgeBaseMutation.mutateAsync(buildKnowledgePayload(formData));
      setBases(prev => [newBase, ...prev.filter(kb => kb.id !== newBase.id)]);
      setCreateOpen(false);
      setFormData(defaultFormData);
      toast({ title: 'Base criada', description: `"${newBase.name}" foi adicionada ao catálogo.` });
    } catch (error) {
      toast({ title: 'Erro ao criar base', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleEdit = async () => {
    if (!selectedBase) return;
    try {
      const updated = await updateKnowledgeBaseMutation.mutateAsync({ id: selectedBase.id, payload: buildKnowledgePayload(formData) });
      setBases(prev => prev.map(kb => kb.id === updated.id ? updated : kb));
      setEditOpen(false);
      setSelectedBase(null);
      toast({ title: 'Base atualizada', description: 'As alterações foram salvas.' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar base', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!selectedBase) return;
    try {
      await archiveKnowledgeBaseMutation.mutateAsync(selectedBase.id);
      setBases(prev => prev.filter(kb => kb.id !== selectedBase.id));
      setDeleteOpen(false);
      toast({ title: 'Base arquivada', description: `"${selectedBase.name}" foi arquivada.` });
      setSelectedBase(null);
    } catch (error) {
      toast({ title: 'Erro ao arquivar base', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleRestore = async (kb: KnowledgeBase) => {
    try {
      await restoreKnowledgeBaseMutation.mutateAsync(kb.id);
      toast({ title: 'Base restaurada', description: `"${kb.name}" voltou ao catálogo.` });
      void archivedQuery.refetch();
      void knowledgeQuery.refetch();
    } catch (error) {
      toast({ title: 'Erro ao restaurar base', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleDuplicate = async (kb: KnowledgeBase) => {
    try {
      const duplicated = await createKnowledgeBaseMutation.mutateAsync({
        name: `${kb.name} (cópia)`,
        description: kb.description,
        visibility: kb.visibility ?? 'workspace',
        dataClassification: kb.dataClassification ?? mapClassificationToApi(kb.classification),
        metadata: {
          connectorType: kb.connectorType,
          embeddingModel: kb.embeddingModel,
          chunkSize: kb.chunkSize,
          chunkOverlap: kb.chunkOverlap,
          retention: kb.retention,
          phase: 'catalog_placeholder',
        },
      });
      setBases(prev => [duplicated, ...prev]);
      toast({ title: 'Base duplicada', description: `"${duplicated.name}" foi criada.` });
    } catch (error) {
      toast({ title: 'Erro ao duplicar base', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleManageIndexing = (kb: KnowledgeBase) => {
    navigate(`/app/knowledge/${kb.id}`);
  };

  const openEdit = (kb: KnowledgeBase) => {
    setSelectedBase(kb);
    setFormData({ name: kb.name, description: kb.description, classification: kb.classification, connectorType: kb.connectorType, embeddingModel: kb.embeddingModel, chunkSize: String(kb.chunkSize), chunkOverlap: String(kb.chunkOverlap), retention: kb.retention });
    setEditOpen(true);
  };

  const openDelete = (kb: KnowledgeBase) => {
    setSelectedBase(kb);
    setDeleteOpen(true);
  };

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterClassification('all');
    setSearch('');
  };

  const hasActiveFilters = filterStatus !== 'all' || filterClassification !== 'all' || search !== '';


  return (
    <AppShell>
      <div className="orchestra-front-page space-y-4 animate-fade-in pb-5">
        <OrchestraPageBanner labelledBy="knowledge-catalog-title">
          <div className="orchestra-banner-heading flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h1 id="knowledge-catalog-title" className="text-xl font-bold tracking-tight sm:text-2xl">Base de Conhecimento</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">Gerencie as bases de documentos que alimentam os assistentes de IA.</p>
              </div>
            </div>
            <Button onClick={() => { setFormData(defaultFormData); setCreateOpen(true); }} className="shrink-0 shadow-sm">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />Adicionar base de conhecimento
            </Button>
          </div>
          <div className="orchestra-banner-toolbar flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-1">
              <label className="orchestra-search-field flex min-h-10 w-full min-w-0 max-w-xl flex-1 items-center gap-2 rounded-lg border bg-white px-3 shadow-sm sm:w-auto">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Buscar bases de conhecimento</span>
                <input type="search" aria-label="Buscar bases de conhecimento" value={search}
                  onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou descrição..."
                  className="w-full min-w-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
              </label>
              <Button variant="outline" size="sm" type="button" aria-expanded={showFilters} aria-controls="knowledge-advanced-filters"
                onClick={() => setShowFilters(!showFilters)} className="h-10 bg-white">
                <Filter className="mr-1.5 h-4 w-4" aria-hidden="true" />Filtros
                {filterClassification !== 'all' && <span className="ml-1 rounded bg-primary/10 px-1.5 text-xs text-primary">1</span>}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" type="button" onClick={clearFilters}>
                  <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />Limpar
                </Button>
              )}
            </div>
            <div className="inline-flex h-10 items-center gap-0.5 rounded-lg border bg-white p-1" role="group" aria-label="Modo de visualização">
              <button type="button" aria-label="Visualizar cards" aria-pressed={viewMode === 'card'}
                onClick={() => setViewMode('card')}
                className={`rounded-md p-2 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Visualizar tabela" aria-pressed={viewMode === 'table'}
                onClick={() => setViewMode('table')}
                className={`rounded-md p-2 transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                <List className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </OrchestraPageBanner>

        <div className="flex min-w-0 gap-3 overflow-x-auto border-b border-border/80" role="group" aria-label="Filtrar bases por estado">
          {catalogTabs.map((tab) => (
            <button type="button" key={tab.value} aria-pressed={filterStatus === tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm font-medium transition-colors ${filterStatus === tab.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {tab.label}
              {tab.count !== null && <span className={`rounded-md px-1.5 py-0.5 text-xs ${filterStatus === tab.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {filterStatus === 'all' && archivedQuery.isError && (
          <p role="alert" className="text-xs text-destructive">
            Não foi possível consultar as bases arquivadas. A lista pode estar incompleta.
          </p>
        )}

        {showFilters && (
          <div id="knowledge-advanced-filters" className="flex flex-wrap gap-4 rounded-xl border bg-white p-4 shadow-sm">
            <div className="space-y-1.5">
              <Label className="text-xs">Classificação da informação</Label>
              <Select value={filterClassification} onValueChange={setFilterClassification}>
                <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Público">Público</SelectItem>
                  <SelectItem value="Interno">Interno</SelectItem>
                  <SelectItem value="Confidencial">Confidencial</SelectItem>
                  <SelectItem value="Restrito">Restrito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end text-xs leading-relaxed text-muted-foreground">
              Os estados de ingestão são acompanhados nos documentos de cada base.
            </div>
          </div>
        )}

        {/* Content */}
        <QueryState
          query={filterStatus === 'archived' ? archivedQuery : knowledgeQuery}
          isEmpty={selectedBases.length === 0}
          loading={<ListLoading rows={4} />}
          emptyIcon={<Database className="h-6 w-6" />}
          emptyTitle={filterStatus === 'archived' ? 'Nenhuma base arquivada' : 'Nenhuma base de conhecimento cadastrada'}
          emptyDescription="Crie uma base para catalogar documentos e governar futuras integrações de recuperação."
          emptyAction={
            <Button onClick={() => { setFormData(defaultFormData); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Nova base
            </Button>
          }
          errorTitle="Não foi possível carregar as bases de conhecimento"
          errorDescription="Tente novamente em instantes."
        >
        {filtered.length === 0 ? (
          <EmptyState icon={<Database className="h-6 w-6" />} title="Nenhuma base encontrada para os filtros" description="Ajuste os filtros ou crie uma nova base." action={<Button onClick={() => { setFormData(defaultFormData); setCreateOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova Base</Button>} />
        ) : viewMode === 'card' ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((kb) => (
              <article key={kb.id} className="group flex min-h-[176px] flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/25 hover:shadow-md">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CatalogKnowledgeIcon base={kb} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/app/knowledge/${kb.id}`}
                      className="orchestra-card-title block truncate text-sm font-semibold text-foreground hover:text-primary" title={kb.name}>
                      {kb.name}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {kb.description || 'Descrição não informada.'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${classificationColors[kb.classification]}`}>
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" />{kb.classification}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Ações da base ${kb.name}`} className="h-8 w-8 shrink-0 text-muted-foreground">
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/app/knowledge/${kb.id}`)}><Eye className="mr-2 h-4 w-4" />Visualizar documentos</DropdownMenuItem>
                      {kb.status !== 'archived' && <DropdownMenuItem onClick={() => openEdit(kb)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => { void handleDuplicate(kb); }}><Copy className="mr-2 h-4 w-4" />Duplicar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleManageIndexing(kb)}><RefreshCw className="mr-2 h-4 w-4" />Gerenciar ingestão</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {kb.status === 'archived'
                        ? <DropdownMenuItem onClick={() => { void handleRestore(kb); }}><RotateCcw className="mr-2 h-4 w-4" />Restaurar</DropdownMenuItem>
                        : <DropdownMenuItem onClick={() => openDelete(kb)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Arquivar</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border/70 pt-3 sm:gap-4">
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    <span>{kb.documentCount} documento{kb.documentCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
                  <CatalogKnowledgeStatus status={kb.status} />
                  <div className="ml-auto flex items-center gap-1.5">
                    {kb.status === 'archived' ? (
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label={`Restaurar ${kb.name}`} onClick={() => { void handleRestore(kb); }}>
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    ) : (
                      <>
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label={`Editar ${kb.name}`} onClick={() => openEdit(kb)}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Arquivar ${kb.name}`} onClick={() => openDelete(kb)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Docs</TableHead>
                  <TableHead className="text-center">Chunks</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Conector</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Atualização</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(kb => (
                  <TableRow key={kb.id} className="cursor-pointer" onClick={() => navigate(`/app/knowledge/${kb.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-info" />
                        <span className="font-medium">{kb.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${classificationColors[kb.classification]}`}>
                        {kb.classification}
                      </span>
                    </TableCell>
                    <TableCell><CatalogKnowledgeStatus status={kb.status} /></TableCell>
                    <TableCell className="text-center">{kb.documentCount}</TableCell>
                    <TableCell className="text-center">{kb.totalChunks.toLocaleString()}</TableCell>
                    <TableCell>{kb.size}</TableCell>
                    <TableCell className="text-xs">{connectorLabels[kb.connectorType]}</TableCell>
                    <TableCell className="text-xs">{kb.owner}</TableCell>
                    <TableCell className="text-xs">{kb.lastUpdated}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => navigate(`/app/knowledge/${kb.id}`)}><Eye className="h-4 w-4 mr-2" />Visualizar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(kb)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { void handleDuplicate(kb); }}><Copy className="h-4 w-4 mr-2" />Duplicar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleManageIndexing(kb)}><RefreshCw className="h-4 w-4 mr-2" />Gerenciar indexação</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {kb.status === 'archived'
                            ? <DropdownMenuItem onClick={() => { void handleRestore(kb); }}><RotateCcw className="h-4 w-4 mr-2" />Restaurar</DropdownMenuItem>
                            : <DropdownMenuItem onClick={() => openDelete(kb)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Arquivar</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        </QueryState>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Base de Conhecimento</DialogTitle>
            <DialogDescription>Configure a base no catálogo. A ingestão de documentos e os embeddings são gerenciados na página de detalhes.</DialogDescription>
          </DialogHeader>
          <KnowledgeFormFields formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => { void handleCreate(); }} disabled={!formData.name || createKnowledgeBaseMutation.isPending}>Criar Base</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Base de Conhecimento</DialogTitle>
            <DialogDescription>Atualize as configurações da base "{selectedBase?.name}".</DialogDescription>
          </DialogHeader>
          <KnowledgeFormFields formData={formData} setFormData={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => { void handleEdit(); }} disabled={!formData.name || updateKnowledgeBaseMutation.isPending}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar Base de Conhecimento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja arquivar "{selectedBase?.name}"? Os vínculos e eventos ficam preservados para governança.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { void handleDelete(); }} disabled={archiveKnowledgeBaseMutation.isPending}>Arquivar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
