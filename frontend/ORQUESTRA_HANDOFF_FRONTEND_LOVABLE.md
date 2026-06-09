# Orquestra — Handoff Técnico Final do Frontend

> Documento de exportação do frontend ajustado no Lovable, preparado para handoff técnico, exportação do projeto e início do ciclo de arquitetura/backend.

---

## 1. Estado atual do projeto

### Stack detectada
- React 18 + TypeScript 5
- Vite 5 (plugin SWC)
- Tailwind CSS v3 + shadcn/ui (Radix)
- React Router v6
- TanStack Query v5
- Axios (client base configurado, ainda não usado em runtime)
- Vitest + Playwright (configurados, suíte mínima)
- `lovable-tagger` (apenas em dev — **remover após exportação**)

### Rotas atuais
Área autenticada agrupada em `/app/*`, com redirects das rotas legadas (`/dashboard`, `/assistants`, `/knowledge`, `/mcp`, `/chat`, `/analytics`, `/audit`, `/admin`, `/settings`, `/profile`) para os equivalentes em `/app/*`.

- `/` → redireciona para `/login`
- `/login`
- `/app/dashboard`
- `/app/analytics`
- `/app/assistants` · `/app/assistants/new` · `/app/assistants/:id` · `/app/assistants/:id/edit`
- `/app/knowledge` · `/app/knowledge/:id`
- `/app/mcp` · `/app/mcp/:id`
- `/app/chat` · `/app/chat/:assistantId`
- `/app/audit`
- `/app/admin/users` · `/app/admin/roles` · `/app/admin/settings`
- `/app/settings` · `/app/profile`
- `/403` · `/404` · `/500` · `*` → `NotFoundPage`

### Layouts criados
- `AuthLayout` — fluxo de login (sem shell).
- `AppLayout` — área autenticada (`/app/*`), wrapper de rotas.
- `DashboardLayout` — agrupa Dashboard + Analytics.
- `ChatLayout` — específico do Chat (estrutura full-height).
- `SettingsLayout` — Admin / Settings / Profile.
- `EmptyLayout` — páginas de erro (403/404/500).

### Estrutura principal de pastas
```
src/
  components/
    auth/            # ProtectedRoute, PermissionGate
    chat/            # Componentes da experiência de IA
    shared/          # AppShell, AppSidebar, AppTopbar, QueryState, etc.
    ui/              # shadcn/ui
  data/              # mockData.ts (dataset bruto)
  hooks/
    queries/         # Hooks TanStack Query por domínio
  layouts/           # Auth, App, Dashboard, Chat, Settings, Empty
  lib/               # env, utils
  pages/             # Páginas por domínio (Auth, Dashboard, Assistants, ...)
  services/          # Services por domínio + api/ + mocks/
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

### Mocks e variáveis de ambiente
Definidas em `.env.example` e tipadas em `src/vite-env.d.ts`:
- `VITE_USE_MOCKS=true|false` — ativa a camada de mocks.
- `VITE_MOCK_DELAY_MS=400` — delay simulado das respostas mock.
- `VITE_MOCK_SCENARIO=success|empty|error|forbidden` — cenário global.
- `VITE_API_BASE_URL=http://localhost:3000/api/v1` — base da API real (quando mocks desligados).

### Como rodar localmente após exportação
```bash
git clone <repo>
cd <projeto>
cp .env.example .env
npm install
npm run dev      # http://localhost:8080
```

---

## 2. Checklist pós-exportação

- [ ] Remover dependência `lovable-tagger` do `package.json` e do `vite.config.ts`.
- [ ] Substituir o `README.md` boilerplate por documentação interna do produto.
- [ ] Revisar/remover referências ao domínio `lovable.app` e a IDs de projeto Lovable.
- [ ] Conferir `.env.example` versionado e `.env` no `.gitignore`.
- [ ] Rodar `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] Validar smoke das rotas principais com mocks ligados.
- [ ] Validar cenários `success | empty | error | forbidden` via `VITE_MOCK_SCENARIO`.
- [ ] Configurar CI (typecheck + lint + build + testes).
- [ ] Definir estratégia de auth real (SSO/OIDC) antes de desligar mocks.
- [ ] Revisar política de CSP/headers no host de produção (fora do escopo Lovable).

---

## 3. Pendências técnicas conhecidas

- **Auth real ausente:** `ProtectedRoute` é simbólico; não há sessão, token, refresh ou logout reais.
- **Axios configurado mas inerte:** `apiClient` existe e tem interceptors, mas nenhum service chama HTTP enquanto `VITE_USE_MOCKS=true`.
- **Mocks centralizados parcialmente:** `services/mocks/index.ts` re-exporta `src/data/mockData.ts`; a migração final dataset-por-domínio para dentro de `services/mocks/` ainda não foi feita.
- **AppShell ainda embutido nas páginas:** o plano original previa elevá-lo para `AppLayout`; permanece em cada página por compatibilidade.
- **Chat:** sem runtime, sem RAG, sem MCP e sem provider real. Streaming, tool calls, fontes, fallback e erros são simulações visuais.
- **Permissões:** `PermissionGate` é estrutural; não há RBAC real conectado.
- **Testes:** Vitest e Playwright estão configurados com casos mínimos; cobertura precisa ser expandida.
- **i18n:** textos em pt-BR diretamente nas páginas; nenhuma camada de tradução.
- **Acessibilidade:** revisão básica feita (focus ring global, prefers-reduced-motion, labels, autoComplete). Auditoria formal (axe / leitor de tela) ainda pendente.

---

## 4. Mapa das principais telas

| Tela | Rota | Página | Observações |
|---|---|---|---|
| Login | `/login` | `pages/Auth/LoginPage.tsx` | Mock; sem auth real. |
| Dashboard | `/app/dashboard` | `pages/Dashboard/DashboardPage.tsx` | KPIs + atividade. |
| Analytics | `/app/analytics` | `pages/Analytics/AnalyticsPage.tsx` | Gráficos mock. |
| Assistentes (lista) | `/app/assistants` | `pages/Assistants/AssistantsPage.tsx` | Listagem + filtros. |
| Assistente (detalhe) | `/app/assistants/:id` | `pages/Assistants/AssistantDetailPage.tsx` | Versões, prompt, feedback. |
| Assistente (wizard) | `/app/assistants/new` · `/edit` | `pages/Assistants/AssistantWizardPage.tsx` | 12 etapas. |
| Knowledge (lista) | `/app/knowledge` | `pages/Knowledge/KnowledgePage.tsx` | Bases de conhecimento. |
| Knowledge (detalhe) | `/app/knowledge/:id` | `pages/Knowledge/KnowledgeDetailPage.tsx` | Documentos. |
| MCP Hub | `/app/mcp` | `pages/MCP/McpHubPage.tsx` | Servidores. |
| MCP (detalhe) | `/app/mcp/:id` | `pages/MCP/McpDetailPage.tsx` | Tools/resources/prompts. |
| Chat | `/app/chat` · `/app/chat/:assistantId` | `pages/Chat/ChatPage.tsx` | Menu “Cenário” simula estados. |
| Audit | `/app/audit` | `pages/Audit/AuditPage.tsx` | Logs mock. |
| Admin | `/app/admin/*` | `pages/Admin/AdminPage.tsx` | Users/Roles/Settings. |
| Erros | `/403` · `/404` · `/500` | `pages/Errors/*` | Layout vazio. |

---

## 5. Mapa da camada de dados

### Services por domínio (`src/services/*.service.ts`)
- `assistants.service`, `knowledge.service`, `mcp.service`, `chat.service`, `dashboard.service`, `analytics.service`, `audit.service`, `admin.service`.
- Cada service decide entre mock e HTTP com base em `env.useMocks`. Hoje, o ramo HTTP lança `Error('API real ainda não implementada.')`.

### Hooks (TanStack Query) — `src/hooks/queries/*`
- `useAssistants`, `useKnowledge`, `useMcp`, `useChat`, `useDashboard`, `useAnalytics`, `useAudit`, `useAdmin`.
- Chaves centralizadas em `queryKeys.ts`.

### Mocks
- Dataset bruto: `src/data/mockData.ts`.
- Camada de mocks: `src/services/mocks/index.ts` (re-exporta) e `mock-utils.ts` (`mockResponse`, `mockFind`).
- Cenários globais respeitados: `success | empty | error | forbidden`.

### Como alternar `VITE_USE_MOCKS`
No arquivo `.env`:
```env
VITE_USE_MOCKS=true     # usa mocks
VITE_USE_MOCKS=false    # tenta chamar a API real (ainda não implementada)
VITE_MOCK_SCENARIO=success|empty|error|forbidden
VITE_MOCK_DELAY_MS=400
VITE_API_BASE_URL=http://localhost:3000/api/v1
```
Reiniciar o `dev server` após alterar variáveis.

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

## 6. Experiência de IA

### Tipos criados (`src/types/chat.ts`)
- `ChatRunState`: `idle | sending | thinking | streaming | retrieving_sources | executing_tool | completed | failed | fallback`.
- `ToolCallStatus`, `MockToolCall`, `MockRagSource`, `ChatError`, `ChatErrorKind`.
- `MessagePart` (`text | source | tool_call | status`), `ChatMessageMetadata`, `FeedbackReason`, `MessageFeedback`.
- Decisão consciente: **não** usar `reasoning`; transparência via `status_events` / execution trace seguros.

### Componentes de chat
- `ChatRunStateIndicator` — feedback animado para `thinking`/`streaming`.
- `ToolCallCard` — execução de tool colapsável; sanitiza chaves sensíveis (`secret`, `token`, `password`, ...).
- `SourceCitation` + `RAGSourcesList` — citações com rótulo de relevância e trecho expansível.
- `FallbackBadge` — sinaliza fallback de modelo.
- `ChatErrorState` — mapeia `ChatErrorKind` para mensagem amigável.
- `FeedbackBar` — thumbs up/down + diálogo com razões estruturadas.

### Estados de IA implementados visualmente
`idle`, `sending`, `thinking`, `streaming`, `retrieving_sources`, `executing_tool`, `completed`, `failed`, `fallback`. Disparáveis via menu **Cenário** no header do Chat.

### O que está mockado
- Mensagens, conversas, fontes RAG, tool calls, fallback e erros.
- Sem provider real, sem RAG real, sem MCP real, sem runtime real.
- Nenhuma chave/secret/credencial presente no código.

---

## 7. Comandos finais

```bash
# Instalação
npm install            # ou: pnpm install / bun install

# Dev
npm run dev            # http://localhost:8080

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

## 8. Conclusão

O frontend foi ajustado nas cinco fases planejadas (fundação estrutural, camada de dados mockada, estados e responsividade, experiência de IA e polimento técnico/visual) e está **pronto para exportação e handoff técnico**.

Isto **não** significa pronto para produção: ainda é necessário definir arquitetura de backend, modelagem de banco, auth real (SSO/OIDC), integração com providers de IA, RAG real, MCP real e observabilidade. Toda a camada de dados foi desenhada para que essa transição aconteça service-por-service, sem reescrita de UI.

Nenhuma credencial, token, API key ou integração real foi incluída no projeto.

---

**Local sugerido após exportação:**

```
docs/engineering/ORQUESTRA_HANDOFF_FRONTEND_LOVABLE.md
```
