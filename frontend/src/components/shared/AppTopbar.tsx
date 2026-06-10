import { Bell, Search, ChevronDown, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCurrentSession, useLogoutMutation } from '@/hooks/queries/useAuth';

interface AppTopbarProps {
  onToggleSidebar: () => void;
}

export function AppTopbar({ onToggleSidebar }: AppTopbarProps) {
  const navigate = useNavigate();
  const { data: session } = useCurrentSession();
  const logoutMutation = useLogoutMutation();
  const userName = session?.user.name ?? 'Maria Silva';
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
        <div className="hidden sm:flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 min-w-0">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Buscar assistentes, bases, ferramentas..."
            className="w-48 lg:w-64 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            aria-label="Busca global"
          />
          <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground lg:inline">
            Ctrl K
          </kbd>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden md:inline rounded-md border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {session?.tenant.name ?? 'Acme Corp'}
        </span>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificacoes">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </Button>
        <button
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted transition-colors"
          aria-label="Menu do usuario"
          onClick={() => { void handleLogout(); }}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
            {initials}
          </div>
          <span className="hidden text-sm font-medium sm:inline">{userName}</span>
          <ChevronDown className="hidden sm:inline h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
