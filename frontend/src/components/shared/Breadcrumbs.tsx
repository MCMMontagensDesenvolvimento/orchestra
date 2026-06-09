import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { Fragment } from 'react';

/**
 * Breadcrumbs — derivados do pathname.
 * Fase 1: heurística simples baseada em segmentos. Em fases futuras pode
 * receber labels customizadas via contexto/route handle.
 */
const LABELS: Record<string, string> = {
  app: 'Início',
  dashboard: 'Dashboard',
  assistants: 'Assistentes',
  new: 'Novo',
  edit: 'Editar',
  knowledge: 'Knowledge Hub',
  mcp: 'MCP Hub',
  chat: 'Chat',
  analytics: 'Analytics',
  audit: 'Auditoria',
  admin: 'Administração',
  users: 'Usuários',
  roles: 'Perfis',
  settings: 'Configurações',
  profile: 'Perfil',
};

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0 || parts[0] !== 'app') return null;

  const crumbs = parts.map((seg, i) => {
    const href = '/' + parts.slice(0, i + 1).join('/');
    const label = LABELS[seg] ?? seg;
    return { href, label, last: i === parts.length - 1 };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
      <Link to="/app/dashboard" className="hover:text-foreground transition-colors" aria-label="Início">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.slice(1).map((c) => (
        <Fragment key={c.href}>
          <ChevronRight className="h-3 w-3 opacity-60" />
          {c.last ? (
            <span className="font-medium text-foreground">{c.label}</span>
          ) : (
            <Link to={c.href} className="hover:text-foreground transition-colors">{c.label}</Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
