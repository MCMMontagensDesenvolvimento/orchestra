import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAuditLogs } from '@/hooks/queries/useAudit';
import { auditActionLabel } from '@/services/audit.service';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { Shield, Filter } from 'lucide-react';

const eventLabels: Record<string, string> = {
  assistant_created: 'Assistente Criado',
  assistant_published: 'Assistente Publicado',
  assistant_updated: 'Assistente Atualizado',
  tool_executed: 'Ferramenta Executada',
  knowledge_updated: 'Conhecimento Atualizado',
  user_login: 'Login',
  policy_changed: 'Política Alterada',
  security_alert: 'Alerta de Segurança',
  approval_requested: 'Aprovação Solicitada',
  approval_granted: 'Aprovação Concedida',
};

export default function AuditPage() {
  const logsQuery = useAuditLogs();
  const mockAuditLogs = logsQuery.data ?? [];

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Auditoria & Segurança" description="Trilha de auditoria, eventos e alertas de segurança">
          <button className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </button>
        </PageHeader>

        {/* Summary cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{mockAuditLogs.length}</p>
            <p className="text-xs text-muted-foreground">Eventos totais</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{mockAuditLogs.filter(l => l.riskLevel === 'critical').length}</p>
            <p className="text-xs text-muted-foreground">Alertas críticos</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-warning">{mockAuditLogs.filter(l => l.event === 'approval_requested').length}</p>
            <p className="text-xs text-muted-foreground">Aprovações pendentes</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-success">{mockAuditLogs.filter(l => l.riskLevel === 'low').length}</p>
            <p className="text-xs text-muted-foreground">Eventos normais</p>
          </div>
        </div>

        <QueryState
          query={logsQuery}
          isEmpty={mockAuditLogs.length === 0}
          loading={<ListLoading rows={6} />}
          emptyIcon={<Shield className="h-6 w-6" />}
          emptyTitle="Nenhum log encontrado"
          emptyDescription="Não há eventos de auditoria registrados para os filtros atuais."
          errorTitle="Não foi possível carregar os logs"
          errorDescription="Houve um problema ao recuperar a trilha de auditoria. Tente novamente em instantes."
        >
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Horário</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Evento</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Descrição</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Recurso</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Risco</th>
                </tr>
              </thead>
              <tbody>
                {mockAuditLogs.map(log => (
                  <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                        {log.action
                          ? auditActionLabel(log.action)
                          : eventLabels[log.event] || log.event}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs truncate">{log.description}</td>
                    <td className="px-4 py-3 text-xs">{log.user}</td>
                    <td className="px-4 py-3 text-xs">{log.resource}</td>
                    <td className="px-4 py-3"><StatusBadge status={log.riskLevel} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {mockAuditLogs.map(log => (
              <div key={log.id} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium truncate">
                    {log.action
                          ? auditActionLabel(log.action)
                          : eventLabels[log.event] || log.event}
                  </span>
                  <StatusBadge status={log.riskLevel} />
                </div>
                <p className="text-sm">{log.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{log.user} · {log.resource}</span>
                  <span>{new Date(log.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </QueryState>
      </div>
    </AppShell>
  );
}
