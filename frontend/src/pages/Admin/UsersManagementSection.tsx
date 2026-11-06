import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrentSession } from '@/hooks/queries/useAuth';
import { useRoles } from '@/hooks/queries/useAdmin';
import { userManagementService, type ManagedUser, type ManagedUserInput } from '@/services/user-management.service';

type UserForm = { name: string; email: string; status: 'active' | 'inactive'; roleId: string };
const emptyForm = (): UserForm => ({ name: '', email: '', status: 'active', roleId: '' });

export function UsersManagementSection() {
  const queryClient = useQueryClient();
  const session = useCurrentSession();
  const canRead = session.data?.permissions.includes('users.read') ?? false;
  const canManage = session.data?.permissions.includes('users.manage') ?? false;
  const canManageRoles = session.data?.permissions.includes('roles.manage') ?? false;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const rolesQuery = useRoles();
  const roleOptions = rolesQuery.data ?? [];

  const usersQuery = useQuery({
    queryKey: ['admin', 'managed-users', page, search],
    queryFn: () => userManagementService.list(page, search),
    enabled: canRead,
  });
  const mutation = useMutation({
    mutationFn: async (input: { id?: string; values: ManagedUserInput }) => {
      if (input.id) return userManagementService.update(input.id, input.values);
      return userManagementService.create(input.values);
    },
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'managed-users'] });
      toast.success(editing ? 'Usuario atualizado.' : 'Usuario criado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => userManagementService.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'managed-users'] });
      toast.success('Usuario excluido.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm(), roleId: roleOptions.find((role) => role.name === 'consumer')?.id ?? '' });
    setOpen(true);
  }
  function openEdit(user: ManagedUser) {
    setEditing(user);
    setForm({
      name: user.name, email: user.email,
      status: user.status === 'inactive' ? 'inactive' : 'active',
      roleId: user.roles[0]?.id ?? '',
    });
    setOpen(true);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || (!editing && !form.email.trim())) {
      toast.error('Preencha nome e email.');
      return;
    }
    const values: ManagedUserInput = {
      name: form.name.trim(), status: form.status,
      ...(!editing ? { email: form.email.trim().toLowerCase() } : {}),
    };
    if (canManageRoles && form.roleId && (!editing || form.roleId !== (editing.roles[0]?.id ?? ''))) {
      values.roleId = form.roleId;
    }
    mutation.mutate({ id: editing?.id, values });
  }
  async function removeUser(user: ManagedUser) {
    if (user.id === session.data?.user.id) {
      toast.error('Nao e permitido excluir sua propria conta.');
      return;
    }
    if (!window.confirm(`Excluir o usuario ${user.name}? O acesso sera desativado e o registro preservado para auditoria.`)) return;
    await deleteMutation.mutateAsync(user.id).catch(() => undefined);
  }

  const users = usersQuery.data?.data ?? [];
  const pagination = usersQuery.data?.pagination;
  const saving = mutation.isPending || deleteMutation.isPending;

  if (session.isLoading) return <p className="p-4 text-sm text-muted-foreground">Carregando permissoes...</p>;
  if (!canRead) return <p className="rounded-lg border p-6 text-sm text-muted-foreground">Voce nao tem permissao para visualizar usuarios.</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(event) => {
            event.preventDefault(); setPage(1); setSearch(searchInput.trim());
          }}>
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input className="max-w-sm" value={searchInput} onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nome ou email" aria-label="Buscar usuarios" />
            <Button type="submit" variant="outline">Buscar</Button>
          </form>
          {canManage && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Novo usuario</Button>}
        </div>
        {usersQuery.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando usuarios...</p>
        ) : usersQuery.isError ? (
          <p className="p-6 text-sm text-destructive">Nao foi possivel carregar os usuarios.</p>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-3 h-7 w-7" />Nenhum usuario encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ultimo login</th>
                  {canManage && <th className="px-4 py-3 text-right">Acoes</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">{user.roles.map((role) => role.name).join(', ') || 'Sem perfil'}</td>
                    <td className="px-4 py-3">
                      <span className={user.status === 'active'
                        ? 'rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400'
                        : 'rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground'}>
                        {user.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString('pt-BR') : 'Nunca'}</td>
                    {canManage && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}
                          aria-label={`Editar ${user.name}`}><Pencil className="mr-1 h-4 w-4" />Editar</Button>
                        <Button variant="ghost" size="sm" disabled={saving || user.id === session.data?.user.id}
                          onClick={() => void removeUser(user)} aria-label={`Excluir ${user.name}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">{pagination ? `${pagination.total} usuario(s) · Pagina ${page} de ${Math.max(1, pagination.totalPages)}` : '—'}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || usersQuery.isFetching}
              onClick={() => setPage((current) => current - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={!pagination || page >= pagination.totalPages || usersQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}>Proximo</Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(value) => { if (!mutation.isPending) setOpen(value); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar usuario' : 'Novo usuario'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize o nome, status e perfil. O email de identidades Microsoft nao e alterado.' :
                'Crie um usuario no workspace principal com o perfil selecionado.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="managed-user-name">Nome</Label>
              <Input id="managed-user-name" required minLength={2} maxLength={120} value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-user-email">Email</Label>
              <Input id="managed-user-email" type="email" required disabled={Boolean(editing)} value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-user-role">Perfil</Label>
              <select id="managed-user-role" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                disabled={!canManageRoles || rolesQuery.isLoading} value={form.roleId}
                onChange={(event) => setForm({ ...form, roleId: event.target.value })}>
                {!form.roleId && <option value="">Perfil padrao (consumer)</option>}
                {roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">
                {canManageRoles ? 'Alterar o perfil substitui as roles atuais deste tenant.' :
                  'Sua conta nao possui permissao para alterar perfis.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-user-status">Status</Label>
              <select id="managed-user-status" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.status} onChange={(event) => setForm({
                  ...form, status: event.target.value as UserForm['status'],
                })}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Alteracoes de perfil exigem novo login do colaborador para atualizar a sessao.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando...' : 'Salvar usuario'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
