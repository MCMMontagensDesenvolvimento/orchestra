import { useState } from 'react';
import { ChevronDown, Wrench, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import type { MockToolCall, ToolCallStatus } from '@/types/chat';
import { cn } from '@/lib/utils';

interface Props {
  toolCall: MockToolCall;
  defaultOpen?: boolean;
}

const statusMeta: Record<ToolCallStatus, { label: string; icon: typeof Wrench; tone: string; dot: string }> = {
  pending: { label: 'Aguardando',  icon: Clock,    tone: 'text-muted-foreground', dot: 'bg-muted-foreground/60' },
  running: { label: 'Executando',  icon: Loader2,  tone: 'text-primary',          dot: 'bg-primary' },
  success: { label: 'Concluída',   icon: CheckCircle2, tone: 'text-success',      dot: 'bg-success' },
  error:   { label: 'Falhou',      icon: XCircle,  tone: 'text-destructive',      dot: 'bg-destructive' },
};

function sanitize(obj: unknown): string {
  try {
    const json = JSON.stringify(obj, (_k, v) => {
      if (typeof v === 'string' && /(secret|token|key|password|bearer)/i.test(_k)) return '••••••';
      return v;
    }, 2);
    return json ?? 'null';
  } catch {
    return String(obj);
  }
}

export function ToolCallCard({ toolCall, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = statusMeta[toolCall.status];
  const Icon = meta.icon;
  const spin = toolCall.status === 'running';

  return (
    <div className="rounded-md border bg-background/60 text-foreground text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors text-left"
        aria-expanded={open}
      >
        <span className={cn('flex h-6 w-6 items-center justify-center rounded bg-muted', meta.tone)}>
          <Wrench className="h-3 w-3" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{toolCall.friendlyName ?? toolCall.name}</span>
            {toolCall.domain && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{toolCall.domain}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className={cn('inline-flex items-center gap-1', meta.tone)}>
              <Icon className={cn('h-3 w-3', spin && 'animate-spin')} />
              {meta.label}
            </span>
            {typeof toolCall.durationMs === 'number' && (
              <span>· {toolCall.durationMs} ms</span>
            )}
            <span>· mock</span>
          </div>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t bg-muted/20 p-3 space-y-3">
          {toolCall.input && (
            <details className="group" open>
              <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-muted-foreground">
                Input (mock, sanitizado)
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 text-[11px] leading-relaxed">
{sanitize(toolCall.input)}
              </pre>
            </details>
          )}
          {toolCall.output !== undefined && toolCall.status === 'success' && (
            <details className="group">
              <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-muted-foreground">
                Output (mock, sanitizado)
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 text-[11px] leading-relaxed">
{sanitize(toolCall.output)}
              </pre>
            </details>
          )}
          {toolCall.status === 'error' && toolCall.errorMessage && (
            <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
              {toolCall.errorMessage}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground italic">
            Visualização mock. Nenhuma chamada real foi executada e nenhum dado sensível é exibido.
          </p>
        </div>
      )}
    </div>
  );
}
