import { Bell, Search, ChevronDown, LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentSession, useLogoutMutation } from '@/hooks/queries/useAuth';

interface AppTopbarProps {
  onToggleSidebar: () => void;
}

export function AppTopbar({ onToggleSidebar }: AppTopbarProps) {
  const navigate = useNavigate();
  const { data: session } = useCurrentSession();
  const logoutMutation = useLogoutMutation();
  const userName = session?.user.name ?? 'Usuário Orchestra';
  const userEmail = session?.user.email ?? 'Sessão não carregada';
  const currentWorkspace = session?.workspaces[0];
  const tenantName = session?.tenant.name ?? 'Tenant indisponível';
  const workspaceName = currentWorkspace?.name ?? 'Workspace indisponível';
  const roleName = session?.roles[0] ?? currentWorkspace?.role ?? 'Contexto autenticado';
  const roleLabel = roleName.replaceAll('_', ' ');
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Navigation still clears the local app surface; backend errors are surfaced by logs/devtools.
    }
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-3 sm:px-4 gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="md:hidden shrink-0" aria-label="Abrir menu">
          <Menu className="h-4 w-4" />
        </Button>
        <div
          className="hidden min-w-0 items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-muted-foreground sm:flex"
          role="status"
          aria-label="Busca global em breve"
          title="Busca global indisponível nesta fase"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="w-48 truncate text-sm lg:w-64">Busca global em breve</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="hidden max-w-56 rounded-md border bg-muted/30 px-2.5 py-1 text-muted-foreground md:block"
          role="status"
          aria-label={`Contexto atual: tenant ${tenantName}, workspace ${workspaceName}`}
          title="Contexto atual. A troca de tenant ou workspace está indisponível nesta fase."
        >
          <span className="block text-[10px] uppercase tracking-wide">Contexto atual</span>
          <span className="block truncate text-xs font-medium text-foreground">{tenantName} / {workspaceName}</span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5 text-muted-foreground"
          role="status"
          aria-label="Sem notificações nesta fase"
          title="Notificações em breve"
        >
          <Bell className="h-4 w-4" />
          <span className="hidden text-xs xl:inline">Sem notificações nesta fase</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Abrir menu do usuário"
              title="Abrir menu do usuário"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                {initials}
              </div>
              <span className="hidden text-sm font-medium sm:inline">{userName}</span>
              <ChevronDown className="hidden h-3 w-3 text-muted-foreground sm:inline" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="space-y-1 font-normal">
              <span className="block truncate text-sm font-medium">{userName}</span>
              <span className="block truncate text-xs text-muted-foreground">{userEmail}</span>
              <span className="block text-xs text-muted-foreground">Papel: {roleLabel}</span>
              <span className="block truncate text-xs text-muted-foreground">{tenantName} / {workspaceName}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={logoutMutation.isPending}
              onSelect={() => { void handleLogout(); }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {logoutMutation.isPending ? 'Saindo…' : 'Sair'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
