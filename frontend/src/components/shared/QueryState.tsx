import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertCircle, Inbox, ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiError } from '@/services/api/api-error';
import { HttpStatus } from '@/services/api/http-status';

interface QueryStateProps<T> {
  /** Query do TanStack Query a ser tratada. */
  query: UseQueryResult<T>;
  /** Quando true, mostra empty state ao invés de children. */
  isEmpty?: boolean;

  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;

  errorTitle?: string;
  errorDescription?: string;

  forbiddenTitle?: string;
  forbiddenDescription?: string;

  /** Skeleton customizado enquanto isLoading. */
  loading?: ReactNode;
  /** Quando true, exibe o conteúdo mesmo durante o loading inicial (mantendo dados antigos / placeholder). */
  showWhileLoading?: boolean;

  children: ReactNode;
}

/**
 * Tratamento padrão de loading / empty / error / forbidden para queries
 * TanStack. Lê `ApiError.status === 403` para diferenciar acesso negado.
 */
export function QueryState<T>({
  query,
  isEmpty,
  emptyIcon,
  emptyTitle = 'Sem dados para exibir',
  emptyDescription = 'Ainda não há registros disponíveis nesta visualização.',
  emptyAction,
  errorTitle = 'Não foi possível carregar os dados',
  errorDescription = 'Tente novamente em instantes. Se o problema persistir, fale com seu administrador.',
  forbiddenTitle = 'Acesso negado',
  forbiddenDescription = 'Você não tem permissão para acessar este recurso.',
  loading,
  showWhileLoading = false,
  children,
}: QueryStateProps<T>) {
  if (query.isLoading && !showWhileLoading) {
    return <>{loading ?? <DefaultLoading />}</>;
  }

  if (query.isError) {
    const forbidden = isApiError(query.error) && query.error.status === HttpStatus.FORBIDDEN;
    if (forbidden) {
      return (
        <StateCard
          tone="warn"
          icon={<ShieldAlert className="h-6 w-6" />}
          title={forbiddenTitle}
          description={forbiddenDescription}
        />
      );
    }
    return (
      <StateCard
        tone="danger"
        icon={<AlertCircle className="h-6 w-6" />}
        title={errorTitle}
        description={errorDescription}
        action={
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        }
      />
    );
  }

  if (isEmpty) {
    return (
      <StateCard
        tone="muted"
        icon={emptyIcon ?? <Inbox className="h-6 w-6" />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return <>{children}</>;
}

/** Skeleton genérico de 3 linhas — funciona como loading padrão para listas. */
export function ListLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function DefaultLoading() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground" aria-busy="true" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin mr-2" />
      Carregando…
    </div>
  );
}

interface StateCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  tone: 'muted' | 'danger' | 'warn';
}

function StateCard({ icon, title, description, action, tone }: StateCardProps) {
  const toneClasses = {
    muted: 'bg-muted text-muted-foreground',
    danger: 'bg-destructive/10 text-destructive',
    warn: 'bg-warning/10 text-warning',
  }[tone];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center" role="status">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${toneClasses} mb-4`}>
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
