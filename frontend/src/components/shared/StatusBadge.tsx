import { cn } from '@/lib/utils';
import type { AssistantStatus, IngestionStatus, McpServerStatus, RiskLevel } from '@/types';

type StatusType = AssistantStatus | IngestionStatus | McpServerStatus | RiskLevel | string;

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  published: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  active: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  completed: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  healthy: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  degraded: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  draft: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  testing: { bg: 'bg-info/10', text: 'text-info', dot: 'bg-info' },
  pending_approval: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  pending: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  approved: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  rejected: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  cancelled: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  expired: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  draft_test: { bg: 'bg-info/10', text: 'text-info', dot: 'bg-info' },
  sandbox: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  blocked: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  processing: { bg: 'bg-info/10', text: 'text-info', dot: 'bg-info' },
  passed: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  needs_review: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  archived: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  inactive: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  disabled: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  misconfigured: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  configured_but_execution_disabled: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  unavailable: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  error: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  failed: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  queued: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  running: { bg: 'bg-info/10', text: 'text-info', dot: 'bg-info' },
  completed_placeholder: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  indexed_placeholder: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  low: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  medium: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  high: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  critical: { bg: 'bg-destructive/15', text: 'text-destructive', dot: 'bg-destructive' },
};

const labelMap: Record<string, string> = {
  published: 'Publicado',
  draft: 'Rascunho',
  testing: 'Em teste',
  pending_approval: 'Aguardando aprovação',
  archived: 'Arquivado',
  active: 'Ativo',
  inactive: 'Inativo',
  disabled: 'Desabilitado',
  completed: 'Concluído',
  healthy: 'Saudavel',
  degraded: 'Degradado',
  misconfigured: 'Mal configurado',
  configured_but_execution_disabled: 'Configurado sem execucao',
  unavailable: 'Indisponivel',
  processing: 'Processando',
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  draft_test: 'Teste draft',
  sandbox: 'Sandbox',
  blocked: 'Bloqueado',
  error: 'Erro',
  failed: 'Falha',
  queued: 'Na fila',
  running: 'Rodando',
  completed_placeholder: 'Preparação concluída',
  indexed_placeholder: 'Preparado para indexação',
  passed: 'Passou',
  needs_review: 'Revisar',
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.inactive;
  const label = labelMap[status] || status;

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', config.bg, config.text, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {label}
    </span>
  );
}
