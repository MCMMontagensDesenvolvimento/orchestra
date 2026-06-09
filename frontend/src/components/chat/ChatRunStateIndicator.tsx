import { Bot, Search, Wrench, Loader2, CheckCircle2, AlertTriangle, Send, Shuffle } from 'lucide-react';
import type { ChatRunState } from '@/types/chat';

interface Props {
  state: ChatRunState;
  detail?: string;
}

const config: Record<Exclude<ChatRunState, 'idle' | 'completed'>, { icon: typeof Bot; label: string; tone: string }> = {
  sending:            { icon: Send,       label: 'Enviando mensagem…',      tone: 'text-muted-foreground' },
  thinking:           { icon: Bot,        label: 'IA pensando…',            tone: 'text-primary' },
  streaming:          { icon: Loader2,    label: 'Gerando resposta…',       tone: 'text-primary' },
  retrieving_sources: { icon: Search,     label: 'Buscando fontes…',        tone: 'text-primary' },
  executing_tool:     { icon: Wrench,     label: 'Executando ferramenta…',  tone: 'text-primary' },
  failed:             { icon: AlertTriangle, label: 'Falha ao responder',   tone: 'text-destructive' },
  fallback:           { icon: Shuffle,    label: 'Usando modelo alternativo', tone: 'text-warning' },
};

export function ChatRunStateIndicator({ state, detail }: Props) {
  if (state === 'idle') return null;
  if (state === 'completed') {
    return (
      <div className="inline-flex items-center gap-2 text-xs text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Resposta concluída</span>
      </div>
    );
  }
  const cfg = config[state];
  const Icon = cfg.icon;
  const spin = state === 'streaming' || state === 'thinking' || state === 'sending';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 text-xs ${cfg.tone}`}
    >
      <Icon className={`h-3.5 w-3.5 ${spin ? 'animate-spin' : ''}`} />
      <span>{detail ?? cfg.label}</span>
      {(state === 'thinking' || state === 'streaming') && (
        <span className="inline-flex gap-0.5 ml-1" aria-hidden>
          <span className="h-1 w-1 rounded-full bg-current animate-pulse" />
          <span className="h-1 w-1 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
          <span className="h-1 w-1 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
        </span>
      )}
    </div>
  );
}
