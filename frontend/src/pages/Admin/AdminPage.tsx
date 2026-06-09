import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useUsers } from '@/hooks/queries/useAdmin';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { Plus, Users, Shield, Settings, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const adminTabs = [
  { label: 'Usuários', path: '/app/admin/users', icon: Users },
  { label: 'Roles', path: '/app/admin/roles', icon: Shield },
  { label: 'Configurações', path: '/app/admin/settings', icon: Settings },
];

export default function AdminPage() {
  const usersQuery = useUsers();
  const mockUsers = usersQuery.data ?? [];
  const location = useLocation();

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Administração" description="Gerencie usuários, roles, permissões e configurações do tenant">
          <Button><Plus className="h-4 w-4 mr-1" />Convidar Usuário</Button>
        </PageHeader>

        {/* Tabs */}
        <div className="border-b overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {adminTabs.map(tab => {
              const isActive = location.pathname === tab.path;
              return (
                <Link key={tab.path} to={tab.path} className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="border-b p-3">
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 max-w-sm">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="text" placeholder="Buscar usuários..." className="bg-transparent text-sm outline-none w-full" aria-label="Buscar usuários" />
            </div>
          </div>

          <QueryState
            query={usersQuery}
            isEmpty={mockUsers.length === 0}
            loading={<div className="p-4"><ListLoading rows={5} /></div>}
            emptyIcon={<Users className="h-6 w-6" />}
            emptyTitle="Nenhum usuário cadastrado"
            emptyDescription="Convide o primeiro usuário para começar a gerenciar acessos no workspace."
            emptyAction={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Convidar Usuário</Button>}
            errorTitle="Não foi possível carregar os usuários"
            errorDescription="Houve um problema ao buscar a lista de usuários. Tente novamente em instantes."
          >
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Último Login</th>
                </tr>
              </thead>
              <tbody>
                {mockUsers.map(user => (
                  <tr key={user.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                          {user.name.split(' ').map(n => n[0]).join('')}
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

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {mockUsers.map(user => (
                <div key={user.id} className="p-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                    {user.name.split(' ').map(n => n[0]).join('')}
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
      </div>
    </AppShell>
  );
}
