import { Shuffle } from 'lucide-react';

interface Props {
  fromModel?: string;
  toModel?: string;
}

export function FallbackBadge({ fromModel, toModel }: Props) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] text-warning"
      title="Modelo principal indisponível. Resposta gerada por modelo alternativo."
    >
      <Shuffle className="h-3 w-3" />
      <span>
        Fallback de modelo
        {fromModel && toModel ? `: ${fromModel} → ${toModel}` : toModel ? `: ${toModel}` : ''}
      </span>
    </div>
  );
}
