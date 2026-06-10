# Orchestra Frontend API Integration

Status: integracao progressiva implementada na Fase 05.

O frontend continua suportando dois modos:

```env
VITE_USE_MOCKS=true
VITE_USE_MOCKS=false
```

## Modo Mock

Com `VITE_USE_MOCKS=true`, os services seguem consumindo mocks locais. Esse modo preserva a experiencia visual existente e continua sendo o default do `.env.example`.

## Modo API

Com `VITE_USE_MOCKS=false`, os services fundacionais chamam a API real definida por:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

O client usa `withCredentials: true` para enviar o cookie HttpOnly emitido pelo backend. Nenhum token e salvo em `localStorage`.

## Services Integrados

- `auth.service`
- `users.service`
- `workspaces.service`
- `roles.service`
- `permissions.service`
- `assistants.service`
- `audit.service`
- `settings.service`

`admin.service` permanece como fachada de compatibilidade para a tela administrativa.

## Hooks

- `useCurrentSession`
- `useDevLoginMutation`
- `useLogoutMutation`
- `useAssistants`
- `useAssistant`
- `useCreateAssistantMutation`
- `useUpdateAssistantMutation`
- `useWorkspaces`
- `useUsers`
- `useRoles`
- `usePermissions`
- `useAuditLogs`
- `useSettings`

## Telas Integradas

- `LoginPage`: chama `POST /auth/dev-login` em modo API.
- `ProtectedRoute`: chama `GET /auth/me` em modo API.
- `AppTopbar`: exibe usuario e tenant da sessao.
- `AssistantsPage`: lista assistentes reais.
- `AssistantDetailPage`: le detalhe e versoes reais.
- `AssistantWizardPage`: cria, edita e publica assistentes reais.
- `AdminPage`: le usuarios, roles, permissoes e workspaces reais.
- `AuditPage`: le audit logs reais.

## Limites

- Knowledge, MCP, chat, analytics e runtime seguem mockados.
- Feedback e testes de assistant permanecem como leitura mockada quando a API real nao possui esses endpoints.
- Microsoft SSO real nao foi implementado no frontend; apenas o fluxo dev local foi conectado.
