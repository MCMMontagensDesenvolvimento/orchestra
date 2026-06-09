import { Link } from 'react-router-dom';
import { AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ServerError() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
          <AlertOctagon className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Erro 500</p>
        <h1 className="mt-1 text-2xl font-bold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu um erro inesperado ao processar sua requisição. Tente novamente em instantes ou contate o suporte se o problema persistir.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
          <Button asChild><Link to="/app/dashboard">Voltar ao Dashboard</Link></Button>
        </div>
      </div>
    </div>
  );
}
