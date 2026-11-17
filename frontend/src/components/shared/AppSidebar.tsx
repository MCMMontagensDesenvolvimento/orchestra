import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { env } from '@/lib/env';
import { useCurrentSession } from '@/hooks/queries/useAuth';
import {
  LayoutDashboard, Bot, BookOpen, Server, MessageSquare,
  BarChart3, Shield, Settings, ChevronLeft, ChevronRight, Zap,
  type LucideIcon,
} from 'lucide-react';

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  forceExpanded?: boolean;
  hideToggle?: boolean;
  onNavigate?: () => void;
}

interface NavigationItem {
  label: string;
  icon: LucideIcon;
  path: string;
  permissions?: string[];
}

const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { label: 'Início', icon: LayoutDashboard, path: '/app/dashboard' },
      { label: 'Assistentes', icon: Bot, path: '/app/assistants', permissions: ['assistants.read'] },
      { label: 'Minhas conversas', icon: MessageSquare, path: '/app/chat', permissions: ['agent_runs.read', 'agent_runs.create'] },
    ],
  },
  {
    label: 'Gestão e configurações',
    items: [
      { label: 'Bases de conhecimento', icon: BookOpen, path: '/app/knowledge', permissions: ['knowledge.read'] },
      { label: 'Ferramentas e integrações', icon: Server, path: '/app/mcp', permissions: ['mcp.read'] },
      { label: 'Indicadores', icon: BarChart3, path: '/app/analytics', permissions: ['ai.quality.read'] },
      { label: 'Auditoria', icon: Shield, path: '/app/audit', permissions: ['audit.read'] },
      { label: 'Administração', icon: Settings, path: '/app/admin/users', permissions: ['users.read', 'roles.read', 'permissions.read'] },
    ],
  },
];

export function AppSidebar({ collapsed, onToggle, forceExpanded = false, hideToggle = false, onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const { data: session } = useCurrentSession();
  const isCollapsed = !forceExpanded && collapsed;
  const canShow = (item: NavigationItem) =>
    !item.permissions || (env.useMocks && env.mockModeAllowed) ||
    (session?.permissions.some(permission => item.permissions?.includes(permission)) ?? false);

  return (
    <aside
      className={cn(
        'sidebar-gradient flex h-full flex-col border-r border-sidebar-border transition-all duration-300',
        forceExpanded ? 'w-60' : (collapsed ? 'w-16' : 'w-60'),
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
          <Zap className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
        </div>
        {!isCollapsed && (
          <div className="flex min-w-0 items-baseline gap-1.5 text-sidebar-accent-foreground">
            <span className="text-sm font-bold tracking-wide">MCM</span>
            <span className="text-[10px] font-semibold tracking-wide text-sidebar-foreground">| ORCHESTRA</span>
          </div>
        )}
      </div>

      <nav aria-label="Navegação principal" className="flex-1 overflow-auto px-2 py-3">
        {navigationGroups.map(group => {
          const items = group.items.filter(canShow);
          if (items.length === 0) return null;

          return (
            <div key={group.label} className="mb-5 space-y-1">
              {!isCollapsed && (
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {group.label}
                </p>
              )}
              {items.map(item => {
                const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-primary'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                    aria-current={active ? 'page' : undefined}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={item.label}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {!hideToggle && (
        <button
          onClick={onToggle}
          className="flex items-center justify-center border-t border-sidebar-border p-3 text-sidebar-muted hover:text-sidebar-foreground transition-colors"
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      )}
    </aside>
  );
}
