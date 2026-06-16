import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { Plus, Users, Shield, Settings, Search, KeyRound, Briefcase } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { usePermissions, useRoles, useUsers, useWorkspaces } from '@/hooks/queries/useAdmin';
import { LlmCatalogSection } from './LlmCatalogSection';

const adminTabs = [
  { label: 'Usuarios', path: '/app/admin/users', icon: Users },
  { label: 'Roles', path: '/app/admin/roles', icon: Shield },
  { label: 'Configuracoes', path: '/app/admin/settings', icon: Settings },
];

export default function AdminPage() {
  const usersQuery = useUsers();
  const rolesQuery = useRoles();
  const permissionsQuery = usePermissions();
  const workspacesQuery = useWorkspaces();
  const location = useLocation();
  const activePath = location.pathname;
  const users = usersQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const workspaces = workspacesQuery.data ?? [];

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Administracao" description="Gerencie usuarios, roles, permissoes e configuracoes do tenant">
          <Button><Plus className="h-4 w-4 mr-1" />Convidar Usuario</Button>
        </PageHeader>

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
                      <p className="text-xs text-muted-foreground">{workspace.description ?? workspace.slug ?? workspace.id}</p>
                    </div>
                  ))}
                </div>
              </QueryState>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="border-b p-3">
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 max-w-sm">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input type="text" placeholder="Buscar usuarios..." className="bg-transparent text-sm outline-none w-full" aria-label="Buscar usuarios" />
              </div>
            </div>

            <QueryState
              query={usersQuery}
              isEmpty={users.length === 0}
              loading={<div className="p-4"><ListLoading rows={5} /></div>}
              emptyIcon={<Users className="h-6 w-6" />}
              emptyTitle="Nenhum usuario cadastrado"
              emptyDescription="Convide o primeiro usuario para comecar a gerenciar acessos no workspace."
              emptyAction={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Convidar Usuario</Button>}
              errorTitle="Nao foi possivel carregar os usuarios"
              errorDescription="Houve um problema ao buscar a lista de usuarios. Tente novamente em instantes."
            >
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuario</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ultimo Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                            {user.name.split(' ').map((name) => name[0]).join('')}
                          </div>
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{user.role}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(user.lastLogin).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="md:hidden divide-y">
                {users.map((user) => (
                  <div key={user.id} className="p-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                      {user.name.split(' ').map((name) => name[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium shrink-0">{user.role}</span>
                  </div>
                ))}
              </div>
            </QueryState>
          </div>
        )}
      </div>
    </AppShell>
  );
}
