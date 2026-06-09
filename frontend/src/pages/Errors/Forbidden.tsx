import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ForbiddenProps {
  /** Renderiza versão compacta (sem ocupar viewport inteiro), para uso em PermissionGate. */
  inline?: boolean;
  message?: string;
}

export default function Forbidden({ inline = false, message }: ForbiddenProps) {
  const content = (
    <div className="flex flex-col items-center text-center max-w-md">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Erro 403</p>
      <h1 className="mt-1 text-2xl font-bold">Acesso negado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ?? 'Você não tem permissão para acessar este recurso. Solicite acesso ao administrador do workspace.'}
      </p>
      {!inline && (
        <div className="mt-5 flex gap-2">
          <Button asChild variant="outline"><Link to="/app/dashboard">Ir para Dashboard</Link></Button>
          <Button asChild><Link to="/login">Trocar de usuário</Link></Button>
        </div>
      )}
    </div>
  );

  if (inline) return <div className="flex items-center justify-center py-16">{content}</div>;
  return <div className="flex min-h-dvh items-center justify-center px-6">{content}</div>;
}
