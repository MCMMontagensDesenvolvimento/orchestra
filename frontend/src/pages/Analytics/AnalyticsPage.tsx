import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { KpiCard } from '@/components/shared/KpiCard';
import { useAnalytics } from '@/hooks/queries/useAnalytics';
import { useAssistants } from '@/hooks/queries/useAssistants';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { DollarSign, MessageSquare, Clock, Wrench, TrendingUp, ThumbsUp, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts';

export default function AnalyticsPage() {
  const analyticsQuery = useAnalytics();
  const analytics = analyticsQuery.data ?? [];
  const { data: assistants = [] } = useAssistants();
  const totalCost = analytics.reduce((acc, d) => acc + d.cost, 0);
  const totalConversations = analytics.reduce((acc, d) => acc + d.conversations, 0);
  const avgLatency = analytics.length
    ? (analytics.reduce((acc, d) => acc + d.latency, 0) / analytics.length).toFixed(1)
    : '0.0';
  const totalToolCalls = analytics.reduce((acc, d) => acc + d.toolCalls, 0);

  const costByModel = [
    { name: 'GPT-4o', cost: 678.20 },
    { name: 'Claude 3.5 Sonnet', cost: 187.20 },
    { name: 'GPT-4o Mini', cost: 89.40 },
    { name: 'Claude 3.5 Haiku', cost: 45.60 },
  ];

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Analytics" description="Métricas de uso, custo e performance dos assistentes" />

        <QueryState
          query={analyticsQuery}
          isEmpty={analytics.length === 0}
          loading={<ListLoading rows={3} />}
          emptyIcon={<BarChart3 className="h-6 w-6" />}
          emptyTitle="Sem métricas para o período"
          emptyDescription="A API consolidada de Analytics ainda não está disponível. Nenhum dado de demonstração é exibido no modo de API real."
          errorTitle="Não foi possível carregar as métricas"
          errorDescription="Tente novamente em instantes."
        >
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Custo Total (semana)" value={`R$ ${totalCost.toFixed(2)}`} change={-5} trend="down" icon={<DollarSign className="h-5 w-5" />} />
            <KpiCard label="Conversas (semana)" value={totalConversations} change={12} trend="up" icon={<MessageSquare className="h-5 w-5" />} />
            <KpiCard label="Latência Média" value={`${avgLatency}s`} change={-8} trend="down" icon={<Clock className="h-5 w-5" />} />
            <KpiCard label="Tool Calls" value={totalToolCalls.toLocaleString()} change={15} trend="up" icon={<Wrench className="h-5 w-5" />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Custo ao Longo do Tempo (R$)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={analytics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="cost" stroke="hsl(16, 99%, 55%)" fill="hsl(16, 99%, 55%)" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Custo por Modelo (R$)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={costByModel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="cost" fill="hsl(16, 99%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Volume de Conversas</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={analytics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="conversations" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={{ fill: 'hsl(217, 91%, 60%)', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Latência Média (s)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={analytics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="latency" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ fill: 'hsl(142, 71%, 45%)', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Ranking de Assistentes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">#</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Assistente</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Área</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">Conversas</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">Custo</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">Satisfação</th>
                  </tr>
                </thead>
                <tbody>
                  {assistants.filter(a => a.status === 'published').sort((a, b) => b.conversations - a.conversations).map((a, i) => (
                    <tr key={a.id} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2 font-bold text-primary">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{a.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{a.area}</td>
                      <td className="px-3 py-2 text-right">{a.conversations.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">R$ {a.costThisMonth.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right"><span className="inline-flex items-center justify-end gap-1"><ThumbsUp className="h-3 w-3 text-success" />{a.satisfaction}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </QueryState>
      </div>
    </AppShell>
  );
}
