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
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMcpServers, useMcpTools, useMcpBindings } from '@/hooks/queries/useMcp';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { useAssistants } from '@/hooks/queries/useAssistants';
import {
  Plus, Server, Wrench, Shield, Search, MoreHorizontal, Eye, Pencil, Trash2,
  Copy, RefreshCw, Filter, X, AlertTriangle, Zap, Link2, LayoutGrid, List, Power, PowerOff,
  Globe, Settings, Key, RotateCcw
} from 'lucide-react';
import type { McpServer, McpServerStatus, RiskLevel } from '@/types';
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
  apiKey: string;
  rotateCredentials: boolean;
  healthCheckEnabled: boolean;
  healthCheckInterval: string;
  toolApprovals: Record<string, boolean>;
  selectedAssistants: string[];
}

const defaultForm: ServerFormData = {
  name: '', description: '', url: '', authType: 'API Key', riskLevel: 'low',
  version: '1.0.0', owner: '', status: 'inactive',
  apiKey: '', rotateCredentials: false,
  healthCheckEnabled: true, healthCheckInterval: '60',
  toolApprovals: {}, selectedAssistants: [],
};

export default function McpHubPage() {
  const serversQuery = useMcpServers();
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

  const handleCreate = () => {
    const newServer: McpServer = {
      id: String(Date.now()), name: formData.name, description: formData.description, status: 'inactive',
      authType: formData.authType, riskLevel: formData.riskLevel, toolCount: 0, resourceCount: 0, promptCount: 0,
      bindings: 0, lastSync: '', url: formData.url, owner: formData.owner || 'Usuário Atual',
      createdAt: new Date().toISOString().split('T')[0], version: formData.version || '1.0.0',
    };
    setServers(prev => [newServer, ...prev]);
    setCreateOpen(false);
    setFormData(defaultForm);
    toast({ title: 'Servidor registrado', description: `"${newServer.name}" foi adicionado ao catálogo.` });
  };

  const handleEdit = () => {
    if (!selected) return;
    setServers(prev => prev.map(s => s.id === selected.id ? {
      ...s, name: formData.name, description: formData.description, url: formData.url,
      authType: formData.authType, riskLevel: formData.riskLevel, version: formData.version,
      owner: formData.owner, status: formData.status,
    } : s));
    setEditOpen(false);
    toast({ title: 'Servidor atualizado', description: 'Todas as configurações foram salvas.' });
  };

  const handleDelete = () => {
    if (!selected) return;
    setServers(prev => prev.filter(s => s.id !== selected.id));
    setDeleteOpen(false);
    toast({ title: 'Servidor removido', description: `"${selected.name}" foi removido.`, variant: 'destructive' });
    setSelected(null);
  };

  const handleToggleStatus = (server: McpServer) => {
    const newStatus: McpServerStatus = server.status === 'active' ? 'inactive' : 'active';
    setServers(prev => prev.map(s => s.id === server.id ? { ...s, status: newStatus } : s));
    toast({ title: newStatus === 'active' ? 'Servidor ativado' : 'Servidor desativado' });
  };

  const handleSync = (server: McpServer) => {
    setServers(prev => prev.map(s => s.id === server.id ? { ...s, lastSync: new Date().toISOString() } : s));
    toast({ title: 'Sincronização iniciada', description: `"${server.name}" está sendo sincronizado.` });
  };

  const handleDuplicate = (server: McpServer) => {
    const dup: McpServer = { ...server, id: String(Date.now()), name: `${server.name} (cópia)`, status: 'inactive', bindings: 0, createdAt: new Date().toISOString().split('T')[0] };
    setServers(prev => [dup, ...prev]);
    toast({ title: 'Servidor duplicado', description: `"${dup.name}" foi criado.` });
  };

  const handleRotateCredentials = () => {
    toast({ title: 'Credenciais rotacionadas', description: `Novas credenciais geradas para "${selected?.name}".` });
  };

  const handleHealthCheck = () => {
    toast({ title: 'Health check executado', description: `"${selected?.name}" respondeu com sucesso (200 OK, 45ms).` });
  };

  const openEdit = (s: McpServer) => {
    const sTools = mockMcpTools.filter(t => t.serverId === s.id);
    const sBindings = mockMcpBindings.filter(b => b.serverId === s.id);
    setSelected(s);
    setFormData({
      name: s.name, description: s.description, url: s.url, authType: s.authType,
      riskLevel: s.riskLevel, version: s.version, owner: s.owner, status: s.status,
      apiKey: '••••••••••••••••', rotateCredentials: false,
      healthCheckEnabled: true, healthCheckInterval: '60',
      toolApprovals: Object.fromEntries(sTools.map(t => [t.id, t.requiresApproval])),
      selectedAssistants: sBindings.map(b => b.assistantId),
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
              <SelectItem value="inactive">Inativo</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
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
          <Label>Credencial</Label>
          <div className="flex gap-2">
            <Input value={formData.apiKey} onChange={e => setFormData(p => ({ ...p, apiKey: e.target.value }))} type="password" className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleRotateCredentials} className="shrink-0">
              <RotateCcw className="h-3.5 w-3.5 mr-1" />Rotacionar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Rotacione as credenciais periodicamente para maior segurança.</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Health Check</p>
              <p className="text-[11px] text-muted-foreground">Verificação periódica de conectividade</p>
            </div>
            <Switch checked={formData.healthCheckEnabled} onCheckedChange={v => setFormData(p => ({ ...p, healthCheckEnabled: v }))} />
          </div>
          {formData.healthCheckEnabled && (
            <div className="space-y-2">
              <Label className="text-xs">Intervalo (segundos)</Label>
              <Select value={formData.healthCheckInterval} onValueChange={v => setFormData(p => ({ ...p, healthCheckInterval: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30s</SelectItem>
                  <SelectItem value="60">60s</SelectItem>
                  <SelectItem value="300">5min</SelectItem>
                  <SelectItem value="900">15min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleHealthCheck}>
            <Zap className="h-3.5 w-3.5 mr-1" />Testar Agora
          </Button>
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
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2"><Key className="h-3.5 w-3.5" />Políticas de Credenciais</h4>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Rotação automática</p>
              <p className="text-[11px] text-muted-foreground">Rotacionar credenciais automaticamente a cada 90 dias</p>
            </div>
            <Switch checked={formData.rotateCredentials} onCheckedChange={v => setFormData(p => ({ ...p, rotateCredentials: v }))} />
          </div>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="flex gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Zona de Perigo</p>
              <p className="text-xs text-muted-foreground mt-1">Revogar todas as credenciais ativas forçará a reconexão de todos os assistentes vinculados.</p>
              <Button variant="destructive" size="sm" className="mt-2" onClick={() => toast({ title: 'Credenciais revogadas', description: 'Todas as sessões ativas foram encerradas.', variant: 'destructive' })}>
                Revogar Todas as Credenciais
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="tools" className="space-y-4 mt-4">
        <p className="text-xs text-muted-foreground">Gerencie as políticas de aprovação para cada ferramenta deste servidor.</p>
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
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-[10px] text-muted-foreground">{formData.toolApprovals[tool.id] ? 'Aprovação manual' : 'Auto'}</span>
                  <Switch
                    checked={formData.toolApprovals[tool.id] ?? false}
                    onCheckedChange={v => setFormData(p => ({ ...p, toolApprovals: { ...p.toolApprovals, [tool.id]: v } }))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => {
            const all = Object.fromEntries(serverToolsForEdit.map(t => [t.id, true]));
            setFormData(p => ({ ...p, toolApprovals: all }));
          }}>Habilitar Todas</Button>
          <Button variant="outline" size="sm" onClick={() => {
            const none = Object.fromEntries(serverToolsForEdit.map(t => [t.id, false]));
            setFormData(p => ({ ...p, toolApprovals: none }));
          }}>Desabilitar Todas</Button>
        </div>
      </TabsContent>

      <TabsContent value="bindings" className="space-y-4 mt-4">
        <p className="text-xs text-muted-foreground">Selecione os assistentes que podem utilizar este servidor MCP.</p>
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {mockAssistants.filter(a => a.status !== 'archived').map(assistant => (
            <label key={assistant.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <Checkbox
                checked={formData.selectedAssistants.includes(assistant.id)}
                onCheckedChange={checked => {
                  setFormData(p => ({
                    ...p,
                    selectedAssistants: checked
                      ? [...p.selectedAssistants, assistant.id]
                      : p.selectedAssistants.filter(id => id !== assistant.id),
                  }));
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{assistant.name}</span>
                  <StatusBadge status={assistant.status} />
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{assistant.area} · {assistant.owner}</p>
              </div>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{formData.selectedAssistants.length} assistente(s) vinculado(s)</p>
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
        <DropdownMenuItem onClick={() => openEdit(server)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSync(server)}><RefreshCw className="h-4 w-4 mr-2" />Sincronizar</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleToggleStatus(server)}>
          {server.status === 'active' ? <><PowerOff className="h-4 w-4 mr-2" />Desativar</> : <><Power className="h-4 w-4 mr-2" />Ativar</>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDuplicate(server)}><Copy className="h-4 w-4 mr-2" />Duplicar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openDelete(server)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="MCP Hub" description="Gestão centralizada de servidores MCP, ferramentas e permissões">
          <Button onClick={() => { setFormData(defaultForm); setCreateOpen(true); }}><Plus className="h-4 w-4 mr-1" />Registrar Servidor</Button>
        </PageHeader>

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
                <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Ativo</SelectItem><SelectItem value="inactive">Inativo</SelectItem><SelectItem value="error">Erro</SelectItem></SelectContent>
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
          emptyDescription="Registre um servidor MCP para disponibilizar ferramentas governadas aos assistentes."
          emptyAction={
            <Button onClick={() => { setFormData(defaultForm); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Registrar servidor
            </Button>
          }
          errorTitle="Não foi possível carregar os servidores MCP"
          errorDescription="Tente novamente em instantes."
        >
        {filtered.length === 0 ? (
          <EmptyState icon={<Server className="h-6 w-6" />} title="Nenhum servidor encontrado para os filtros" description="Ajuste os filtros ou registre um novo servidor." action={<Button onClick={() => { setFormData(defaultForm); setCreateOpen(true); }}><Plus className="h-4 w-4 mr-1" />Registrar</Button>} />
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
                  <TableHead>Último Sync</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(server => (
                  <TableRow key={server.id} className="cursor-pointer" onClick={() => navigate(`/app/mcp/${server.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning"><Server className="h-4 w-4" /></div>
                        <div><p className="font-medium">{server.name}</p><p className="text-xs text-muted-foreground truncate max-w-[200px]">{server.description}</p></div>
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
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={handleCreate} disabled={!formData.name || !formData.url}>Registrar</Button></DialogFooter>
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
            <Button onClick={handleEdit} disabled={!formData.name}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir Servidor MCP</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir "{selected?.name}"? Todos os bindings e permissões associados serão removidos.</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={handleDelete}>Excluir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
