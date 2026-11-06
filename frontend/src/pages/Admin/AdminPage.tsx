import { useEffect } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { Users, Shield, Settings, KeyRound, Briefcase } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { usePermissions, useRoles, useWorkspaces } from '@/hooks/queries/useAdmin';
import { UsersManagementSection } from './UsersManagementSection';
import { LlmCatalogSection } from './LlmCatalogSection';

const adminTabs = [
  { label: 'Usuarios', path: '/app/admin/users', icon: Users },
  { label: 'Roles', path: '/app/admin/roles', icon: Shield },
  { label: 'Configuracoes', path: '/app/admin/settings', icon: Settings },
];

export default function AdminPage() {
  const rolesQuery = useRoles();
  const permissionsQuery = usePermissions();
  const workspacesQuery = useWorkspaces();
  const location = useLocation();
  const activePath = location.pathname;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);
  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const workspaces = workspacesQuery.data ?? [];

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Administracao" description="Gerencie usuarios, perfis e configuracoes do tenant" />

        <div className="border-b overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {adminTabs.map((tab) => {
              const isActive = activePath === tab.path;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {activePath.endsWith('/roles') ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="border-b p-3 font-medium text-sm">Roles</div>
              <QueryState
                query={rolesQuery}
                isEmpty={roles.length === 0}
                loading={<div className="p-4"><ListLoading rows={4} /></div>}
                emptyIcon={<Shield className="h-6 w-6" />}
                emptyTitle="Nenhuma role cadastrada"
                emptyDescription="As roles do tenant aparecerao aqui."
                errorTitle="Nao foi possivel carregar roles"
                errorDescription="Tente novamente em instantes."
              >
                <div className="divide-y">
                  {roles.map((role) => (
                    <div key={role.id} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{role.name}</p>
                          <p className="text-xs text-muted-foreground">{role.description ?? 'Sem descricao'}</p>
                        </div>
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">{role.permissions.length} permissoes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </QueryState>
            </div>

            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="border-b p-3 font-medium text-sm">Permissoes</div>
              <QueryState
                query={permissionsQuery}
                isEmpty={permissions.length === 0}
                loading={<div className="p-4"><ListLoading rows={4} /></div>}
                emptyIcon={<KeyRound className="h-6 w-6" />}
                emptyTitle="Nenhuma permissao cadastrada"
                emptyDescription="As permissoes globais aparecerao aqui."
                errorTitle="Nao foi possivel carregar permissoes"
                errorDescription="Tente novamente em instantes."
              >
                <div className="divide-y">
                  {permissions.map((permission) => (
                    <div key={permission.id} className="p-3">
                      <p className="font-mono text-xs font-medium">{permission.key}</p>
                      <p className="text-xs text-muted-foreground">{permission.description ?? 'Sem descricao'}</p>
                    </div>
                  ))}
                </div>
              </QueryState>
            </div>
          </div>
        ) : activePath.endsWith('/settings') ? (
          <div className="space-y-4">
            <LlmCatalogSection />

            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="border-b p-3 font-medium text-sm">Workspaces</div>
              <QueryState
                query={workspacesQuery}
                isEmpty={workspaces.length === 0}
                loading={<div className="p-4"><ListLoading rows={4} /></div>}
                emptyIcon={<Briefcase className="h-6 w-6" />}
                emptyTitle="Nenhum workspace cadastrado"
                emptyDescription="Os workspaces do tenant aparecerao aqui."
                errorTitle="Nao foi possivel carregar workspaces"
                errorDescription="Tente novamente em instantes."
              >
                <div className="divide-y">
                  {workspaces.map((workspace) => (
                    <div key={workspace.id} className="p-4">
                      <p className="font-medium">{workspace.name}</p>
                      {(workspace.description || workspace.slug) && (
                        <p className="text-xs text-muted-foreground">
                          {workspace.description ?? workspace.slug}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </QueryState>
            </div>
          </div>
        ) : (
          <UsersManagementSection />
        )}
      </div>
    </AppShell>
  );
}
