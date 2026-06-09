import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  className?: string;
}

export function KpiCard({ label, value, change, trend = 'neutral', icon, className }: KpiCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-5 transition-shadow hover:shadow-md', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-card-foreground">{value}</p>
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className="mt-3 flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-success" />}
          {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
          {trend === 'neutral' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className={cn(
            'text-xs font-medium',
            trend === 'up' && 'text-success',
            trend === 'down' && 'text-destructive',
            trend === 'neutral' && 'text-muted-foreground',
          )}>
            {change > 0 ? '+' : ''}{change}% vs período anterior
          </span>
        </div>
      )}
    </div>
  );
}
