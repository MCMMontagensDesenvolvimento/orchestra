import { useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import type { MockRagSource } from '@/types/chat';
import { cn } from '@/lib/utils';

interface Props {
  source: MockRagSource;
  index?: number;
}

function relevanceLabel(score?: number) {
  if (score === undefined) return null;
  if (score >= 0.85) return { label: 'Alta', tone: 'bg-success/15 text-success' };
  if (score >= 0.6)  return { label: 'Média', tone: 'bg-warning/15 text-warning' };
  return { label: 'Baixa', tone: 'bg-muted text-muted-foreground' };
}

export function SourceCitation({ source, index }: Props) {
  const [open, setOpen] = useState(false);
  const rel = relevanceLabel(source.score);

  return (
    <div className="rounded-md border bg-background/60 text-xs">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-2 p-2 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-semibold">
          {index !== undefined ? index + 1 : <BookOpen className="h-3 w-3" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-foreground">{source.documentName}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {source.knowledgeBase}
            {source.section ? ` · ${source.section}` : ''}
            {source.page ? ` · p. ${source.page}` : ''}
          </p>
        </div>
        {rel && (
          <span className={cn('rounded px-1.5 py-0.5 text-[10px]', rel.tone)}>{rel.label}</span>
        )}
        <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform mt-1', open && 'rotate-180')} />
      </button>
      {open && source.excerpt && (
        <div className="border-t bg-muted/20 p-2 text-[11px] text-muted-foreground leading-relaxed">
          “{source.excerpt}”
        </div>
      )}
    </div>
  );
}
