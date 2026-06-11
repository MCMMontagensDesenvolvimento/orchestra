import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shared/AppShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMcpServers, useMcpTools, useMcpResources, useMcpPrompts, useMcpBindings, useMcpExecutions } from '@/hooks/queries/useMcp';
import {
  ArrowLeft, Server, Wrench, FileCode, MessageSquare, Link2, Shield, Clock, Globe,
  RefreshCw, Power, PowerOff, Settings, AlertTriangle, CheckCircle2, XCircle, Loader2,
  MoreHorizontal, Search, Zap, Users, Lock, ExternalLink, Copy
} from 'lucide-react';
import type { RiskLevel, McpBinding } from '@/types';
import { toast } from '@/hooks/use-toast';

const riskColors: Record<RiskLevel, string> = {
  low: 'bg-success/10 text-success border-success/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  critical: 'bg-destructive text-destructive-foreground border-destructive',
};

const logStatusIcon: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  error: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  pending_approval: <Loader2 className="h-3.5 w-3.5 text-warning animate-spin" />,
  rejected: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />,
};

const logStatusLabel: Record<string, string> = {
  success: 'Sucesso', error: 'Erro', pending_approval: 'Aguardando', rejected: 'Rejeitado',
};

export default function McpDetailPage() {
  const serversQuery = useMcpServers();
  const mockMcpServers = serversQuery.data ?? [];
  const { data: mockMcpTools = [] } = useMcpTools();
  const { data: mockMcpResources = [] } = useMcpResources();
  const { data: mockMcpPrompts = [] } = useMcpPrompts();
  const { data: mockMcpBindings = [] } = useMcpBindings();
  const { data: mockToolExecutionLogs = [] } = useMcpExecutions();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const server = mockMcpServers.find(s => s.id === id);

  const tools = useMemo(() => mockMcpTools.filter(t => t.serverId === id), [mockMcpTools, id]);
  const resources = useMemo(() => mockMcpResources.filter(r => r.serverId === id), [mockMcpResources, id]);
  const prompts = useMemo(() => mockMcpPrompts.filter(p => p.serverId === id), [mockMcpPrompts, id]);
  const bindings = useMemo(() => mockMcpBindings.filter(b => b.serverId === id), [mockMcpBindings, id]);
  const logs = useMemo(() => mockToolExecutionLogs.filter(l => l.serverId === id), [mockToolExecutionLogs, id]);

  const [toolSearch, setToolSearch] = useState('');
  const [approvalStates, setApprovalStates] = useState<Record<string, boolean>>(
    Object.fromEntries(tools.map(t => [t.id, t.requiresApproval]))
  );
  const [bindingDialog, setBindingDialog] = useState(false);

  const filteredTools = useMemo(() => {
    return tools.filter(t => !toolSearch || t.name.toLowerCase().includes(toolSearch.toLowerCase()) || t.description.toLowerCase().includes(toolSearch.toLowerCase()));
  }, [tools, toolSearch]);

  if (serversQuery.isLoading) {
    return <AppShell><div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Carregando servidor MCP…</div></AppShell>;
  }
  if (serversQuery.isError) {
    return <AppShell><EmptyState icon={<Server className="h-6 w-6" />} title="Não foi possível carregar o servidor" description="Tente novamente em instantes." action={<Button onClick={() => serversQuery.refetch()}>Tentar novamente</Button>} /></AppShell>;
  }
  if (!server) {
    return <AppShell><EmptyState icon={<Server className="h-6 w-6" />} title="Servidor não encontrado" description="O servidor MCP solicitado não existe." action={<Button onClick={() => navigate('/app/mcp')}>Voltar</Button>} /></AppShell>;
  }

  const toggleApproval = (toolId: string) => {
    setApprovalStates(prev => ({ ...prev, [toolId]: !prev[toolId] }));
    const tool = tools.find(t => t.id === toolId);
    toast({ title: 'Política atualizada', description: `Aprovação ${!approvalStates[toolId] ? 'habilitada' : 'removida'} para "${tool?.name}".` });
  };

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/mcp')} className="mb-3"><ArrowLeft className="h-4 w-4 mr-1" />MCP Hub</Button>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning"><Server className="h-6 w-6" /></div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{server.name}</h1>
                  <StatusBadge status={server.status} />
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskColors[server.riskLevel]}`}>
                    <Shield className="h-2.5 w-2.5 mr-0.5" />{server.riskLevel} risk
                  </span>
                  <Badge variant="outline" className="text-[10px]">v{server.version}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{server.description}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                toast({ title: 'Sincronização iniciada', description: `"${server.name}" está sendo sincronizado.` });
              }}><RefreshCw className="h-4 w-4 mr-1" />Sincronizar</Button>
              <Button variant="outline" size="sm" onClick={() => {
                toast({ title: server.status === 'active' ? 'Servidor desativado' : 'Servidor ativado' });
              }}>
                {server.status === 'active' ? <><PowerOff className="h-4 w-4 mr-1" />Desativar</> : <><Power className="h-4 w-4 mr-1" />Ativar</>}
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { icon: Wrench, label: 'Tools', value: tools.length },
            { icon: FileCode, label: 'Resources', value: resources.length },
            { icon: MessageSquare, label: 'Prompts', value: prompts.length },
            { icon: Link2, label: 'Bindings', value: bindings.length },
            { icon: Zap, label: 'Execuções', value: logs.length },
            { icon: Clock, label: 'Último Sync', value: server.lastSync ? new Date(server.lastSync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' },
          ].map((kpi, i) => (
            <div key={i} className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1"><kpi.icon className="h-3.5 w-3.5" /><span className="text-[11px]">{kpi.label}</span></div>
              <p className="text-lg font-bold">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tools" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tools">Tools ({tools.length})</TabsTrigger>
            <TabsTrigger value="resources">Resources ({resources.length})</TabsTrigger>
            <TabsTrigger value="prompts">Prompts ({prompts.length})</TabsTrigger>
            <TabsTrigger value="bindings">Bindings ({bindings.length})</TabsTrigger>
            <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
            <TabsTrigger value="config">Configuração</TabsTrigger>
          </TabsList>

          {/* Tools Tab */}
          <TabsContent value="tools" className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 max-w-sm">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="text" value={toolSearch} onChange={e => setToolSearch(e.target.value)} placeholder="Buscar tools..." className="bg-transparent text-sm outline-none w-full" />
            </div>
            {filteredTools.length === 0 ? (
              <EmptyState icon={<Wrench className="h-6 w-6" />} title="Nenhuma tool" description="Este servidor não possui tools registradas." />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tool</TableHead>
                      <TableHead>Risco</TableHead>
                      <TableHead>Aprovação</TableHead>
                      <TableHead className="text-center">Execuções</TableHead>
                      <TableHead>Input Schema</TableHead>
                      <TableHead>Última Execução</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTools.map(tool => (
                      <TableRow key={tool.id}>
                        <TableCell>
                          <div><p className="font-mono text-xs font-semibold">{tool.name}</p><p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p></div>
                        </TableCell>
                        <TableCell><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskColors[tool.riskLevel]}`}>{tool.riskLevel}</span></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={approvalStates[tool.id] ?? false} onCheckedChange={() => toggleApproval(tool.id)} />
                            <span className="text-xs text-muted-foreground">{approvalStates[tool.id] ? 'Sim' : 'Não'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">{tool.executionCount.toLocaleString()}</TableCell>
                        <TableCell><code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{tool.inputSchema || '—'}</code></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tool.lastExecuted ? new Date(tool.lastExecuted).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4">
            {resources.length === 0 ? (
              <EmptyState icon={<FileCode className="h-6 w-6" />} title="Nenhum resource" description="Este servidor não possui resources registrados." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {resources.map(res => (
                  <div key={res.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-sm font-semibold">{res.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{res.description}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{res.mimeType}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{res.uri}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Prompts Tab */}
          <TabsContent value="prompts" className="space-y-4">
            {prompts.length === 0 ? (
              <EmptyState icon={<MessageSquare className="h-6 w-6" />} title="Nenhum prompt" description="Este servidor não possui prompts registrados." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {prompts.map(prompt => (
                  <div key={prompt.id} className="rounded-lg border bg-card p-4">
                    <p className="font-mono text-sm font-semibold">{prompt.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{prompt.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {prompt.arguments.map(arg => (
                        <Badge key={arg} variant="secondary" className="text-[10px]">{arg}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Bindings Tab */}
          <TabsContent value="bindings" className="space-y-4">
            {bindings.length === 0 ? (
              <EmptyState icon={<Link2 className="h-6 w-6" />} title="Nenhum binding" description="Nenhum assistente está vinculado a este servidor." action={<Button variant="outline" onClick={() => navigate('/app/assistants')}>Ver Assistentes</Button>} />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assistente</TableHead>
                      <TableHead>Tools Habilitadas</TableHead>
                      <TableHead>Resources</TableHead>
                      <TableHead>Política de Aprovação</TableHead>
                      <TableHead>Vinculado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bindings.map(binding => (
                      <TableRow key={binding.id} className="cursor-pointer" onClick={() => navigate(`/app/assistants/${binding.assistantId}`)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="font-medium">{binding.assistantName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {binding.toolsEnabled.map(t => (
                              <code key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t}</code>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {binding.resourcesEnabled.length > 0 ? binding.resourcesEnabled.map(r => (
                              <code key={r} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{r}</code>
                            )) : <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={binding.approvalPolicy === 'manual' ? 'default' : 'secondary'} className="text-[10px]">
                            {binding.approvalPolicy === 'manual' ? '🔒 Manual' : binding.approvalPolicy === 'auto' ? '⚡ Auto' : '— Nenhuma'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{binding.createdAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            {logs.length === 0 ? (
              <EmptyState icon={<Zap className="h-6 w-6" />} title="Nenhum log" description="Nenhuma execução de ferramenta registrada." />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tool</TableHead>
                      <TableHead>Assistente</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Input</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell><code className="text-xs font-semibold">{log.toolName}</code></TableCell>
                        <TableCell className="text-xs">{log.assistantName}</TableCell>
                        <TableCell className="text-xs">{log.user}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {logStatusIcon[log.status]}
                            <span className="text-xs">{logStatusLabel[log.status]}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{log.duration > 0 ? `${log.duration}s` : '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</TableCell>
                        <TableCell>{log.input ? <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded truncate max-w-[150px] block">{log.input}</code> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Settings className="h-4 w-4" />Conexão</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">URL</span><code className="text-xs bg-muted px-2 py-0.5 rounded">{server.url}</code></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Autenticação</span><span className="font-medium">{server.authType}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Versão</span><span className="font-medium">v{server.version}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Último Sync</span><span className="font-medium">{server.lastSync ? new Date(server.lastSync).toLocaleString('pt-BR') : '—'}</span></div>
                </div>
              </div>
              <div className="rounded-lg border bg-card p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4" />Governança</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Nível de Risco</span><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${riskColors[server.riskLevel]}`}>{server.riskLevel}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Owner</span><span className="font-medium">{server.owner}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Criação</span><span className="font-medium">{server.createdAt}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tools com aprovação</span><span className="font-medium">{tools.filter(t => t.requiresApproval).length} de {tools.length}</span></div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
