# Orchestra - Handoff Tecnico Do Frontend

> Status: handoff historico e tecnico do frontend de origem. Preserva contexto do prototipo e deve ser lido junto com `ORCHESTRA_FRONTEND.md`.

---

## 1. Estado atual do projeto

### Stack detectada
- React 18 + TypeScript 5
- Vite 5 (plugin SWC)
- Tailwind CSS v3 + shadcn/ui (Radix)
- React Router v6
- TanStack Query v5
- Axios (client base configurado, ainda nֳ£o usado em runtime)
- Vitest + Playwright (configurados, suֳ­te mֳ­nima)
- `lovable-tagger` removido na Fase 01 pos-exportacao

### Rotas atuais
ֳrea autenticada agrupada em `/app/*`, com redirects das rotas legadas (`/dashboard`, `/assistants`, `/knowledge`, `/mcp`, `/chat`, `/analytics`, `/audit`, `/admin`, `/settings`, `/profile`) para os equivalentes em `/app/*`.

- `/` ג†’ redireciona para `/login`
- `/login`
- `/app/dashboard`
- `/app/analytics`
- `/app/assistants` ֲ· `/app/assistants/new` ֲ· `/app/assistants/:id` ֲ· `/app/assistants/:id/edit`
- `/app/knowledge` ֲ· `/app/knowledge/:id`
- `/app/mcp` ֲ· `/app/mcp/:id`
- `/app/chat` ֲ· `/app/chat/:assistantId`
- `/app/audit`
- `/app/admin/users` ֲ· `/app/admin/roles` ֲ· `/app/admin/settings`
- `/app/settings` ֲ· `/app/profile`
- `/403` ֲ· `/404` ֲ· `/500` ֲ· `*` ג†’ `NotFoundPage`

### Layouts criados
- `AuthLayout` ג€” fluxo de login (sem shell).
- `AppLayout` ג€” ֳ¡rea autenticada (`/app/*`), wrapper de rotas.
- `DashboardLayout` ג€” agrupa Dashboard + Analytics.
- `ChatLayout` ג€” especֳ­fico do Chat (estrutura full-height).
- `SettingsLayout` ג€” Admin / Settings / Profile.
- `EmptyLayout` ג€” pֳ¡ginas de erro (403/404/500).

### Estrutura principal de pastas
```
src/
  components/
    auth/            # ProtectedRoute, PermissionGate
    chat/            # Componentes da experiֳ×ncia de IA
    shared/          # AppShell, AppSidebar, AppTopbar, QueryState, etc.
    ui/              # shadcn/ui
  data/              # mockData.ts (dataset bruto)
  hooks/
    queries/         # Hooks TanStack Query por domֳ­nio
  layouts/           # Auth, App, Dashboard, Chat, Settings, Empty
  lib/               # env, utils
  pages/             # Pֳ¡ginas por domֳ­nio (Auth, Dashboard, Assistants, ...)
  services/          # Services por domֳ­nio + api/ + mocks/
  types/             # Tipos compartilhados (incl. chat.ts)
```

### Componentes principais
- **Shell:** `AppShell`, `AppSidebar`, `AppTopbar`, `Breadcrumbs`.
- **Estados:** `QueryState`, `EmptyState`, `StatusBadge`, `PageHeader`, `KpiCard`.
- **Auth:** `ProtectedRoute`, `PermissionGate`, `LegacyRedirect`.
- **Chat / IA:** `ChatRunStateIndicator`, `ToolCallCard`, `SourceCitation`, `RAGSourcesList`, `FallbackBadge`, `ChatErrorState`, `FeedbackBar`.

### Hooks / services criados
- Hooks (TanStack Query): `useAssistants`, `useKnowledge`, `useMcp`, `useChat`, `useDashboard`, `useAnalytics`, `useAudit`, `useAdmin`, mais `queryKeys` central.
- Services: `assistants.service`, `knowledge.service`, `mcp.service`, `chat.service`, `dashboard.service`, `analytics.service`, `audit.service`, `admin.service`.
- API base: `services/api/api-client.ts`, `api-error.ts`, `http-status.ts`, `endpoints.ts`.
- Mocks: `services/mocks/index.ts` e `mock-utils.ts` (com `mockResponse` / `mockFind`).

### Mocks e variֳ¡veis de ambiente
Definidas em `.env.example` e tipadas em `src/vite-env.d.ts`:
- `VITE_USE_MOCKS=true|false` ג€” ativa a camada de mocks.
- `VITE_MOCK_DELAY_MS=400` ג€” delay simulado das respostas mock.
- `VITE_MOCK_SCENARIO=success|empty|error|forbidden` ג€” cenֳ¡rio global.
- `VITE_API_BASE_URL=http://localhost:3000/api/v1` ג€” base da API real (quando mocks desligados).

### Como rodar localmente apֳ³s exportaֳ§ֳ£o
```bash
git clone <repo>
cd <projeto>
cp .env.example .env
npm install
npm run dev      # http://localhost:5173
```

---

## 2. Checklist pֳ³s-exportaֳ§ֳ£o

- [x] Remover dependencia `lovable-tagger` do `package.json` e do `vite.config.ts`.
- [x] Substituir o `README.md` boilerplate por documentacao tecnica do produto.
- [x] Revisar/remover referencias ao dominio `lovable.app` e a IDs de projeto Lovable nos documentos operacionais.
- [x] Conferir `.env.example` versionado e `.env` no `.gitignore`.
- [x] Rodar `npx tsc --noEmit`, `npm run lint`, `npm run build` e `npx vitest run`.
- [ ] Validar smoke das rotas principais com mocks ligados.
- [ ] Validar cenֳ¡rios `success | empty | error | forbidden` via `VITE_MOCK_SCENARIO`.
- [ ] Configurar CI (typecheck + lint + build + testes).
- [ ] Definir estratֳ©gia de auth real (SSO/OIDC) antes de desligar mocks.
- [ ] Revisar polֳ­tica de CSP/headers no host de produֳ§ֳ£o (fora do escopo Lovable).

---

## 3. Pendֳ×ncias tֳ©cnicas conhecidas

- **Auth real ausente:** `ProtectedRoute` ֳ© simbֳ³lico; nֳ£o hֳ¡ sessֳ£o, token, refresh ou logout reais.
- **Axios configurado mas inerte:** `apiClient` existe e tem interceptors, mas nenhum service chama HTTP enquanto `VITE_USE_MOCKS=true`.
- **Mocks centralizados parcialmente:** `services/mocks/index.ts` re-exporta `src/data/mockData.ts`; a migraֳ§ֳ£o final dataset-por-domֳ­nio para dentro de `services/mocks/` ainda nֳ£o foi feita.
- **AppShell ainda embutido nas pֳ¡ginas:** o plano original previa elevֳ¡-lo para `AppLayout`; permanece em cada pֳ¡gina por compatibilidade.
- **Chat:** sem runtime, sem RAG, sem MCP e sem provider real. Streaming, tool calls, fontes, fallback e erros sֳ£o simulaֳ§ֳµes visuais.
- **Permissֳµes:** `PermissionGate` ֳ© estrutural; nֳ£o hֳ¡ RBAC real conectado.
- **Testes:** Vitest e Playwright estֳ£o configurados com casos mֳ­nimos; cobertura precisa ser expandida.
- **i18n:** textos em pt-BR diretamente nas pֳ¡ginas; nenhuma camada de traduֳ§ֳ£o.
- **Acessibilidade:** revisֳ£o bֳ¡sica feita (focus ring global, prefers-reduced-motion, labels, autoComplete). Auditoria formal (axe / leitor de tela) ainda pendente.

---

## 4. Mapa das principais telas

| Tela | Rota | Pֳ¡gina | Observaֳ§ֳµes |
|---|---|---|---|
| Login | `/login` | `pages/Auth/LoginPage.tsx` | Mock; sem auth real. |
| Dashboard | `/app/dashboard` | `pages/Dashboard/DashboardPage.tsx` | KPIs + atividade. |
| Analytics | `/app/analytics` | `pages/Analytics/AnalyticsPage.tsx` | Grֳ¡ficos mock. |
| Assistentes (lista) | `/app/assistants` | `pages/Assistants/AssistantsPage.tsx` | Listagem + filtros. |
| Assistente (detalhe) | `/app/assistants/:id` | `pages/Assistants/AssistantDetailPage.tsx` | Versֳµes, prompt, feedback. |
| Assistente (wizard) | `/app/assistants/new` ֲ· `/edit` | `pages/Assistants/AssistantWizardPage.tsx` | 12 etapas. |
| Knowledge (lista) | `/app/knowledge` | `pages/Knowledge/KnowledgePage.tsx` | Bases de conhecimento. |
| Knowledge (detalhe) | `/app/knowledge/:id` | `pages/Knowledge/KnowledgeDetailPage.tsx` | Documentos. |
| MCP Hub | `/app/mcp` | `pages/MCP/McpHubPage.tsx` | Servidores. |
| MCP (detalhe) | `/app/mcp/:id` | `pages/MCP/McpDetailPage.tsx` | Tools/resources/prompts. |
| Chat | `/app/chat` ֲ· `/app/chat/:assistantId` | `pages/Chat/ChatPage.tsx` | Menu ג€Cenֳ¡rioג€ simula estados. |
| Audit | `/app/audit` | `pages/Audit/AuditPage.tsx` | Logs mock. |
| Admin | `/app/admin/*` | `pages/Admin/AdminPage.tsx` | Users/Roles/Settings. |
| Erros | `/403` ֲ· `/404` ֲ· `/500` | `pages/Errors/*` | Layout vazio. |

---

## 5. Mapa da camada de dados

### Services por domֳ­nio (`src/services/*.service.ts`)
- `assistants.service`, `knowledge.service`, `mcp.service`, `chat.service`, `dashboard.service`, `analytics.service`, `audit.service`, `admin.service`.
- Cada service decide entre mock e HTTP com base em `env.useMocks`. Hoje, o ramo HTTP lanֳ§a `Error('API real ainda nֳ£o implementada.')`.

### Hooks (TanStack Query) ג€” `src/hooks/queries/*`
- `useAssistants`, `useKnowledge`, `useMcp`, `useChat`, `useDashboard`, `useAnalytics`, `useAudit`, `useAdmin`.
- Chaves centralizadas em `queryKeys.ts`.

### Mocks
- Dataset bruto: `src/data/mockData.ts`.
- Camada de mocks: `src/services/mocks/index.ts` (re-exporta) e `mock-utils.ts` (`mockResponse`, `mockFind`).
- Cenֳ¡rios globais respeitados: `success | empty | error | forbidden`.

### Como alternar `VITE_USE_MOCKS`
No arquivo `.env`:
```env
VITE_USE_MOCKS=true     # usa mocks
VITE_USE_MOCKS=false    # tenta chamar a API real (ainda nֳ£o implementada)
VITE_MOCK_SCENARIO=success|empty|error|forbidden
VITE_MOCK_DELAY_MS=400
VITE_API_BASE_URL=http://localhost:3000/api/v1
```
Reiniciar o `dev server` apֳ³s alterar variֳ¡veis.

### Endpoints futuros previstos (`src/services/api/endpoints.ts`)
- **auth:** `/auth/login`, `/auth/logout`, `/auth/me`
- **dashboard:** `/dashboard/summary`
- **assistants:** `/assistants`, `/assistants/:id`, `/versions`, `/feedback`, `/test`, `/publish`
- **knowledge:** `/knowledge-bases`, `/knowledge-bases/:id`, `/documents`
- **mcp:** `/mcp/servers`, `/mcp/tools`, `/mcp/resources`, `/mcp/prompts`, `/mcp/bindings`, `/mcp/executions`
- **chat:** `/chat/conversations`, `/chat/conversations/:id/messages`
- **analytics:** `/analytics/overview`
- **audit:** `/audit/logs`
- **admin:** `/admin/users`, `/admin/roles`, `/admin/workspaces`

---

## 6. Experiֳ×ncia de IA

### Tipos criados (`src/types/chat.ts`)
- `ChatRunState`: `idle | sending | thinking | streaming | retrieving_sources | executing_tool | completed | failed | fallback`.
- `ToolCallStatus`, `MockToolCall`, `MockRagSource`, `ChatError`, `ChatErrorKind`.
- `MessagePart` (`text | source | tool_call | status`), `ChatMessageMetadata`, `FeedbackReason`, `MessageFeedback`.
- Decisֳ£o consciente: **nֳ£o** usar `reasoning`; transparֳ×ncia via `status_events` / execution trace seguros.

### Componentes de chat
- `ChatRunStateIndicator` ג€” feedback animado para `thinking`/`streaming`.
- `ToolCallCard` ג€” execuֳ§ֳ£o de tool colapsֳ¡vel; sanitiza chaves sensֳ­veis (`secret`, `token`, `password`, ...).
- `SourceCitation` + `RAGSourcesList` ג€” citaֳ§ֳµes com rֳ³tulo de relevֳ¢ncia e trecho expansֳ­vel.
- `FallbackBadge` ג€” sinaliza fallback de modelo.
- `ChatErrorState` ג€” mapeia `ChatErrorKind` para mensagem amigֳ¡vel.
- `FeedbackBar` ג€” thumbs up/down + diֳ¡logo com razֳµes estruturadas.

### Estados de IA implementados visualmente
`idle`, `sending`, `thinking`, `streaming`, `retrieving_sources`, `executing_tool`, `completed`, `failed`, `fallback`. Disparֳ¡veis via menu **Cenֳ¡rio** no header do Chat.

### O que estֳ¡ mockado
- Mensagens, conversas, fontes RAG, tool calls, fallback e erros.
- Sem provider real, sem RAG real, sem MCP real, sem runtime real.
- Nenhuma chave/secret/credencial presente no cֳ³digo.

---

## 7. Comandos finais

```bash
# Instalaֳ§ֳ£o
npm install            # ou: pnpm install / bun install

# Dev
npm run dev      # http://localhost:5173

# Typecheck
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Preview do build
npm run preview

# Testes
npx vitest run
npx playwright test
```

---

## 8. Conclusֳ£o

O frontend foi ajustado nas cinco fases planejadas (fundaֳ§ֳ£o estrutural, camada de dados mockada, estados e responsividade, experiֳ×ncia de IA e polimento tֳ©cnico/visual) e estֳ¡ **pronto para exportaֳ§ֳ£o e handoff tֳ©cnico**.

Isto **nֳ£o** significa pronto para produֳ§ֳ£o: ainda ֳ© necessֳ¡rio definir arquitetura de backend, modelagem de banco, auth real (SSO/OIDC), integraֳ§ֳ£o com providers de IA, RAG real, MCP real e observabilidade. Toda a camada de dados foi desenhada para que essa transiֳ§ֳ£o aconteֳ§a service-por-service, sem reescrita de UI.

Nenhuma credencial, token, API key ou integraֳ§ֳ£o real foi incluֳ­da no projeto.

---

**Local sugerido apֳ³s exportaֳ§ֳ£o:**

```
docs/engineering/ORCHESTRA_HANDOFF_FRONTEND_LOVABLE.md
```
