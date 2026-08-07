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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useArchiveMcpServerMutation,
  useCreateMcpServerMutation,
  useMcpBindings,
  useMcpServers,
  useMcpTools,
  useUpdateMcpServerMutation,
} from '@/hooks/queries/useMcp';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { useAssistants } from '@/hooks/queries/useAssistants';
import {
  Plus, Server, Wrench, Shield, Search, MoreHorizontal, Eye, Pencil, Trash2,
  Copy, Filter, X, AlertTriangle, Link2, LayoutGrid, List, Power, PowerOff,
  Globe, Settings, Key, Lock
} from 'lucide-react';
import type { McpServer, McpServerStatus, RiskLevel } from '@/types';
import type { McpServerPayload } from '@/services/mcp.service';
import { toast } from '@/hooks/use-toast';

const riskColors: Record<RiskLevel, string> = {
  low: 'bg-success/10 text-success border-success/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  critical: 'bg-destructive text-destructive-foreground border-destructive',
};

interface ServerFormData {
  name: string;
  description: string;
  url: string;
  authType: string;
  riskLevel: RiskLevel;
  version: string;
  owner: string;
  status: McpServerStatus;
  credentialRef: string;
}

const defaultForm: ServerFormData = {
  name: '', description: '', url: '', authType: 'none', riskLevel: 'low',
  version: '1.0.0', owner: '', status: 'disabled',
  credentialRef: '',
};

function mapAuthType(authType: string): McpServerPayload['authType'] {
  if (authType === 'API Key') return 'api_key';
  if (authType === 'api_key') return 'api_key';
  if (authType === 'Bearer Token') return 'bearer';
  if (authType === 'bearer') return 'bearer';
  if (authType === 'OAuth 2.0') return 'oauth';
  if (authType === 'oauth') return 'oauth';
  if (authType === 'mTLS') return 'mTLS';
  if (authType === 'none') return 'none';
  return 'other';
}

function authTypeForForm(authType: string) {
  if (authType === 'api_key') return 'API Key';
  if (authType === 'bearer') return 'Bearer Token';
  if (authType === 'oauth') return 'OAuth 2.0';
  if (authType === 'mTLS') return 'mTLS';
  if (authType === 'none') return 'none';
  return authType || 'none';
}

function statusForForm(status: McpServerStatus): McpServerStatus {
  if (status === 'inactive' || status === 'error') return 'disabled';
  return status;
}

function mapServerStatus(status: McpServerStatus): McpServerPayload['status'] {
  if (status === 'active') return 'active';
  if (status === 'archived') return 'archived';
  return 'disabled';
}

function buildServerPayload(formData: ServerFormData): McpServerPayload {
  return {
    name: formData.name.trim(),
    description: formData.description.trim() || undefined,
    baseUrl: formData.url.trim() || undefined,
    status: mapServerStatus(formData.status),
    serverType: 'remote',
    trustLevel: formData.riskLevel === 'low' ? 'trusted' : formData.riskLevel === 'medium' ? 'restricted' : 'experimental',
    riskLevel: formData.riskLevel,
    authType: mapAuthType(formData.authType),
    secretRef: formData.credentialRef.trim() || undefined,
    metadata: {
      version: formData.version,
      owner: formData.owner,
      phase: 'remote_readonly_homologation',
    },
  };
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isGovernedLocalDemo(server: McpServer) {
  const metadata = metadataRecord(server.metadata);
  return server.serverType === 'local' && metadata.localDemo === true && metadata.phase === '18D';
}

export default function McpHubPage() {
  const serversQuery = useMcpServers();
  const createMcpServerMutation = useCreateMcpServerMutation();
  const updateMcpServerMutation = useUpdateMcpServerMutation();
  const archiveMcpServerMutation = useArchiveMcpServerMutation();
  const mockMcpServers = useMemo(() => serversQuery.data ?? [], [serversQuery.data]);
  const { data: mockMcpTools = [] } = useMcpTools();
  const { data: mockMcpBindings = [] } = useMcpBindings();
  const { data: mockAssistants = [] } = useAssistants();
  const navigate = useNavigate();
  const [servers, setServers] = useState<McpServer[]>(mockMcpServers);
  useEffect(() => { setServers(mockMcpServers); }, [mockMcpServers]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<McpServer | null>(null);
  const [formData, setFormData] = useState<ServerFormData>(defaultForm);

  const filtered = useMemo(() => {
    return servers.filter(s => {
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || s.status === filterStatus;
      const matchRisk = filterRisk === 'all' || s.riskLevel === filterRisk;
      return matchSearch && matchStatus && matchRisk;
    });
  }, [servers, search, filterStatus, filterRisk]);

  const stats = useMemo(() => ({
    total: servers.length,
    active: servers.filter(s => s.status === 'active').length,
    totalTools: servers.reduce((s, sv) => s + sv.toolCount, 0),
    totalBindings: servers.reduce((s, sv) => s + sv.bindings, 0),
  }), [servers]);

  const hasActiveFilters = filterStatus !== 'all' || filterRisk !== 'all' || search !== '';

  const serverToolsForEdit = useMemo(() => {
    if (!selected) return [];
    return mockMcpTools.filter(t => t.serverId === selected.id);
  }, [selected, mockMcpTools]);

  const handleCreate = async () => {
    try {
      const newServer = await createMcpServerMutation.mutateAsync(buildServerPayload(formData));
      setServers(prev => [newServer, ...prev.filter(server => server.id !== newServer.id)]);
      setCreateOpen(false);
      setFormData(defaultForm);
      toast({ title: 'Servidor registrado', description: `"${newServer.name}" foi adicionado ao catálogo.` });
    } catch (error) {
      toast({ title: 'Erro ao registrar servidor', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleEdit = async () => {
    if (!selected) return;
    try {
      const updated = await updateMcpServerMutation.mutateAsync({ id: selected.id, payload: buildServerPayload(formData) });
      setServers(prev => prev.map(server => server.id === updated.id ? updated : server));
      setEditOpen(false);
      toast({ title: 'Servidor atualizado', description: 'Todas as configurações foram salvas.' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar servidor', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await archiveMcpServerMutation.mutateAsync(selected.id);
      setServers(prev => prev.filter(server => server.id !== selected.id));
      setDeleteOpen(false);
      toast({ title: 'Servidor arquivado', description: `"${selected.name}" foi arquivado.` });
      setSelected(null);
    } catch (error) {
      toast({ title: 'Erro ao arquivar servidor', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleToggleStatus = async (server: McpServer) => {
    const newStatus: McpServerStatus = server.status === 'active' ? 'disabled' : 'active';
    try {
      const updated = await updateMcpServerMutation.mutateAsync({ id: server.id, payload: { status: mapServerStatus(newStatus) } });
      setServers(prev => prev.map(item => item.id === updated.id ? updated : item));
      toast({ title: newStatus === 'active' ? 'Servidor ativado' : 'Servidor desativado' });
    } catch (error) {
      toast({ title: 'Erro ao alterar status', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleDuplicate = async (server: McpServer) => {
    try {
      const duplicated = await createMcpServerMutation.mutateAsync({
        name: `${server.name} (cópia)`,
        description: server.description,
        baseUrl: server.url,
        status: 'disabled',
        serverType: server.serverType ?? 'remote',
        trustLevel: server.trustLevel ?? 'restricted',
        riskLevel: server.riskLevel,
        authType: mapAuthType(server.authType),
        metadata: {
          ...(typeof server.metadata === 'object' && server.metadata ? server.metadata : {}),
          version: server.version,
          owner: server.owner,
          phase: 'remote_readonly_homologation',
        },
      });
      setServers(prev => [duplicated, ...prev]);
      toast({ title: 'Servidor duplicado', description: `"${duplicated.name}" foi criado.` });
    } catch (error) {
      toast({ title: 'Erro ao duplicar servidor', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const openEdit = (s: McpServer) => {
    setSelected(s);
    setFormData({
      name: s.name, description: s.description, url: s.url, authType: authTypeForForm(s.authType),
      riskLevel: s.riskLevel, version: s.version, owner: s.owner, status: statusForForm(s.status),
      credentialRef: '',
    });
    setEditOpen(true);
  };

  const openDelete = (s: McpServer) => { setSelected(s); setDeleteOpen(true); };

  const CreateFormFields = () => (
    <div className="space-y-4">
      <div className="space-y-2"><Label>Nome do Servidor</Label><Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Ex: ERP Gateway" /></div>
      <div className="space-y-2"><Label>Descrição</Label><Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Descreva a função deste servidor MCP..." rows={2} /></div>
      <div className="space-y-2"><Label>URL do Servidor</Label><Input value={formData.url} onChange={e => setFormData(p => ({ ...p, url: e.target.value }))} placeholder="https://mcp.example.internal" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Autenticação</Label>
          <Select value={formData.authType} onValueChange={v => setFormData(p => ({ ...p, authType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="API Key">API Key</SelectItem>
              <SelectItem value="OAuth 2.0">OAuth 2.0</SelectItem>
              <SelectItem value="Bearer Token">Bearer Token</SelectItem>
              <SelectItem value="mTLS">mTLS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Nível de Risco</Label>
          <Select value={formData.riskLevel} onValueChange={v => setFormData(p => ({ ...p, riskLevel: v as RiskLevel }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baixo</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Referência lógica de secret</Label>
        <Input value={formData.credentialRef} onChange={e => setFormData(p => ({ ...p, credentialRef: e.target.value }))} placeholder="vault://orchestra/mcp/nome-do-secret" />
        <p className="text-[11px] text-muted-foreground">Informe somente a referência do cofre. Tokens, API keys e senhas não são aceitos.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Versão</Label><Input value={formData.version} onChange={e => setFormData(p => ({ ...p, version: e.target.value }))} placeholder="1.0.0" /></div>
        <div className="space-y-2"><Label>Owner</Label><Input value={formData.owner} onChange={e => setFormData(p => ({ ...p, owner: e.target.value }))} placeholder="Nome do responsável" /></div>
      </div>
    </div>
  );

  const EditFormFields = () => (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="w-full grid grid-cols-5">
        <TabsTrigger value="general" className="text-xs"><Settings className="h-3 w-3 mr-1" />Geral</TabsTrigger>
        <TabsTrigger value="connection" className="text-xs"><Globe className="h-3 w-3 mr-1" />Conexão</TabsTrigger>
        <TabsTrigger value="security" className="text-xs"><Shield className="h-3 w-3 mr-1" />Segurança</TabsTrigger>
        <TabsTrigger value="tools" className="text-xs"><Wrench className="h-3 w-3 mr-1" />Tools</TabsTrigger>
        <TabsTrigger value="bindings" className="text-xs"><Link2 className="h-3 w-3 mr-1" />Bindings</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-4 mt-4">
        <div className="space-y-2"><Label>Nome do Servidor</Label><Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
        <div className="space-y-2"><Label>Descrição</Label><Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Versão</Label><Input value={formData.version} onChange={e => setFormData(p => ({ ...p, version: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Owner</Label><Input value={formData.owner} onChange={e => setFormData(p => ({ ...p, owner: e.target.value }))} /></div>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v as McpServerStatus }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="disabled">Desabilitado</SelectItem>
              <SelectItem value="archived">Arquivado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TabsContent>

      <TabsContent value="connection" className="space-y-4 mt-4">
        <div className="space-y-2"><Label>URL do Servidor</Label><Input value={formData.url} onChange={e => setFormData(p => ({ ...p, url: e.target.value }))} /></div>
        <div className="space-y-2">
          <Label>Tipo de Autenticação</Label>
          <Select value={formData.authType} onValueChange={v => setFormData(p => ({ ...p, authType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="API Key">API Key</SelectItem>
              <SelectItem value="OAuth 2.0">OAuth 2.0</SelectItem>
              <SelectItem value="Bearer Token">Bearer Token</SelectItem>
              <SelectItem value="mTLS">mTLS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Referência lógica de secret</Label>
          <Input value={formData.credentialRef} onChange={e => setFormData(p => ({ ...p, credentialRef: e.target.value }))} placeholder="vault://orchestra/mcp/nome-do-secret" />
          <p className="text-[11px] text-muted-foreground">
            O Orchestra recebe apenas a referência lógica e nunca exibe o valor. {selected?.credentialConfigured ? 'Já existe uma referência configurada; deixe em branco para preservá-la.' : 'Nenhuma referência está configurada.'}
          </p>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm font-medium">Conectividade governada</p>
          <p className="mt-1 text-xs text-muted-foreground">Readiness e discovery passam pelo boundary governado. O adapter corporativo read-only permanece aguardando configuração aprovada; toda chamada exige flags explícitas, origem HTTPS allowlistada, referência lógica de secret e política read-only.</p>
        </div>
      </TabsContent>

      <TabsContent value="security" className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label>Nível de Risco</Label>
          <Select value={formData.riskLevel} onValueChange={v => setFormData(p => ({ ...p, riskLevel: v as RiskLevel }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">🟢 Baixo</SelectItem>
              <SelectItem value="medium">🟡 Médio</SelectItem>
              <SelectItem value="high">🟠 Alto</SelectItem>
              <SelectItem value="critical">🔴 Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="flex gap-2">
            <Key className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Credenciais fora da interface</p>
              <p className="text-xs text-muted-foreground mt-1">Rotação e revogação devem ocorrer no cofre externo. A UI mantém apenas a referência lógica e não simula essas operações.</p>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="tools" className="space-y-4 mt-4">
        <p className="text-xs text-muted-foreground">Visão somente leitura. A execução remota exige tool explicitamente read-only, risco baixo e política aprovada no backend.</p>
        {serverToolsForEdit.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">Nenhuma tool registrada neste servidor.</div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {serverToolsForEdit.map(tool => (
              <div key={tool.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-semibold">{tool.name}</code>
                    <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${riskColors[tool.riskLevel]}`}>{tool.riskLevel}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{tool.description}</p>
                </div>
                <Badge variant="outline" className="ml-3 text-[10px]">{tool.requiresApproval ? 'Aprovação obrigatória' : 'Sem aprovação'}</Badge>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="bindings" className="space-y-4 mt-4">
        <p className="text-xs text-muted-foreground">Bindings existentes em modo somente leitura. Alterações de vínculo não são simuladas nesta tela.</p>
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {mockMcpBindings.filter(binding => binding.serverId === selected?.id).map(binding => {
            const assistant = mockAssistants.find(item => item.id === binding.assistantId);
            return (
              <div key={binding.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{assistant?.name ?? binding.assistantId}</span>
                  <p className="text-[11px] text-muted-foreground">Modo: {binding.mode}</p>
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>
    </Tabs>
  );

  const ActionMenu = ({ server }: { server: McpServer }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => navigate(`/app/mcp/${server.id}`)}><Eye className="h-4 w-4 mr-2" />Detalhes</DropdownMenuItem>
        {isGovernedLocalDemo(server) ? (
          <DropdownMenuItem disabled><Lock className="h-4 w-4 mr-2" />Catálogo protegido pelo seed</DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={() => openEdit(server)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { void handleToggleStatus(server); }}>
              {server.status === 'active' ? <><PowerOff className="h-4 w-4 mr-2" />Desativar</> : <><Power className="h-4 w-4 mr-2" />Ativar</>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { void handleDuplicate(server); }}><Copy className="h-4 w-4 mr-2" />Duplicar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openDelete(server)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Arquivar</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="MCP Hub" description="Catálogo local demonstrável, read-only e governado">
          <Button disabled title="Na Fase 18D o catálogo é instalado somente pelo seed local governado."><Lock className="h-4 w-4 mr-1" />Gerenciado por seed</Button>
        </PageHeader>

        <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium">Fase 18D · MCP demo local pronto e execução bloqueada</p>
            <p className="mt-1 text-xs text-muted-foreground">O catálogo abaixo usa apenas stubs locais determinísticos. Rede externa, MCP remoto, tools de escrita, providers, embeddings e Chat/AgentRun reais permanecem desabilitados.</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Server, label: 'Servidores', value: stats.total, sub: `${stats.active} ativos` },
            { icon: Wrench, label: 'Ferramentas', value: stats.totalTools },
            { icon: Link2, label: 'Bindings', value: stats.totalBindings },
            { icon: Shield, label: 'Aprovações', value: mockMcpTools.filter(t => t.requiresApproval).length, sub: 'requerem aprovação' },
          ].map((kpi, i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <kpi.icon className="h-3.5 w-3.5" />
                <span className="text-xs">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              {kpi.sub && <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>}
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 flex-1 max-w-md">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar servidores..." className="bg-transparent text-sm outline-none w-full" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-3.5 w-3.5 mr-1" />Filtros
            {hasActiveFilters && <span className="ml-1 h-2 w-2 rounded-full bg-primary" />}
          </Button>
          {hasActiveFilters && <Button variant="ghost" size="sm" onClick={() => { setFilterStatus('all'); setFilterRisk('all'); setSearch(''); }}><X className="h-3.5 w-3.5 mr-1" />Limpar</Button>}
          <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
            <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('table')}><List className="h-3.5 w-3.5" /></Button>
            <Button variant={viewMode === 'card' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('card')}><LayoutGrid className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        {showFilters && (
          <div className="flex gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="space-y-1"><Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Ativo</SelectItem><SelectItem value="disabled">Desabilitado</SelectItem><SelectItem value="archived">Arquivado</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Risco</Label>
              <Select value={filterRisk} onValueChange={setFilterRisk}><SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="low">Baixo</SelectItem><SelectItem value="medium">Médio</SelectItem><SelectItem value="high">Alto</SelectItem><SelectItem value="critical">Crítico</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{filtered.length} servidor{filtered.length !== 1 ? 'es' : ''}</p>

        <QueryState
          query={serversQuery}
          isEmpty={servers.length === 0}
          loading={<ListLoading rows={4} />}
          emptyIcon={<Server className="h-6 w-6" />}
          emptyTitle="Nenhum servidor MCP registrado"
          emptyDescription="Execute o seed demo local governado para instalar o catálogo MCP da Fase 18D."
          emptyAction={
            <Button disabled>
              <Lock className="h-4 w-4 mr-1" />Somente via seed local
            </Button>
          }
          errorTitle="Não foi possível carregar os servidores MCP"
          errorDescription="Tente novamente em instantes."
        >
        {filtered.length === 0 ? (
          <EmptyState icon={<Server className="h-6 w-6" />} title="Nenhum servidor encontrado para os filtros" description="Ajuste ou limpe os filtros para reencontrar o catálogo demo local." />
        ) : viewMode === 'table' ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servidor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead className="text-center">Tools</TableHead>
                  <TableHead className="text-center">Resources</TableHead>
                  <TableHead className="text-center">Bindings</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Última descoberta</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(server => (
                  <TableRow key={server.id} className="cursor-pointer" onClick={() => navigate(`/app/mcp/${server.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning"><Server className="h-4 w-4" /></div>
                        <div>
                          <p className="font-medium">{server.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{server.description}</p>
                          {isGovernedLocalDemo(server) && <div className="mt-1 flex flex-wrap gap-1"><Badge variant="secondary" className="text-[9px]">local</Badge><Badge variant="secondary" className="text-[9px]">demo</Badge><Badge variant="outline" className="text-[9px]">read-only</Badge><Badge variant="outline" className="text-[9px]">sandbox</Badge></div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={server.status} /></TableCell>
                    <TableCell className="text-xs">{server.authType}</TableCell>
                    <TableCell><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskColors[server.riskLevel]}`}>{server.riskLevel}</span></TableCell>
                    <TableCell className="text-center font-medium">{server.toolCount}</TableCell>
                    <TableCell className="text-center font-medium">{server.resourceCount}</TableCell>
                    <TableCell className="text-center font-medium">{server.bindings}</TableCell>
                    <TableCell className="text-xs">v{server.version}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{server.lastSync ? new Date(server.lastSync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                    <TableCell><ActionMenu server={server} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(server => (
              <div key={server.id} className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate(`/app/mcp/${server.id}`)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning"><Server className="h-5 w-5" /></div>
                    <div>
                      <h3 className="font-semibold group-hover:text-primary transition-colors">{server.name}</h3>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskColors[server.riskLevel]}`}>{server.riskLevel} risk</span>
                      {isGovernedLocalDemo(server) && <div className="mt-1 flex flex-wrap gap-1"><Badge variant="secondary" className="text-[9px]">local</Badge><Badge variant="secondary" className="text-[9px]">demo</Badge><Badge variant="outline" className="text-[9px]">read-only</Badge></div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={server.status} />
                    <ActionMenu server={server} />
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{server.description}</p>
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                  <span>{server.authType}</span><span>·</span><span>v{server.version}</span><span>·</span><span>{server.owner}</span>
                </div>
                <div className="mt-4 border-t pt-3 grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-bold">{server.toolCount}</p><p className="text-[10px] text-muted-foreground">Tools</p></div>
                  <div><p className="text-lg font-bold">{server.resourceCount}</p><p className="text-[10px] text-muted-foreground">Resources</p></div>
                  <div><p className="text-lg font-bold">{server.bindings}</p><p className="text-[10px] text-muted-foreground">Bindings</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
        </QueryState>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Registrar Servidor MCP</DialogTitle><DialogDescription>Configure um novo servidor MCP para integração com assistentes.</DialogDescription></DialogHeader>
          <CreateFormFields />
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={() => { void handleCreate(); }} disabled={!formData.name || createMcpServerMutation.isPending}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog - Full featured with tabs */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />Editar Servidor MCP
            </DialogTitle>
            <DialogDescription>Configure todas as propriedades de "{selected?.name}".</DialogDescription>
          </DialogHeader>
          <EditFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => { void handleEdit(); }} disabled={!formData.name || updateMcpServerMutation.isPending}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Arquivar Servidor MCP</DialogTitle>
            <DialogDescription>Tem certeza que deseja arquivar "{selected?.name}"? Bindings e políticas ficam preservados para auditoria.</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={() => { void handleDelete(); }} disabled={archiveMcpServerMutation.isPending}>Arquivar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
