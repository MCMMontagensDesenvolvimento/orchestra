import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { FeedbackReason, MessageFeedback } from '@/types/chat';

interface Props {
  feedback?: MessageFeedback;
  onChange?: (feedback: MessageFeedback) => void;
  model?: string;
}

const REASONS: { value: FeedbackReason; label: string }[] = [
  { value: 'useful', label: 'Resposta útil' },
  { value: 'incomplete', label: 'Resposta incompleta' },
  { value: 'wrong_source', label: 'Fonte incorreta' },
  { value: 'wrong_tool', label: 'Ferramenta inadequada' },
  { value: 'confusing', label: 'Resposta confusa' },
  { value: 'other', label: 'Outro' },
];

export function FeedbackBar({ feedback, onChange, model }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingType, setPendingType] = useState<'positive' | 'negative'>('negative');
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [comment, setComment] = useState('');
  const [local, setLocal] = useState<MessageFeedback | undefined>(feedback);

  const send = (type: 'positive' | 'negative') => {
    if (type === 'positive') {
      const f: MessageFeedback = { type, at: new Date().toISOString() };
      setLocal(f);
      onChange?.(f);
      return;
    }
    setPendingType('negative');
    setReasons([]);
    setComment('');
    setOpen(true);
  };

  const submit = () => {
    const f: MessageFeedback = {
      type: pendingType,
      reasons: reasons.length ? reasons : undefined,
      comment: comment.trim() || undefined,
      at: new Date().toISOString(),
    };
    setLocal(f);
    onChange?.(f);
    setOpen(false);
  };

  const toggleReason = (r: FeedbackReason) =>
    setReasons(prev => (prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]));

  return (
    <>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => send('positive')}
          aria-label="Resposta útil"
          className={cn(
            'p-1 rounded transition-colors',
            local?.type === 'positive' ? 'text-success' : 'text-muted-foreground/60 hover:text-success'
          )}
        >
          <ThumbsUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => send('negative')}
          aria-label="Resposta com problemas"
          className={cn(
            'p-1 rounded transition-colors',
            local?.type === 'negative' ? 'text-destructive' : 'text-muted-foreground/60 hover:text-destructive'
          )}
        >
          <ThumbsDown className="h-3 w-3" />
        </button>
        {model && <span className="text-[10px] text-muted-foreground/80">{model}</span>}
        {local?.comment && (
          <span className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">“{local.comment}”</span>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conte mais sobre a resposta</DialogTitle>
            <DialogDescription>
              Seu feedback ajuda a melhorar o assistente. Apenas visual nesta fase — nada é enviado a um backend real.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {REASONS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggleReason(r.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    reasons.includes(r.value)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Comentário opcional"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>Enviar feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
