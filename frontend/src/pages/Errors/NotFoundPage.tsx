import { Link, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const location = useLocation();
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
          <Compass className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Erro 404</p>
        <h1 className="mt-1 text-2xl font-bold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não encontramos <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{location.pathname}</code>. Ela pode ter sido movida ou nunca existiu.
        </p>
        <div className="mt-5 flex gap-2">
          <Button asChild variant="outline"><Link to="/app/dashboard">Dashboard</Link></Button>
          <Button asChild><Link to="/app/assistants">Ver assistentes</Link></Button>
        </div>
      </div>
    </div>
  );
}
