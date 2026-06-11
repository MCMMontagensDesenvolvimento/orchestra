import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
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
  useCreateKnowledgeBaseMutation,
  useKnowledgeBases,
  useUpdateKnowledgeBaseMutation,
} from '@/hooks/queries/useKnowledge';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { Plus, Search, Database, LayoutGrid, List, MoreHorizontal, Eye, Pencil, Trash2, Copy, RefreshCw, FileText, Upload, Link2, Filter, X, ShieldCheck } from 'lucide-react';
import type { KnowledgeBase, DataClassification, ConnectorType, IngestionStatus, RetentionPeriod } from '@/types';
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

export default function KnowledgePage() {
  const knowledgeQuery = useKnowledgeBases();
  const createKnowledgeBaseMutation = useCreateKnowledgeBaseMutation();
  const updateKnowledgeBaseMutation = useUpdateKnowledgeBaseMutation();
  const archiveKnowledgeBaseMutation = useArchiveKnowledgeBaseMutation();
  const mockKnowledgeBases = useMemo(() => knowledgeQuery.data ?? [], [knowledgeQuery.data]);
  const navigate = useNavigate();
  const [bases, setBases] = useState<KnowledgeBase[]>(mockKnowledgeBases);
  // Sincroniza estado local quando o mock/API resolve (delay simulado).
  useEffect(() => { setBases(mockKnowledgeBases); }, [mockKnowledgeBases]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedBase, setSelectedBase] = useState<KnowledgeBase | null>(null);
  const [formData, setFormData] = useState(defaultFormData);

  const filtered = useMemo(() => {
    return bases.filter(kb => {
      const matchSearch = !search || kb.name.toLowerCase().includes(search.toLowerCase()) || kb.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || kb.status === filterStatus;
      const matchClass = filterClassification === 'all' || kb.classification === filterClassification;
      return matchSearch && matchStatus && matchClass;
    });
  }, [bases, search, filterStatus, filterClassification]);

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

  const handleReindex = (kb: KnowledgeBase) => {
    setBases(prev => prev.map(b => b.id === kb.id ? { ...b, status: 'processing' as IngestionStatus } : b));
    toast({ title: 'Re-indexação iniciada', description: `"${kb.name}" está sendo reprocessada.` });
    setTimeout(() => {
      setBases(prev => prev.map(b => b.id === kb.id ? { ...b, status: 'completed' as IngestionStatus, lastUpdated: new Date().toISOString().split('T')[0] } : b));
    }, 3000);
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

  const FormFields = () => (
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

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Knowledge Hub" description="Catálogo governado de bases, documentos e ingestão placeholder">
          <Button onClick={() => { setFormData(defaultFormData); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Nova Base
          </Button>
        </PageHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 flex-1 max-w-md">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar bases de conhecimento..." className="bg-transparent text-sm outline-none w-full" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-3.5 w-3.5 mr-1" />Filtros
            {hasActiveFilters && <span className="ml-1 h-2 w-2 rounded-full bg-primary" />}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" />Limpar
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
            <Button variant={viewMode === 'card' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('card')}><LayoutGrid className="h-3.5 w-3.5" /></Button>
            <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('table')}><List className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="processing">Processando</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="failed">Falha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Classificação</Label>
              <Select value={filterClassification} onValueChange={setFilterClassification}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Público">Público</SelectItem>
                  <SelectItem value="Interno">Interno</SelectItem>
                  <SelectItem value="Confidencial">Confidencial</SelectItem>
                  <SelectItem value="Restrito">Restrito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Results count */}
        <p className="text-xs text-muted-foreground">{filtered.length} base{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}</p>

        {/* Content */}
        <QueryState
          query={knowledgeQuery}
          isEmpty={bases.length === 0}
          loading={<ListLoading rows={4} />}
          emptyIcon={<Database className="h-6 w-6" />}
          emptyTitle="Nenhuma base de conhecimento cadastrada"
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(kb => (
              <div key={kb.id} className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate(`/app/knowledge/${kb.id}`)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-info">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold group-hover:text-primary transition-colors">{kb.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${classificationColors[kb.classification]}`}>
                          <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />{kb.classification}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={kb.status} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => navigate(`/app/knowledge/${kb.id}`)}><Eye className="h-4 w-4 mr-2" />Visualizar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(kb)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { void handleDuplicate(kb); }}><Copy className="h-4 w-4 mr-2" />Duplicar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleReindex(kb)}><RefreshCw className="h-4 w-4 mr-2" />Re-indexar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openDelete(kb)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Arquivar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{kb.description}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Link2 className="h-3 w-3" />{connectorLabels[kb.connectorType]}</span>
                  <span>·</span>
                  <span>{kb.owner}</span>
                </div>
                <div className="mt-4 border-t pt-3 grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-bold">{kb.documentCount}</p><p className="text-[10px] text-muted-foreground">Documentos</p></div>
                  <div><p className="text-lg font-bold">{kb.totalChunks.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Chunks</p></div>
                  <div><p className="text-lg font-bold">{kb.size}</p><p className="text-[10px] text-muted-foreground">Tamanho</p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {kb.assistants.map(a => (
                    <span key={a} className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{a}</span>
                  ))}
                </div>
              </div>
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
                    <TableCell><StatusBadge status={kb.status} /></TableCell>
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
                          <DropdownMenuItem onClick={() => handleReindex(kb)}><RefreshCw className="h-4 w-4 mr-2" />Re-indexar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openDelete(kb)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Arquivar</DropdownMenuItem>
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
            <DialogDescription>Configure a base no catálogo. A indexação real não é executada nesta fase.</DialogDescription>
          </DialogHeader>
          <FormFields />
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
          <FormFields />
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
