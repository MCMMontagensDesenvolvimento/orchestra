import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shared/AppShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  useArchiveKnowledgeDocumentMutation,
  useCreateKnowledgeDataSourceMutation,
  useCreateKnowledgeDocumentMutation,
  useKnowledgeBases,
  useKnowledgeChunks,
  useKnowledgeDataSources,
  useKnowledgeDocuments,
  useKnowledgeIngestionJobs,
  useKnowledgeSourceReferences,
  useRequestKnowledgeIngestionMutation,
} from '@/hooks/queries/useKnowledge';
import { useAssistants } from '@/hooks/queries/useAssistants';
import {
  ArrowLeft, Database, FileText, Upload, Trash2, MoreHorizontal, RefreshCw,
  Settings, Users, ShieldCheck, Clock, HardDrive, Layers, Link2, Eye,
  FileUp, Search, AlertTriangle, CheckCircle2, Loader2, XCircle, Download, Plus
} from 'lucide-react';
import type { KnowledgeDocument, IngestionStatus } from '@/types';
import type { KnowledgeDataSourcePayload, KnowledgeDocumentPayload } from '@/services/knowledge.service';
import { toast } from '@/hooks/use-toast';

const statusIcon: Partial<Record<IngestionStatus, React.ReactNode>> = {
  completed: <CheckCircle2 className="h-4 w-4 text-success" />,
  processing: <Loader2 className="h-4 w-4 text-warning animate-spin" />,
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
};

const fileTypeIcon: Record<string, string> = {
  PDF: '📄', DOCX: '📝', XLSX: '📊', CSV: '📋', TXT: '📃', MD: '📑',
};

const defaultDataSourceForm = {
  name: '',
  type: 'manual' as KnowledgeDataSourcePayload['type'],
  uri: '',
};

function mimeTypeFromName(name: string) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (extension === 'csv') return 'text/csv';
  if (extension === 'md') return 'text/markdown';
  return 'text/plain';
}

export default function KnowledgeDetailPage() {
  const knowledgeQuery = useKnowledgeBases();
  const mockKnowledgeBases = knowledgeQuery.data ?? [];
  const { id } = useParams<{ id: string }>();
  const documentsQuery = useKnowledgeDocuments(id);
  const { data: mockDocuments = [] } = documentsQuery;
  const dataSourcesQuery = useKnowledgeDataSources(id);
  const { data: dataSources = [] } = dataSourcesQuery;
  const { data: mockAssistants = [] } = useAssistants();
  const createDocumentMutation = useCreateKnowledgeDocumentMutation();
  const requestIngestionMutation = useRequestKnowledgeIngestionMutation();
  const archiveDocumentMutation = useArchiveKnowledgeDocumentMutation();
  const createDataSourceMutation = useCreateKnowledgeDataSourceMutation();
  const navigate = useNavigate();
  const kb = mockKnowledgeBases.find(k => k.id === id);

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  useEffect(() => {
    setDocuments(mockDocuments.filter(d => d.knowledgeBaseId === id));
  }, [mockDocuments, id]);
  const [docSearch, setDocSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dataSourceOpen, setDataSourceOpen] = useState(false);
  const [deleteDocOpen, setDeleteDocOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);
  const [dataSourceForm, setDataSourceForm] = useState(defaultDataSourceForm);
  const [previewDocId, setPreviewDocId] = useState<string | undefined>();

  // Documento textual local. Esta fase nao envia arquivos binarios.
  const [uploadFileName, setUploadFileName] = useState('');
  const [documentText, setDocumentText] = useState('');
  const previewDoc = documents.find(doc => doc.id === previewDocId);
  const ingestionJobsQuery = useKnowledgeIngestionJobs(previewDoc?.id);
  const chunksQuery = useKnowledgeChunks(previewDoc?.id);
  const sourceReferencesQuery = useKnowledgeSourceReferences(previewDoc?.id);
  const ingestionJobs = ingestionJobsQuery.data ?? [];
  const chunks = chunksQuery.data ?? [];
  const sourceReferences = sourceReferencesQuery.data ?? [];

  const linkedAssistants = useMemo(() => {
    if (!kb) return [];
    return mockAssistants.filter(a => a.knowledgeBases.includes(kb.id));
  }, [kb, mockAssistants]);

  const filteredDocs = useMemo(() => {
    return documents.filter(d => !docSearch || d.name.toLowerCase().includes(docSearch.toLowerCase()));
  }, [documents, docSearch]);

  const docStats = useMemo(() => {
    const total = documents.length;
    const completed = documents.filter(d => d.status === 'completed').length;
    const processing = documents.filter(d => d.status === 'processing').length;
    const pending = documents.filter(d => d.status === 'pending').length;
    const failed = documents.filter(d => d.status === 'failed').length;
    return { total, completed, processing, pending, failed, progress: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [documents]);
  const totalChunks = useMemo(() => documents.reduce((total, doc) => total + (doc.chunkCount ?? doc.chunks ?? 0), 0), [documents]);

  if (knowledgeQuery.isLoading) {
    return <AppShell><div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Carregando base de conhecimento…</div></AppShell>;
  }
  if (knowledgeQuery.isError) {
    return <AppShell><EmptyState icon={<Database className="h-6 w-6" />} title="Não foi possível carregar a base" description="Tente novamente em instantes." action={<Button onClick={() => knowledgeQuery.refetch()}>Tentar novamente</Button>} /></AppShell>;
  }
  if (!kb) {
    return (
      <AppShell>
        <EmptyState icon={<Database className="h-6 w-6" />} title="Base não encontrada" description="A base de conhecimento solicitada não existe." action={<Button onClick={() => navigate('/app/knowledge')}>Voltar</Button>} />
      </AppShell>
    );
  }

  const handleUpload = async () => {
    const title = uploadFileName.trim() || 'Documento catalogado.txt';
    const payload: KnowledgeDocumentPayload = {
      title,
      sourceType: 'manual',
      sourceUri: `manual://${kb.id}/${encodeURIComponent(title)}`,
      mimeType: mimeTypeFromName(title),
      dataClassification: kb.dataClassification ?? 'internal',
      contentText: documentText,
      metadata: {
        size: `${Math.max(1, Math.ceil(documentText.length / 1024))} KB`,
        version: '1.0',
        phase: 'local_text_ingestion',
      },
    };

    try {
      const newDoc = await createDocumentMutation.mutateAsync({ knowledgeBaseId: kb.id, payload });
      setDocuments(prev => [newDoc, ...prev.filter(doc => doc.id !== newDoc.id)]);
      setPreviewDocId(newDoc.id);
      setUploadOpen(false);
      setUploadFileName('');
      setDocumentText('');
      toast({ title: 'Documento registrado', description: `"${newDoc.name}" está pronto para ingestão local.` });
    } catch (error) {
      toast({ title: 'Erro ao catalogar documento', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleDeleteDoc = async () => {
    if (!selectedDoc) return;
    try {
      await archiveDocumentMutation.mutateAsync({ documentId: selectedDoc.id, knowledgeBaseId: kb.id });
      setDocuments(prev => prev.filter(d => d.id !== selectedDoc.id));
      setDeleteDocOpen(false);
      toast({ title: 'Documento arquivado', description: `"${selectedDoc.name}" foi arquivado.` });
      setSelectedDoc(null);
    } catch (error) {
      toast({ title: 'Erro ao arquivar documento', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleReprocessDoc = async (doc: KnowledgeDocument) => {
    try {
      const ingestion = await requestIngestionMutation.mutateAsync({ documentId: doc.id, knowledgeBaseId: kb.id });
      setDocuments(prev => prev.map(item => item.id === doc.id ? ingestion.document : item));
      setPreviewDocId(doc.id);
      toast({ title: 'Ingestão local concluída', description: `${ingestion.job.chunksCreated ?? ingestion.document.chunks} chunk(s) preparados para retrieval futuro.` });
    } catch (error) {
      toast({ title: 'Erro ao solicitar ingestão', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleCreateDataSource = async () => {
    const payload: KnowledgeDataSourcePayload = {
      name: dataSourceForm.name.trim(),
      type: dataSourceForm.type,
      config: {
        uri: dataSourceForm.uri.trim() || undefined,
        phase: 'catalog_placeholder',
      },
      status: 'active',
    };

    try {
      await createDataSourceMutation.mutateAsync({ knowledgeBaseId: kb.id, payload });
      setDataSourceOpen(false);
      setDataSourceForm(defaultDataSourceForm);
      toast({ title: 'Data source catalogado', description: `"${payload.name}" foi registrado sem execução de conector real.` });
    } catch (error) {
      toast({ title: 'Erro ao catalogar data source', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const classificationColors: Record<string, string> = {
    'Público': 'bg-success/10 text-success',
    'Interno': 'bg-info/10 text-info',
    'Confidencial': 'bg-warning/10 text-warning',
    'Restrito': 'bg-destructive/10 text-destructive',
  };

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/knowledge')} className="mb-3">
            <ArrowLeft className="h-4 w-4 mr-1" />Knowledge Hub
          </Button>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10 text-info">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{kb.name}</h1>
                  <StatusBadge status={kb.status} />
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${classificationColors[kb.classification]}`}>
                    <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />{kb.classification}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{kb.description}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                toast({ title: 'Ingestão local', description: `Solicite ingestão por documento em "${kb.name}".` });
              }}>
                <RefreshCw className="h-4 w-4 mr-1" />Ingestão
              </Button>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-1" />Registrar documento
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { icon: FileText, label: 'Documentos', value: docStats.total },
            { icon: Layers, label: 'Chunks', value: (totalChunks || kb.totalChunks).toLocaleString() },
            { icon: HardDrive, label: 'Tamanho', value: kb.size },
            { icon: Users, label: 'Assistentes', value: linkedAssistants.length },
            { icon: Clock, label: 'Atualização', value: kb.lastUpdated },
            { icon: Link2, label: 'Conector', value: kb.connectorType === 'upload' ? 'Upload' : kb.connectorType },
          ].map((kpi, i) => (
            <div key={i} className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <kpi.icon className="h-3.5 w-3.5" />
                <span className="text-[11px]">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Ingestion progress */}
        {docStats.processing > 0 && (
          <div className="rounded-lg border bg-warning/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 text-warning animate-spin" />
              <span className="text-sm font-medium">{docStats.processing} documento{docStats.processing > 1 ? 's' : ''} em processamento</span>
            </div>
            <Progress value={docStats.progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{docStats.progress}% dos documentos com ingestão placeholder</p>
          </div>
        )}

        <div className="rounded-lg border bg-info/5 p-4 text-sm text-info">
          Ingestão local ativa para texto simples. Embeddings, vector store e retrieval semântico seguem desabilitados nesta fase.
        </div>

        {/* Tabs */}
        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents">Documentos ({docStats.total})</TabsTrigger>
            <TabsTrigger value="data-sources">Data Sources ({dataSources.length})</TabsTrigger>
            <TabsTrigger value="assistants">Assistentes ({linkedAssistants.length})</TabsTrigger>
            <TabsTrigger value="settings">Configuração</TabsTrigger>
            <TabsTrigger value="audit">Atividade</TabsTrigger>
          </TabsList>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 flex-1 max-w-sm">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input type="text" value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="Buscar documentos..." className="bg-transparent text-sm outline-none w-full" />
              </div>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <FileUp className="h-4 w-4 mr-1" />Registrar
              </Button>
            </div>

            {filteredDocs.length === 0 ? (
              <EmptyState icon={<FileText className="h-6 w-6" />} title="Nenhum documento" description="Cadastre documentos estruturais para esta base de conhecimento." action={<Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-1" />Registrar</Button>} />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Chunks</TableHead>
                      <TableHead>Versão</TableHead>
                      <TableHead>Enviado por</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{fileTypeIcon[doc.type] || '📄'}</span>
                            <span className="font-medium text-sm">{doc.name}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{doc.type}</Badge></TableCell>
                        <TableCell className="text-xs">{doc.size}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {statusIcon[doc.status] ?? <Clock className="h-4 w-4 text-muted-foreground" />}
                            <StatusBadge status={doc.status} />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{(doc.chunkCount ?? doc.chunks) > 0 ? (doc.chunkCount ?? doc.chunks) : '—'}</TableCell>
                        <TableCell className="text-xs">{doc.version}</TableCell>
                        <TableCell className="text-xs">{doc.uploadedBy}</TableCell>
                        <TableCell className="text-xs">{doc.uploadedAt}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setPreviewDocId(doc.id)}><Eye className="h-4 w-4 mr-2" />Ver ingestão</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { void handleReprocessDoc(doc); }}><RefreshCw className="h-4 w-4 mr-2" />Solicitar ingestão</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedDoc(doc); setDeleteDocOpen(true); }} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />Arquivar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {previewDoc && (
              <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{previewDoc.name}</h3>
                      <p className="text-xs text-muted-foreground">{previewDoc.ingestionStatus ?? previewDoc.status}</p>
                    </div>
                    <StatusBadge status={previewDoc.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
                    <div><p className="text-lg font-bold">{previewDoc.chunkCount ?? previewDoc.chunks}</p><p className="text-[10px] text-muted-foreground">Chunks</p></div>
                    <div><p className="text-lg font-bold">{ingestionJobs.length}</p><p className="text-[10px] text-muted-foreground">Jobs</p></div>
                    <div><p className="text-lg font-bold">{sourceReferences.length}</p><p className="text-[10px] text-muted-foreground">Fontes</p></div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {ingestionJobs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum job registrado para este documento.</p>
                    ) : ingestionJobs.slice(0, 4).map(job => (
                      <div key={job.id} className="rounded-md border p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono">{job.strategy ?? 'local_text_chunking'}</span>
                          <StatusBadge status={job.status as IngestionStatus} />
                        </div>
                        <p className="mt-1 text-muted-foreground">{job.chunksCreated ?? 0} chunk(s), {job.sourceReferencesCreated ?? 0} referência(s)</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Chunks e source references</h3>
                    <Button variant="outline" size="sm" onClick={() => { void chunksQuery.refetch(); void sourceReferencesQuery.refetch(); }}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />Atualizar
                    </Button>
                  </div>
                  {chunksQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando chunks...</p>
                  ) : chunks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum chunk ativo. Solicite ingestão após preencher conteúdo textual.</p>
                  ) : (
                    <div className="space-y-3">
                      {chunks.slice(0, 5).map(chunk => {
                        const reference = sourceReferences.find(item => item.chunkId === chunk.id);
                        return (
                          <div key={chunk.id} className="rounded-md border p-3">
                            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                              <Badge variant="outline">#{chunk.chunkIndex + 1}</Badge>
                              <span>{chunk.charCount} chars</span>
                              <span>~{chunk.tokenEstimate} tokens</span>
                              {reference && <span className="text-muted-foreground">{reference.label}</span>}
                            </div>
                            <p className="line-clamp-3 text-sm text-muted-foreground">{chunk.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Data Sources Tab */}
          <TabsContent value="data-sources" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setDataSourceOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Novo data source
              </Button>
            </div>
            {dataSources.length === 0 ? (
              <EmptyState icon={<Link2 className="h-6 w-6" />} title="Nenhum data source" description="Cadastre referências estruturais para futuras rotinas de ingestão." action={<Button variant="outline" onClick={() => setDataSourceOpen(true)}><Plus className="h-4 w-4 mr-1" />Novo data source</Button>} />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Configuração</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataSources.map(source => (
                      <TableRow key={source.id}>
                        <TableCell className="font-medium">{source.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{source.type}</Badge></TableCell>
                        <TableCell><StatusBadge status={source.status} /></TableCell>
                        <TableCell>
                          <code className="block max-w-[280px] truncate rounded bg-muted px-1.5 py-0.5 text-[10px]">
                            {source.config ? JSON.stringify(source.config) : '—'}
                          </code>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(source.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Assistants Tab */}
          <TabsContent value="assistants" className="space-y-4">
            {linkedAssistants.length === 0 ? (
              <EmptyState icon={<Users className="h-6 w-6" />} title="Sem assistentes vinculados" description="Nenhum assistente está usando esta base de conhecimento." action={<Button variant="outline" onClick={() => navigate('/app/assistants')}>Ver Assistentes</Button>} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {linkedAssistants.map(a => (
                  <div key={a.id} className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate(`/app/assistants/${a.id}`)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{a.name}</h4>
                        <p className="text-xs text-muted-foreground">{a.area} · {a.owner}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-1">{a.description}</p>
                    <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                      <span>{a.conversations.toLocaleString()} conversas</span>
                      <span>v{a.version}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Settings className="h-4 w-4" />Configuração de Catálogo</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Modelo de Embedding</span><span className="font-medium">{kb.embeddingModel}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Chunk Size</span><span className="font-medium">{kb.chunkSize} tokens</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Chunk Overlap</span><span className="font-medium">{kb.chunkOverlap} tokens</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Conector</span><span className="font-medium capitalize">{kb.connectorType}</span></div>
                </div>
              </div>
              <div className="rounded-lg border bg-card p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Governança</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Classificação</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classificationColors[kb.classification]}`}>{kb.classification}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Retenção</span><span className="font-medium">{kb.retention}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Owner</span><span className="font-medium">{kb.owner}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Criação</span><span className="font-medium">{kb.createdAt}</span></div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="space-y-4">
            <div className="space-y-3">
              {[
                { time: '2026-03-08 15:00', event: 'Documento "Processo de Admissão - Fluxo.pdf" enviado para processamento', user: 'Maria Silva' },
                { time: '2026-03-01 16:00', event: 'Documento "Tabela de Cargos e Salários.xlsx" atualizado para v2.0', user: 'Maria Silva' },
                { time: '2026-02-10 11:00', event: 'Documento "Regulamento de Home Office.pdf" indexado com sucesso (67 chunks)', user: 'Sistema' },
                { time: '2026-02-01 14:00', event: 'Manual de Políticas RH atualizado para v3.0 (480 chunks)', user: 'Maria Silva' },
                { time: '2026-01-15 10:00', event: 'Base de conhecimento re-indexada com novo modelo de embedding', user: 'Fernando Alves' },
                { time: '2025-12-20 09:00', event: 'Código de Conduta 2026 adicionado à base', user: 'Juliana Costa' },
                { time: '2025-08-10 10:00', event: 'Base de conhecimento "Políticas de RH 2026" criada', user: 'Maria Silva' },
              ].map((log, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">{log.event}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{log.user}</span>
                      <span>·</span>
                      <span>{log.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Document Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Documento</DialogTitle>
            <DialogDescription>Cadastre metadados do documento em "{kb.name}". Nenhum arquivo binário é enviado nesta fase.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setUploadFileName('Documento_' + Date.now() + '.pdf')}>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Clique para preencher um nome de referência</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, CSV, TXT, MD como metadado catalogado</p>
            </div>
            {uploadFileName && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <FileText className="h-4 w-4 text-info" />
                <span className="text-sm flex-1">{uploadFileName}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setUploadFileName('')}><XCircle className="h-3.5 w-3.5" /></Button>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nome do documento (opcional)</Label>
              <Input value={uploadFileName} onChange={e => setUploadFileName(e.target.value)} placeholder="Ex: manual-operacional.pdf" />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo textual simples</Label>
              <Textarea value={documentText} onChange={e => setDocumentText(e.target.value)} rows={8} maxLength={100000} placeholder="Cole aqui o texto que será preparado pelo chunking local." />
              <p className="text-[10px] text-muted-foreground">{documentText.length}/100000 caracteres. Conteúdo bruto não entra em audit logs.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={() => { void handleUpload(); }} disabled={!uploadFileName || !documentText.trim() || createDocumentMutation.isPending}><Upload className="h-4 w-4 mr-1" />Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Source Dialog */}
      <Dialog open={dataSourceOpen} onOpenChange={setDataSourceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Data Source</DialogTitle>
            <DialogDescription>Cadastre uma referência governada. Nenhum conector real será executado nesta fase.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={dataSourceForm.name} onChange={event => setDataSourceForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Ex: Manual interno RH" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={dataSourceForm.type} onValueChange={value => setDataSourceForm(prev => ({ ...prev, type: value as KnowledgeDataSourcePayload['type'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="connector">Connector</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="storage">Storage</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>URI/Referência</Label>
                <Input value={dataSourceForm.uri} onChange={event => setDataSourceForm(prev => ({ ...prev, uri: event.target.value }))} placeholder="catalog://source" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDataSourceOpen(false)}>Cancelar</Button>
            <Button onClick={() => { void handleCreateDataSource(); }} disabled={!dataSourceForm.name || createDataSourceMutation.isPending}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Dialog */}
      <Dialog open={deleteDocOpen} onOpenChange={setDeleteDocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar Documento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja arquivar "{selectedDoc?.name}"? O histórico de ingestão placeholder será preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDocOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { void handleDeleteDoc(); }} disabled={archiveDocumentMutation.isPending}>Arquivar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
