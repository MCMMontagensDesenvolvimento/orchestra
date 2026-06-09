import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Bot, BookOpen, Server, MessageSquare,
  BarChart3, Shield, Settings, ChevronLeft, ChevronRight,
  Zap
} from 'lucide-react';

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Força layout expandido (usado no drawer mobile). */
  forceExpanded?: boolean;
  /** Hide o botão de colapsar (no drawer mobile não faz sentido). */
  hideToggle?: boolean;
  /** Callback ao clicar num item de nav (para fechar drawer mobile). */
  onNavigate?: () => void;
}

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/app/dashboard' },
  { label: 'Assistants', icon: Bot, path: '/app/assistants' },
  { label: 'Knowledge Hub', icon: BookOpen, path: '/app/knowledge' },
  { label: 'MCP Hub', icon: Server, path: '/app/mcp' },
  { label: 'Chat', icon: MessageSquare, path: '/app/chat' },
  { label: 'Analytics', icon: BarChart3, path: '/app/analytics' },
  { label: 'Auditoria', icon: Shield, path: '/app/audit' },
  { label: 'Admin', icon: Settings, path: '/app/admin/users' },
];

export function AppSidebar({ collapsed, onToggle, forceExpanded = false, hideToggle = false, onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const isCollapsed = !forceExpanded && collapsed;

  return (
    <aside
      className={cn(
        'sidebar-gradient flex h-full flex-col border-r border-sidebar-border transition-all duration-300',
        forceExpanded ? 'w-60' : (collapsed ? 'w-16' : 'w-60')
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        {!isCollapsed && (
          <span className="text-base font-bold tracking-wide text-sidebar-accent-foreground">
            ORQUESTRA
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3 overflow-auto">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              title={isCollapsed ? item.label : undefined}
              aria-label={item.label}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
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
