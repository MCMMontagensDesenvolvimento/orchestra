import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shared/AppShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { KpiCard } from '@/components/shared/KpiCard';
import { AgentRunLlmBadges, AgentRunLlmTimeline } from '@/components/assistants/AgentRunLlmTimeline';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type {
  AgentRun,
  AgentRunStatus,
  Assistant,
  AssistantApprovalAction,
  AssistantExecutionMode,
  AssistantExecutionPolicy,
  AssistantTestStatus,
  FeedbackType,
  KnowledgeBase,
  LlmConfig,
  LlmProviderSummary,
  McpExecutionPrecheck,
  McpTool,
  McpToolCallRecord,
  ResponseScopeMode,
  RuntimeCapabilities,
  RuntimeConfig,
  RuntimeHealth,
  RuntimeProviderSummary,
} from '@/types';
import {
  useApproveAssistantApprovalMutation,
  useArchiveAssistantMutation,
  useAssistant,
  useAssistantApprovals,
  useAssistantExecutionPolicy,
  useAssistantExecutionPrecheckMutation,
  useAssistantFeedback,
  useAssistantTestResults,
  useAssistantVersions,
  useCancelAssistantApprovalMutation,
  useCreateAssistantApprovalMutation,
  useCreateAssistantFeedbackMutation,
  useCreateAssistantTestResultMutation,
  usePublishAssistantMutation,
  useRejectAssistantApprovalMutation,
  useRestoreAssistantMutation,
  useRollbackAssistantMutation,
  useUnpublishAssistantMutation,
  useUpdateAssistantExecutionPolicyMutation,
} from '@/hooks/queries/useAssistants';
import { useAssistantRuns, useCancelAgentRunMutation, useCreateAgentRunMutation } from '@/hooks/queries/useAgentRuns';
import { useCurrentSession } from '@/hooks/queries/useAuth';
import {
  useAssistantKnowledgeBindings,
  useAssistantRagQueries,
  useAssistantRagQueryMutation,
  useAssistantRagReadiness,
  useCreateAssistantKnowledgeBindingMutation,
  useKnowledgeBases,
  useRemoveAssistantKnowledgeBindingMutation,
} from '@/hooks/queries/useKnowledge';
import {
  useAssistantMcpBindings,
  useAssistantMcpToolCalls,
  useCreateAssistantMcpBindingMutation,
  useMcpSandboxPrecheckMutation,
  useMcpSandboxToolCallMutation,
  useMcpTools,
  useRemoveAssistantMcpBindingMutation,
} from '@/hooks/queries/useMcp';
import { useRuntimeCapabilities, useRuntimeConfig, useRuntimeHealth, useRuntimeProviders } from '@/hooks/queries/useRuntime';
import { useLlmConfig, useLlmProviders } from '@/hooks/queries/useLlm';
import { useConversations } from '@/hooks/queries/useChat';
import { useAuditLogs } from '@/hooks/queries/useAudit';
import { useAnalytics } from '@/hooks/queries/useAnalytics';
import { llmPolicySaveErrorDescription } from '@/lib/llm-policy-errors';
import { humanizeTechnicalToken, safeSummaryPreview } from '@/lib/display-safety';
import { env } from '@/lib/env';
import {
  getAgentRunLlmSummary,
  hasAgentRunLlmSummary,
  type AgentRunLlmSummary,
} from '@/lib/agent-run-llm-metadata';
import {
  ArrowLeft, Edit, Copy, Play, Send, Archive, MessageSquare, DollarSign,
  ThumbsUp, ThumbsDown, Thermometer, Bot, Server, BookOpen, Clock,
  GitBranch, CheckCircle, XCircle, FileCode, Wrench, BarChart3, Shield,
  AlertTriangle, ChevronRight, ExternalLink, Zap, Download, RefreshCw,
  Hash, Eye, EyeOff, Pencil, Save, X, ChevronDown, ChevronUp, Clipboard, Diff, Undo2,
  Activity, StopCircle, Search
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { toast } from 'sonner';
import { buildAssistantMcpBindingPayload, canUseMcpBindingInSandbox, isRemoteMaterializedMcpTool } from './assistantMcpGovernance';

type TabId = 'overview' | 'config' | 'governance' | 'runs' | 'knowledge' | 'tools' | 'prompt' | 'tests' | 'analytics' | 'audit';
type LlmPolicyUpdatePayload = Pick<AssistantExecutionPolicy, 'allowExternalLlmProviders' | 'allowedLlmProviders'> & {
  defaultLlmProvider: AssistantExecutionPolicy['defaultLlmProvider'];
};
type LlmPolicyForm = {
  allowExternalLlmProviders: boolean;
  openaiAllowed: boolean;
  defaultProvider: 'local_deterministic' | 'openai';
};

const tabs: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: 'overview', label: 'Visão geral', icon: Bot },
  { id: 'config', label: 'Configuração', icon: Wrench },
  { id: 'governance', label: 'Governança', icon: Shield },
  { id: 'runs', label: 'Execuções', icon: Activity },
  { id: 'knowledge', label: 'Conhecimento', icon: BookOpen },
  { id: 'tools', label: 'Ferramentas', icon: Server },
  { id: 'prompt', label: 'Prompt Compilado', icon: FileCode },
  { id: 'tests', label: 'Testes', icon: CheckCircle },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'audit', label: 'Auditoria', icon: Shield },
];

export default function AssistantDetailPage() {
  const { data: knowledgeBases = [] } = useKnowledgeBases();
  const { data: mcpTools = [] } = useMcpTools();
  const { data: conversationData = [] } = useConversations(undefined, env.useMocks);
  const { data: auditLogsData = [] } = useAuditLogs();
  const { data: analyticsData = [] } = useAnalytics(env.useMocks);
  const { id } = useParams();
  const assistantQuery = useAssistant(id);
  const { data: versionData = [] } = useAssistantVersions(id);
  const { data: feedbackData = [] } = useAssistantFeedback(id);
  const { data: testResultData = [] } = useAssistantTestResults(id);
  const { data: assistantApprovals = [] } = useAssistantApprovals(id);
  const assistantExecutionPolicyQuery = useAssistantExecutionPolicy(id);
  const assistantExecutionPolicy = assistantExecutionPolicyQuery.data;
  const { data: assistantRuns = [], isLoading: assistantRunsLoading, refetch: refetchAssistantRuns } = useAssistantRuns(id);
  const runtimeHealthQuery = useRuntimeHealth();
  const runtimeCapabilitiesQuery = useRuntimeCapabilities();
  const runtimeConfigQuery = useRuntimeConfig();
  const runtimeProvidersQuery = useRuntimeProviders();
  const llmProvidersQuery = useLlmProviders();
  const llmConfigQuery = useLlmConfig();
  const { data: assistantKnowledgeBindings = [] } = useAssistantKnowledgeBindings(id);
  const ragReadinessQuery = useAssistantRagReadiness(id);
  const ragQueriesQuery = useAssistantRagQueries(id);
  const { data: assistantMcpBindings = [] } = useAssistantMcpBindings(id);
  const { data: assistantMcpToolCalls = [], isLoading: assistantMcpToolCallsLoading, refetch: refetchAssistantMcpToolCalls } = useAssistantMcpToolCalls(id);
  const { data: session } = useCurrentSession();
  const publishMutation = usePublishAssistantMutation();
  const unpublishMutation = useUnpublishAssistantMutation();
  const archiveMutation = useArchiveAssistantMutation();
  const restoreMutation = useRestoreAssistantMutation();
  const rollbackMutation = useRollbackAssistantMutation();
  const createApprovalMutation = useCreateAssistantApprovalMutation();
  const approveApprovalMutation = useApproveAssistantApprovalMutation();
  const rejectApprovalMutation = useRejectAssistantApprovalMutation();
  const cancelApprovalMutation = useCancelAssistantApprovalMutation();
  const updateExecutionPolicyMutation = useUpdateAssistantExecutionPolicyMutation();
  const executionPrecheckMutation = useAssistantExecutionPrecheckMutation();
  const createFeedbackMutation = useCreateAssistantFeedbackMutation();
  const createTestResultMutation = useCreateAssistantTestResultMutation();
  const createAgentRunMutation = useCreateAgentRunMutation();
  const cancelAgentRunMutation = useCancelAgentRunMutation();
  const createKnowledgeBindingMutation = useCreateAssistantKnowledgeBindingMutation();
  const removeKnowledgeBindingMutation = useRemoveAssistantKnowledgeBindingMutation();
  const ragQueryMutation = useAssistantRagQueryMutation();
  const createMcpBindingMutation = useCreateAssistantMcpBindingMutation();
  const removeMcpBindingMutation = useRemoveAssistantMcpBindingMutation();
  const mcpSandboxPrecheckMutation = useMcpSandboxPrecheckMutation();
  const mcpSandboxToolCallMutation = useMcpSandboxToolCallMutation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState<{ rating: FeedbackType; comment: string }>({ rating: 'positive', comment: '' });
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testForm, setTestForm] = useState<{
    input: string;
    expectedBehavior: string;
    actualOutput: string;
    status: AssistantTestStatus;
    score: string;
    notes: string;
  }>({
    input: '',
    expectedBehavior: '',
    actualOutput: '',
    status: 'passed',
    score: '100',
    notes: '',
  });
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [rollbackVersionId, setRollbackVersionId] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalForm, setApprovalForm] = useState<{ action: AssistantApprovalAction; reason: string; assistantVersionId: string }>({
    action: 'publish',
    reason: '',
    assistantVersionId: '',
  });
  const [precheckMode, setPrecheckMode] = useState<AssistantExecutionMode>('sandbox');
  const [runMode, setRunMode] = useState<AssistantExecutionMode>('sandbox');
  const [runInput, setRunInput] = useState('');
  const [knowledgeBindingDialogOpen, setKnowledgeBindingDialogOpen] = useState(false);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState('');
  const [ragSearchQuery, setRagSearchQuery] = useState('');
  const [mcpBindingDialogOpen, setMcpBindingDialogOpen] = useState(false);
  const [selectedMcpToolId, setSelectedMcpToolId] = useState('');
  const [selectedSandboxToolId, setSelectedSandboxToolId] = useState('');
  const [mcpSandboxInput, setMcpSandboxInput] = useState('{\n  "query": "teste sandbox"\n}');
  const [selectedMcpToolCallId, setSelectedMcpToolCallId] = useState<string | null>(null);

  const assistant = assistantQuery.data;

  if (assistantQuery.isLoading) {
    return <AppShell><div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Carregando assistente...</div></AppShell>;
  }
  if (assistantQuery.isError) {
    return <AppShell><EmptyState icon={<Bot className="h-6 w-6" />} title="Nao foi possivel carregar o assistente" description="A consulta ao backend falhou e nenhum outro registro sera exibido como fallback." action={<Button variant="outline" onClick={() => { void assistantQuery.refetch(); }}>Tentar novamente</Button>} /></AppShell>;
  }
  if (!assistant) {
    return <AppShell><EmptyState icon={<Bot className="h-6 w-6" />} title="Assistente nao encontrado" description="O assistente solicitado nao existe ou nao esta disponivel neste workspace." /></AppShell>;
  }
  const versions = versionData.filter(v => v.assistantId === assistant.id);
  const feedbacks = feedbackData.filter(f => f.assistantId === assistant.id);
  const tests = testResultData.filter(t => t.assistantId === assistant.id);
  const approvals = assistantApprovals.filter(approval => approval.assistantId === assistant.id);
  const runs = assistantRuns.filter(run => run.assistantId === assistant.id);
  const executionPolicy = assistantExecutionPolicy ?? assistant.executionPolicy;
  const conversations = conversationData.filter(c => c.assistantId === assistant.id);
  const boundKnowledgeBases = assistantKnowledgeBindings
    .map(binding => binding.knowledgeBase)
    .filter((kb): kb is KnowledgeBase => Boolean(kb));
  const boundMcpTools = assistantMcpBindings
    .map(binding => binding.tool)
    .filter((tool): tool is McpTool => Boolean(tool));
  const kbs = boundKnowledgeBases.length > 0
    ? boundKnowledgeBases
    : env.useMocks
      ? knowledgeBases.filter(kb => assistant.knowledgeBases.includes(kb.id))
      : [];
  const tools = boundMcpTools.length > 0
    ? boundMcpTools
    : env.useMocks
      ? mcpTools.filter(tool => assistant.mcpTools.includes(tool.id))
      : [];
  const knowledgeBindingByBaseId = new Map(assistantKnowledgeBindings.map(binding => [binding.knowledgeBaseId, binding.id]));
  const mcpBindingByToolId = new Map(
    assistantMcpBindings
      .filter(binding => binding.mcpToolId)
      .map(binding => [binding.mcpToolId, binding.id])
  );
  const sandboxMcpTools = env.useMocks
    ? tools
    : tools.filter((tool) => {
        const binding = assistantMcpBindings.find(
          (item) => item.mcpToolId === tool.id,
        );

        return canUseMcpBindingInSandbox(binding);
      });

  const sandboxMcpToolIds = new Set(
    sandboxMcpTools.map((tool) => tool.id),
  );
  const availableKnowledgeBases = knowledgeBases.filter(kb => !kbs.some(bound => bound.id === kb.id));
  const availableMcpTools = mcpTools.filter(
    (tool) =>
      !tools.some((bound) => bound.id === tool.id)
      && (tool.isEnabled || isRemoteMaterializedMcpTool(tool)),
  );
  const selectedMcpBindingTool = availableMcpTools.find(
    (tool) => tool.id === selectedMcpToolId,
  );
  const auditLogs = auditLogsData.filter(l => l.resource === assistant.name || l.resource.includes(assistant.name.split(' ')[0]));

  const positiveFeedbacks = feedbacks.filter(f => f.type === 'positive').length;
  const negativeFeedbacks = feedbacks.filter(f => f.type === 'negative').length;
  const rollbackCandidates = versions.filter(v => v.id !== assistant.activePublication?.assistantVersionId);
  const pendingApprovals = approvals.filter(approval => approval.status === 'pending');
  const hasPermission = (permission: string) => session?.permissions.includes(permission) ?? false;
  const ragReadiness = ragReadinessQuery.data;
  const ragHistory = ragQueriesQuery.data ?? [];
  const ragBlockedReasons = ragReadiness?.blockedReasons ?? ragReadiness?.missingRequirements ?? [];
  const ragReady = ragReadiness?.ready ?? ragReadiness?.canUseKnowledge ?? false;
  const activeSandboxToolId =
    sandboxMcpTools.some((tool) => tool.id === selectedSandboxToolId)
      ? selectedSandboxToolId
      : sandboxMcpTools[0]?.id ?? '';
  const selectedSandboxTool =
    sandboxMcpTools.find((tool) => tool.id === activeSandboxToolId);
  const selectedMcpToolCall = (
    selectedMcpToolCallId
      ? assistantMcpToolCalls.find(call => call.id === selectedMcpToolCallId)
      : undefined
  ) ?? mcpSandboxToolCallMutation.data ?? assistantMcpToolCalls[0];

  const parseMcpSandboxInput = () => {
    const value = mcpSandboxInput.trim();
    if (!value) return {};
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return { input: value };
    }
  };

  const handleBindKnowledgeBase = async () => {
    if (!selectedKnowledgeBaseId) return;
    try {
      await createKnowledgeBindingMutation.mutateAsync({
        assistantId: assistant.id,
        payload: {
          knowledgeBaseId: selectedKnowledgeBaseId,
          retrievalMode: 'retrieval_placeholder',
          priority: 100,
        },
      });
      setSelectedKnowledgeBaseId('');
      setKnowledgeBindingDialogOpen(false);
      toast.success('Base vinculada ao assistente');
    } catch (error) {
      toast.error('Nao foi possivel vincular a base', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleRemoveKnowledgeBaseBinding = async (knowledgeBaseId: string) => {
    const bindingId = knowledgeBindingByBaseId.get(knowledgeBaseId);
    if (!bindingId) return;
    try {
      await removeKnowledgeBindingMutation.mutateAsync({ assistantId: assistant.id, bindingId });
      toast.success('Vinculo de conhecimento removido');
    } catch (error) {
      toast.error('Nao foi possivel remover o vinculo', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleRagLocalSearch = async () => {
    if (!ragSearchQuery.trim()) {
      toast.error('Informe um termo para busca local');
      return;
    }
    try {
      await ragQueryMutation.mutateAsync({
        assistantId: assistant.id,
        payload: {
          query: ragSearchQuery,
          limit: 5,
          includeArchived: false,
        },
      });
    } catch (error) {
      toast.error('Nao foi possivel executar consulta local', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleBindMcpTool = async () => {
    const tool = mcpTools.find(item => item.id === selectedMcpToolId);
    if (!tool) return;
    try {
      await createMcpBindingMutation.mutateAsync({
        assistantId: assistant.id,
        payload: buildAssistantMcpBindingPayload(tool),
      });
      setSelectedMcpToolId('');
      setMcpBindingDialogOpen(false);
      toast.success(
        isRemoteMaterializedMcpTool(tool)
          ? 'Tool MCP vinculada em estado governado'
          : 'Tool MCP vinculada em modo sandbox',
      );
    } catch (error) {
      toast.error('Nao foi possivel vincular a tool MCP', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleRemoveMcpBinding = async (toolId: string) => {
    const bindingId = mcpBindingByToolId.get(toolId);
    if (!bindingId) return;
    try {
      await removeMcpBindingMutation.mutateAsync({ assistantId: assistant.id, bindingId });
      toast.success('Vinculo MCP removido');
    } catch (error) {
      toast.error('Nao foi possivel remover o vinculo MCP', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleMcpSandboxPrecheck = async (toolId = activeSandboxToolId) => {
    if (!toolId || !sandboxMcpToolIds.has(toolId)) {
      toast.error('Ferramenta MCP indisponível para sandbox', {
        description: 'O vínculo está desabilitado ou a ferramenta permanece bloqueada pela governança.',
      });
      return;
    }
    try {
      await mcpSandboxPrecheckMutation.mutateAsync({
        assistantId: assistant.id,
        payload: {
          mcpToolId: toolId,
          mode: 'sandbox',
          input: parseMcpSandboxInput(),
        },
      });
      toast.success('Pré-checagem de sandbox executada');
    } catch (error) {
      toast.error('Nao foi possivel executar precheck MCP', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleMcpSandboxRun = async (toolId = activeSandboxToolId) => {
    if (!toolId || !sandboxMcpToolIds.has(toolId)) {
      toast.error('Ferramenta MCP indisponível para execução', {
        description: 'O vínculo está desabilitado ou a ferramenta permanece bloqueada pela governança.',
      });
      return;
    }
    try {
      const call = await mcpSandboxToolCallMutation.mutateAsync({
        assistantId: assistant.id,
        payload: {
          mcpToolId: toolId,
          mode: 'sandbox',
          input: parseMcpSandboxInput(),
        },
      });
      setSelectedMcpToolCallId(call.id);
      toast.success(call.status === 'completed' ? 'Sandbox MCP concluido' : `Sandbox MCP: ${call.status}`);
    } catch (error) {
      toast.error('Nao foi possivel executar sandbox MCP', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleCreateAgentRun = async () => {
    if (!runInput.trim()) {
      toast.error('Informe a entrada da execucao');
      return;
    }
    try {
      const run = await createAgentRunMutation.mutateAsync({
        assistantId: assistant.id,
        input: {
          mode: runMode,
          input: runInput,
          source: 'assistant_detail',
          metadata: { uiContext: 'assistant_detail_runs' },
        },
      });
      setRunInput('');
      toast.success(
        run.status === 'blocked'
          ? 'Execução bloqueada pela pré-checagem'
          : 'Execução simulada concluída',
        {
          description: `Execução ${compactId(run.id)} · Rastreamento ${compactId(run.traceId)}`,
        },
      );
    } catch (error) {
      toast.error('Nao foi possivel criar a execucao', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleCancelAgentRun = async (selectedRunId: string) => {
    try {
      await cancelAgentRunMutation.mutateAsync(selectedRunId);
      toast.success('Execucao cancelada');
    } catch (error) {
      toast.error('Nao foi possivel cancelar a execucao', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleLifecycleAction = async (action: 'publish' | 'unpublish' | 'archive' | 'restore') => {
    try {
      if (action === 'publish') await publishMutation.mutateAsync(assistant.id);
      if (action === 'unpublish') await unpublishMutation.mutateAsync(assistant.id);
      if (action === 'archive') await archiveMutation.mutateAsync(assistant.id);
      if (action === 'restore') await restoreMutation.mutateAsync(assistant.id);
      const labels = {
        publish: 'Assistente publicado',
        unpublish: 'Assistente despublicado',
        archive: 'Assistente arquivado',
        restore: 'Assistente restaurado',
      };
      toast.success(labels[action]);
    } catch (error) {
      toast.error('Nao foi possivel executar a acao', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleRollback = async () => {
    if (!rollbackVersionId) return;
    try {
      await rollbackMutation.mutateAsync({
        id: assistant.id,
        versionId: rollbackVersionId,
        reason: rollbackReason || 'Rollback solicitado pela interface.',
      });
      setRollbackDialogOpen(false);
      setRollbackReason('');
      toast.success('Rollback aplicado');
    } catch (error) {
      toast.error('Nao foi possivel aplicar rollback', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleCreateApproval = async () => {
    try {
      await createApprovalMutation.mutateAsync({
        id: assistant.id,
        action: approvalForm.action,
        assistantVersionId: approvalForm.assistantVersionId || undefined,
        reason: approvalForm.reason || undefined,
      });
      setApprovalDialogOpen(false);
      setApprovalForm({ action: 'publish', reason: '', assistantVersionId: versions[0]?.id ?? '' });
      toast.success('Aprovação solicitada');
    } catch (error) {
      toast.error('Nao foi possivel solicitar approval', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleApprovalDecision = async (approvalId: string, decision: 'approve' | 'reject' | 'cancel') => {
    try {
      if (decision === 'approve') {
        await approveApprovalMutation.mutateAsync({ id: assistant.id, approvalId, decisionReason: 'Aprovado pela governanca.' });
        toast.success('Aprovação aprovada');
      }
      if (decision === 'reject') {
        await rejectApprovalMutation.mutateAsync({ id: assistant.id, approvalId, decisionReason: 'Rejeitado pela governanca.' });
        toast.success('Aprovação rejeitada');
      }
      if (decision === 'cancel') {
        await cancelApprovalMutation.mutateAsync({ id: assistant.id, approvalId, decisionReason: 'Cancelado pela governanca.' });
        toast.success('Aprovação cancelada');
      }
    } catch (error) {
      toast.error('Nao foi possivel decidir approval', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handlePublishWithApproval = async (approvalId: string, versionId?: string | null) => {
    try {
      await publishMutation.mutateAsync({
        id: assistant.id,
        approvalId,
        versionId: versionId ?? undefined,
        reason: 'Publicacao liberada por approval aprovado.',
      });
      toast.success('Assistente publicado com approval');
    } catch (error) {
      toast.error('Nao foi possivel publicar com approval', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handlePolicyUpdate = async (payload: Partial<Pick<AssistantExecutionPolicy,
    'executionMode' |
    'requiresApprovalToPublish' |
    'sandboxEnabled' |
    'allowDraftTesting' |
    'allowPublishedExecution' |
    'isExecutionEnabled' |
    'responseScopeMode'
  >>) => {
    try {
      await updateExecutionPolicyMutation.mutateAsync({ id: assistant.id, payload });
      toast.success('Policy atualizada');
    } catch (error) {
      toast.error('Nao foi possivel atualizar policy', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleLlmPolicyUpdate = async (payload: LlmPolicyUpdatePayload) => {
    try {
      await updateExecutionPolicyMutation.mutateAsync({ id: assistant.id, payload });
      toast.success('Política LLM atualizada', {
        description: payload.allowExternalLlmProviders ? 'OpenAI foi atualizado na policy do assistant.' : 'OpenAI foi removido da policy do assistant.',
      });
      return true;
    } catch (error) {
      toast.error('Não foi possível salvar a política LLM', {
        description: llmPolicySaveErrorDescription(error),
      });
      return false;
    }
  };

  const handleExecutionPrecheck = async () => {
    try {
      await executionPrecheckMutation.mutateAsync({ id: assistant.id, mode: precheckMode });
    } catch (error) {
      toast.error('Nao foi possivel executar precheck', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleCreateFeedback = async () => {
    try {
      await createFeedbackMutation.mutateAsync({
        id: assistant.id,
        assistantVersionId: assistant.activePublication?.assistantVersionId,
        rating: feedbackForm.rating,
        comment: feedbackForm.comment || undefined,
      });
      setFeedbackDialogOpen(false);
      setFeedbackForm({ rating: 'positive', comment: '' });
      toast.success('Feedback registrado');
    } catch (error) {
      toast.error('Nao foi possivel registrar feedback', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const handleCreateTestResult = async () => {
    try {
      await createTestResultMutation.mutateAsync({
        id: assistant.id,
        assistantVersionId: assistant.activePublication?.assistantVersionId ?? versions[0]?.id,
        input: testForm.input,
        expectedBehavior: testForm.expectedBehavior || undefined,
        actualOutput: testForm.actualOutput,
        status: testForm.status,
        score: testForm.score ? Number(testForm.score) : undefined,
        notes: testForm.notes || undefined,
      });
      setTestDialogOpen(false);
      setTestForm({
        input: '',
        expectedBehavior: '',
        actualOutput: '',
        status: 'passed',
        score: '100',
        notes: '',
      });
      toast.success('Resultado de teste registrado');
    } catch (error) {
      toast.error('Nao foi possivel registrar o teste', {
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const compiledPrompt = `# System Prompt — ${assistant.name}

## Persona
${assistant.persona || 'Não definida'}

## Objetivo
${assistant.objective || 'Não definido'}

## Tom de Voz
${assistant.tone || 'Não definido'} | Humor: ${assistant.humor || 'Neutro'} | Formalidade: ${assistant.formality || 'formal'}

## Tarefas Permitidas
${assistant.tasks || '- Não definidas'}

## Tarefas Proibidas
${assistant.prohibitedTasks || '- Não definidas'}

## Regras
${assistant.rules || '- Não definidas'}

## Restrições
${assistant.restrictions || '- Não definidas'}

## Instruções Críticas
${assistant.criticalInstructions || '- Não definidas'}

## Formato de Resposta
${assistant.responseFormat || 'Padrão'}

## Limites
${assistant.limits || 'Não definidos'}

## Política de Escalonamento
${assistant.escalationPolicy || 'Não definida'}

## Configuração do Modelo
- Modelo principal: ${assistant.model}
- Modelo fallback: ${assistant.fallbackModel || 'Não configurado'}
- Temperatura: ${assistant.temperature}

## Bases de Conhecimento
${kbs.map(kb => `- ${kb.name} (${kb.documentCount} documentos, ${kb.totalChunks} trechos)`).join('\n') || '- Nenhuma'}

## Ferramentas MCP
${tools.map(mcpToolPromptLine).join('\n') || '- Nenhuma'}`;

  const handleAction = (action: string) => {
    if (!env.useMocks) {
      toast.info('Acao disponivel apenas no prototipo local.');
      return;
    }
    toast.success(`${action}: ${assistant.name}`, { description: 'Acao simulada no modo mock.' });
  };

  // Assistant-specific analytics (mock per-assistant)
  const assistantAnalytics = analyticsData.map(d => ({
    ...d,
    conversations: Math.round(d.conversations * (assistant.conversations / 7000)),
    cost: +(d.cost * (assistant.costThisMonth / 650)).toFixed(2),
  }));

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/assistants" className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Assistants
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{assistant.name}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{assistant.name}</h1>
                <StatusBadge status={assistant.status} />
                {assistant.environment && (
                  <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${assistant.environment === 'production' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {assistant.environment}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {assistant.area} · {assistant.owner} · v{assistant.version} · Atualizado em {new Date(assistant.updatedAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasPermission('assistants.update') && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/app/assistants/${assistant.id}/edit`)}>
                <Edit className="h-3.5 w-3.5 mr-1" />Editar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => handleAction('Duplicado')}>
              <Copy className="h-3.5 w-3.5 mr-1" />Duplicar
            </Button>
            <Link to={`/chat/${assistant.id}`}>
              <Button variant="outline" size="sm"><Play className="h-3.5 w-3.5 mr-1" />Testar</Button>
            </Link>
            {assistant.status !== 'published' && assistant.status !== 'archived' && hasPermission('assistants.publish') && (
              <Button size="sm" onClick={() => { void handleLifecycleAction('publish'); }}>
                <Send className="h-3.5 w-3.5 mr-1" />Publicar
              </Button>
            )}
            {assistant.status === 'published' && hasPermission('assistants.unpublish') && (
              <Button variant="outline" size="sm" onClick={() => { void handleLifecycleAction('unpublish'); }}>
                <Undo2 className="h-3.5 w-3.5 mr-1" />Despublicar
              </Button>
            )}
            {assistant.status === 'published' && rollbackCandidates.length > 0 && hasPermission('assistants.rollback') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRollbackVersionId(rollbackCandidates[0]?.id ?? '');
                  setRollbackDialogOpen(true);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />Rollback
              </Button>
            )}
            {assistant.status !== 'archived' && hasPermission('assistants.archive') && (
              <Button variant="outline" size="sm" onClick={() => { void handleLifecycleAction('archive'); }} className="text-destructive hover:text-destructive">
                <Archive className="h-3.5 w-3.5 mr-1" />Arquivar
              </Button>
            )}
            {assistant.status === 'archived' && hasPermission('assistants.restore') && (
              <Button variant="outline" size="sm" onClick={() => { void handleLifecycleAction('restore'); }}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />Restaurar
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Conversas" value={assistant.conversations.toLocaleString()} change={12} trend="up" icon={<MessageSquare className="h-5 w-5" />} />
              <KpiCard label="Custo (mês)" value={`R$ ${assistant.costThisMonth.toFixed(2)}`} change={-5} trend="down" icon={<DollarSign className="h-5 w-5" />} />
              <KpiCard label="Satisfação" value={assistant.satisfaction > 0 ? `${assistant.satisfaction}%` : '—'} change={assistant.satisfaction > 0 ? 2 : undefined} trend="up" icon={<ThumbsUp className="h-5 w-5" />} />
              <KpiCard label="Temperatura" value={assistant.temperature} icon={<Thermometer className="h-5 w-5" />} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Description + config summary */}
              <div className="rounded-lg border bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold">Sobre</h3>
                <p className="text-sm text-muted-foreground">{assistant.description}</p>
                {assistant.objective && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Objetivo</p>
                    <p className="text-sm">{assistant.objective}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Modelo</p><p className="font-medium">{assistant.model}</p></div>
                  <div><p className="text-xs text-muted-foreground">Fallback</p><p className="font-medium">{assistant.fallbackModel || 'Não configurado'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Persona</p><p className="font-medium">{assistant.persona || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Tom</p><p className="font-medium">{assistant.tone || '—'}</p></div>
                </div>
              </div>

              {/* Connected resources */}
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-5 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-info" /> Bases de Conhecimento ({kbs.length})
                  </h3>
                  {kbs.length > 0 ? kbs.map(kb => (
                    <div key={kb.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/30">
                      <div>
                        <p className="font-medium">{kb.name}</p>
                        <p className="text-xs text-muted-foreground">{kb.documentCount} documentos · {kb.totalChunks.toLocaleString()} trechos</p>
                      </div>
                      <StatusBadge status={kb.status} />
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Nenhuma base vinculada</p>}
                </div>

                <div className="rounded-lg border bg-card p-5 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Server className="h-4 w-4 text-warning" /> Ferramentas MCP ({tools.length})
                  </h3>
                  {tools.length > 0 ? tools.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/30">
                      <div>
                        <p className="font-mono text-xs font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={t.riskLevel} />
                        {isRemoteMaterializedMcpTool(t) && (
                          <Badge variant="outline" className="text-[10px]">
                            Governada
                          </Badge>
                        )}
                        {t.isEnabled === false && (
                          <Badge variant="outline" className="text-[10px]">
                            Desabilitada
                          </Badge>
                        )}
                        {t.requiresApproval && (
                          <span className="text-[10px] text-warning">
                            Aprovação
                          </span>
                        )}
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Nenhuma ferramenta vinculada</p>}
                </div>
              </div>
            </div>

            {/* Recent conversations + versions + feedbacks */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-sm font-semibold mb-3">Últimas Conversas</h3>
                {conversations.length > 0 ? conversations.slice(0, 4).map(c => (
                  <Link key={c.id} to={`/chat/${assistant.id}`} className="flex items-start gap-2 py-2 border-b last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.messageCount} msgs · {new Date(c.updatedAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </Link>
                )) : <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>}
              </div>

              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" /> Histórico de Versões
                </h3>
                {versions.length > 0 ? versions.slice(0, 5).map(v => (
                  <div key={v.id} className="py-2 border-b last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">v{v.version}</span>
                      <StatusBadge status={v.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.changelog}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{v.author} · {new Date(v.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Nenhuma versão registrada</p>}
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Feedbacks Recentes</h3>
                  {hasPermission('assistants.feedback.create') && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setFeedbackDialogOpen(true)}>
                      <ThumbsUp className="h-3.5 w-3.5 mr-1" />Registrar
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1 text-sm"><ThumbsUp className="h-4 w-4 text-success" /><span className="font-bold">{positiveFeedbacks}</span></div>
                  <div className="flex items-center gap-1 text-sm"><ThumbsDown className="h-4 w-4 text-destructive" /><span className="font-bold">{negativeFeedbacks}</span></div>
                </div>
                {feedbacks.length > 0 ? feedbacks.slice(0, 4).map(f => (
                  <div key={f.id} className="py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      {f.type === 'positive' ? <ThumbsUp className="h-3 w-3 text-success" /> : <ThumbsDown className="h-3 w-3 text-destructive" />}
                      <span className="text-xs font-medium">{f.user}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(f.timestamp).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {f.comment && <p className="text-xs text-muted-foreground mt-0.5 ml-5">{f.comment}</p>}
                  </div>
                )) : <p className="text-sm text-muted-foreground">Nenhum feedback ainda</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Identidade">
                <Field label="Nome" value={assistant.name} />
                <Field label="Área" value={assistant.area} />
                <Field label="Responsável" value={assistant.owner} />
                <Field label="Descrição" value={assistant.description} />
                <Field label="Ambiente" value={assistant.environment || 'Não definido'} />
              </Section>
              <Section title="Persona e Tom">
                <Field label="Persona" value={assistant.persona} />
                <Field label="Tom de voz" value={assistant.tone} />
                <Field label="Humor" value={assistant.humor} />
                <Field label="Formalidade" value={assistant.formality} />
              </Section>
              <Section title="Objetivo e Tarefas">
                <Field label="Objetivo" value={assistant.objective} multiline />
                <Field label="Tarefas permitidas" value={assistant.tasks} multiline />
                <Field label="Tarefas proibidas" value={assistant.prohibitedTasks} multiline />
              </Section>
              <Section title="Regras e Restrições">
                <Field label="Regras" value={assistant.rules} multiline />
                <Field label="Restrições" value={assistant.restrictions} multiline />
                <Field label="Instruções críticas" value={assistant.criticalInstructions} multiline />
              </Section>
              <Section title="Modelo e Parâmetros">
                <Field label="Modelo principal" value={assistant.model} />
                <Field label="Modelo fallback" value={assistant.fallbackModel || 'Não configurado'} />
                <Field label="Temperatura" value={String(assistant.temperature)} />
              </Section>
              <Section title="Resposta e Limites">
                <Field label="Formato de resposta" value={assistant.responseFormat} multiline />
                <Field label="Limites" value={assistant.limits} multiline />
                <Field label="Política de escalonamento" value={assistant.escalationPolicy} multiline />
              </Section>
              <Section title="Exemplos Positivos">
                <Field label="" value={assistant.positiveExamples} multiline />
              </Section>
              <Section title="Exemplos Negativos">
                <Field label="" value={assistant.negativeExamples} multiline />
              </Section>
            </div>
          </div>
        )}

        {activeTab === 'governance' && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border bg-card p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" /> Aprovações
                    </h3>
                    <p className="text-xs text-muted-foreground">{pendingApprovals.length} pendente(s)</p>
                  </div>
                  {hasPermission('assistants.approval.request') && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setApprovalForm({ action: 'publish', reason: '', assistantVersionId: versions[0]?.id ?? '' });
                        setApprovalDialogOpen(true);
                      }}
                    >
                      <Shield className="h-3.5 w-3.5 mr-1" />Solicitar
                    </Button>
                  )}
                </div>
                {approvals.length > 0 ? (
                  <div className="space-y-3">
                    {approvals.slice(0, 8).map(approval => (
                      <div key={approval.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{approvalActionLabel(approval.action)}</p>
                            <p className="text-xs text-muted-foreground">
                              {approval.requestedBy?.name
  ?? approval.requestedBy?.email
  ?? 'Solicitante não disponível'} · {new Date(approval.createdAt).toLocaleString('pt-BR')}
                            </p>
                            {approval.reason && <p className="mt-1 text-xs text-muted-foreground">{approval.reason}</p>}
                          </div>
                          <StatusBadge status={approval.status} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {approval.status === 'pending' && hasPermission('assistants.approval.approve') && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { void handleApprovalDecision(approval.id, 'approve'); }}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />Aprovar
                            </Button>
                          )}
                          {approval.status === 'pending' && hasPermission('assistants.approval.reject') && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { void handleApprovalDecision(approval.id, 'reject'); }}>
                              <XCircle className="h-3.5 w-3.5 mr-1" />Rejeitar
                            </Button>
                          )}
                          {approval.status === 'pending' && hasPermission('assistants.approval.cancel') && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { void handleApprovalDecision(approval.id, 'cancel'); }}>
                              <X className="h-3.5 w-3.5 mr-1" />Cancelar
                            </Button>
                          )}
                          {approval.status === 'approved' && approval.action === 'publish' && hasPermission('assistants.publish') && (
                            <Button size="sm" className="h-7 text-xs" onClick={() => { void handlePublishWithApproval(approval.id, approval.assistantVersionId); }}>
                              <Send className="h-3.5 w-3.5 mr-1" />Publicar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma aprovação registrada.</p>
                )}
              </div>

              <div className="space-y-4">
                <LlmExecutionPolicyPanel
                  policy={executionPolicy}
                  isLoading={assistantExecutionPolicyQuery.isLoading}
                  isError={assistantExecutionPolicyQuery.isError}
                  canEdit={hasPermission('assistants.execution.configure')}
                  isSaving={updateExecutionPolicyMutation.isPending}
                  onRefresh={() => { void assistantExecutionPolicyQuery.refetch(); }}
                  onSave={handleLlmPolicyUpdate}
                />

                <div className="rounded-lg border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" /> Política de execução
                    </h3>
                    {executionPolicy && (
  <Badge variant="secondary" className="text-[10px]">
    {executionModeLabel(executionPolicy.executionMode)}
  </Badge>
)}
                  </div>
                  {executionPolicy ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Modo</Label>
                        <Select
                          value={executionPolicy.executionMode}
                          onValueChange={value => { void handlePolicyUpdate({ executionMode: value as AssistantExecutionMode }); }}
                          disabled={!hasPermission('assistants.execution.configure') || updateExecutionPolicyMutation.isPending}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft_test">Teste em rascunho</SelectItem>
                            <SelectItem value="sandbox">Sandbox</SelectItem>
                            <SelectItem value="published">Publicado</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Escopo de resposta</Label>
                        <Select
                          value={executionPolicy.responseScopeMode}
                          onValueChange={value => { void handlePolicyUpdate({ responseScopeMode: value as ResponseScopeMode }); }}
                          disabled={!hasPermission('assistants.execution.configure') || updateExecutionPolicyMutation.isPending}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="knowledge_only">Somente base de conhecimento</SelectItem>
                            <SelectItem value="knowledge_first">Base primeiro, geral se faltar</SelectItem>
                            <SelectItem value="general_allowed">Geral permitido</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Define se o assistente responde somente com fontes vinculadas, usa a base primeiro ou permite conhecimento geral.
                        </p>
                      </div>
                      <PolicySwitch
                        label="Aprovação para publicar"
                        checked={executionPolicy.requiresApprovalToPublish}
                        disabled={!hasPermission('assistants.execution.configure') || updateExecutionPolicyMutation.isPending}
                        onCheckedChange={checked => { void handlePolicyUpdate({ requiresApprovalToPublish: checked }); }}
                      />
                      <PolicySwitch
                        label="Sandbox habilitado"
                        checked={executionPolicy.sandboxEnabled}
                        disabled={!hasPermission('assistants.execution.configure') || updateExecutionPolicyMutation.isPending}
                        onCheckedChange={checked => { void handlePolicyUpdate({ sandboxEnabled: checked }); }}
                      />
                      <PolicySwitch
                        label="Teste em rascunho"
                        checked={executionPolicy.allowDraftTesting}
                        disabled={!hasPermission('assistants.execution.configure') || updateExecutionPolicyMutation.isPending}
                        onCheckedChange={checked => { void handlePolicyUpdate({ allowDraftTesting: checked }); }}
                      />
                      <PolicySwitch
                        label="Execução publicada"
                        checked={executionPolicy.allowPublishedExecution}
                        disabled={!hasPermission('assistants.execution.configure') || updateExecutionPolicyMutation.isPending}
                        onCheckedChange={checked => { void handlePolicyUpdate({ allowPublishedExecution: checked }); }}
                      />
                      <PolicySwitch
                        label="Execução habilitada"
                        checked={executionPolicy.isExecutionEnabled}
                        disabled={!hasPermission('assistants.execution.enable') || updateExecutionPolicyMutation.isPending}
                        onCheckedChange={checked => { void handlePolicyUpdate({ isExecutionEnabled: checked }); }}
                      />
                      <div className="grid grid-cols-2 gap-2 border-t pt-3 text-xs text-muted-foreground">
                        <span>Ferramentas externas: {executionPolicy.sandboxBlocksExternalTools ? 'bloqueadas' : 'liberadas'}</span>
                        <span>Provedores reais: {executionPolicy.sandboxBlocksRealProviders ? 'bloqueados' : 'liberados'}</span>
                        <span>Autenticação do sandbox: {executionPolicy.sandboxRequiresAuth ? 'obrigatória' : 'opcional'}</span>
                        <span>Logs: {executionPolicy.sandboxLogsRequired ? 'obrigatorios' : 'opcionais'}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Policy ainda nao carregada.</p>
                  )}
                </div>

                <div className="rounded-lg border bg-card p-5">
                  <h3 className="mb-4 text-sm font-semibold flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary" /> Pré-checagem de execução
                  </h3>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Select value={precheckMode} onValueChange={value => setPrecheckMode(value as AssistantExecutionMode)}>
                      <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft_test">Teste em rascunho</SelectItem>
                        <SelectItem value="sandbox">Sandbox</SelectItem>
                        <SelectItem value="published">Publicado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => { void handleExecutionPrecheck(); }} disabled={executionPrecheckMutation.isPending}>
                      <Play className="h-3.5 w-3.5 mr-1" />Checar
                    </Button>
                  </div>
                  {executionPrecheckMutation.data && (
                    <div className={`mt-4 rounded-md border p-3 ${executionPrecheckMutation.data.canExecute ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{executionPrecheckMutation.data.canExecute ? 'Liberado' : 'Bloqueado'}</span>
                        <StatusBadge status={executionPrecheckMutation.data.mode} />
                      </div>
                      {executionPrecheckMutation.data.reasons.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {executionPrecheckMutation.data.reasons.map(reason => (
                            <li key={reason.code} className="flex gap-2">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                              <span>{reason.code}: {reason.message}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'runs' && (
          <div className="space-y-4">
            <RuntimePanel
              health={runtimeHealthQuery.data}
              capabilities={runtimeCapabilitiesQuery.data}
              config={runtimeConfigQuery.data}
              providers={runtimeProvidersQuery.data ?? []}
              isLoading={runtimeHealthQuery.isLoading || runtimeCapabilitiesQuery.isLoading || runtimeConfigQuery.isLoading || runtimeProvidersQuery.isLoading}
              onRefresh={() => {
                void runtimeHealthQuery.refetch();
                void runtimeCapabilitiesQuery.refetch();
                void runtimeConfigQuery.refetch();
                void runtimeProvidersQuery.refetch();
              }}
            />
            <LlmProviderPanel
              config={llmConfigQuery.data}
              providers={llmProvidersQuery.data ?? []}
              isLoading={llmProvidersQuery.isLoading || llmConfigQuery.isLoading}
              onRefresh={() => {
                void llmProvidersQuery.refetch();
                void llmConfigQuery.refetch();
              }}
            />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="rounded-lg border bg-card p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" /> Nova execução
                    </h3>
                    <p className="text-xs text-muted-foreground">Run controlado com precheck e runtime adapter.</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">sem provedor externo</Badge>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Modo</Label>
                    <Select value={runMode} onValueChange={value => setRunMode(value as AssistantExecutionMode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft_test">Teste em rascunho</SelectItem>
                        <SelectItem value="sandbox">Sandbox</SelectItem>
                        <SelectItem value="published">Publicado</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Entrada</Label>
                    <Textarea
                      value={runInput}
                      onChange={e => setRunInput(e.target.value)}
                      rows={6}
                      maxLength={2000}
                      placeholder="Digite a entrada controlada para o run."
                    />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{runInput.length}/2000</span>
                      <span>{executionPolicy?.executionMode ? `Política: ${executionModeLabel(executionPolicy.executionMode)}` : 'Política pendente'}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => { void handleCreateAgentRun(); }}
                    disabled={!hasPermission('agent_runs.create') || createAgentRunMutation.isPending || !runInput.trim()}
                    className="w-full"
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />Simular execução
                  </Button>
                  {!hasPermission('agent_runs.create') && (
                    <p className="text-xs text-muted-foreground">Permissão agent_runs.create necessária.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" /> Histórico
                    </h3>
                    <p className="text-xs text-muted-foreground">{runs.length} run(s) registrado(s)</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { void refetchAssistantRuns(); }}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />Atualizar
                  </Button>
                </div>
                {assistantRunsLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando execuções...</p>
                ) : runs.length > 0 ? (
                  <div className="space-y-3">
                    {runs.slice(0, 8).map(run => (
                      <AgentRunCard
                        key={run.id}
                        run={run}
                        canCancel={hasPermission('agent_runs.cancel') && canCancelRun(run.status)}
                        isCancelling={cancelAgentRunMutation.isPending}
                        onCancel={() => { void handleCancelAgentRun(run.id); }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />Prontidão do RAG
                  </h3>
                  <p className="text-xs text-muted-foreground">Recuperação local por palavra-chave, com fontes e citações persistidas.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { void ragReadinessQuery.refetch(); }}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />Verificar prontidão
                </Button>
              </div>
              {ragReadinessQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando prontidão...</p>
              ) : ragReadiness ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-5">
                    <div className="rounded-md border p-3"><p className="text-[10px] text-muted-foreground">Status</p><p className="text-sm font-semibold">{readinessStatusLabel(ragReady ? 'ready' : 'blocked')}</p></div>
                    <div className="rounded-md border p-3"><p className="text-[10px] text-muted-foreground">Bases</p><p className="text-sm font-semibold">{ragReadiness.knowledgeBaseCount ?? ragReadiness.knowledgeBasesBound}</p></div>
                    <div className="rounded-md border p-3"><p className="text-[10px] text-muted-foreground">Documentos</p><p className="text-sm font-semibold">{ragReadiness.documentCount ?? ragReadiness.documentsIngested}</p></div>
                    <div className="rounded-md border p-3"><p className="text-[10px] text-muted-foreground">Trechos</p><p className="text-sm font-semibold">{ragReadiness.chunkCount ?? ragReadiness.chunksAvailable}</p></div>
                    <div className="rounded-md border p-3"><p className="text-[10px] text-muted-foreground">Fontes</p><p className="text-sm font-semibold">{ragReadiness.sourceReferenceCount ?? 0}</p></div>
                  </div>
                  {ragBlockedReasons.length > 0 && (
                    <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
                      <p className="text-xs font-medium text-warning">Pendências</p>
                      <p className="mt-1 text-xs text-muted-foreground">{ragBlockedReasons.join(', ')}</p>
                    </div>
                  )}
                  {ragReadiness.warnings && ragReadiness.warnings.length > 0 && (
                    <div className="rounded-md border p-3">
                      <p className="text-xs font-medium">Avisos</p>
                      <div className="mt-2 space-y-1">
                        {ragReadiness.warnings.map(warning => (
                          <p key={warning.code} className="text-xs text-muted-foreground">{warning.code}: {warning.message}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex flex-1 items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5">
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        value={ragSearchQuery}
                        onChange={event => setRagSearchQuery(event.target.value)}
                        placeholder="Consulta local em trechos autorizados"
                        className="w-full bg-transparent text-sm outline-none"
                      />
                    </div>
                    <Button onClick={() => { void handleRagLocalSearch(); }} disabled={!ragSearchQuery.trim() || ragQueryMutation.isPending}>
                      <Search className="h-3.5 w-3.5 mr-1" />Consultar
                    </Button>
                  </div>
                  {ragQueryMutation.data && (
                    <div className="space-y-2">
                      <div className={`rounded-md border p-3 ${ragQueryMutation.data.status === 'blocked' ? 'border-warning/30 bg-warning/5' : ''}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={ragQueryMutation.data.status} />
                            {ragQueryMutation.data.queryId && <span className="font-mono text-[10px] text-muted-foreground">{ragQueryMutation.data.queryId.slice(0, 8)}</span>}
                          </div>
                          <Badge variant="outline" className="text-[10px]">local_keyword</Badge>
                        </div>
                        {ragQueryMutation.data.message && <p className="mt-2 text-sm text-muted-foreground">{ragQueryMutation.data.message}</p>}
                        {ragQueryMutation.data.reasons && ragQueryMutation.data.reasons.length > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">{ragQueryMutation.data.reasons.join(', ')}</p>
                        )}
                        {ragQueryMutation.data.warnings.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {ragQueryMutation.data.warnings.map(warning => (
                              <p key={warning.code} className="text-xs text-muted-foreground">{warning.code}: {warning.message}</p>
                            ))}
                          </div>
                        )}
                      </div>
                      {ragQueryMutation.data.sources.length === 0 ? (
                        ragQueryMutation.data.status !== 'blocked' && <p className="text-sm text-muted-foreground">Nenhum chunk encontrado por keyword local.</p>
                      ) : ragQueryMutation.data.sources.map(source => (
                        <div key={`${source.chunkId}-${source.rank}`} className="rounded-md border p-3">
                          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline">{source.citationLabel}</Badge>
                            <Badge variant="secondary">score {source.score}</Badge>
                            {source.matchType && <span className="text-muted-foreground">{source.matchType}</span>}
                            <span className="font-mono text-muted-foreground">{source.chunkId.slice(0, 8)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{source.excerpt}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {source.documentTitle && <span>{source.documentTitle}</span>}
                            {source.sourceUri && <span className="font-mono">{source.sourceUri}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">Histórico de consultas</p>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { void ragQueriesQuery.refetch(); }}>
                        <RefreshCw className="h-3 w-3 mr-1" />Atualizar
                      </Button>
                    </div>
                    {ragQueriesQuery.isLoading ? (
                      <p className="text-xs text-muted-foreground">Carregando histórico...</p>
                    ) : ragHistory.length > 0 ? (
                      <div className="space-y-2">
                        {ragHistory.slice(0, 5).map(query => (
                          <div key={query.id} className="flex flex-col gap-1 rounded border bg-muted/30 p-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">{query.query}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(query.createdAt).toLocaleString('pt-BR')} · {query.mode}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={query.status} />
                              <span className="text-[10px] text-muted-foreground">{query.resultCount} fonte(s)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma consulta registrada.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Readiness indisponível.</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Bases de Conhecimento Vinculadas ({kbs.length})</h3>
              <Button variant="outline" size="sm" onClick={() => setKnowledgeBindingDialogOpen(true)}><BookOpen className="h-3.5 w-3.5 mr-1" />Vincular Base</Button>
            </div>
            {kbs.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {kbs.map(kb => (
                  <div key={kb.id} className="rounded-lg border bg-card p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-info"><BookOpen className="h-5 w-5" /></div>
                        <div>
                          <h4 className="font-semibold">{kb.name}</h4>
                          <p className="text-xs text-muted-foreground">{kb.classification}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={kb.status} />
                        {knowledgeBindingByBaseId.has(kb.id) && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { void handleRemoveKnowledgeBaseBinding(kb.id); }} disabled={removeKnowledgeBindingMutation.isPending}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{kb.description}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center border-t pt-3">
                      <div><p className="text-lg font-bold">{kb.documentCount}</p><p className="text-[10px] text-muted-foreground">Documentos</p></div>
                      <div><p className="text-lg font-bold">{kb.totalChunks.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Trechos</p></div>
                      <div><p className="text-lg font-bold">{kb.size}</p><p className="text-[10px] text-muted-foreground">Tamanho</p></div>
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">Última atualização: {new Date(kb.lastUpdated).toLocaleDateString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma base de conhecimento vinculada</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setKnowledgeBindingDialogOpen(true)}><BookOpen className="h-3.5 w-3.5 mr-1" />Vincular Base</Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  Ferramentas MCP vinculadas ({tools.length})
                </h3>

                <p className="text-xs text-muted-foreground">
                  Vínculos governados. Apenas ferramentas habilitadas podem participar do sandbox.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setMcpBindingDialogOpen(true)}><Server className="h-3.5 w-3.5 mr-1" />Vincular Ferramenta</Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-lg border bg-card p-5">
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />MCP Sandbox</h4>
                    <p className="text-xs text-muted-foreground">Execução determinística sem chamada MCP externa.</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Sandbox</Badge>
                </div>

                {tools.length > 0 && sandboxMcpTools.length === 0 && (
                  <div className="mb-4 rounded-md border border-warning/30 bg-warning/5 p-3">
                    <p className="text-xs font-medium text-warning">
                      Nenhuma ferramenta habilitada para sandbox
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Os vínculos atuais permanecem associados ao Assistant, mas estão
                      desabilitados pela governança. Nenhuma execução MCP está disponível.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Ferramenta</Label>
                    <Select value={activeSandboxToolId || 'none'} onValueChange={value => setSelectedSandboxToolId(value === 'none' ? '' : value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sandboxMcpTools.length === 0 && (
                          <SelectItem value="none">
                            Nenhuma ferramenta habilitada para sandbox
                          </SelectItem>
                        )}
                        {sandboxMcpTools.map((tool) => (
                          <SelectItem key={tool.id} value={tool.id}>
                            {tool.name} · {riskLevelLabel(tool.riskLevel)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedSandboxTool && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Risco</p><Badge variant="outline" className="text-[10px]">{riskLevelLabel(selectedSandboxTool.riskLevel)}</Badge></div>
                      <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Aprovação</p><p className="font-medium">{selectedSandboxTool.requiresApproval ? 'Obrigatório' : 'Não'}</p></div>
                      <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Modo</p><p className="font-medium">Somente sandbox</p></div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Entrada</Label>
                    <Textarea
                      value={mcpSandboxInput}
                      onChange={event => setMcpSandboxInput(event.target.value)}
                      rows={6}
                      maxLength={4000}
                      className="font-mono text-xs"
                      disabled={!activeSandboxToolId}
                    />
                    <p className="text-[10px] text-muted-foreground">{mcpSandboxInput.length}/4000</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={() => { void handleMcpSandboxPrecheck(); }} disabled={!activeSandboxToolId || mcpSandboxPrecheckMutation.isPending}>
                      <Shield className="h-3.5 w-3.5 mr-1" />Pré-checagem sandbox
                    </Button>
                    <Button onClick={() => { void handleMcpSandboxRun(); }} disabled={!activeSandboxToolId || mcpSandboxToolCallMutation.isPending}>
                      <Play className="h-3.5 w-3.5 mr-1" />Executar teste em sandbox
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Resultado</h4>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { void refetchAssistantMcpToolCalls(); }}>
                    <RefreshCw className="h-3 w-3 mr-1" />Atualizar
                  </Button>
                </div>
                {mcpSandboxPrecheckMutation.data && (
                  <McpPrecheckCard precheck={mcpSandboxPrecheckMutation.data} />
                )}
                {mcpSandboxToolCallMutation.data && (
                  <div className="mt-3">
                    <McpToolCallCard call={mcpSandboxToolCallMutation.data} onSelect={() => setSelectedMcpToolCallId(mcpSandboxToolCallMutation.data.id)} selected={selectedMcpToolCall?.id === mcpSandboxToolCallMutation.data.id} />
                  </div>
                )}
                {!mcpSandboxPrecheckMutation.data && !mcpSandboxToolCallMutation.data && (
                  <div className="py-10 text-center">
                    <Wrench className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum teste sandbox executado nesta sessão.</p>
                  </div>
                )}
              </div>
            </div>

            {tools.length > 0 ? (
              <div className="rounded-lg border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ferramenta</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Descrição</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Risco</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Aprovação</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Execuções</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tools.map(t => (
                      <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <p className="font-mono text-xs font-medium">{t.name}</p>
                            <div className="flex flex-wrap gap-1">
                              {isRemoteMaterializedMcpTool(t) && (
                                <Badge variant="outline" className="text-[9px]">
                                  Governada
                                </Badge>
                              )}
                              {t.isEnabled === false && (
                                <Badge variant="outline" className="text-[9px]">
                                  Desabilitada
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{t.description}</td>
                        <td className="px-4 py-3"><StatusBadge status={t.riskLevel} /></td>
                        <td className="px-4 py-3">
                          {t.requiresApproval ? (
                            <span className="flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3 w-3" />Obrigatória</span>
                          ) : (
                            <span className="text-xs text-success">Automática</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs">{t.executionCount.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setSelectedSandboxToolId(t.id); void handleMcpSandboxPrecheck(t.id); }} disabled={!sandboxMcpToolIds.has(t.id) || mcpSandboxPrecheckMutation.isPending}>
                              <Shield className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setSelectedSandboxToolId(t.id); void handleMcpSandboxRun(t.id); }} disabled={!sandboxMcpToolIds.has(t.id) || mcpSandboxToolCallMutation.isPending}>
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                            {mcpBindingByToolId.has(t.id) ? (
                              isRemoteMaterializedMcpTool(t) ? (
                                <span className="flex items-center gap-1 px-2 text-[10px] text-muted-foreground">
                                  <Shield className="h-3 w-3" />
                                  governado
                                </span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => { void handleRemoveMcpBinding(t.id); }}
                                  disabled={removeMcpBindingMutation.isPending}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              )
                            ) : (
                              <span className="px-2 text-xs text-muted-foreground">legado</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Server className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma ferramenta MCP vinculada</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setMcpBindingDialogOpen(true)}><Server className="h-3.5 w-3.5 mr-1" />Vincular Ferramenta</Button>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="rounded-lg border bg-card p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Histórico de chamadas de ferramenta</h4>
                    <p className="text-xs text-muted-foreground">{assistantMcpToolCalls.length} registro(s)</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { void refetchAssistantMcpToolCalls(); }}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />Atualizar
                  </Button>
                </div>
                {assistantMcpToolCallsLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando histórico MCP...</p>
                ) : assistantMcpToolCalls.length > 0 ? (
                  <div className="space-y-2">
                    {assistantMcpToolCalls.slice(0, 8).map(call => (
                      <McpToolCallCard key={call.id} call={call} selected={selectedMcpToolCall?.id === call.id} onSelect={() => setSelectedMcpToolCallId(call.id)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma chamada de ferramenta registrada.</p>
                )}
              </div>

              <div className="rounded-lg border bg-card p-5">
                <h4 className="mb-4 text-sm font-semibold flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" />Linha do tempo</h4>
                {selectedMcpToolCall ? (
                  <McpToolCallTimeline call={selectedMcpToolCall} />
                ) : (
                  <p className="text-sm text-muted-foreground">Selecione uma chamada de ferramenta para visualizar os eventos.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'prompt' && (
          <PromptCompiledTab assistant={assistant} kbs={kbs} tools={tools} compiledPrompt={compiledPrompt} />
        )}

        {activeTab === 'tests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Resultados de Testes ({tests.length})</h3>
              {hasPermission('assistants.testResults.create') && (
                <Button size="sm" onClick={() => setTestDialogOpen(true)}>
                  <Play className="h-3.5 w-3.5 mr-1" />Registrar Teste
                </Button>
              )}
            </div>
            {tests.length > 0 ? (
              <div className="space-y-3">
                {tests.map(t => {
                  const testStatus = t.status ?? (t.passed ? 'passed' : 'failed');
                  return (
                  <div key={t.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {testStatus === 'passed' ? <CheckCircle className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                        <div>
                          <p className="text-sm font-medium">Prompt: "{t.prompt}"</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {t.model} · {t.latency}s · {t.tokensUsed} tokens · {new Date(t.timestamp).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={testStatus} />
                    </div>
                    <div className="mt-2 rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground font-medium mb-1">Resposta:</p>
                      <p className="text-sm">{t.response.slice(0, 200)}{t.response.length > 200 ? '…' : ''}</p>
                    </div>
                    {(t.sourcesUsed.length > 0 || t.toolsUsed.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {t.sourcesUsed.map((s, i) => (
                          <span key={i} className="flex items-center gap-1 rounded bg-info/10 px-2 py-0.5 text-[10px] text-info">
                            <BookOpen className="h-2.5 w-2.5" />{s}
                          </span>
                        ))}
                        {t.toolsUsed.map((tool, i) => (
                          <span key={i} className="flex items-center gap-1 rounded bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
                            <Wrench className="h-2.5 w-2.5" />{tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );})}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum teste executado ainda</p>
                {hasPermission('assistants.testResults.create') && (
                  <Button size="sm" className="mt-3" onClick={() => setTestDialogOpen(true)}>
                    <Play className="h-3.5 w-3.5 mr-1" />Registrar Primeiro Teste
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (env.useMocks ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Conversas (mês)" value={assistant.conversations.toLocaleString()} change={12} trend="up" icon={<MessageSquare className="h-5 w-5" />} />
              <KpiCard label="Custo (mês)" value={`R$ ${assistant.costThisMonth.toFixed(2)}`} change={-5} trend="down" icon={<DollarSign className="h-5 w-5" />} />
              <KpiCard label="Satisfação" value={assistant.satisfaction > 0 ? `${assistant.satisfaction}%` : '—'} icon={<ThumbsUp className="h-5 w-5" />} />
              <KpiCard label="Feedbacks" value={feedbacks.length} icon={<Zap className="h-5 w-5" />} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-sm font-semibold mb-4">Conversas por Dia</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={assistantAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="conversations" stroke="hsl(16, 99%, 55%)" fill="hsl(16, 99%, 55%)" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-sm font-semibold mb-4">Custo por Dia (R$)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={assistantAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="cost" fill="hsl(16, 99%, 55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" />}
            title="Analytics do assistente ainda indisponivel"
            description="A API real ainda nao fornece metricas consolidadas por assistente. Nenhum grafico de demonstracao e exibido."
          />
        ))}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Trilha de Auditoria</h3>
            {auditLogs.length > 0 ? (
              <div className="rounded-lg border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Horário</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Evento</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Descrição</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Risco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{log.event.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">{log.description}</td>
                        <td className="px-4 py-3 text-xs">{log.user}</td>
                        <td className="px-4 py-3"><StatusBadge status={log.riskLevel} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Shield className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum evento de auditoria registrado</p>
              </div>
            )}
          </div>
        )}

        <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Solicitar approval</DialogTitle>
              <DialogDescription>Crie uma solicitação auditável para uma ação sensível.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Ação</Label>
                <Select value={approvalForm.action} onValueChange={value => setApprovalForm(prev => ({ ...prev, action: value as AssistantApprovalAction }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="publish">Publicar</SelectItem>
                    <SelectItem value="rollback">Rollback</SelectItem>
                    <SelectItem value="restore">Restaurar</SelectItem>
                    <SelectItem value="enable_execution">Habilitar execução</SelectItem>
                    <SelectItem value="configure_sandbox">Configurar sandbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Versão</Label>
                <Select value={approvalForm.assistantVersionId || 'none'} onValueChange={value => setApprovalForm(prev => ({ ...prev, assistantVersionId: value === 'none' ? '' : value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem versão específica</SelectItem>
                    {versions.map(version => (
                      <SelectItem key={version.id} value={version.id}>v{version.version} · {version.changelog}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Textarea value={approvalForm.reason} onChange={e => setApprovalForm(prev => ({ ...prev, reason: e.target.value }))} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => { void handleCreateApproval(); }} disabled={createApprovalMutation.isPending}>
                Solicitar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Rollback de publicação</DialogTitle>
              <DialogDescription>Promova uma versão anterior como publicação ativa.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Versão</Label>
                <Select value={rollbackVersionId} onValueChange={setRollbackVersionId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a versão" /></SelectTrigger>
                  <SelectContent>
                    {rollbackCandidates.map(version => (
                      <SelectItem key={version.id} value={version.id}>v{version.version} · {version.changelog}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Textarea value={rollbackReason} onChange={e => setRollbackReason(e.target.value)} rows={3} placeholder="Descreva o motivo operacional do rollback." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRollbackDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => { void handleRollback(); }} disabled={!rollbackVersionId || rollbackMutation.isPending}>
                Aplicar rollback
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar feedback</DialogTitle>
              <DialogDescription>Feedback associado ao assistente e, quando houver, à publicação ativa.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Avaliação</Label>
                <Select value={feedbackForm.rating} onValueChange={value => setFeedbackForm(prev => ({ ...prev, rating: value as FeedbackType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Positiva</SelectItem>
                    <SelectItem value="neutral">Neutra</SelectItem>
                    <SelectItem value="negative">Negativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Comentário</Label>
                <Textarea value={feedbackForm.comment} onChange={e => setFeedbackForm(prev => ({ ...prev, comment: e.target.value }))} rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => { void handleCreateFeedback(); }} disabled={createFeedbackMutation.isPending}>
                Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar teste manual</DialogTitle>
              <DialogDescription>Resultado simulado/manual, sem chamada a runtime ou provedor de IA.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Entrada</Label>
                <Textarea value={testForm.input} onChange={e => setTestForm(prev => ({ ...prev, input: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Comportamento esperado</Label>
                <Textarea value={testForm.expectedBehavior} onChange={e => setTestForm(prev => ({ ...prev, expectedBehavior: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Saída observada</Label>
                <Textarea value={testForm.actualOutput} onChange={e => setTestForm(prev => ({ ...prev, actualOutput: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={testForm.status} onValueChange={value => setTestForm(prev => ({ ...prev, status: value as AssistantTestStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passed">Passou</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>
                    <SelectItem value="needs_review">Revisar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Score</Label>
                <Input type="number" min={0} max={100} value={testForm.score} onChange={e => setTestForm(prev => ({ ...prev, score: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notas</Label>
                <Textarea value={testForm.notes} onChange={e => setTestForm(prev => ({ ...prev, notes: e.target.value }))} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => { void handleCreateTestResult(); }} disabled={!testForm.input || !testForm.actualOutput || createTestResultMutation.isPending}>
                Registrar teste
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={knowledgeBindingDialogOpen} onOpenChange={setKnowledgeBindingDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Vincular Base de Conhecimento</DialogTitle>
              <DialogDescription>Crie um binding governado em modo retrieval placeholder.</DialogDescription>
            </DialogHeader>
            {availableKnowledgeBases.length > 0 ? (
              <div className="space-y-2">
                <Label>Base</Label>
                <Select value={selectedKnowledgeBaseId} onValueChange={setSelectedKnowledgeBaseId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma base" /></SelectTrigger>
                  <SelectContent>
                    {availableKnowledgeBases.map(kb => (
                      <SelectItem key={kb.id} value={kb.id}>{kb.name} · {kb.classification}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Não há bases disponíveis para vincular.</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setKnowledgeBindingDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => { void handleBindKnowledgeBase(); }} disabled={!selectedKnowledgeBaseId || createKnowledgeBindingMutation.isPending}>
                Vincular
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={mcpBindingDialogOpen} onOpenChange={setMcpBindingDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Vincular ferramenta MCP</DialogTitle>
              <DialogDescription>
                {selectedMcpBindingTool && isRemoteMaterializedMcpTool(selectedMcpBindingTool)
                  ? 'A ferramenta será associada ao Assistant em estado governado e desabilitado, sem execução MCP real.'
                  : 'Crie um vínculo governado em modo sandbox, sem execução MCP real.'}
              </DialogDescription>
            </DialogHeader>

            {availableMcpTools.length > 0 ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Ferramenta</Label>
                  <Select value={selectedMcpToolId} onValueChange={setSelectedMcpToolId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma ferramenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMcpTools.map((tool) => (
                        <SelectItem key={tool.id} value={tool.id}>
                          {tool.name}
                          {' · risco '}
                          {riskLevelLabel(tool.riskLevel)}
                          {isRemoteMaterializedMcpTool(tool) ? ' · governada' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedMcpBindingTool
                  && isRemoteMaterializedMcpTool(selectedMcpBindingTool) && (
                  <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-warning" />
                      <p className="text-xs font-medium">
                        Materialização remota governada
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded border bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Vínculo</p>
                        <p className="font-medium">Desabilitado</p>
                      </div>
                      <div className="rounded border bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">McpTool</p>
                        <p className="font-medium">Desabilitada</p>
                      </div>
                      <div className="rounded border bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Runtime</p>
                        <p className="font-medium">Bloqueado</p>
                      </div>
                      <div className="rounded border bg-background/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Execução remota</p>
                        <p className="font-medium">Bloqueada</p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-muted-foreground">
                      A aprovação permanece obrigatória. Este vínculo não cria
                      chamada de ferramenta nem libera execução.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Não há ferramentas disponíveis para vincular.
              </p>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setMcpBindingDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => { void handleBindMcpTool(); }}
                disabled={!selectedMcpToolId || createMcpBindingMutation.isPending}
              >
                {selectedMcpBindingTool && isRemoteMaterializedMcpTool(selectedMcpBindingTool)
                  ? 'Vincular governada'
                  : 'Vincular'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

// ─── Prompt Compiled Tab ───

interface PromptSection {
  id: string;
  title: string;
  content: string;
  editable: boolean;
}

function mcpToolPromptLine(tool: McpTool) {
  const markers: string[] = [];

  if (isRemoteMaterializedMcpTool(tool)) {
    markers.push('GOVERNADA');
  }

  if (tool.isEnabled === false) {
    markers.push('DESABILITADA');
  }

  if (tool.requiresApproval) {
    markers.push('REQUER APROVAÇÃO');
  }

  const suffix = markers.length > 0
    ? ` [${markers.join(' · ')}]`
    : '';

  return `- ${tool.name}: ${tool.description || 'Sem descrição'}${suffix}`;
}

function buildSections(a: Assistant, kbs: KnowledgeBase[], tls: McpTool[]): PromptSection[] {
  return [
    { id: 'persona', title: 'Persona', content: a.persona || 'Não definida', editable: true },
    { id: 'objective', title: 'Objetivo', content: a.objective || 'Não definido', editable: true },
    { id: 'tone', title: 'Tom de Voz', content: `${a.tone || 'Não definido'} | Humor: ${a.humor || 'Neutro'} | Formalidade: ${a.formality || 'formal'}`, editable: true },
    { id: 'tasks', title: 'Tarefas Permitidas', content: a.tasks || '- Não definidas', editable: true },
    { id: 'prohibited', title: 'Tarefas Proibidas', content: a.prohibitedTasks || '- Não definidas', editable: true },
    { id: 'rules', title: 'Regras', content: a.rules || '- Não definidas', editable: true },
    { id: 'restrictions', title: 'Restrições', content: a.restrictions || '- Não definidas', editable: true },
    { id: 'critical', title: 'Instruções Críticas', content: a.criticalInstructions || '- Não definidas', editable: true },
    { id: 'format', title: 'Formato de Resposta', content: a.responseFormat || 'Padrão', editable: true },
    { id: 'positive', title: 'Exemplos Positivos', content: a.positiveExamples || '—', editable: true },
    { id: 'negative', title: 'Exemplos Negativos', content: a.negativeExamples || '—', editable: true },
    { id: 'limits', title: 'Limites', content: a.limits || 'Não definidos', editable: true },
    { id: 'escalation', title: 'Política de Escalonamento', content: a.escalationPolicy || 'Não definida', editable: true },
    { id: 'model', title: 'Configuração do Modelo', content: `- Modelo principal: ${a.model}\n- Modelo fallback: ${a.fallbackModel || 'Não configurado'}\n- Temperatura: ${a.temperature}`, editable: false },
    { id: 'knowledge', title: 'Bases de Conhecimento', content: kbs.length > 0 ? kbs.map(kb => `- ${kb.name} (${kb.documentCount} documentos, ${kb.totalChunks} trechos)`).join('\n') : '- Nenhuma', editable: false },
    { id: 'tools_section', title: 'Ferramentas MCP', content: tls.length > 0 ? tls.map(mcpToolPromptLine).join('\n') : '- Nenhuma', editable: false },
  ];
}

function estTokens(text: string): number {
  return Math.ceil(text.length / 3.8);
}

function PromptCompiledTab({ assistant, kbs, tools, compiledPrompt }: {
  assistant: Assistant;
  kbs: KnowledgeBase[];
  tools: McpTool[];
  compiledPrompt: string;
}) {
  const [sections, setSections] = useState<PromptSection[]>(() => buildSections(assistant, kbs, tools));
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'sections' | 'raw' | 'diff'>('sections');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const fullPrompt = useMemo(() => sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n'), [sections]);
  const tokenCount = useMemo(() => estTokens(fullPrompt), [fullPrompt]);
  const charCount = fullPrompt.length;

  const previousVersionPrompt = useMemo(() => {
    return fullPrompt
      .replace(assistant.model, 'GPT-4o-mini')
      .replace(String(assistant.temperature), '0.5')
      .replace('Instruções Críticas', 'Instruções Críticas (v anterior)');
  }, [fullPrompt, assistant]);

  const startEdit = (section: PromptSection) => { setEditingSection(section.id); setEditValue(section.content); };
  const saveEdit = () => {
    if (!editingSection) return;
    setSections(prev => prev.map(s => s.id === editingSection ? { ...s, content: editValue } : s));
    setEditingSection(null);
    toast.success('Seção atualizada', { description: 'As alterações foram aplicadas ao prompt compilado.' });
  };
  const cancelEdit = () => { setEditingSection(null); setEditValue(''); };

  const toggleCollapse = (id: string) => {
    setCollapsedSections(prev => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  };
  const collapseAll = () => setCollapsedSections(new Set(sections.map(s => s.id)));
  const expandAll = () => setCollapsedSections(new Set());

  const copySection = (section: PromptSection) => {
    navigator.clipboard.writeText(`## ${section.title}\n${section.content}`);
    toast.success(`Seção "${section.title}" copiada!`);
  };
  const copyAll = () => {
    navigator.clipboard.writeText(`# System Prompt — ${assistant.name}\n\n${fullPrompt}`);
    toast.success('Prompt completo copiado!');
  };

  const handleDownload = (format: 'md' | 'txt' | 'json') => {
    let content: string, filename: string, mime: string;
    const header = `# System Prompt — ${assistant.name}\n\n`;
    if (format === 'json') {
      content = JSON.stringify({ name: assistant.name, version: assistant.version, model: assistant.model, temperature: assistant.temperature, exportedAt: new Date().toISOString(), sections: sections.map(s => ({ id: s.id, title: s.title, content: s.content })) }, null, 2);
      filename = `prompt-${assistant.name.toLowerCase().replace(/\s+/g, '-')}-v${assistant.version}.json`;
      mime = 'application/json';
    } else {
      content = header + fullPrompt;
      filename = `prompt-${assistant.name.toLowerCase().replace(/\s+/g, '-')}-v${assistant.version}.${format}`;
      mime = 'text/plain';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    setDownloadOpen(false);
    toast.success(`Prompt exportado como .${format}`);
  };

  const recompile = () => {
    setSections(buildSections(assistant, kbs, tools));
    toast.success('Prompt recompilado', { description: 'Seções regeneradas a partir da configuração atual.' });
  };

  const rawLines = useMemo(() => `# System Prompt — ${assistant.name}\n\n${fullPrompt}`.split('\n'), [fullPrompt, assistant.name]);

  const diffLines = useMemo(() => {
    if (viewMode !== 'diff') return [];
    const curr = fullPrompt.split('\n'), prev = previousVersionPrompt.split('\n');
    const result: { line: string; type: 'same' | 'added' | 'removed' }[] = [];
    for (let i = 0; i < Math.max(curr.length, prev.length); i++) {
      const c = curr[i] ?? '', p = prev[i] ?? '';
      if (c === p) result.push({ line: c, type: 'same' });
      else { if (p) result.push({ line: p, type: 'removed' }); if (c) result.push({ line: c, type: 'added' }); }
    }
    return result;
  }, [fullPrompt, previousVersionPrompt, viewMode]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold flex items-center gap-2"><FileCode className="h-4 w-4 text-primary" />Prompt Compilado</h3>
          <Badge variant="secondary" className="text-[10px] gap-1"><Hash className="h-2.5 w-2.5" />{sections.length} seções</Badge>
          <Badge variant="outline" className="text-[10px]">~{tokenCount.toLocaleString()} tokens</Badge>
          <Badge variant="outline" className="text-[10px]">{charCount.toLocaleString()} caracteres</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 rounded-md border p-0.5">
            <Button variant={viewMode === 'sections' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs px-2" onClick={() => setViewMode('sections')}>Seções</Button>
            <Button variant={viewMode === 'raw' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs px-2" onClick={() => setViewMode('raw')}>Raw</Button>
            <Button variant={viewMode === 'diff' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs px-2" onClick={() => setViewMode('diff')}>Diff</Button>
          </div>
          <Button variant="outline" size="sm" onClick={recompile}><RefreshCw className="h-3.5 w-3.5 mr-1" />Recompilar</Button>
          <Button variant="outline" size="sm" onClick={copyAll}><Copy className="h-3.5 w-3.5 mr-1" />Copiar</Button>
          <Button variant="outline" size="sm" onClick={() => setDownloadOpen(true)}><Download className="h-3.5 w-3.5 mr-1" />Exportar</Button>
        </div>
      </div>

      {/* Sections view */}
      {viewMode === 'sections' && (
        <>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={expandAll}><ChevronDown className="h-3 w-3 mr-1" />Expandir Tudo</Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={collapseAll}><ChevronUp className="h-3 w-3 mr-1" />Colapsar Tudo</Button>
          </div>
          <div className="space-y-2">
            {sections.map(section => {
              const isCollapsed = collapsedSections.has(section.id);
              const isEditing = editingSection === section.id;
              return (
                <div key={section.id} className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => !isEditing && toggleCollapse(section.id)}>
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-sm font-semibold">{section.title}</span>
                      {!isCollapsed && <span className="text-[10px] text-muted-foreground">~{estTokens(section.content)} tokens</span>}
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copySection(section)}><Clipboard className="h-3 w-3" /></Button>
                      {section.editable && !isEditing && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(section)}><Pencil className="h-3 w-3" /></Button>}
                      {!section.editable && <Badge variant="secondary" className="text-[9px] h-5">auto</Badge>}
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-3">
                          <Textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={Math.max(3, editValue.split('\n').length + 1)} className="font-mono text-sm" />
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">~{estTokens(editValue)} tokens · {editValue.length} caracteres</span>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" className="h-7" onClick={cancelEdit}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                              <Button size="sm" className="h-7" onClick={saveEdit}><Save className="h-3.5 w-3.5 mr-1" />Salvar</Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-foreground/90">{section.content}</pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Raw view */}
      {viewMode === 'raw' && (
        <div className="rounded-lg border bg-muted/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
            <span className="text-xs text-muted-foreground font-mono">system-prompt-v{assistant.version}.md</span>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <Switch checked={showLineNumbers} onCheckedChange={setShowLineNumbers} className="h-4 w-7" />Linhas
            </label>
          </div>
          <div className="p-4 overflow-x-auto max-h-[60vh] overflow-y-auto">
            <pre className="text-sm font-mono leading-relaxed">
              {rawLines.map((line, i) => (
                <div key={i} className="flex hover:bg-muted/30 -mx-1 px-1 rounded">
                  {showLineNumbers && <span className="inline-block w-8 shrink-0 text-right mr-4 text-muted-foreground/50 select-none text-xs leading-relaxed">{i + 1}</span>}
                  <span className={`flex-1 ${line.startsWith('#') ? 'font-bold text-primary' : line.startsWith('-') ? 'text-info' : ''}`}>{line || '\u00A0'}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      )}

      {/* Diff view */}
      {viewMode === 'diff' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-success/20 border border-success/30" /> Adicionado</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-destructive/20 border border-destructive/30" /> Removido</span>
            <span className="ml-auto">Comparando v{assistant.version} com versão anterior</span>
          </div>
          <div className="rounded-lg border bg-muted/20 overflow-hidden">
            <div className="p-4 overflow-x-auto max-h-[60vh] overflow-y-auto">
              <pre className="text-sm font-mono leading-relaxed">
                {diffLines.map((d, i) => (
                  <div key={i} className={`flex -mx-1 px-1 rounded ${d.type === 'added' ? 'bg-success/10 text-success' : d.type === 'removed' ? 'bg-destructive/10 text-destructive line-through' : ''}`}>
                    <span className="inline-block w-5 shrink-0 mr-3 text-muted-foreground/50 select-none text-xs">{d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ' '}</span>
                    <span className="flex-1">{d.line || '\u00A0'}</span>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Export dialog */}
      <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Exportar Prompt</DialogTitle><DialogDescription>Escolha o formato para download do prompt compilado.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {([
              { format: 'md' as const, label: 'Markdown (.md)', desc: 'Formatado com cabeçalhos e listas' },
              { format: 'txt' as const, label: 'Texto (.txt)', desc: 'Texto puro sem formatação' },
              { format: 'json' as const, label: 'JSON (.json)', desc: 'Estruturado por seções, ideal para automação' },
            ]).map(opt => (
              <button key={opt.format} onClick={() => handleDownload(opt.format)} className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors">
                <Download className="h-4 w-4 text-primary shrink-0" />
                <div><p className="text-sm font-medium">{opt.label}</p><p className="text-[11px] text-muted-foreground">{opt.desc}</p></div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helpers ───

function canCancelRun(status: AgentRunStatus | string) {
  return status === 'queued' || status === 'prechecking' || status === 'running';
}

function agentRunStatusClass(status: AgentRunStatus | string) {
  if (status === 'completed') return 'border-success/30 bg-success/5';
  if (status === 'blocked') return 'border-warning/30 bg-warning/5';
  if (status === 'failed' || status === 'cancelled') return 'border-destructive/30 bg-destructive/5';
  return 'border-primary/30 bg-primary/5';
}

function mcpToolCallStatusClass(status: string) {
  if (status === 'completed') return 'border-success/30 bg-success/5';
  if (status === 'approval_required') return 'border-warning/30 bg-warning/5';
  if (status === 'blocked' || status === 'failed' || status === 'cancelled') return 'border-destructive/30 bg-destructive/5';
  return 'border-primary/30 bg-primary/5';
}

function compactId(value?: string | null) {
  if (!value) return '—';
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function approvalActionLabel(action: AssistantApprovalAction) {
  const labels: Record<AssistantApprovalAction, string> = {
    publish: 'Publicação',
    rollback: 'Reversão',
    restore: 'Restauração',
    enable_execution: 'Habilitar execução',
    configure_sandbox: 'Configurar sandbox',
  };

  return labels[action];
}

function mcpModeLabel(mode?: string | null) {
  if (mode === 'disabled') return 'Desabilitado';
  if (mode === 'sandbox_only') return 'Somente sandbox';
  if (mode === 'enabled_placeholder') return 'Preparado (placeholder)';
  if (mode === 'precheck_only') return 'Somente pré-checagem';

  return mode ? mode.replace(/_/g, ' ') : 'Não informado';
}

function riskLevelLabel(value?: string | null) {
  if (value === 'low') return 'Baixo';
  if (value === 'medium') return 'Médio';
  if (value === 'high') return 'Alto';
  if (value === 'critical') return 'Crítico';

  return humanizeTechnicalToken(value, 'Não informado');
}

function providerLabel(value?: string | null) {
  if (value === 'local') return 'Local';
  if (value === 'local_deterministic') return 'Local determinístico';
  if (value === 'openai') return 'OpenAI';
  if (value === 'agno') return 'Agno';
  if (value === 'agno_stub') return 'Agno Stub';
  if (value === 'agno_http') return 'Agno HTTP';

  return humanizeTechnicalToken(value, 'Não informado');
}

function executionModeLabel(value?: string | null) {
  if (value === 'draft_test') return 'Teste em rascunho';
  if (value === 'published') return 'Publicado';
  if (value === 'sandbox') return 'Sandbox';

  return humanizeTechnicalToken(value, 'Não informado');
}

function readinessStatusLabel(value?: string | null) {
  if (value === 'ready') return 'Pronto';
  if (value === 'blocked') return 'Bloqueado';
  if (value === 'not_ready') return 'Não pronto';
  if (value === 'unavailable') return 'Indisponível';

  return humanizeTechnicalToken(value, 'Não informado');
}

function runtimeHealthMessageLabel(value?: string | null) {
  if (!value) return '';

  if (value === 'Agno HTTP runtime reported healthy.') {
    return 'Runtime Agno HTTP saudável.';
  }

  return value;
}

function capabilityText(value: unknown) {
  if (value === true) return 'sim';
  if (value === false) return 'não';
  if (value === 'simulated') return 'simulado';
  if (value === 'planned') return 'planejado';
  if (value === 'planned_but_disabled') return 'planejado/desligado';
  return String(value);
}

function runtimeMetadata(run: AgentRun) {
  const metadata = run.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const runtime = metadata.runtime;
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) return undefined;
  return runtime;
}

function LlmExecutionPolicyPanel({ policy, isLoading, isError, canEdit, isSaving, onRefresh, onSave }: {
  policy?: AssistantExecutionPolicy;
  isLoading: boolean;
  isError: boolean;
  canEdit: boolean;
  isSaving: boolean;
  onRefresh: () => void;
  onSave: (payload: LlmPolicyUpdatePayload) => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<LlmPolicyForm>(() => llmPolicyFormFromPolicy(policy));
  const allowedProviders = policy?.allowedLlmProviders ?? [];
  const externalProvidersAllowed = Boolean(policy?.allowExternalLlmProviders);
  const openAiAllowed = externalProvidersAllowed && allowedProviders.includes('openai');
  const defaultProvider = policy?.defaultLlmProvider ?? 'local_deterministic';
  const sandboxBlocksRealProvider = Boolean(policy?.sandboxEnabled && policy.sandboxBlocksRealProviders);
  const canEditPolicy = canEdit && Boolean(policy);
  const displayedExternalProvidersAllowed = isEditing ? form.allowExternalLlmProviders : externalProvidersAllowed;
  const displayedOpenAiAllowed = isEditing ? form.allowExternalLlmProviders && form.openaiAllowed : openAiAllowed;
  const displayedDefaultProvider = isEditing ? form.defaultProvider : defaultProvider;
  const displayedAllowedProviders = isEditing
    ? (form.allowExternalLlmProviders && form.openaiAllowed ? ['openai'] : [])
    : allowedProviders;

  const beginEdit = () => {
    if (!policy) return;
    setForm(llmPolicyFormFromPolicy(policy));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setForm(llmPolicyFormFromPolicy(policy));
    setIsEditing(false);
  };

  const updateExternalProviders = (checked: boolean) => {
    setForm(prev => checked
      ? { ...prev, allowExternalLlmProviders: true, openaiAllowed: true, defaultProvider: prev.defaultProvider === 'openai' ? 'openai' : 'local_deterministic' }
      : { allowExternalLlmProviders: false, openaiAllowed: false, defaultProvider: 'local_deterministic' });
  };

  const updateOpenAiAllowed = (checked: boolean) => {
    setForm(prev => checked
      ? { ...prev, allowExternalLlmProviders: true, openaiAllowed: true }
      : { allowExternalLlmProviders: false, openaiAllowed: false, defaultProvider: 'local_deterministic' });
  };

  const updateDefaultProvider = (value: 'local_deterministic' | 'openai') => {
    setForm(prev => value === 'openai'
      ? { ...prev, allowExternalLlmProviders: true, openaiAllowed: true, defaultProvider: 'openai' }
      : { ...prev, defaultProvider: 'local_deterministic' });
  };

  const clearOpenAi = () => {
    setForm({ allowExternalLlmProviders: false, openaiAllowed: false, defaultProvider: 'local_deterministic' });
  };

  const save = async () => {
    const saved = await onSave(llmPolicyPayloadFromForm(form));
    if (saved) setIsEditing(false);
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Governança LLM
          </h3>
          <p className="text-xs text-muted-foreground">Política LLM governada pelo backend, sem segredos, prompts brutos ou saídas brutas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isEditing ? 'secondary' : 'outline'} className="text-[10px]">{isEditing ? 'Editando' : 'Somente leitura'}</Badge>
          {policy && (
  <Badge variant="secondary" className="text-[10px]">
    {executionModeLabel(policy.executionMode)}
  </Badge>
)}
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={beginEdit} disabled={!canEditPolicy || isLoading}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />Editar política LLM
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Atualizar
          </Button>
        </div>
      </div>

      {isLoading && !policy ? (
        <p className="text-sm text-muted-foreground">Carregando política de execução LLM...</p>
      ) : isError && !policy ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">Não foi possível carregar a política de execução.</p>
          <p className="mt-1 text-xs text-muted-foreground">Tente novamente em instantes. Nenhuma mensagem técnica interna é exibida aqui.</p>
        </div>
      ) : !policy ? (
        <p className="text-sm text-muted-foreground">Política ainda não carregada pelo backend.</p>
      ) : (
        <div className="space-y-4">
          {isEditing && (
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.8fr]">
                <PolicyEditSwitch
                  label="Provedor externo"
                  description="Quando desabilitado, a lista de provedores permitidos fica vazia e o provedor padrão volta para Local determinístico."
                  checked={form.allowExternalLlmProviders}
                  disabled={isSaving}
                  onCheckedChange={updateExternalProviders}
                />
                <PolicyEditSwitch
                  label="Permitir OpenAI"
                  description="OpenAI é apenas um valor de política. As credenciais continuam somente no backend."
                  checked={form.openaiAllowed}
                  disabled={isSaving}
                  onCheckedChange={updateOpenAiAllowed}
                />
                <div className="space-y-2">
                  <Label>Provedor padrão</Label>
                  <Select value={form.defaultProvider} onValueChange={value => updateDefaultProvider(value as 'local_deterministic' | 'openai')} disabled={isSaving}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local_deterministic">Local determinístico</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Selecionar OpenAI inclui o provedor na lista de permitidos automaticamente.</p>
                </div>
              </div>
              {policy.sandboxEnabled && policy.sandboxBlocksRealProviders && (
                <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  O sandbox bloqueia o provedor real mesmo que OpenAI esteja permitido para outros modos.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { void save(); }} disabled={isSaving}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />{isSaving ? 'Salvando...' : 'Salvar política LLM'}
                </Button>
                <Button variant="outline" size="sm" onClick={cancelEdit} disabled={isSaving}>
                  <X className="h-3.5 w-3.5 mr-1.5" />Cancelar
                </Button>
                <Button variant="ghost" size="sm" onClick={clearOpenAi} disabled={isSaving}>
                  Limpar OpenAI
                </Button>
              </div>
            </div>
          )}

          {!canEdit && (
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Seu usuário não possui permissão para editar esta política. As alterações continuam bloqueadas pelo backend.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PolicySignal
              label="Provedor externo"
              positive={displayedExternalProvidersAllowed}
              positiveText="Provedor externo habilitado"
              negativeText="Provedor externo bloqueado"
              detail="Controlado pela política de provedores externos"
            />
            <PolicySignal
              label="OpenAI"
              positive={displayedOpenAiAllowed}
              positiveText="OpenAI permitido pela política"
              negativeText="OpenAI bloqueado pela política"
              detail="Exige provedor externo habilitado e OpenAI na lista de provedores permitidos"
            />
            <PolicySignal
              label="Sandbox"
              positive={policy.sandboxEnabled}
              positiveText="Sandbox habilitado"
              negativeText="Sandbox desabilitado"
              detail={policy.sandboxRequiresAuth ? 'Autenticação do sandbox obrigatória' : 'Autenticação do sandbox opcional'}
            />
            <PolicySignal
              label="Provedor real"
              positive={sandboxBlocksRealProvider}
              positiveText="Sandbox bloqueia provedor real"
              negativeText={policy.sandboxEnabled ? 'Sandbox não bloqueia provedor real' : 'Sandbox desabilitado'}
              detail={policy.sandboxBlocksExternalTools ? 'Ferramentas externas bloqueadas' : 'Ferramentas externas liberadas'}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PolicySignal
              label="Teste em rascunho"
              positive={policy.allowDraftTesting}
              positiveText="Teste em rascunho permitido"
              negativeText="Teste em rascunho bloqueado"
              detail={`Modo atual: ${executionModeLabel(policy.executionMode)}`}
            />
            <PolicySignal
              label="Publicado"
              positive={policy.allowPublishedExecution}
              positiveText="Execução publicada permitida"
              negativeText="Execução publicada bloqueada"
              detail={policy.requiresApprovalToPublish ? 'Publicação exige aprovação' : 'Aprovação de publicação opcional'}
            />
            <PolicySignal
              label="Execução geral"
              positive={policy.isExecutionEnabled}
              positiveText="Execução geral habilitada"
              negativeText="Execução geral bloqueada"
              detail={policy.sandboxLogsRequired ? 'Logs de sandbox obrigatórios' : 'Logs de sandbox opcionais'}
            />
            <div className="rounded-md border p-3">
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Provedor padrão</p>
              <Badge variant="secondary" className="mt-2 font-mono text-[10px]">{providerLabel(displayedDefaultProvider)}</Badge>
              <p className="mt-2 text-xs text-muted-foreground">
                {displayedDefaultProvider === 'openai' ? 'Provedor externo padrão definido pela política' : 'Fallback seguro sem provedor externo definido'}
              </p>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Provedores LLM permitidos</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {displayedAllowedProviders.length > 0 ? (
                displayedAllowedProviders.map(provider => (
                  <Badge key={provider} variant="outline" className="font-mono text-[10px]">{providerLabel(provider)}</Badge>
                ))
              ) : (
                <Badge variant="outline" className="text-[10px]">Nenhum provedor externo permitido</Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PolicySignal({ label, positive, positiveText, negativeText, detail }: {
  label: string;
  positive: boolean;
  positiveText: string;
  negativeText: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      <Badge variant={positive ? 'secondary' : 'outline'} className="mt-2 text-[10px]">
        {positive ? positiveText : negativeText}
      </Badge>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function PolicyEditSwitch({ label, description, checked, disabled, onCheckedChange }: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-md border bg-card p-3 text-sm">
      <span>
        <span className="font-medium">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function llmPolicyFormFromPolicy(policy?: AssistantExecutionPolicy): LlmPolicyForm {
  const allowedProviders = policy?.allowedLlmProviders ?? [];
  const openaiAllowed = Boolean(policy?.allowExternalLlmProviders && allowedProviders.includes('openai'));

  return {
    allowExternalLlmProviders: Boolean(policy?.allowExternalLlmProviders),
    openaiAllowed,
    defaultProvider: policy?.defaultLlmProvider === 'openai' ? 'openai' : 'local_deterministic',
  };
}

function llmPolicyPayloadFromForm(form: LlmPolicyForm): LlmPolicyUpdatePayload {
  if (!form.allowExternalLlmProviders || !form.openaiAllowed) {
    return {
      allowExternalLlmProviders: false,
      allowedLlmProviders: [],
      defaultLlmProvider: null,
    };
  }
  return {
    allowExternalLlmProviders: true,
    allowedLlmProviders: ['openai'],
    defaultLlmProvider: form.defaultProvider === 'openai' ? 'openai' : null,
  };
}

function RuntimePanel({ health, capabilities, config, providers, isLoading, onRefresh }: {
  health?: RuntimeHealth;
  capabilities?: RuntimeCapabilities;
  config?: RuntimeConfig;
  providers: RuntimeProviderSummary[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const activeProvider = providers.find(provider => provider.current);
  const agno = providers.find(provider => provider.provider === 'agno');
  const panelHealth = activeProvider?.health ?? health;
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />Provedor de runtime
          </h3>
          <p className="text-xs text-muted-foreground">Boundary oficial de execução, governado pelo backend.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />Atualizar
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando runtime...</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-[10px] text-muted-foreground">Provedor atual</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono text-[10px]">{providerLabel(activeProvider?.provider ?? config?.provider ?? health?.provider ?? 'local')}</Badge>
              {panelHealth && <StatusBadge status={panelHealth.status} />}
            </div>
            {health?.message && <p className="mt-2 text-xs text-muted-foreground">{runtimeHealthMessageLabel(health.message)}</p>}
          </div>
          <div className="rounded-md border p-3">
            <p className="text-[10px] text-muted-foreground">Configurações de execução</p>
            <div className="mt-2 space-y-1 text-xs">
              <p>Pré-checagem: {config?.requirePrecheck ? 'obrigatória' : 'opcional'}</p>
              <p>Ferramentas externas: {config?.externalToolsAllowed ? 'liberadas' : 'bloqueadas'}</p>
              <p>Fallback do provedor: {config?.allowProviderFallback ? 'habilitado' : 'bloqueado'}</p>
              <p>Tempo limite: {config?.requestTimeoutMs ?? 15000}ms</p>
            </div>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-[10px] text-muted-foreground">Capacidades</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span>RAG: {capabilityText(capabilities?.supportsRagContext ?? false)}</span>
              <span>MCP: {capabilityText(capabilities?.supportsMcpTools ?? false)}</span>
              <span>Sandbox: {capabilityText(capabilities?.supportsSandbox ?? false)}</span>
              <span>Streaming: {capabilityText(capabilities?.supportsStreaming ?? false)}</span>
            </div>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-[10px] text-muted-foreground">Agno local</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">agno</Badge>
              {agno?.health && <StatusBadge status={agno.health.status} />}
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>Habilitado: {config?.agnoEnabled ? 'sim' : 'não'} · Configurado: {config?.agnoConfigured ? 'sim' : 'não'}</p>
              <p>Execução: {config?.agnoExecutionEnabled ? 'habilitada' : 'desligada'} · Verificação: {config?.agnoHealthcheckEnabled ? 'sim' : 'não'}</p>
              <p>Sandbox: {config?.agnoRequireSandbox ? 'obrigatório' : 'opcional'} · MCP remoto: {config?.agnoAllowRemoteMcp ? 'liberado' : 'bloqueado'}</p>
              <p>Contexto RAG: {config?.agnoSendRagContext ? 'sim' : 'não'} · Descritores MCP: {config?.agnoSendMcpToolDescriptors ? 'sim' : 'não'}</p>
            </div>
            {config?.agnoEnabled && !config.agnoConfigured && (
              <p className="mt-2 text-xs text-warning">AGNO_BASE_URL não configurado no backend.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LlmProviderPanel({ config, providers, isLoading, onRefresh }: {
  config?: LlmConfig;
  providers: LlmProviderSummary[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const current = providers.find(provider => provider.current);
  const externalProviders = providers.filter(provider => provider.provider !== 'local_deterministic');
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />Provedores LLM
          </h3>
          <p className="text-xs text-muted-foreground">Catálogo sanitizado somente no backend, sem segredos ou prompt bruto.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />Atualizar
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando providers LLM...</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-md border p-3">
            <p className="text-[10px] text-muted-foreground">Provedor LLM atual</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono text-[10px]">{providerLabel(current?.provider ?? config?.defaultProvider ?? 'local_deterministic')}</Badge>
              {current?.health && <StatusBadge status={current.health.status} />}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>Catálogo externo: {config?.providersEnabled ? 'habilitado' : 'desligado'}</span>
              <span>Execução externa: {config?.executionEnabled ? 'habilitada' : 'desligada'}</span>
              <span>Prompt bruto: {config?.storeRawPrompts ? 'armazenado' : 'bloqueado'}</span>
              <span>Saída bruta: {config?.storeRawOutputs ? 'armazenado' : 'bloqueado'}</span>
              <span>Prévia da entrada: {config?.maxInputPreviewChars ?? 500} caracteres</span>
              <span>Prévia da saída: {config?.maxOutputPreviewChars ?? 800} caracteres</span>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {externalProviders.map(provider => (
              <div key={provider.provider} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{providerLabel(provider.provider)}</Badge>
                  <StatusBadge status={provider.health.status} />
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>Habilitado: {provider.capabilities.enabled ? 'sim' : 'não'} · Configuração: {provider.capabilities.configured ? 'sim' : 'não'}</p>
                  <p>Execução: {provider.capabilities.executionEnabled ? 'habilitada' : 'bloqueada'}</p>
                  <p>Chat: {capabilityText(provider.capabilities.supportsChatCompletion)} · Ferramentas: {capabilityText(provider.capabilities.supportsToolCalling)}</p>
                  <p>Modelo: {provider.capabilities.defaultModel ?? 'não configurado'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentRunCard({ run, canCancel, isCancelling, onCancel }: {
  run: AgentRun;
  canCancel: boolean;
  isCancelling: boolean;
  onCancel: () => void;
}) {
  const events = run.events ?? [];
  const runtime = runtimeMetadata(run);
  const llmSummary = getAgentRunLlmSummary(run);
  return (
    <div className={`rounded-md border p-3 ${agentRunStatusClass(run.status)}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={run.status} />
            <Badge variant="secondary" className="text-[10px]">{run.mode}</Badge>
            <span className="font-mono text-[11px] text-muted-foreground">{compactId(run.id)}</span>
          </div>
          <p className="text-sm font-medium">{safeSummaryPreview(run.inputSummary, 96, 'Entrada sem resumo')}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span>trace {compactId(run.traceId)}</span>
            <span>request {compactId(run.requestId)}</span>
            {runtime?.provider && <span>adapter {runtime.provider}</span>}
            <span>{new Date(run.createdAt).toLocaleString('pt-BR')}</span>
          </div>
          {run.errorCode && (
            <p className="text-xs text-warning">{run.errorCode}: falha registrada pelo backend.</p>
          )}
          {runtime?.outputPreview && (
            <p className="rounded bg-muted/50 p-2 text-xs text-muted-foreground">{runtime.outputPreview}</p>
          )}
        </div>
        {canCancel && (
          <Button variant="outline" size="sm" className="shrink-0" onClick={onCancel} disabled={isCancelling}>
            <StopCircle className="h-3.5 w-3.5 mr-1" />Cancelar
          </Button>
        )}
      </div>
      <AgentRunLlmSummaryView summary={llmSummary} />
      <AgentRunLlmTimeline events={events} runSummary={llmSummary} runStatus={run.status} />
    </div>
  );
}

function AgentRunLlmSummaryView({ summary }: { summary: AgentRunLlmSummary }) {
  if (!hasAgentRunLlmSummary(summary)) {
    return (
      <p className="mt-3 border-t pt-3 text-[11px] text-muted-foreground">
        Metadados LLM não informados para este run.
      </p>
    );
  }

  return (
    <div className="mt-3 border-t pt-3">
      <p className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">Execução LLM</p>
      <AgentRunLlmBadges summary={summary} showRuntimeProvider showProviderStatus />
    </div>
  );
}

function McpPrecheckCard({ precheck }: { precheck: McpExecutionPrecheck }) {
  return (
    <div className={`rounded-md border p-3 ${precheck.canExecute ? 'border-success/30 bg-success/5' : precheck.status === 'approval_required' ? 'border-warning/30 bg-warning/5' : 'border-destructive/30 bg-destructive/5'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={precheck.status} />
          <Badge variant="outline" className="text-[10px]">{precheck.mode}</Badge>
          <StatusBadge status={precheck.policy.riskLevel} />
        </div>
        <span className="text-xs text-muted-foreground">{precheck.policy.requiresApproval ? 'Aprovação obrigatória' : 'Automática'}</span>
      </div>
      {precheck.reasons.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{precheck.reasons.join(', ')}</p>
      )}
      {precheck.warnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {precheck.warnings.map(warning => (
            <p key={warning.code} className="text-xs text-muted-foreground">{warning.code}: {warning.message}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function McpToolCallCard({ call, selected, onSelect }: {
  call: McpToolCallRecord;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/30 ${mcpToolCallStatusClass(call.status)} ${selected ? 'ring-1 ring-primary' : ''}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={call.status} />
            <Badge variant="secondary" className="text-[10px]">{mcpModeLabel(call.mode)}</Badge>
            <span className="font-mono text-[11px] text-muted-foreground">{compactId(call.id)}</span>
          </div>
          <p className="truncate text-sm font-medium">{call.tool?.name ?? 'Ferramenta MCP'}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span>trace {compactId(call.traceId)}</span>
            <span>{new Date(call.createdAt).toLocaleString('pt-BR')}</span>
            {typeof call.durationMs === 'number' && <span>{call.durationMs}ms</span>}
          </div>
        </div>
        <StatusBadge status={call.riskLevelSnapshot} />
      </div>
      {call.outputPreview && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{call.outputPreview}</p>}
      {call.errorCode && <p className="mt-2 text-xs text-warning">{call.errorCode}: {call.errorMessage}</p>}
    </button>
  );
}

function McpToolCallTimeline({ call }: { call: McpToolCallRecord }) {
  const events = call.events ?? [];
  return (
    <div className="space-y-3">
      <div className="rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={call.status} />
          <span className="font-mono text-[11px] text-muted-foreground">{compactId(call.id)}</span>
          {call.agentRunId && <span className="font-mono text-[11px] text-muted-foreground">run {compactId(call.agentRunId)}</span>}
        </div>
        {call.inputPreview && (
          <div className="mt-3 rounded bg-muted/50 p-2">
            <p className="mb-1 text-[10px] text-muted-foreground">Prévia da entrada</p>
            <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-xs">{call.inputPreview}</pre>
          </div>
        )}
      </div>
      {events.length > 0 ? (
        <div className="space-y-2">
          {events.map((event, index) => (
            <div key={event.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 text-xs">
              <span className="font-mono text-muted-foreground">#{index + 1}</span>
              <div className="min-w-0 rounded-md border p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-medium">{event.type}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(event.createdAt).toLocaleString('pt-BR')}</span>
                </div>
                {event.message && <p className="mt-1 text-muted-foreground">{event.message}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum evento persistido para esta tool call.</p>
      )}
    </div>
  );
}

function PolicySwitch({ label, checked, disabled, onCheckedChange }: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <span className="font-medium">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value?: string; multiline?: boolean }) {
  return (
    <div>
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      {multiline ? (
        <pre className="text-sm whitespace-pre-wrap font-sans mt-0.5">{value || '—'}</pre>
      ) : (
        <p className="text-sm font-medium">{value || '—'}</p>
      )}
    </div>
  );
}
