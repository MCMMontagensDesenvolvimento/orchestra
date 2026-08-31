import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shared/AppShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  useCreateMcpToolMutation,
  useMcpBindings,
  useMcpExecutions,
  useMcpPrompts,
  useMcpResources,
  useMcpServer,
  useMcpTools,
  useUpdateMcpToolMutation,
} from '@/hooks/queries/useMcp';
import { useCurrentSession } from '@/hooks/queries/useAuth';
import {
  ArrowLeft, Server, Wrench, FileCode, MessageSquare, Link2, Shield, Clock, Globe,
  Settings, AlertTriangle, CheckCircle2, XCircle, Loader2,
  MoreHorizontal, Search, Zap, Users, Lock, ExternalLink, Copy, Plus
} from 'lucide-react';
import type { RiskLevel } from '@/types';
import { mcpService } from '@/services/mcp.service';
import type {
  McpLocalDemoPrecheckResult,
  McpRemoteCatalogEntry,
  McpRemoteDiscoveryResult,
  McpRemoteImportApplyResult,
  McpRemoteImportPlanResult,
  McpRemoteReadinessResult,
  McpToolPayload,
} from '@/services/mcp.service';
import {
  buildMcpRemoteManualApplyPayload,
  isMcpRemoteManualApplyReady,
} from './mcpRemoteApproval';
import {
  isMcpRemoteCatalogEntryMaterializable,
  remoteMaterializationSummary,
} from './mcpRemoteMaterialization';
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

const defaultToolForm = {
  name: '',
  description: '',
  riskLevel: 'medium' as RiskLevel,
  inputSchema: '{\n  "type": "object",\n  "properties": {}\n}',
  outputSchema: '{\n  "type": "object",\n  "properties": {}\n}',
  requiresApproval: false,
};

function parseJsonObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value || '{}') as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} deve ser um objeto JSON.`);
  }
  return parsed as Record<string, unknown>;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function riskLevelLabel(riskLevel: RiskLevel) {
  const labels: Record<RiskLevel, string> = {
    low: 'Baixo',
    medium: 'Médio',
    high: 'Alto',
    critical: 'Crítico',
  };

  return labels[riskLevel];
}

function authTypeLabel(authType: string) {
  if (authType === 'api_key') return 'API Key';
  if (authType === 'bearer') return 'Bearer Token';
  if (authType === 'oauth') return 'OAuth 2.0';
  if (authType === 'mTLS') return 'mTLS';
  if (authType === 'none') return 'Sem autenticação';
  return authType || 'Não informado';
}

function serverTypeLabel(serverType: string | null | undefined) {
  if (serverType === 'local') return 'Local';
  if (serverType === 'remote') return 'Remoto';
  if (serverType === 'external') return 'Externo';
  if (serverType === 'internal') return 'Interno';
  return serverType || 'Não informado';
}

function bindingModeLabel(mode: string | null | undefined) {
  if (mode === 'disabled') return 'Desabilitado';
  if (mode === 'sandbox_only') return 'Somente sandbox';
  if (mode === 'enabled_placeholder') return 'Preparado (placeholder)';
  return mode || 'Não informado';
}

function formatDatePtBr(value: string | null | undefined) {
  if (!value) return '—';

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('pt-BR');
}

function remotePlanStatusLabel(status: string) {
  if (status === 'pending_approval') return 'Aguardando aprovação';
  if (status === 'ready_for_manual_apply') return 'Pronto para aprovação manual';
  if (status === 'no_changes') return 'Sem alterações';
  if (status === 'blocked') return 'Bloqueado';
  return status;
}

function remoteOperationLabel(type: string) {
  if (type === 'create_tool_draft') return 'Incluir no catálogo';
  if (type === 'update_tool_draft') return 'Atualizar catálogo';
  if (type === 'deprecate_tool_draft') return 'Descontinuar do catálogo';
  if (type === 'noop') return 'Sem alteração';
  return type;
}

function formatDateTimePtBr(value: string | null | undefined) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function McpDetailPage() {
  const { id } = useParams<{ id: string }>();
  const serverQuery = useMcpServer(id);
  const { data: currentSession } = useCurrentSession();
  const toolsQuery = useMcpTools(id);
  const { data: mockMcpTools = [] } = toolsQuery;
  const { data: mockMcpResources = [] } = useMcpResources(id);
  const { data: mockMcpPrompts = [] } = useMcpPrompts(id);
  const { data: mockMcpBindings = [] } = useMcpBindings();
  const { data: mockToolExecutionLogs = [] } = useMcpExecutions();
  const createMcpToolMutation = useCreateMcpToolMutation();
  const updateMcpToolMutation = useUpdateMcpToolMutation();
  const navigate = useNavigate();
  const server = serverQuery.data;
  const currentUser = currentSession?.user;
  const currentUserPermissions =
    (currentUser as { permissions?: string[] } | undefined)?.permissions ?? [];
  const canManageMcp = currentUserPermissions.includes('mcp.manage');

  const tools = useMemo(() => mockMcpTools.filter(t => t.serverId === id), [mockMcpTools, id]);
  const resources = useMemo(() => mockMcpResources.filter(r => r.serverId === id), [mockMcpResources, id]);
  const prompts = useMemo(() => mockMcpPrompts.filter(p => p.serverId === id), [mockMcpPrompts, id]);
  const bindings = useMemo(() => mockMcpBindings.filter(b => b.serverId === id), [mockMcpBindings, id]);
  const logs = useMemo(() => mockToolExecutionLogs.filter(l => l.serverId === id), [mockToolExecutionLogs, id]);

  const [toolSearch, setToolSearch] = useState('');
  const [approvalStates, setApprovalStates] = useState<Record<string, boolean>>(
    Object.fromEntries(tools.map(t => [t.id, t.requiresApproval]))
  );
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [toolForm, setToolForm] = useState(defaultToolForm);
  const [remoteReadiness, setRemoteReadiness] = useState<McpRemoteReadinessResult | null>(null);
  const [remoteDiscovery, setRemoteDiscovery] = useState<McpRemoteDiscoveryResult | null>(null);
  const [remoteImportPlan, setRemoteImportPlan] = useState<McpRemoteImportPlanResult | null>(null);
  const [remoteApplyResult, setRemoteApplyResult] = useState<McpRemoteImportApplyResult | null>(null);
  const [remoteCatalogEntries, setRemoteCatalogEntries] = useState<McpRemoteCatalogEntry[]>([]);
  const [remoteCatalogLoading, setRemoteCatalogLoading] = useState(false);
  const [remoteCatalogError, setRemoteCatalogError] = useState<string | null>(null);
  const [materializationDialogOpen, setMaterializationDialogOpen] = useState(false);
  const [materializationEntry, setMaterializationEntry] = useState<McpRemoteCatalogEntry | null>(null);
  const [materializationConfirmed, setMaterializationConfirmed] = useState(false);
  const [materializationPending, setMaterializationPending] = useState(false);
  const [manualApplyDialogOpen, setManualApplyDialogOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const [manualApplyConfirmed, setManualApplyConfirmed] = useState(false);
  const [localPrecheck, setLocalPrecheck] = useState<McpLocalDemoPrecheckResult | null>(null);
  const [remoteCheckPending, setRemoteCheckPending] = useState<
    'readiness' | 'discovery' | 'plan' | 'apply' | 'local_precheck' | null
  >(null);

  useEffect(() => {
    setApprovalStates(Object.fromEntries(tools.map(t => [t.id, t.requiresApproval])));
  }, [tools]);

  useEffect(() => {
    let cancelled = false;

    const remoteServer =
      server?.serverType === 'remote'
      || server?.serverType === 'external';

    if (!id || !remoteServer || !currentUser || !canManageMcp) {
      setRemoteCatalogEntries([]);
      setRemoteCatalogLoading(false);
      setRemoteCatalogError(null);
      return undefined;
    }

    setRemoteCatalogLoading(true);
    setRemoteCatalogError(null);

    void mcpService.remoteCatalogEntries(id)
      .then((entries) => {
        if (!cancelled) {
          setRemoteCatalogEntries(entries);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRemoteCatalogEntries([]);
          setRemoteCatalogError(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o catálogo governado.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRemoteCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    id,
    server?.serverType,
    currentUser,
    canManageMcp,
  ]);

  const filteredTools = useMemo(() => {
    return tools.filter(t => !toolSearch || t.name.toLowerCase().includes(toolSearch.toLowerCase()) || t.description.toLowerCase().includes(toolSearch.toLowerCase()));
  }, [tools, toolSearch]);

  if (serverQuery.isLoading) {
    return <AppShell><div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Carregando servidor MCP…</div></AppShell>;
  }
  if (serverQuery.isError) {
    return <AppShell><EmptyState icon={<Server className="h-6 w-6" />} title="Não foi possível carregar o servidor" description="Tente novamente em instantes." action={<Button onClick={() => serverQuery.refetch()}>Tentar novamente</Button>} /></AppShell>;
  }
  if (!server) {
    return <AppShell><EmptyState icon={<Server className="h-6 w-6" />} title="Servidor não encontrado" description="O servidor MCP solicitado não existe." action={<Button onClick={() => navigate('/app/mcp')}>Voltar</Button>} /></AppShell>;
  }

  const isRemoteServer = server.serverType === 'remote' || server.serverType === 'external';
  const serverMetadata = metadataRecord(server.metadata);
  const isLocalDemo = server.serverType === 'local' && serverMetadata.localDemo === true && serverMetadata.phase === '18D';

  const materializationSummary = !canManageMcp
    ? 'Não verificada'
    : remoteCatalogLoading
      ? 'Carregando…'
      : remoteCatalogError
        ? 'Indisponível'
        : remoteMaterializationSummary(remoteCatalogEntries);

  const refreshRemoteCatalog = async () => {
    if (!id || !isRemoteServer || !canManageMcp) return;

    try {
      setRemoteCatalogError(null);

      const entries = await mcpService.remoteCatalogEntries(id);
      setRemoteCatalogEntries(entries);
    } catch (error) {
      setRemoteCatalogError(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o catálogo governado.',
      );
    }
  };

  const openMaterializationDialog = (
    entry: McpRemoteCatalogEntry,
  ) => {
    if (!isMcpRemoteCatalogEntryMaterializable(entry)) {
      toast({
        title: 'Materialização não disponível',
        description:
          'A entrada não atende aos gates governados de materialização.',
        variant: 'destructive',
      });
      return;
    }

    setMaterializationEntry(entry);
    setMaterializationConfirmed(false);
    setMaterializationDialogOpen(true);
  };

  const materializeRemoteCatalogEntry = async () => {
    if (
      !materializationEntry
      || !currentUser
      || !canManageMcp
    ) {
      return;
    }

    if (
      !isMcpRemoteCatalogEntryMaterializable(
        materializationEntry,
      )
    ) {
      toast({
        title: 'Materialização bloqueada',
        description:
          'O catálogo mudou e a entrada não atende mais aos gates governados.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setMaterializationPending(true);

      const result =
        await mcpService.materializeRemoteCatalogEntry(
          materializationEntry.id,
        );

      setMaterializationDialogOpen(false);
      setMaterializationConfirmed(false);
      setMaterializationEntry(null);

      await Promise.all([
        refreshRemoteCatalog(),
        toolsQuery.refetch(),
        serverQuery.refetch(),
      ]);

      toast({
        title:
          result.status === 'materialized'
            ? 'Ferramenta materializada'
            : 'Ferramenta já materializada',
        description:
          `${result.mcpTool.displayName} foi registrada como McpTool desabilitada. Runtime e execução remota permanecem bloqueados.`,
      });
    } catch (error) {
      toast({
        title: 'Materialização não concluída',
        description:
          error instanceof Error
            ? error.message
            : 'A governança bloqueou ou não concluiu a materialização.',
        variant: 'destructive',
      });
    } finally {
      setMaterializationPending(false);
    }
  };

  const checkLocalDemo = async () => {
    if (!id) return;
    setRemoteCheckPending('local_precheck');
    try {
      const result = await mcpService.localDemoPrecheck(id);
      setLocalPrecheck(result);
      toast({ title: 'Precheck local concluído', description: result.reason });
    } catch (error) {
      toast({ title: 'Precheck local indisponível', description: error instanceof Error ? error.message : 'Falha local sanitizada.', variant: 'destructive' });
    } finally {
      setRemoteCheckPending(null);
    }
  };

  const checkRemoteReadiness = async () => {
    if (!id) return;
    setRemoteCheckPending('readiness');
    try {
      const result = await mcpService.remoteReadiness(id);
      setRemoteReadiness(result);
      toast({
        title: result.status === 'ready' ? 'MCP remoto somente leitura disponível' : 'MCP remoto bloqueado',
        description: result.reason,
        variant: result.status === 'ready' ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({ title: 'Readiness indisponível', description: error instanceof Error ? error.message : 'Falha sanitizada no transporte.', variant: 'destructive' });
    } finally {
      setRemoteCheckPending(null);
    }
  };

  const discoverRemoteCatalog = async () => {
    if (!id) return;
    setRemoteCheckPending('discovery');
    try {
      const result = await mcpService.remoteDiscovery(id);
      setRemoteDiscovery(result);
      setRemoteReadiness(result.readiness);
      toast({
        title: result.status === 'completed' ? 'Catálogo somente leitura consultado' : 'Descoberta bloqueada',
        description: result.status === 'completed'
          ? `${result.tools.length} ferramentas somente leitura encontradas.`
          : result.warnings[0]?.message ?? 'O boundary permaneceu fail-closed.',
        variant: result.status === 'completed' ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({ title: 'Descoberta indisponível', description: error instanceof Error ? error.message : 'Falha sanitizada no transporte.', variant: 'destructive' });
    } finally {
      setRemoteCheckPending(null);
    }
  };

  const prepareRemoteImportPlan = async () => {
    if (!id) return;

    setRemoteCheckPending('plan');

    try {
      const result = await mcpService.remoteImportPlan(id);

      setRemoteImportPlan(result);
      setRemoteApplyResult(null);

      toast({
        title: result.plan.status === 'pending_approval'
          ? 'Plano governado aguardando aprovação'
          : result.plan.status === 'no_changes'
            ? 'Catálogo remoto sem alterações'
            : 'Plano governado preparado',
        description: result.plan.status === 'pending_approval'
          ? `${result.plan.operations.length} operação(ões) requerem revisão manual.`
          : result.plan.status === 'no_changes'
            ? 'Nenhuma alteração aplicável foi identificada no catálogo remoto.'
            : `${result.plan.operations.length} operação(ões) no plano atual.`,
      });
    } catch (error) {
      toast({
        title: 'Não foi possível preparar o Import Plan',
        description: error instanceof Error
          ? error.message
          : 'Falha sanitizada ao preparar o plano governado.',
        variant: 'destructive',
      });
    } finally {
      setRemoteCheckPending(null);
    }
  };

  const openManualApplyDialog = () => {
    const plan = remoteImportPlan?.plan;

    if (!isMcpRemoteManualApplyReady(plan)) {
      toast({
        title: 'Plano não disponível para aprovação',
        description:
          'O plano atual não atende aos gates governados de Manual Apply.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentUser) {
      toast({
        title: 'Identidade da sessão indisponível',
        description:
          'Recarregue a sessão antes de registrar uma aprovação manual.',
        variant: 'destructive',
      });
      return;
    }

    setApprovalReason('');
    setManualApplyConfirmed(false);
    setManualApplyDialogOpen(true);
  };

  const applyRemoteImportPlan = async () => {
    if (!id || !remoteImportPlan) return;

    try {
      const payload = buildMcpRemoteManualApplyPayload(
        remoteImportPlan.plan,
        approvalReason,
      );

      setRemoteCheckPending('apply');

      const result = await mcpService.remoteImportApply(id, payload);

      setRemoteApplyResult(result);
      setManualApplyDialogOpen(false);
      setManualApplyConfirmed(false);
      setApprovalReason('');

      toast({
        title: result.status === 'applied'
          ? 'Aprovado para o catálogo governado'
          : 'Manual Apply concluído',
        description: result.status === 'applied'
          ? 'A aprovação foi registrada sem habilitar runtime ou execução remota.'
          : `Resultado do Manual Apply: ${result.status}.`,
        variant: result.status === 'blocked' ? 'destructive' : 'default',
      });
    } catch (error) {
      toast({
        title: 'Manual Apply não concluído',
        description: error instanceof Error
          ? error.message
          : 'A governança bloqueou ou não concluiu a aprovação.',
        variant: 'destructive',
      });
    } finally {
      setRemoteCheckPending(null);
    }
  };

  const toggleApproval = async (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;
    const nextRequiresApproval = !(approvalStates[toolId] ?? tool.requiresApproval);
    try {
      await updateMcpToolMutation.mutateAsync({
        toolId,
        serverId: id,
        payload: { requiresApproval: nextRequiresApproval },
      });
      setApprovalStates(prev => ({ ...prev, [toolId]: nextRequiresApproval }));
      toast({ title: 'Política atualizada', description: `Aprovação ${nextRequiresApproval ? 'habilitada' : 'removida'} para "${tool.name}".` });
    } catch (error) {
      toast({ title: 'Erro ao atualizar política', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
  };

  const handleCreateTool = async () => {
    if (!id) return;
    try {
      const payload: McpToolPayload = {
        name: toolForm.name.trim(),
        description: toolForm.description.trim() || undefined,
        riskLevel: toolForm.riskLevel,
        inputSchema: parseJsonObject(toolForm.inputSchema, 'Schema de entrada'),
        outputSchema: parseJsonObject(toolForm.outputSchema, 'Schema de saída'),
        requiresApproval: toolForm.requiresApproval || toolForm.riskLevel === 'high' || toolForm.riskLevel === 'critical',
        isEnabled: true,
        metadata: { phase: 'remote_readonly_foundation', readOnly: true },
      };
      await createMcpToolMutation.mutateAsync({ serverId: id, payload });
      setToolDialogOpen(false);
      setToolForm(defaultToolForm);
      toast({ title: 'Tool catalogada', description: `"${payload.name}" foi registrada sem execução MCP real.` });
    } catch (error) {
      toast({ title: 'Erro ao catalogar tool', description: error instanceof Error ? error.message : 'Tente novamente em instantes.', variant: 'destructive' });
    }
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
                    <Shield className="h-2.5 w-2.5 mr-0.5" />Risco {riskLevelLabel(server.riskLevel)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">v{server.version}</Badge>
                  {isLocalDemo && <><Badge variant="secondary" className="text-[10px]">Local</Badge><Badge variant="secondary" className="text-[10px]">Demo</Badge><Badge variant="outline" className="text-[10px]">Sandbox</Badge></>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{server.description}</p>
              </div>
            </div>
            <Badge variant="outline">{isLocalDemo ? 'Pronto · somente pré-checagem' : 'Externo opt-in · somente leitura'}</Badge>
          </div>
        </div>

        <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{isLocalDemo
              ? 'Este catálogo é local, determinístico e imutável na interface. A pré-checagem valida disponibilidade e políticas sem executar ferramenta, abrir rede, chamar provedor, gerar embeddings ou iniciar Chat/AgentRun.'
              : 'O MCP remoto permanece governado e somente leitura. Execução remota e ferramentas de escrita continuam bloqueadas. Aprovação humana e materialização governada do catálogo são separadas da autorização de execução.'}</p>
            {isLocalDemo && (
              <Button variant="outline" size="sm" disabled={remoteCheckPending !== null} onClick={() => { void checkLocalDemo(); }}>
                {remoteCheckPending === 'local_precheck' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Shield className="mr-1 h-3.5 w-3.5" />}
                Verificar pré-checagem local
              </Button>
            )}
            {isRemoteServer && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={remoteCheckPending !== null} onClick={() => { void checkRemoteReadiness(); }}>
                  {remoteCheckPending === 'readiness' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Shield className="mr-1 h-3.5 w-3.5" />}
                  Testar disponibilidade com segurança
                </Button>
                <Button variant="outline" size="sm" disabled={remoteCheckPending !== null} onClick={() => { void discoverRemoteCatalog(); }}>
                  {remoteCheckPending === 'discovery' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}
                  Consultar catálogo somente leitura
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    remoteCheckPending !== null
                    || remoteDiscovery?.status !== 'completed'
                    || (
                      remoteImportPlan !== null
                      && remoteApplyResult === null
                    )
                  }
                  onClick={() => { void prepareRemoteImportPlan(); }}
                >
                  {remoteCheckPending === 'plan'
                    ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    : <Shield className="mr-1 h-3.5 w-3.5" />}
                  Gerar plano para aprovação
                </Button>
              </div>
            )}
          </div>
        </div>

        {isRemoteServer && (remoteReadiness || remoteDiscovery) && (
          <div className="rounded-lg border bg-card p-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={remoteReadiness?.status === 'ready' ? 'default' : 'destructive'}>
                {remoteReadiness?.status ?? remoteDiscovery?.status}
              </Badge>
              <Badge variant="outline">
                Bloqueio fail-closed: {remoteReadiness?.failClosed ? 'acionado' : 'não acionado'}
              </Badge>
              <Badge variant="outline">simulated: {String(remoteReadiness?.simulated ?? false)}</Badge>
              {remoteReadiness?.mcpRemoteHost && <Badge variant="outline">host: {remoteReadiness.mcpRemoteHost}</Badge>}
            </div>
            <p className="mt-2 text-muted-foreground">{remoteReadiness?.reason}</p>
            {remoteDiscovery && (
              <div className="mt-3 flex flex-wrap gap-2">
                {remoteDiscovery.tools.map((tool) => (
                  <Badge key={tool.externalName} variant="secondary">
                    {tool.externalName} · {tool.inferredRiskLevel} · somente leitura
                  </Badge>
                ))}
                {remoteDiscovery.tools.length === 0 && <span className="text-muted-foreground">Nenhuma ferramenta exposta.</span>}
              </div>
            )}
          </div>
        )}

        {isRemoteServer && remoteImportPlan && (
          <div className="rounded-lg border border-warning/30 bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Shield className="h-4 w-4 text-warning" />
                  <h3 className="font-semibold">Plano governado de importação</h3>
                  <Badge
                    variant={
                      remoteApplyResult?.status === 'applied'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {remoteApplyResult?.status === 'applied'
                      ? 'Aprovado para o catálogo'
                      : remotePlanStatusLabel(remoteImportPlan.plan.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  A aprovação altera somente o catálogo governado. Ela não
                  materializa McpTool e não habilita execução remota.
                </p>
              </div>

              {!remoteApplyResult && isMcpRemoteManualApplyReady(remoteImportPlan.plan) && (
                <Button
                  size="sm"
                  onClick={openManualApplyDialog}
                  disabled={remoteCheckPending !== null || !currentUser}
                >
                  <Shield className="mr-1 h-3.5 w-3.5" />
                  Aprovar inclusão no catálogo
                </Button>
              )}

              {!remoteApplyResult
                && remoteImportPlan.plan.status === 'no_changes' && (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    Nenhuma aprovação necessária
                  </Badge>
                )}
            </div>

            <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border bg-background/70 p-3">
                <p className="text-muted-foreground">Decisão de origem</p>
                <p className="mt-1 font-medium">
                  {remotePlanStatusLabel(remoteImportPlan.plan.sourceDecisionStatus)}
                </p>
              </div>
              <div className="rounded border bg-background/70 p-3">
                <p className="text-muted-foreground">Aprovação</p>
                <p className="mt-1 font-medium">
                  {remoteImportPlan.plan.preflight.requiresManualApproval
                    ? 'Manual obrigatória'
                    : 'Não requerida'}
                </p>
              </div>
              <div className="rounded border bg-background/70 p-3">
                <p className="text-muted-foreground">Runtime</p>
                <p className="mt-1 font-medium">Desabilitado</p>
              </div>
              <div className="rounded border bg-background/70 p-3">
                <p className="text-muted-foreground">Materialização</p>
                <p className="mt-1 font-medium">
                  {materializationSummary}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {remoteImportPlan.plan.operations.map((operation) => (
                <div
                  key={operation.operationId}
                  className="rounded-lg border bg-background/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{operation.displayName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {operation.externalName}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskColors[operation.riskLevel]}`}
                      >
                        Risco {riskLevelLabel(operation.riskLevel)}
                      </span>
                      <Badge variant="outline">
                        {remoteOperationLabel(operation.type)}
                      </Badge>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {operation.type === 'noop'
                      ? 'O descritor da ferramenta permanece inalterado no snapshot governado mais recente.'
                      : operation.reason}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Aprovação: {operation.type === 'noop'
                        ? 'não aplicável'
                        : operation.requiresApproval
                          ? 'manual'
                          : 'não'}
                    </Badge>
                    <Badge variant="outline">
                      Runtime: {operation.policyDraft.runtimeEnabled ? 'habilitado' : 'desabilitado'}
                    </Badge>
                    <Badge variant="outline">
                      Execução remota: {operation.policyDraft.remoteExecutionEnabled ? 'habilitada' : 'desabilitada'}
                    </Badge>
                    <Badge variant="outline">
                      Bloqueado por padrão: {operation.policyDraft.blockedByDefault ? 'sim' : 'não'}
                    </Badge>
                  </div>
                </div>
              ))}

              {remoteImportPlan.plan.operations.length === 0 && (
                <div className="rounded border p-4 text-xs text-muted-foreground">
                  Nenhuma alteração de catálogo foi proposta neste snapshot.
                </div>
              )}
            </div>

            <div className="rounded border bg-muted/30 p-3 text-xs">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Plan ID</span>
                  <code className="mt-1 block break-all">
                    {remoteImportPlan.plan.planId}
                  </code>
                </div>
                <div>
                  <span className="text-muted-foreground">Snapshot</span>
                  <code className="mt-1 block break-all">
                    {remoteImportPlan.plan.snapshotId}
                  </code>
                </div>
              </div>
            </div>

            {remoteApplyResult?.status === 'applied' && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <p className="font-medium">Aprovado para o catálogo governado</p>
                </div>

                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  {currentUser && (
                    <div>
                      <p className="text-muted-foreground">Aprovado por</p>
                      <p className="font-medium">{currentUser.name}</p>
                      <p className="text-muted-foreground">{currentUser.email}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Aplicado em</p>
                    <p className="font-medium">
                      {formatDateTimePtBr(remoteApplyResult.appliedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Runtime</p>
                    <p className="font-medium">Desabilitado</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">McpTool</p>
                    <p className="font-medium">
                      {materializationSummary}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {isRemoteServer && canManageMcp && (
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">
                    Catálogo governado
                  </h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Entradas aprovadas são materializadas separadamente como
                  McpTool. Materializar não autoriza runtime nem execução remota.
                </p>
              </div>

              <Badge variant="outline">
                Materialização: {materializationSummary}
              </Badge>
            </div>

            {remoteCatalogLoading && (
              <div className="flex items-center gap-2 rounded border p-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Carregando catálogo governado…
              </div>
            )}

            {!remoteCatalogLoading && remoteCatalogError && (
              <div className="rounded border border-destructive/30 bg-destructive/5 p-4 text-xs">
                <p className="font-medium text-destructive">
                  Catálogo governado indisponível
                </p>
                <p className="mt-1 text-muted-foreground">
                  {remoteCatalogError}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    void refreshRemoteCatalog();
                  }}
                >
                  Tentar novamente
                </Button>
              </div>
            )}

            {!remoteCatalogLoading
              && !remoteCatalogError
              && remoteCatalogEntries.length === 0 && (
                <div className="rounded border p-4 text-xs text-muted-foreground">
                  Nenhuma entrada governada está disponível para este servidor.
                </div>
              )}

            {!remoteCatalogLoading
              && !remoteCatalogError
              && remoteCatalogEntries.map((entry) => {
                const materializedTool = tools.find((tool) => {
                  const metadata = metadataRecord(tool.metadata);

                  return metadata.remoteCatalogEntryId === entry.id;
                });

                const materializable =
                  isMcpRemoteCatalogEntryMaterializable(entry);

                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border bg-background/70 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {entry.displayName}
                          </p>

                          <Badge
                            variant={
                              entry.lifecycleStatus === 'approved_for_catalog'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {entry.lifecycleStatus === 'approved_for_catalog'
                              ? 'Aprovada para catálogo'
                              : entry.lifecycleStatus}
                          </Badge>

                          <Badge
                            variant={
                              entry.materialization.isMaterialized
                                ? 'default'
                                : 'outline'
                            }
                          >
                            {entry.materialization.isMaterialized
                              ? 'Materializada'
                              : 'Não materializada'}
                          </Badge>
                        </div>

                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {entry.externalName}
                        </p>

                        {entry.description && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {entry.description}
                          </p>
                        )}
                      </div>

                      {materializable && (
                        <Button
                          size="sm"
                          disabled={materializationPending}
                          onClick={() => {
                            openMaterializationDialog(entry);
                          }}
                        >
                          <Wrench className="mr-1 h-3.5 w-3.5" />
                          Materializar ferramenta
                        </Button>
                      )}
                    </div>

                    <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded border p-3">
                        <p className="text-muted-foreground">
                          Aprovação
                        </p>
                        <p className="mt-1 font-medium">
                          {entry.approvedAt
                            ? `Registrada em ${formatDateTimePtBr(entry.approvedAt)}`
                            : 'Não registrada'}
                        </p>
                      </div>

                      <div className="rounded border p-3">
                        <p className="text-muted-foreground">
                          Runtime
                        </p>
                        <p className="mt-1 font-medium">
                          {entry.policy.runtimeEnabled
                            ? 'Habilitado'
                            : 'Desabilitado'}
                        </p>
                      </div>

                      <div className="rounded border p-3">
                        <p className="text-muted-foreground">
                          Execução remota
                        </p>
                        <p className="mt-1 font-medium">
                          {entry.policy.remoteExecutionEnabled
                            ? 'Habilitada'
                            : 'Bloqueada'}
                        </p>
                      </div>

                      <div className="rounded border p-3">
                        <p className="text-muted-foreground">
                          McpTool
                        </p>
                        <p className="mt-1 font-medium">
                          {!entry.materialization.isMaterialized
                            ? 'Não materializada'
                            : materializedTool
                              ? materializedTool.isEnabled
                                ? 'Habilitada'
                                : 'Desabilitada'
                              : 'Sincronizando catálogo'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">
                        Aprovação: {entry.requiresApproval
                          ? 'obrigatória'
                          : 'não'}
                      </Badge>

                      <Badge variant="outline">
                        Sandbox: {entry.policy.sandboxOnly
                          ? 'obrigatório'
                          : 'não'}
                      </Badge>

                      <Badge variant="outline">
                        Bloqueado por padrão: {
                          entry.policy.blockedByDefault
                            ? 'sim'
                            : 'não'
                        }
                      </Badge>

                      <Badge variant="outline">
                        Execução pelo runtime: {
                          entry.policy.allowRuntimeExecution
                            ? 'permitida'
                            : 'bloqueada'
                        }
                      </Badge>
                    </div>

                    {entry.materialization.isMaterialized
                      && materializedTool && (
                        <div className="mt-3 rounded border border-success/30 bg-success/5 p-3 text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            <span className="font-medium">
                              {entry.displayName} está registrada como McpTool
                            </span>
                          </div>

                          <p className="mt-1 text-muted-foreground">
                            Estado operacional: {
                              materializedTool.isEnabled
                                ? 'habilitada'
                                : 'desabilitada'
                            }. Execução remota permanece bloqueada.
                          </p>
                        </div>
                      )}
                  </div>
                );
              })}
          </div>
        )}

        {isLocalDemo && localPrecheck && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>ready</Badge>
              <Badge variant="outline">configured: sim</Badge>
              <Badge variant="outline">healthy: sim</Badge>
              <Badge variant="outline">fail-closed: sim</Badge>
              <Badge variant="outline">execução permitida: não</Badge>
            </div>
            <p className="mt-2 text-muted-foreground">{localPrecheck.reason}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {localPrecheck.checks.map(check => (
                <div key={check.name} className="flex gap-2 rounded border bg-background/70 p-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                  <span>{check.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { icon: Wrench, label: 'Ferramentas', value: tools.length },
            { icon: FileCode, label: 'Recursos', value: resources.length },
            { icon: MessageSquare, label: 'Prompts', value: prompts.length },
            { icon: Link2, label: 'Vínculos', value: bindings.length },
            { icon: Zap, label: 'Execuções', value: logs.length },
            { icon: Clock, label: 'Última descoberta', value: server.lastSync ? new Date(server.lastSync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' },
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
            <TabsTrigger value="tools">Ferramentas ({tools.length})</TabsTrigger>
            <TabsTrigger value="resources">Recursos ({resources.length})</TabsTrigger>
            <TabsTrigger value="prompts">Prompts ({prompts.length})</TabsTrigger>
            <TabsTrigger value="bindings">Vínculos ({bindings.length})</TabsTrigger>
            <TabsTrigger value="logs">Registros ({logs.length})</TabsTrigger>
            <TabsTrigger value="config">Configuração</TabsTrigger>
          </TabsList>

          {/* Tools Tab */}
          <TabsContent value="tools" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 flex-1 max-w-sm">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input type="text" value={toolSearch} onChange={e => setToolSearch(e.target.value)} placeholder="Buscar ferramentas..." className="bg-transparent text-sm outline-none w-full" />
              </div>
              {!isRemoteServer && !isLocalDemo && (
                <Button size="sm" onClick={() => setToolDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />Nova tool
                </Button>
              )}
            </div>
            {filteredTools.length === 0 ? (
              <EmptyState icon={<Wrench className="h-6 w-6" />} title="Nenhuma ferramenta" description={isRemoteServer ? 'Use o discovery seguro para consultar o catálogo somente leitura homologado.' : isLocalDemo ? 'Restaure o catálogo pelo seed demo local da Fase 18D.' : 'Este servidor não possui ferramentas registradas.'} action={isRemoteServer || isLocalDemo ? undefined : <Button variant="outline" onClick={() => setToolDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova ferramenta</Button>} />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ferramenta</TableHead>
                      <TableHead>Risco</TableHead>
                      <TableHead>Aprovação</TableHead>
                      <TableHead className="text-center">Execuções</TableHead>
                      <TableHead>Schema de entrada</TableHead>
                      <TableHead>Última Execução</TableHead>
                      <TableHead className="text-right">Sandbox</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTools.map(tool => {
                      const boundAssistant = bindings.find(binding => binding.toolsEnabled.includes(tool.name));
                      return (
                      <TableRow key={tool.id}>
                        <TableCell>
                          <div>
                            <p className="font-mono text-xs font-semibold">{tool.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                            {isLocalDemo && <div className="mt-1 flex flex-wrap gap-1"><Badge variant="secondary" className="text-[9px]">Demo</Badge><Badge variant="outline" className="text-[9px]">Stub local</Badge><Badge variant="outline" className="text-[9px]">Somente leitura</Badge></div>}
                          </div>
                        </TableCell>
                        <TableCell><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskColors[tool.riskLevel]}`}>{riskLevelLabel(tool.riskLevel)}</span></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={approvalStates[tool.id] ?? false} onCheckedChange={() => { void toggleApproval(tool.id); }} disabled={isRemoteServer || isLocalDemo || updateMcpToolMutation.isPending} />
                            <span className="text-xs text-muted-foreground">{isRemoteServer || isLocalDemo ? 'Obrigatória' : approvalStates[tool.id] ? 'Sim' : 'Não'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">{tool.executionCount.toLocaleString()}</TableCell>
                        <TableCell><code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{tool.inputSchema || '—'}</code></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tool.lastExecuted ? new Date(tool.lastExecuted).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                        <TableCell className="text-right">
                          {isLocalDemo ? (
                            <Badge variant="outline" className="text-[10px]"><Lock className="mr-1 h-3 w-3" />Somente pré-checagem</Badge>
                          ) : boundAssistant ? (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate(`/app/assistants/${boundAssistant.assistantId}`)}>
                              <Zap className="h-3.5 w-3.5 mr-1" />Abrir
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );})}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4">
            {resources.length === 0 ? (
              <EmptyState icon={<FileCode className="h-6 w-6" />} title="Nenhum recurso" description="Este servidor não possui recursos registrados." />
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
                      <TableHead>Ferramentas habilitadas</TableHead>
                      <TableHead>Recursos</TableHead>
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
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={binding.approvalPolicy === 'manual' ? 'default' : 'secondary'} className="text-[10px]">
                              {binding.approvalPolicy === 'manual' ? '🔒 Manual' : binding.approvalPolicy === 'auto' ? '⚡ Auto' : '— Nenhuma'}
                            </Badge>
                            {binding.mode && <Badge variant="outline" className="text-[10px]">{bindingModeLabel(binding.mode)}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDatePtBr(binding.createdAt)}</TableCell>
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
              <EmptyState icon={<Zap className="h-6 w-6" />} title="Nenhuma execução" description={isLocalDemo ? 'Correto para a Fase 18D: o catálogo permite somente precheck local e não executa tools.' : 'Nenhuma execução de ferramenta registrada.'} />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ferramenta</TableHead>
                      <TableHead>Assistente</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Timestamp</TableHead>
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
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Endpoint externo</span><code className="text-xs bg-muted px-2 py-0.5 rounded">{server.url || 'ausente'}</code></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tipo</span><span className="font-medium">{serverTypeLabel(server.serverType)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Autenticação</span><span className="font-medium">{authTypeLabel(server.authType)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Versão</span><span className="font-medium">v{server.version}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Última descoberta</span><span className="font-medium">{server.lastSync ? new Date(server.lastSync).toLocaleString('pt-BR') : '—'}</span></div>
                </div>
              </div>
              <div className="rounded-lg border bg-card p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4" />Governança</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Nível de Risco</span><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${riskColors[server.riskLevel]}`}>{riskLevelLabel(server.riskLevel)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Responsável</span><span className="font-medium">{server.owner}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Criação</span><span className="font-medium">{formatDatePtBr(server.createdAt)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Ferramentas com aprovação</span><span className="font-medium">{tools.filter(t => t.requiresApproval).length} de {tools.length}</span></div>
                </div>
              </div>
            </div>
            {isLocalDemo && (
              <div className="rounded-lg border bg-card p-5">
                <h3 className="font-semibold flex items-center gap-2"><Lock className="h-4 w-4" />Políticas fail-closed da Fase 18D</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Somente leitura', serverMetadata.readOnly === true],
                    ['Somente sandbox', serverMetadata.sandboxOnly === true],
                    ['Aprovação obrigatória', serverMetadata.requiresApproval === true],
                    ['Bloqueado por padrão', serverMetadata.blockedByDefault === true],
                    ['Execução remota', serverMetadata.remoteExecution === true],
                    ['Rede externa', serverMetadata.externalNetworkAllowed === true],
                    ['Ferramentas de escrita', serverMetadata.writeToolsAllowed === true],
                    ['Execução pelo runtime', serverMetadata.allowRuntimeExecution === true],
                  ].map(([label, enabled]) => (
                    <div key={String(label)} className="flex items-center justify-between rounded border px-3 py-2 text-xs">
                      <span>{label}</span>
                      <Badge variant={enabled ? 'default' : 'outline'}>{enabled ? 'sim' : 'não'}</Badge>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Provedores externos, embeddings reais e Chat/AgentRun real também permanecem bloqueados. O catálogo é restaurável apenas pelo seed local idempotente.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={manualApplyDialogOpen}
        onOpenChange={(open) => {
          if (remoteCheckPending !== 'apply') {
            setManualApplyDialogOpen(open);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Aprovar inclusão no catálogo</DialogTitle>
            <DialogDescription>
              Esta aprovação altera somente o catálogo MCP governado.
              Runtime, execução remota e materialização de McpTool permanecem bloqueados.
            </DialogDescription>
          </DialogHeader>

          {remoteImportPlan && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Operações</span>
                    <span className="font-medium">
                      {remoteImportPlan.plan.operations.length}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Aprovação</span>
                    <span className="font-medium">Manual obrigatória</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Runtime</span>
                    <span className="font-medium">Desabilitado</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Execução remota</span>
                    <span className="font-medium">Desabilitada</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Materialização</span>
                    <span className="font-medium">Não realizada</span>
                  </div>
                </div>
              </div>

              {currentUser && (
                <div className="rounded-lg border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    A aprovação será registrada em nome de
                  </p>
                  <p className="mt-1 font-medium">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentUser.email}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="mcp-approval-reason">
                  Motivo da aprovação
                </Label>
                <Textarea
                  id="mcp-approval-reason"
                  value={approvalReason}
                  onChange={(event) => setApprovalReason(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Descreva o motivo corporativo desta aprovação..."
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Mínimo de 8 caracteres</span>
                  <span>{approvalReason.length}/1000</span>
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-lg border p-3">
                <Switch
                  checked={manualApplyConfirmed}
                  onCheckedChange={setManualApplyConfirmed}
                />
                <div>
                  <p className="text-sm font-medium">
                    Confirmo a aprovação manual deste plano
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confirmo somente a inclusão no catálogo governado.
                    Nenhuma execução MCP é autorizada por esta ação.
                  </p>
                </div>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setManualApplyDialogOpen(false)}
              disabled={remoteCheckPending === 'apply'}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => { void applyRemoteImportPlan(); }}
              disabled={
                remoteCheckPending === 'apply'
                || !manualApplyConfirmed
                || approvalReason.trim().length < 8
                || !currentUser
              }
            >
              {remoteCheckPending === 'apply' && (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              )}
              Aprovar inclusão no catálogo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={materializationDialogOpen}
        onOpenChange={(open) => {
          if (!materializationPending) {
            setMaterializationDialogOpen(open);

            if (!open) {
              setMaterializationEntry(null);
              setMaterializationConfirmed(false);
            }
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Materializar ferramenta
            </DialogTitle>
            <DialogDescription>
              Esta ação transforma a entrada aprovada do catálogo governado
              em uma McpTool real do Orchestra. A ferramenta será criada
              desabilitada e não autoriza runtime ou execução remota.
            </DialogDescription>
          </DialogHeader>

          {materializationEntry && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="font-medium">
                  {materializationEntry.displayName}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {materializationEntry.externalName}
                </p>

                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      McpTool
                    </span>
                    <span className="font-medium">
                      Será criada desabilitada
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      Aprovação
                    </span>
                    <span className="font-medium">
                      Obrigatória
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      Runtime
                    </span>
                    <span className="font-medium">
                      Desabilitado
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      Execução remota
                    </span>
                    <span className="font-medium">
                      Bloqueada
                    </span>
                  </div>
                </div>
              </div>

              {currentUser && (
                <div className="rounded-lg border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    A materialização será auditada em nome de
                  </p>
                  <p className="mt-1 font-medium">
                    {currentUser.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentUser.email}
                  </p>
                </div>
              )}

              <label className="flex items-start gap-3 rounded-lg border p-3">
                <Switch
                  checked={materializationConfirmed}
                  onCheckedChange={setMaterializationConfirmed}
                />

                <div>
                  <p className="text-sm font-medium">
                    Confirmo a materialização governada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confirmo somente a criação da McpTool desabilitada.
                    Esta ação não concede autorização de execução.
                  </p>
                </div>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={materializationPending}
              onClick={() => {
                setMaterializationDialogOpen(false);
                setMaterializationEntry(null);
                setMaterializationConfirmed(false);
              }}
            >
              Cancelar
            </Button>

            <Button
              disabled={
                materializationPending
                || !materializationConfirmed
                || !materializationEntry
                || !currentUser
                || !canManageMcp
              }
              onClick={() => {
                void materializeRemoteCatalogEntry();
              }}
            >
              {materializationPending && (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              )}

              Materializar ferramenta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={toolDialogOpen} onOpenChange={setToolDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Tool MCP</DialogTitle>
            <DialogDescription>Registre uma tool no catálogo governado. Nenhuma chamada MCP real será executada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={toolForm.name} onChange={event => setToolForm(prev => ({ ...prev, name: event.target.value }))} placeholder="ex: crm.search_customer" />
              </div>
              <div className="space-y-2">
                <Label>Risco</Label>
                <Select value={toolForm.riskLevel} onValueChange={value => setToolForm(prev => ({ ...prev, riskLevel: value as RiskLevel, requiresApproval: prev.requiresApproval || value === 'high' || value === 'critical' }))}>
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
              <Label>Descrição</Label>
              <Textarea value={toolForm.description} onChange={event => setToolForm(prev => ({ ...prev, description: event.target.value }))} rows={2} placeholder="Descreva a finalidade governada desta tool." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Schema de entrada</Label>
                <Textarea value={toolForm.inputSchema} onChange={event => setToolForm(prev => ({ ...prev, inputSchema: event.target.value }))} rows={7} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Schema de saída</Label>
                <Textarea value={toolForm.outputSchema} onChange={event => setToolForm(prev => ({ ...prev, outputSchema: event.target.value }))} rows={7} className="font-mono text-xs" />
              </div>
            </div>
            <label className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Requer aprovação</p>
                <p className="text-xs text-muted-foreground">Riscos alto/crítico sempre exigem aprovação.</p>
              </div>
              <Switch
                checked={toolForm.requiresApproval || toolForm.riskLevel === 'high' || toolForm.riskLevel === 'critical'}
                disabled={toolForm.riskLevel === 'high' || toolForm.riskLevel === 'critical'}
                onCheckedChange={checked => setToolForm(prev => ({ ...prev, requiresApproval: checked }))}
              />
            </label>
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <p className="text-sm font-medium">Classificação externa: somente leitura</p>
              <p className="text-xs text-muted-foreground">A tool será catalogada com <code>metadata.readOnly=true</code>. O gateway ainda bloqueará risco diferente de baixo, approval pendente e verbos de escrita.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToolDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => { void handleCreateTool(); }} disabled={!toolForm.name || createMcpToolMutation.isPending}>Catalogar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
