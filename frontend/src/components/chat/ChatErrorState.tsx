import { AlertTriangle, ShieldOff, SearchX, Wrench, ServerCrash, BookX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatError, ChatErrorKind } from '@/types/chat';

interface Props {
  error: ChatError;
  onRetry?: () => void;
}

const map: Record<ChatErrorKind, { icon: typeof AlertTriangle; title: string; description: string }> = {
  provider_failure:  { icon: ServerCrash, title: 'O provedor de IA está indisponível', description: 'Estamos com instabilidade no provedor. Tente novamente em instantes.' },
  runtime_failure:   { icon: AlertTriangle, title: 'Não conseguimos gerar a resposta', description: 'Algo deu errado durante a execução. Tente novamente.' },
  tool_failure:      { icon: Wrench, title: 'A ferramenta utilizada falhou', description: 'A ação externa não foi concluída. A resposta pode estar incompleta.' },
  sources_failure:   { icon: BookX, title: 'Não conseguimos consultar as fontes', description: 'A base de conhecimento ficou temporariamente indisponível.' },
  no_sources_found:  { icon: SearchX, title: 'Nenhuma fonte relevante encontrada', description: 'O assistente respondeu sem citação por não localizar conteúdo aplicável.' },
  forbidden:         { icon: ShieldOff, title: 'Você não tem permissão para esta ação', description: 'Sua função atual não permite acessar este recurso.' },
};

export function ChatErrorState({ error, onRetry }: Props) {
  const cfg = map[error.kind];
  const Icon = cfg.icon;
  return (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 text-destructive mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-destructive">{cfg.title}</p>
          <p className="text-muted-foreground mt-0.5">{error.message ?? cfg.description}</p>
          {onRetry && error.kind !== 'forbidden' && (
            <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={onRetry}>
              Tentar novamente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
