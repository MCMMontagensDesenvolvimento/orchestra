import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { KpiCard } from '@/components/shared/KpiCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAssistants } from '@/hooks/queries/useAssistants';
import { useAuditLogs } from '@/hooks/queries/useAudit';
import { useAnalytics } from '@/hooks/queries/useAnalytics';
import { useMcpTools } from '@/hooks/queries/useMcp';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { Bot, MessageSquare, DollarSign, Server, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const assistantsQuery = useAssistants();
  const mockAssistants = assistantsQuery.data ?? [];
  const { data: mockAuditLogs = [] } = useAuditLogs();
  const { data: mockAnalytics = [] } = useAnalytics();
  const { data: mockMcpTools = [] } = useMcpTools();
  const totalConversations = mockAssistants.reduce((acc, a) => acc + a.conversations, 0);
  const totalCost = mockAssistants.reduce((acc, a) => acc + a.costThisMonth, 0);
  const publishedAssistants = mockAssistants.filter(a => a.status === 'published').length;
  const topToolCalls = mockMcpTools.sort((a, b) => b.executionCount - a.executionCount).slice(0, 5);

  const costByAssistant = mockAssistants
    .filter(a => a.costThisMonth > 0)
    .sort((a, b) => b.costThisMonth - a.costThisMonth)
    .map(a => ({ name: a.name.length > 15 ? a.name.slice(0, 15) + '…' : a.name, cost: a.costThisMonth }));

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Dashboard" description="Visão geral do tenant Acme Corp" />

        <QueryState
          query={assistantsQuery}
          loading={<ListLoading rows={3} />}
          errorTitle="Não foi possível carregar o dashboard"
          errorDescription="Tente novamente em instantes."
        >
        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Assistentes Ativos" value={publishedAssistants} change={12} trend="up" icon={<Bot className="h-5 w-5" />} />
          <KpiCard label="Conversas (mês)" value={totalConversations.toLocaleString()} change={8} trend="up" icon={<MessageSquare className="h-5 w-5" />} />
          <KpiCard label="Custo de IA (mês)" value={`R$ ${totalCost.toFixed(2)}`} change={-3} trend="down" icon={<DollarSign className="h-5 w-5" />} />
          <KpiCard label="Servidores MCP" value={8} change={0} trend="neutral" icon={<Server className="h-5 w-5" />} />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Conversas por dia
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={mockAnalytics}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="conversations" fill="hsl(16, 99%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Custo por assistente (R$)
            </h3>
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

        {/* Bottom panels */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Top Assistants */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">Top Assistentes</h3>
            <div className="space-y-3">
              {mockAssistants.filter(a => a.status === 'published').sort((a, b) => b.conversations - a.conversations).slice(0, 4).map(a => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                      {a.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-card-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.area}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{a.conversations} conversas</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top MCP Tools */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">Ferramentas MCP Mais Utilizadas</h3>
            <div className="space-y-3">
              {topToolCalls.map(t => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-mono text-xs font-medium text-card-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{t.executionCount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Audit */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              Atividade Recente
            </h3>
            <div className="space-y-3">
              {mockAuditLogs.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-start gap-2 text-sm">
                  <div className="mt-1.5">
                    <StatusBadge status={log.riskLevel} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-card-foreground leading-snug">{log.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{log.user} · {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
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
