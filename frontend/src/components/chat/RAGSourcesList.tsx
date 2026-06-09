import { BookOpen } from 'lucide-react';
import type { MockRagSource } from '@/types/chat';
import { SourceCitation } from './SourceCitation';

interface Props {
  sources: MockRagSource[];
  title?: string;
}

export function RAGSourcesList({ sources, title = 'Fontes consultadas' }: Props) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <BookOpen className="h-3 w-3" />
        <span>{title}</span>
        <span className="ml-auto italic normal-case tracking-normal">mock</span>
      </div>
      <div className="grid gap-1.5">
        {sources.map((s, i) => (
          <SourceCitation key={s.id} source={s} index={i} />
        ))}
      </div>
    </div>
  );
}
