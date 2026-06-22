import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { KpiCard } from '@/components/shared/KpiCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { useAssistants } from '@/hooks/queries/useAssistants';
import { useAuditLogs } from '@/hooks/queries/useAudit';
import { useAnalytics } from '@/hooks/queries/useAnalytics';
import { useMcpTools } from '@/hooks/queries/useMcp';
import { env } from '@/lib/env';
import { Bot, MessageSquare, DollarSign, Wrench, AlertTriangle, TrendingUp, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  return env.useMocks ? <MockDashboard /> : <RealDashboard />;
}

function RealDashboard() {
  const assistantsQuery = useAssistants();
  const auditQuery = useAuditLogs();
  const mcpToolsQuery = useMcpTools();
  const assistants = assistantsQuery.data ?? [];
  const auditLogs = auditQuery.data ?? [];
  const mcpTools = mcpToolsQuery.data ?? [];
  const publishedAssistants = assistants.filter((assistant) => assistant.status === 'published').length;

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Dashboard"
          description="Resumo operacional calculado a partir das APIs disponiveis"
        />

        <QueryState
          query={assistantsQuery}
          loading={<ListLoading rows={3} />}
          errorTitle="Nao foi possivel carregar os assistentes"
          errorDescription="O dashboard nao substitui falhas da API por dados de demonstracao."
        >
          <QueryState
            query={auditQuery}
            errorTitle="Nao foi possivel carregar a auditoria"
            errorDescription="O dashboard nao substitui falhas da API por atividade ficticia."
          >
            <QueryState
              query={mcpToolsQuery}
              errorTitle="Nao foi possivel carregar o catalogo MCP"
              errorDescription="O dashboard nao substitui falhas da API por ferramentas ficticias."
            >
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Assistentes" value={assistants.length} icon={<Bot className="h-5 w-5" />} />
                <KpiCard label="Publicados" value={publishedAssistants} icon={<ShieldCheck className="h-5 w-5" />} />
                <KpiCard label="Tools MCP" value={mcpTools.length} icon={<Wrench className="h-5 w-5" />} />
                <KpiCard label="Eventos auditados" value={auditLogs.length} icon={<AlertTriangle className="h-5 w-5" />} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold">Assistentes recentes</h3>
                  {assistants.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Nenhum assistente cadastrado.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {assistants.slice(0, 5).map((assistant) => (
                        <div key={assistant.id} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{assistant.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{assistant.owner}</p>
                          </div>
                          <StatusBadge status={assistant.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold">Atividade recente</h3>
                  {auditLogs.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Nenhum evento de auditoria registrado.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {auditLogs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex items-start gap-2 text-sm">
                          <StatusBadge status={log.riskLevel} />
                          <div className="min-w-0">
                            <p className="text-xs leading-snug">{log.description}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{log.user}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Metricas consolidadas de conversas, custos e latencia permanecem indisponiveis ate existir uma API real de Analytics.
              </p>
            </QueryState>
          </QueryState>
        </QueryState>
      </div>
    </AppShell>
  );
}

function MockDashboard() {
  const assistantsQuery = useAssistants();
  const assistants = assistantsQuery.data ?? [];
  const { data: auditLogs = [] } = useAuditLogs();
  const { data: analytics = [] } = useAnalytics();
  const { data: mcpTools = [] } = useMcpTools();
  const totalConversations = assistants.reduce((acc, assistant) => acc + assistant.conversations, 0);
  const totalCost = assistants.reduce((acc, assistant) => acc + assistant.costThisMonth, 0);
  const publishedAssistants = assistants.filter((assistant) => assistant.status === 'published').length;
  const topToolCalls = [...mcpTools].sort((a, b) => b.executionCount - a.executionCount).slice(0, 5);
  const costByAssistant = [...assistants]
    .filter((assistant) => assistant.costThisMonth > 0)
    .sort((a, b) => b.costThisMonth - a.costThisMonth)
    .map((assistant) => ({
      name: assistant.name.length > 15 ? `${assistant.name.slice(0, 15)}...` : assistant.name,
      cost: assistant.costThisMonth,
    }));

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Dashboard" description="Prototipo local com dados de demonstracao" />

        <QueryState query={assistantsQuery} loading={<ListLoading rows={3} />}>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Assistentes Ativos" value={publishedAssistants} icon={<Bot className="h-5 w-5" />} />
            <KpiCard label="Conversas (mes)" value={totalConversations.toLocaleString()} icon={<MessageSquare className="h-5 w-5" />} />
            <KpiCard label="Custo de IA (mes)" value={`R$ ${totalCost.toFixed(2)}`} icon={<DollarSign className="h-5 w-5" />} />
            <KpiCard label="Tools MCP" value={mcpTools.length} icon={<Wrench className="h-5 w-5" />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Conversas por dia
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="conversations" fill="hsl(16, 99%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Custo por assistente (R$)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={costByAssistant} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="cost" fill="hsl(16, 99%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3">Ferramentas MCP mais utilizadas</h3>
              <div className="space-y-3">
                {topToolCalls.map((tool) => (
                  <div key={tool.id} className="flex items-center justify-between gap-3 text-sm">
                    <p className="truncate font-mono text-xs">{tool.name}</p>
                    <span className="text-xs text-muted-foreground">{tool.executionCount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3">Atividade recente</h3>
              <div className="space-y-3">
                {auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-sm">
                    <StatusBadge status={log.riskLevel} />
                    <p className="text-xs leading-snug">{log.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </QueryState>
      </div>
    </AppShell>
  );
}
