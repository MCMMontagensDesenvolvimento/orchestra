import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/shared/AppShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { KpiCard } from '@/components/shared/KpiCard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { Assistant, KnowledgeBase, McpTool } from '@/types';
import { useAssistants, useAssistantVersions, useAssistantFeedback, useAssistantTestResults } from '@/hooks/queries/useAssistants';
import { useKnowledgeBases } from '@/hooks/queries/useKnowledge';
import { useMcpTools } from '@/hooks/queries/useMcp';
import { useConversations } from '@/hooks/queries/useChat';
import { useAuditLogs } from '@/hooks/queries/useAudit';
import { useAnalytics } from '@/hooks/queries/useAnalytics';
import {
  ArrowLeft, Edit, Copy, Play, Send, Archive, MessageSquare, DollarSign,
  ThumbsUp, ThumbsDown, Thermometer, Bot, Server, BookOpen, Clock,
  GitBranch, CheckCircle, XCircle, FileCode, Wrench, BarChart3, Shield,
  AlertTriangle, ChevronRight, ExternalLink, Zap, Download, RefreshCw,
  Hash, Eye, EyeOff, Pencil, Save, X, ChevronDown, ChevronUp, Clipboard, Diff
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { toast } from 'sonner';

type TabId = 'overview' | 'config' | 'knowledge' | 'tools' | 'prompt' | 'tests' | 'analytics' | 'audit';

const tabs: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: 'overview', label: 'Overview', icon: Bot },
  { id: 'config', label: 'Configuração', icon: Wrench },
  { id: 'knowledge', label: 'Conhecimento', icon: BookOpen },
  { id: 'tools', label: 'Ferramentas', icon: Server },
  { id: 'prompt', label: 'Prompt Compilado', icon: FileCode },
  { id: 'tests', label: 'Testes', icon: CheckCircle },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'audit', label: 'Auditoria', icon: Shield },
];

export default function AssistantDetailPage() {
  const assistantsQuery = useAssistants();
  const mockAssistants = assistantsQuery.data ?? [];
  const { data: mockKnowledgeBases = [] } = useKnowledgeBases();
  const { data: mockMcpTools = [] } = useMcpTools();
  const { data: mockConversations = [] } = useConversations();
  const { data: mockAuditLogs = [] } = useAuditLogs();
  const { data: mockAnalytics = [] } = useAnalytics();
  const { id } = useParams();
  const { data: mockAssistantVersions = [] } = useAssistantVersions(id);
  const { data: mockAssistantFeedbacks = [] } = useAssistantFeedback(id);
  const { data: mockTestResults = [] } = useAssistantTestResults(id);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const assistant = mockAssistants.find(a => a.id === id) || mockAssistants[0];

  if (assistantsQuery.isLoading || !assistant) {
    if (assistantsQuery.isError) {
      return <AppShell><div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Não foi possível carregar o assistente. <Button variant="link" onClick={() => assistantsQuery.refetch()}>Tentar novamente</Button></div></AppShell>;
    }
    if (mockAssistants.length === 0 && !assistantsQuery.isLoading) {
      return <AppShell><div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Assistente não encontrado.</div></AppShell>;
    }
    return <AppShell><div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Carregando assistente…</div></AppShell>;
  }
  const versions = mockAssistantVersions.filter(v => v.assistantId === assistant.id);
  const feedbacks = mockAssistantFeedbacks.filter(f => f.assistantId === assistant.id);
  const tests = mockTestResults.filter(t => t.assistantId === assistant.id);
  const conversations = mockConversations.filter(c => c.assistantId === assistant.id);
  const kbs = mockKnowledgeBases.filter(kb => assistant.knowledgeBases.includes(kb.id));
  const tools = mockMcpTools.filter(t => assistant.mcpTools.includes(t.id));
  const auditLogs = mockAuditLogs.filter(l => l.resource === assistant.name || l.resource.includes(assistant.name.split(' ')[0]));

  const positiveFeedbacks = feedbacks.filter(f => f.type === 'positive').length;
  const negativeFeedbacks = feedbacks.filter(f => f.type === 'negative').length;

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
- Modelo fallback: ${assistant.fallbackModel}
- Temperatura: ${assistant.temperature}

## Bases de Conhecimento
${kbs.map(kb => `- ${kb.name} (${kb.documentCount} docs, ${kb.totalChunks} chunks)`).join('\n') || '- Nenhuma'}

## Ferramentas MCP
${tools.map(t => `- ${t.name}: ${t.description}${t.requiresApproval ? ' [REQUER APROVAÇÃO]' : ''}`).join('\n') || '- Nenhuma'}`;

  const handleAction = (action: string) => {
    toast.success(`${action}: ${assistant.name}`, { description: 'Ação executada com sucesso (mock)' });
  };

  // Assistant-specific analytics (mock per-assistant)
  const assistantAnalytics = mockAnalytics.map(d => ({
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
            <Button variant="outline" size="sm" onClick={() => navigate(`/app/assistants/${assistant.id}/edit`)}>
              <Edit className="h-3.5 w-3.5 mr-1" />Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAction('Duplicado')}>
              <Copy className="h-3.5 w-3.5 mr-1" />Duplicar
            </Button>
            <Link to={`/chat/${assistant.id}`}>
              <Button variant="outline" size="sm"><Play className="h-3.5 w-3.5 mr-1" />Testar</Button>
            </Link>
            {assistant.status === 'draft' && (
              <Button size="sm" onClick={() => handleAction('Publicado')}>
                <Send className="h-3.5 w-3.5 mr-1" />Publicar
              </Button>
            )}
            {assistant.status === 'published' && (
              <Button variant="outline" size="sm" onClick={() => handleAction('Arquivado')} className="text-destructive hover:text-destructive">
                <Archive className="h-3.5 w-3.5 mr-1" />Arquivar
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
                  <div><p className="text-xs text-muted-foreground">Fallback</p><p className="font-medium">{assistant.fallbackModel}</p></div>
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
                        <p className="text-xs text-muted-foreground">{kb.documentCount} docs · {kb.totalChunks.toLocaleString()} chunks</p>
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
                      <div className="flex items-center gap-2">
                        <StatusBadge status={t.riskLevel} />
                        {t.requiresApproval && <span className="text-[10px] text-warning">Aprovação</span>}
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
                <h3 className="text-sm font-semibold mb-3">Feedbacks Recentes</h3>
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
                <Field label="Modelo fallback" value={assistant.fallbackModel} />
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

        {activeTab === 'knowledge' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Bases de Conhecimento Vinculadas ({kbs.length})</h3>
              <Button variant="outline" size="sm"><BookOpen className="h-3.5 w-3.5 mr-1" />Vincular Base</Button>
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
                      <StatusBadge status={kb.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{kb.description}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center border-t pt-3">
                      <div><p className="text-lg font-bold">{kb.documentCount}</p><p className="text-[10px] text-muted-foreground">Documentos</p></div>
                      <div><p className="text-lg font-bold">{kb.totalChunks.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Chunks</p></div>
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
                <Button variant="outline" size="sm" className="mt-3"><BookOpen className="h-3.5 w-3.5 mr-1" />Vincular Base</Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Ferramentas MCP Habilitadas ({tools.length})</h3>
              <Button variant="outline" size="sm"><Server className="h-3.5 w-3.5 mr-1" />Vincular Ferramenta</Button>
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
                    </tr>
                  </thead>
                  <tbody>
                    {tools.map(t => (
                      <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-medium">{t.name}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Server className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma ferramenta MCP vinculada</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'prompt' && (
          <PromptCompiledTab assistant={assistant} kbs={kbs} tools={tools} compiledPrompt={compiledPrompt} />
        )}

        {activeTab === 'tests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Resultados de Testes ({tests.length})</h3>
              <Button size="sm"><Play className="h-3.5 w-3.5 mr-1" />Executar Teste</Button>
            </div>
            {tests.length > 0 ? (
              <div className="space-y-3">
                {tests.map(t => (
                  <div key={t.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {t.passed ? <CheckCircle className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                        <div>
                          <p className="text-sm font-medium">Prompt: "{t.prompt}"</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {t.model} · {t.latency}s · {t.tokensUsed} tokens · {new Date(t.timestamp).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium ${t.passed ? 'text-success' : 'text-destructive'}`}>
                        {t.passed ? 'Passou' : 'Falhou'}
                      </span>
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
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum teste executado ainda</p>
                <Button size="sm" className="mt-3"><Play className="h-3.5 w-3.5 mr-1" />Executar Primeiro Teste</Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
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
        )}

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
    { id: 'model', title: 'Configuração do Modelo', content: `- Modelo principal: ${a.model}\n- Modelo fallback: ${a.fallbackModel}\n- Temperatura: ${a.temperature}`, editable: false },
    { id: 'knowledge', title: 'Bases de Conhecimento', content: kbs.length > 0 ? kbs.map(kb => `- ${kb.name} (${kb.documentCount} docs, ${kb.totalChunks} chunks)`).join('\n') : '- Nenhuma', editable: false },
    { id: 'tools_section', title: 'Ferramentas MCP', content: tls.length > 0 ? tls.map(t => `- ${t.name}: ${t.description}${t.requiresApproval ? ' [REQUER APROVAÇÃO]' : ''}`).join('\n') : '- Nenhuma', editable: false },
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
          <Badge variant="outline" className="text-[10px]">{charCount.toLocaleString()} chars</Badge>
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
                            <span className="text-[10px] text-muted-foreground">~{estTokens(editValue)} tokens · {editValue.length} chars</span>
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
