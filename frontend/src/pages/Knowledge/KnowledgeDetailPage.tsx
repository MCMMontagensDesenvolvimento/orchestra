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
import { useKnowledgeBases, useKnowledgeDocuments } from '@/hooks/queries/useKnowledge';
import { useAssistants } from '@/hooks/queries/useAssistants';
import {
  ArrowLeft, Database, FileText, Upload, Trash2, MoreHorizontal, RefreshCw,
  Settings, Users, ShieldCheck, Clock, HardDrive, Layers, Link2, Eye,
  FileUp, Search, AlertTriangle, CheckCircle2, Loader2, XCircle, Download
} from 'lucide-react';
import type { KnowledgeDocument, IngestionStatus } from '@/types';
import { toast } from '@/hooks/use-toast';

const statusIcon: Record<IngestionStatus, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-success" />,
  processing: <Loader2 className="h-4 w-4 text-warning animate-spin" />,
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
};

const fileTypeIcon: Record<string, string> = {
  PDF: '📄', DOCX: '📝', XLSX: '📊', CSV: '📋', TXT: '📃', MD: '📑',
};

export default function KnowledgeDetailPage() {
  const knowledgeQuery = useKnowledgeBases();
  const mockKnowledgeBases = knowledgeQuery.data ?? [];
  const { data: mockDocuments = [] } = useKnowledgeDocuments();
  const { data: mockAssistants = [] } = useAssistants();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const kb = mockKnowledgeBases.find(k => k.id === id);

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  useEffect(() => {
    setDocuments(mockDocuments.filter(d => d.knowledgeBaseId === id));
  }, [mockDocuments.length, id]);
  const [docSearch, setDocSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteDocOpen, setDeleteDocOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);

  // Upload form
  const [uploadFiles, setUploadFiles] = useState<string[]>([]);
  const [uploadFileName, setUploadFileName] = useState('');

  const linkedAssistants = useMemo(() => {
    if (!kb) return [];
    return mockAssistants.filter(a => a.knowledgeBases.includes(kb.id));
  }, [kb]);

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

  const handleUpload = () => {
    const newDoc: KnowledgeDocument = {
      id: `d-${Date.now()}`,
      knowledgeBaseId: kb.id,
      name: uploadFileName || 'Novo Documento.pdf',
      type: uploadFileName.split('.').pop()?.toUpperCase() || 'PDF',
      size: '5 MB',
      status: 'pending',
      chunks: 0,
      version: '1.0',
      uploadedBy: 'Usuário Atual',
      uploadedAt: new Date().toISOString().split('T')[0],
      lastProcessed: '',
    };
    setDocuments(prev => [newDoc, ...prev]);
    setUploadOpen(false);
    setUploadFileName('');
    toast({ title: 'Documento enviado', description: `"${newDoc.name}" está na fila de processamento.` });
    // Simulate processing
    setTimeout(() => {
      setDocuments(prev => prev.map(d => d.id === newDoc.id ? { ...d, status: 'processing' as IngestionStatus } : d));
      setTimeout(() => {
        setDocuments(prev => prev.map(d => d.id === newDoc.id ? { ...d, status: 'completed' as IngestionStatus, chunks: 124, lastProcessed: new Date().toISOString() } : d));
      }, 3000);
    }, 1000);
  };

  const handleDeleteDoc = () => {
    if (!selectedDoc) return;
    setDocuments(prev => prev.filter(d => d.id !== selectedDoc.id));
    setDeleteDocOpen(false);
    toast({ title: 'Documento removido', description: `"${selectedDoc.name}" foi excluído.`, variant: 'destructive' });
    setSelectedDoc(null);
  };

  const handleReprocessDoc = (doc: KnowledgeDocument) => {
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'processing' as IngestionStatus } : d));
    toast({ title: 'Reprocessando', description: `"${doc.name}" está sendo reprocessado.` });
    setTimeout(() => {
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'completed' as IngestionStatus, lastProcessed: new Date().toISOString() } : d));
    }, 3000);
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
                toast({ title: 'Re-indexação iniciada', description: `Todos os documentos de "${kb.name}" estão sendo reprocessados.` });
              }}>
                <RefreshCw className="h-4 w-4 mr-1" />Re-indexar
              </Button>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-1" />Upload
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { icon: FileText, label: 'Documentos', value: docStats.total },
            { icon: Layers, label: 'Chunks', value: kb.totalChunks.toLocaleString() },
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
            <p className="text-xs text-muted-foreground mt-1">{docStats.progress}% dos documentos indexados</p>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents">Documentos ({docStats.total})</TabsTrigger>
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
                <FileUp className="h-4 w-4 mr-1" />Upload
              </Button>
            </div>

            {filteredDocs.length === 0 ? (
              <EmptyState icon={<FileText className="h-6 w-6" />} title="Nenhum documento" description="Faça upload de documentos para alimentar esta base de conhecimento." action={<Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-1" />Upload</Button>} />
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
                            {statusIcon[doc.status]}
                            <StatusBadge status={doc.status} />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{doc.chunks > 0 ? doc.chunks : '—'}</TableCell>
                        <TableCell className="text-xs">{doc.version}</TableCell>
                        <TableCell className="text-xs">{doc.uploadedBy}</TableCell>
                        <TableCell className="text-xs">{doc.uploadedAt}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem><Download className="h-4 w-4 mr-2" />Download</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReprocessDoc(doc)}><RefreshCw className="h-4 w-4 mr-2" />Reprocessar</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedDoc(doc); setDeleteDocOpen(true); }} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />Excluir
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
                <h3 className="font-semibold flex items-center gap-2"><Settings className="h-4 w-4" />Configuração de Indexação</h3>
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

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload de Documento</DialogTitle>
            <DialogDescription>Adicione documentos à base "{kb.name}" para indexação e RAG.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setUploadFileName('Documento_' + Date.now() + '.pdf')}>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Arraste arquivos aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, CSV, TXT, MD — Máximo 50 MB</p>
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
              <Input value={uploadFileName} onChange={e => setUploadFileName(e.target.value)} placeholder="Nome será extraído do arquivo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={!uploadFileName}><Upload className="h-4 w-4 mr-1" />Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Dialog */}
      <Dialog open={deleteDocOpen} onOpenChange={setDeleteDocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Documento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{selectedDoc?.name}"? Os chunks associados serão removidos do índice.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDocOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteDoc}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
