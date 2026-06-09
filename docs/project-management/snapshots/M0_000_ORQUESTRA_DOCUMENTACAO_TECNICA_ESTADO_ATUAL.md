# Documentação Técnica do Estado Atual do Projeto Orquestra

> Documento de referência interna — MCM. Conteúdo neutro e institucional, baseado em evidências reais do código-fonte e nas inferências possíveis a partir da interface atual. Toda recomendação aqui apresentada deve ser validada em decisão de produto, arquitetura e segurança antes da execução.

---

## 0. State Audit Blueprint

| Dimensão | Avaliação | Evidência |
|---|---|---|
| Tipo de entrega atual | Protótipo de frontend de alta fidelidade | `src/pages/**`, `src/data/mockData.ts` |
| Backend próprio | AUSENTE | Nenhum diretório `/backend`, sem servidor, sem rotas API |
| Banco de dados | AUSENTE | Toda persistência ocorre em memória via mocks |
| Autenticação | SIMULADO | `pages/Auth/LoginPage.tsx` não valida credenciais |
| Camada de serviços | AUSENTE | Páginas consomem `mockData` diretamente |
| Estado servidor (TanStack Query) | INSTALADO mas NÃO USADO | `QueryClientProvider` presente em `App.tsx`, sem `useQuery`/`useMutation` |
| HTTP client (Axios) | INSTALADO mas NÃO USADO | Dependência presente, nenhum import |
| Validação de formulários (Zod + RHF) | INSTALADO mas NÃO USADO | Wizard usa `useState` puro |
| Multi-tenant | INFERIDO (visual) | Topbar mostra "Acme Corp" hardcoded |
| RBAC | INFERIDO (visual) | Tela `/admin/roles` existe; sem `ProtectedRoute` |
| Runtime de IA | AUSENTE | Não há provedor LLM, chamadas a APIs ou streaming real |
| RAG real | AUSENTE | Bases de conhecimento são objetos estáticos |
| MCP real | AUSENTE | Servidores e tools são entidades visuais |
| Maturidade técnica | **Nível 2 — Frontend funcional mockado**, com elementos do Nível 3 | Estrutura modular por domínio, design system consistente |

Conclusão do blueprint: o projeto está pronto para iniciar a fase de consolidação do frontend e provisionamento da camada de backend, mas nenhum fluxo end-to-end real existe hoje.

---

## 1. Visão Geral do Projeto

- **Nome:** Orquestra
- **Tipo de sistema:** Plataforma corporativa (SaaS interno) para criação, configuração, publicação, monitoramento e governança de assistentes de IA empresariais.
- **Público:** equipes corporativas — proprietários de assistentes, administradores de plataforma, equipes de segurança/compliance, áreas de negócio consumidoras de chat IA.
- **Escopo atual (evidenciado):**
  - Wizard de criação de assistentes (12 etapas).
  - Listagem, detalhe e edição de assistentes.
  - Knowledge Hub (bases de conhecimento, documentos, ingestão).
  - MCP Hub (servidores Model Context Protocol, tools, bindings).
  - Chat Workspace (interface visual de conversa).
  - Analytics (gráficos com dados estáticos).
  - Auditoria (log mock).
  - Admin (usuários, roles, configurações).
- **Pilares do produto** (rastreado em memória de projeto): Studio (assistentes), Knowledge, MCP, Chat.
- **Maturidade:** Nível 2 com elementos do Nível 3 (estrutura modular preparada para receber backend).

---

## 2. Inventário de Arquivos e Estrutura do Projeto

```
src/
├── App.tsx                      # Router principal (React Router DOM v6)
├── main.tsx
├── index.css                    # Tokens HSL do design system
├── App.css
├── vite-env.d.ts
├── components/
│   ├── NavLink.tsx
│   ├── shared/                  # Layout compartilhado
│   │   ├── AppShell.tsx
│   │   ├── AppSidebar.tsx
│   │   ├── AppTopbar.tsx
│   │   ├── EmptyState.tsx
│   │   ├── KpiCard.tsx
│   │   ├── PageHeader.tsx
│   │   └── StatusBadge.tsx
│   └── ui/                      # shadcn/ui (≈45 componentes)
├── data/
│   └── mockData.ts              # Toda a "base de dados" do protótipo
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts                 # cn() helper
├── pages/
│   ├── Admin/AdminPage.tsx
│   ├── Analytics/AnalyticsPage.tsx
│   ├── Assistants/
│   │   ├── AssistantsPage.tsx          (404 LOC)
│   │   ├── AssistantDetailPage.tsx     (863 LOC)
│   │   └── AssistantWizardPage.tsx     (682 LOC)
│   ├── Audit/AuditPage.tsx
│   ├── Auth/LoginPage.tsx
│   ├── Chat/ChatPage.tsx
│   ├── Dashboard/DashboardPage.tsx
│   ├── Index.tsx
│   ├── Knowledge/
│   │   ├── KnowledgePage.tsx           (468 LOC)
│   │   └── KnowledgeDetailPage.tsx     (408 LOC)
│   ├── MCP/
│   │   ├── McpHubPage.tsx              (588 LOC)
│   │   └── McpDetailPage.tsx           (346 LOC)
│   └── NotFound.tsx
├── test/
│   ├── example.test.ts
│   └── setup.ts
└── types/
    └── index.ts                 # 271 LOC, todos os domínios tipados
```

**Configuração e raiz:** `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `eslint.config.js`, `postcss.config.js`, `components.json`, `playwright.config.ts`, `vitest.config.ts`, `index.html`, `README.md`.

**Ausentes (relevantes para próxima fase):** `src/services/`, `src/api/`, `src/schemas/`, `src/contexts/`, `src/providers/`, `src/routes/ProtectedRoute.tsx`, `src/store/`.

---

## 3. Aderência ao Padrão de Repositório

| Item esperado | Presente? | Observação |
|---|---|---|
| `/frontend` separado | NÃO | Frontend está na raiz (padrão de exportação Lovable) |
| `/backend` | AUSENTE | Não existe backend |
| `README.md` | SIM | Conteúdo padrão Lovable |
| `.gitignore` | SIM | Padrão Vite |
| `.env.example` | AUSENTE | RECOMENDADO antes do backend |
| `Dockerfile.dev/prod` | AUSENTE | RECOMENDADO |
| `docker-compose.*` | AUSENTE | RECOMENDADO |
| `.dockerignore` | AUSENTE | RECOMENDADO |
| `CHANGELOG.md` | AUSENTE | RECOMENDADO |
| `CONTRIBUTING.md` | AUSENTE | RECOMENDADO |

**Recomendação:** antes de introduzir backend real, mover o frontend para `/frontend` e provisionar `/backend` em estrutura monorepo (ou repositórios separados, conforme decisão de arquitetura).

---

## 4. Stack Técnica Utilizada

### 4.1 Runtime e build
- React 18.3.1
- Vite 5.4.19 (`@vitejs/plugin-react-swc`)
- TypeScript 5.8
- Tailwind CSS 3.4 + `tailwindcss-animate` + `@tailwindcss/typography`
- ESLint 9 (`typescript-eslint`)

### 4.2 UI / Design
- shadcn/ui (alias `@/components/ui`, base color `slate`)
- Radix UI primitives (todas as bibliotecas necessárias instaladas)
- `lucide-react` 0.462 (ícones)
- `class-variance-authority`, `tailwind-merge`, `clsx`
- `sonner` + `@radix-ui/react-toast` (dois sistemas de toast coexistem)
- `next-themes` (dark mode disponível, **não aplicado** no produto)
- `framer-motion` 12 (instalado, uso pontual — ver §6.1)
- `vaul`, `embla-carousel-react`, `react-resizable-panels`, `cmdk`, `input-otp`, `react-day-picker`

### 4.3 Dados e formulários
- `@tanstack/react-query` 5.83 — **instalado e provider montado**, sem hooks de consulta no código
- `axios` 1.13 — **instalado, nenhum import**
- `react-hook-form` 7.61 + `@hookform/resolvers` + `zod` 3.25 — **instalados, não usados** (formulários atuais usam `useState`)
- `date-fns` 3.6

### 4.4 Visualização e routing
- `recharts` 2.15 (Analytics e Dashboard)
- `react-router-dom` 6.30 (único router)

### 4.5 Testes
- Vitest 3 + Testing Library + `jsdom` (configurado; 1 teste de exemplo)
- Playwright 1.57 + `playwright-fixture.ts` (configurado; nenhum spec real)

### 4.6 Artefatos Lovable
- `lovable-tagger` em `devDependencies` e plugin `componentTagger()` em `vite.config.ts` (modo dev). **Recomendado remover** na higienização pós-Lovable, caso a equipe decida desacoplar.

### 4.7 Lockfile e package manager
- Apenas `package.json`; lockfile não verificado nesta auditoria — REQUER_DECISAO sobre padronizar `npm`/`pnpm`/`bun` e remover divergentes.

---

## 5. Auditoria de Frontend

| Aspecto | Status | Observação |
|---|---|---|
| Estrutura modular por domínio | IMPLEMENTADO | `pages/<Dominio>/<Page>.tsx` |
| Layout compartilhado (`AppShell`) | IMPLEMENTADO | Sidebar colapsável + topbar |
| Camada `services/` | AUSENTE | Lógica de "dados" embutida nas páginas |
| API client centralizado | AUSENTE | — |
| TanStack Query em uso | AUSENTE | Provider sem consumidores |
| Forms com RHF + Zod | AUSENTE | Wizard usa `useState` (`AssistantWizardPage.tsx`) |
| Tratamento global de erros | AUSENTE | Sem ErrorBoundary, sem interceptor |
| Loading / Empty / Error states | PARCIAL | `EmptyState` existe; loading e error são raros |
| Toasts | IMPLEMENTADO | Tanto `sonner` quanto Radix Toast — REQUER_DECISAO consolidar |
| Responsividade | PARCIAL | Listas e cards adaptam; tabelas densas e wizard precisam revisão mobile |
| Acessibilidade | PARCIAL | Radix garante semântica base; faltam labels, ordem de foco e ARIA em diversos pontos |
| DataTables | MOCKADO | Tabelas HTML simples, sem virtualização, paginação ou ordenação real |
| Permissões visuais | INFERIDO | Não há gating; tudo é navegável |
| Páginas extensas | RISCO | `AssistantDetailPage.tsx` 863 LOC, `Wizard` 682, `McpHubPage` 588 — quebrar em subcomponentes |

---

## 6. Auditoria de Design System

- **Tokens HSL** definidos em `src/index.css` e mapeados em `tailwind.config.ts`.
- Paleta corporativa: branco como fundo, cinza neutro, **laranja primário** (ativos/CTA).
- Tipografia: sans-serif neutra (Inter via shadcn padrão).
- Componentes base via shadcn cobrem inputs, dialog, dropdown, tabs, select, switch, accordion, alert-dialog, sheet, popover, table.
- **Gradientes** customizados: `.gradient-primary` e `.sidebar-gradient` aplicados na sidebar e em badges/avatares.
- **Dark mode:** dependência `next-themes` instalada, mas alternância não exposta na UI — REQUER_DECISAO se será suportado.
- **Consistência:** alta. Padrões de listagem (header, filtros, ações em três pontos) e detalhe (tabs) seguem regra única.
- **Riscos:** uso esporádico de classes utilitárias com cor literal deve ser auditado para garantir 100% de tokens semânticos.

---

## 6.1 Auditoria de Motion, Microinterações e Experiência Dinâmica

| Recurso | Status | Observação |
|---|---|---|
| `framer-motion` | INSTALADO | Uso pontual, não sistemático |
| `tailwindcss-animate` | IMPLEMENTADO | Animações de entrada (`animate-fade-in`) em headers de página |
| Transições de página | AUSENTE | Sem `AnimatePresence` no Router |
| Skeleton loaders | PARCIAL | Componente `skeleton` shadcn disponível, pouco aplicado |
| Microinterações em botões/cards | PARCIAL | Hover via Tailwind |
| Estados animados de IA (typing, streaming, "thinking") | AUSENTE | Chat é estático |
| Lottie | AUSENTE | — |
| `prefers-reduced-motion` | NAO_IDENTIFICADO | Sem fallback explícito |

**Classificação:** **básico**. Para um produto premium B2B, recomenda-se elevar a "relevante" cobrindo: transições de página, micro-animação em mudança de status (assistente publicado, tool aprovada), streaming visual do chat, esqueletos animados nas listagens.

---

## 7. Mapeamento de Páginas

| Rota | Página | Objetivo | Dados | Backend necessário | Status |
|---|---|---|---|---|---|
| `/login` | `Auth/LoginPage` | Autenticação | — | Auth API, sessão | SIMULADO |
| `/dashboard` | `Dashboard/DashboardPage` | Visão executiva | KPIs e gráficos mock | KPIs agregados | MOCKADO |
| `/assistants` | `Assistants/AssistantsPage` | Listagem | `mockAssistants` | CRUD assistants | MOCKADO |
| `/assistants/new` | `AssistantWizardPage` | Criação (12 etapas) | `useState` local | POST assistant + versionamento | PARCIAL (UI completa) |
| `/assistants/:id` | `AssistantDetailPage` | Detalhe (Overview, Config, Knowledge, Tools, Versions, Tests, Feedback, Prompt Compilado) | mocks | Múltiplos endpoints | PARCIAL |
| `/assistants/:id/edit` | `AssistantWizardPage` | Edição | mocks | PATCH assistant | PARCIAL |
| `/knowledge` | `Knowledge/KnowledgePage` | Listagem bases RAG | `mockKnowledgeBases` | CRUD KB | MOCKADO |
| `/knowledge/:id` | `KnowledgeDetailPage` | Detalhe + documentos | mocks | CRUD doc, ingestão | MOCKADO |
| `/mcp` | `MCP/McpHubPage` | Servidores MCP | mocks | Registry MCP | MOCKADO |
| `/mcp/:id` | `McpDetailPage` | Detalhe servidor MCP | mocks | Tools, logs, bindings | MOCKADO |
| `/chat` e `/chat/:assistantId` | `Chat/ChatPage` | Conversa | mocks | Runtime LLM, streaming | SIMULADO |
| `/analytics` | `Analytics/AnalyticsPage` | KPIs e séries | `mockAnalytics` | Data warehouse / API | MOCKADO |
| `/audit` | `Audit/AuditPage` | Log de auditoria | `mockAuditLogs` | Audit API | MOCKADO |
| `/admin/users` | `Admin/AdminPage` | Usuários | `mockUsers` | Users API | MOCKADO |
| `/admin/roles` | `Admin/AdminPage` (tab) | Roles | — | RBAC API | AUSENTE |
| `/admin/settings` | `Admin/AdminPage` (tab) | Configurações | — | Config API | AUSENTE |
| `*` | `NotFound` | 404 | — | — | IMPLEMENTADO |

---

## 8. Mapeamento de Componentes

**Compartilhados (`src/components/shared/`):**
- `AppShell` — wrapper sidebar+topbar+main.
- `AppSidebar` — navegação principal, 8 itens, colapsável.
- `AppTopbar` — busca (visual), tenant chip ("Acme Corp" hardcoded), notificações (visual), avatar ("Maria Silva" hardcoded).
- `PageHeader`, `KpiCard`, `StatusBadge`, `EmptyState`.

**shadcn/ui (`src/components/ui/`):** ~45 componentes padrão.

**Componentes locais em páginas grandes:** `AssistantDetailPage` contém `PromptCompiledTab` interno (16 seções, exportação MD/TXT/JSON, modo Diff). `McpHubPage` contém diálogo de edição de 5 abas. RECOMENDADO extrair para arquivos próprios.

---

## 9. Rotas e Navegação

- Router único: `react-router-dom` v6 (`BrowserRouter` em `App.tsx`).
- Sem code-splitting (`React.lazy`) — IMPACTO em time-to-interactive na evolução.
- Sem `ProtectedRoute` / `RoleGuard`.
- Redirect `/ → /login` IMPLEMENTADO.
- Deep links suportados para `:id`.

---

## 10. Autenticação e Sessão

**Status: SIMULADO.**

- `LoginPage` renderiza formulário, mas não há provedor de auth, JWT, refresh, persistência ou bloqueio de rotas.
- Topbar exibe usuário fixo "Maria Silva" e tenant "Acme Corp" — HARDCODED.
- `useAuth` / `AuthContext` AUSENTE.
- Sem `localStorage`/`sessionStorage` para tokens.
- Não há logout funcional.

Classificação: **Mockada/Simulada**.

---

## 11. Perfis, Papéis e Permissões

- Tipo `User { role: string }` declarado em `types/index.ts`.
- Tela `/admin/roles` referenciada na sidebar/Admin tabs — sem implementação de gestão.
- Nenhuma checagem de permissão na UI.
- RBAC real é **AUSENTE**.
- RECOMENDADO: adotar tabela separada `user_roles` + função `has_role()` SECURITY DEFINER no backend (padrão Supabase) para evitar escalonamento de privilégios.

---

## 12. Entidades Estruturantes

Tipadas em `src/types/index.ts`:

`Assistant`, `AssistantVersion`, `AssistantFeedback`, `AssistantTestResult`, `AssistantWizardFormData`, `KnowledgeBase`, `KnowledgeDocument`, `McpServer`, `McpTool`, `McpResource`, `McpPrompt`, `McpBinding`, `ToolExecutionLog`, `Conversation`, `ConversationMessage`, `AuditLog`, `KpiData`, `User`, `AnalyticsData`.

Enums: `AssistantStatus`, `IngestionStatus`, `McpServerStatus`, `RiskLevel`, `FeedbackType`, `AuditEventType`, `DataClassification`, `RetentionPeriod`, `ConnectorType`.

Todos INFERIDOS a partir da interface; nenhum schema validado em backend.

---

## 13. Fluxos Funcionais Principais

1. **Login** → SIMULADO → redireciona para `/dashboard`.
2. **Criar assistente** (Wizard 12 etapas) → SIMULADO; ao concluir, nada é persistido.
3. **Editar assistente** → estado local; sem PATCH.
4. **Publicar assistente** (ação visual) → muda `status` em memória.
5. **Vincular base de conhecimento / MCP tool ao assistente** → SIMULADO via checkbox.
6. **Ingestão de documento em KB** → SIMULADO (status `pending → completed` sem pipeline).
7. **Cadastrar/editar servidor MCP** (5 abas) → SIMULADO; toggles de aprovação por tool em memória.
8. **Chat com assistente** → SIMULADO; mensagens vêm de mock; sem LLM.
9. **Visualização de analytics** → MOCKADO (Recharts).
10. **Consulta de auditoria** → MOCKADO.

---

## 14. Domínios e Entidades Funcionais

- **Studio (Assistentes):** ciclo de vida + versionamento + testes + feedback + prompt compilado.
- **Knowledge Hub:** bases, documentos, ingestão, classificação (`Público`/`Interno`/`Confidencial`/`Restrito`), retenção, conector.
- **MCP Hub:** servidores, tools, recursos, prompts, bindings, logs de execução, política de aprovação.
- **Chat Workspace:** conversas e mensagens (com `sources` e `toolsUsed`).
- **Analytics:** série temporal de conversations/cost/toolCalls/latency.
- **Auditoria:** eventos categorizados por `AuditEventType` e `RiskLevel`.
- **Admin:** usuários, roles, configurações.

---

## 15. Dados Mockados e Hardcoded

Localização principal: `src/data/mockData.ts` (174 LOC). Hardcoded adicional: topbar (`Acme Corp`, `Maria Silva`), defaults de wizard.

| Mock / Dado | Local | Entidade | Usado em | Vira seed? | Vira endpoint? | Prioridade |
|---|---|---|---|---|---|---|
| `mockAssistants` | mockData.ts | Assistant | Assistants, Detail, Chat, Dashboard | Sim | `GET /assistants` | Crítica MVP |
| `mockKnowledgeBases` | mockData.ts | KnowledgeBase | Knowledge | Sim | `GET /knowledge-bases` | Crítica MVP |
| `mockKnowledgeDocuments` | mockData.ts | KnowledgeDocument | KnowledgeDetail | Sim | `GET /knowledge-bases/:id/documents` | Crítica MVP |
| `mockMcpServers` | mockData.ts | McpServer | MCP | Sim | `GET /mcp/servers` | Importante v1 |
| `mockMcpTools` | mockData.ts | McpTool | MCP/Detail/Assistant | Sim | `GET /mcp/servers/:id/tools` | Importante v1 |
| `mockConversations` / `mockMessages` | mockData.ts | Conversation | Chat | Não | `GET /conversations`, runtime LLM | Crítica MVP |
| `mockAnalytics` | mockData.ts | AnalyticsData | Dashboard, Analytics | Não | `GET /analytics?range=` | Importante v1 |
| `mockAuditLogs` | mockData.ts | AuditLog | Audit | Não | `GET /audit-logs` | Importante v1 |
| `mockUsers` | mockData.ts | User | Admin | Sim | `GET /users` | Importante v1 |
| Usuário/tenant topbar | AppTopbar.tsx | User/Tenant | Layout | Não | sessão real | Crítica MVP |
| Defaults wizard | AssistantWizardPage | Assistant | Wizard | Não | configuração padrão server-side | Pode v2 |

---

## 16. Matriz Frontend → Backend/APIs/Banco

| Tela | Ação | Estado | Endpoint necessário (proposta) | Entidade | Tabela provável | Prioridade |
|---|---|---|---|---|---|---|
| Login | Submit | SIMULADO | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | Session | `users`, `sessions` | Crítica |
| Assistants | Listar/filtrar | MOCKADO | `GET /assistants` | Assistant | `assistants` | Crítica |
| Wizard | Criar | SIMULADO | `POST /assistants` | Assistant | `assistants`, `assistant_versions` | Crítica |
| Detail | Editar | SIMULADO | `PATCH /assistants/:id` | Assistant | `assistants` | Crítica |
| Detail | Publicar | SIMULADO | `POST /assistants/:id/publish` | AssistantVersion | `assistant_versions` | Crítica |
| Detail | Testar | SIMULADO | `POST /assistants/:id/test` | AssistantTestResult | `assistant_tests` | Importante |
| Detail | Feedback | MOCKADO | `POST /feedback` | AssistantFeedback | `assistant_feedback` | Importante |
| Knowledge | CRUD KB | MOCKADO | `GET/POST/PATCH/DELETE /knowledge-bases` | KnowledgeBase | `knowledge_bases` | Crítica |
| KnowledgeDetail | Upload doc | SIMULADO | `POST /knowledge-bases/:id/documents` (multipart) | KnowledgeDocument | `kb_documents`, `kb_chunks`, `kb_embeddings` | Crítica |
| KnowledgeDetail | Reprocessar | SIMULADO | `POST /knowledge-bases/:id/reindex` | — | jobs | Importante |
| MCP | CRUD server | MOCKADO | `GET/POST/PATCH/DELETE /mcp/servers` | McpServer | `mcp_servers` | Importante |
| MCP | Health check | SIMULADO | `POST /mcp/servers/:id/healthcheck` | — | jobs | Importante |
| MCP | Rotação credencial | SIMULADO | `POST /mcp/servers/:id/rotate` | — | `mcp_credentials` | Crítica (segurança) |
| MCP | Bindings | SIMULADO | `PUT /assistants/:id/mcp-bindings` | McpBinding | `mcp_bindings` | Importante |
| Chat | Enviar mensagem | SIMULADO | `POST /conversations/:id/messages` (SSE/streaming) | ConversationMessage | `conversations`, `messages` | Crítica |
| Analytics | Filtrar período | MOCKADO | `GET /analytics?from=&to=` | AnalyticsData | views agregadas | Importante |
| Audit | Buscar | MOCKADO | `GET /audit-logs` | AuditLog | `audit_logs` | Importante |
| Admin Users | Convidar | SIMULADO | `POST /users/invite` | User | `users`, `invitations` | Importante |
| Admin Roles | Atribuir | AUSENTE | `PUT /users/:id/roles` | UserRole | `user_roles` | Crítica (segurança) |

---

## 17. Serviços e Integrações

Nenhuma integração externa real está conectada. Tudo é mock.

### 17.1 Gatilhos para Integrações Externas e Webhooks
- Conectores de KB (`sharepoint`, `confluence`, `google_drive`, `s3`, `api`) — tipados, **não integrados**.
- E-mail (convite de usuário) — AUSENTE.
- Webhooks de eventos (assistant_published, tool_executed) — RECOMENDADO.
- SSO/OAuth corporativo — REQUER_DECISAO.

### 17.2 Gatilhos para Orquestração de IA
- LLM providers (OpenAI/Anthropic/Gemini/Azure/Bedrock) — AUSENTE; campo `model` no Assistant é string livre.
- Vector store (pgvector/Pinecone/Weaviate/Qdrant) — AUSENTE.
- Pipeline de embeddings — AUSENTE.
- Tool calling / MCP runtime real — AUSENTE.
- Guardrails (PII redaction, jailbreak detection) — AUSENTE.
- Evals / golden datasets — AUSENTE.
- Streaming (SSE/WebSocket) — AUSENTE.
- Cost tracking real — AUSENTE.

---

## 18. Contratos de API Esperados (PROPOSTA_FUTURA)

> Todos os endpoints abaixo são propostas, sujeitas a revisão de arquitetura. Padrão REST + JSON, versionamento `/api/v1`.

### Auth
- `POST /api/v1/auth/login` { email, password } → { user, accessToken, refreshToken } — PROPOSTA_FUTURA
- `POST /api/v1/auth/refresh` — PROPOSTA_FUTURA
- `POST /api/v1/auth/logout` — PROPOSTA_FUTURA
- `GET /api/v1/auth/me` — PROPOSTA_FUTURA

### Assistants
- `GET /api/v1/assistants?status=&area=&q=` — PROPOSTA_FUTURA
- `POST /api/v1/assistants` (payload = `AssistantWizardFormData`) — PROPOSTA_FUTURA
- `GET /api/v1/assistants/:id` — PROPOSTA_FUTURA
- `PATCH /api/v1/assistants/:id` — PROPOSTA_FUTURA
- `DELETE /api/v1/assistants/:id` — PROPOSTA_FUTURA
- `POST /api/v1/assistants/:id/publish` — PROPOSTA_FUTURA
- `POST /api/v1/assistants/:id/archive` — PROPOSTA_FUTURA
- `POST /api/v1/assistants/:id/duplicate` — PROPOSTA_FUTURA
- `GET /api/v1/assistants/:id/versions` — PROPOSTA_FUTURA
- `POST /api/v1/assistants/:id/test` — PROPOSTA_FUTURA
- `GET /api/v1/assistants/:id/prompt/compiled?format=md|json|txt` — PROPOSTA_FUTURA

### Knowledge
- `GET /api/v1/knowledge-bases` — PROPOSTA_FUTURA
- `POST /api/v1/knowledge-bases` — PROPOSTA_FUTURA
- `PATCH /api/v1/knowledge-bases/:id` — PROPOSTA_FUTURA
- `DELETE /api/v1/knowledge-bases/:id` — PROPOSTA_FUTURA
- `POST /api/v1/knowledge-bases/:id/documents` (multipart) — PROPOSTA_FUTURA
- `GET /api/v1/knowledge-bases/:id/documents` — PROPOSTA_FUTURA
- `DELETE /api/v1/knowledge-bases/:id/documents/:docId` — PROPOSTA_FUTURA
- `POST /api/v1/knowledge-bases/:id/reindex` — PROPOSTA_FUTURA

### MCP
- `GET /api/v1/mcp/servers` — PROPOSTA_FUTURA
- `POST /api/v1/mcp/servers` — PROPOSTA_FUTURA
- `PATCH /api/v1/mcp/servers/:id` — PROPOSTA_FUTURA
- `POST /api/v1/mcp/servers/:id/healthcheck` — PROPOSTA_FUTURA
- `POST /api/v1/mcp/servers/:id/rotate-credentials` — PROPOSTA_FUTURA
- `GET /api/v1/mcp/servers/:id/tools` — PROPOSTA_FUTURA
- `PATCH /api/v1/mcp/tools/:id` { requiresApproval } — PROPOSTA_FUTURA
- `GET /api/v1/mcp/servers/:id/logs` — PROPOSTA_FUTURA
- `PUT /api/v1/assistants/:id/mcp-bindings` — PROPOSTA_FUTURA

### Chat
- `GET /api/v1/conversations?assistantId=` — PROPOSTA_FUTURA
- `POST /api/v1/conversations` — PROPOSTA_FUTURA
- `GET /api/v1/conversations/:id/messages` — PROPOSTA_FUTURA
- `POST /api/v1/conversations/:id/messages` (SSE streaming) — PROPOSTA_FUTURA
- `POST /api/v1/messages/:id/feedback` — PROPOSTA_FUTURA
- `POST /api/v1/messages/:id/approve-tool` — PROPOSTA_FUTURA

### Analytics e Auditoria
- `GET /api/v1/analytics/overview?from=&to=` — PROPOSTA_FUTURA
- `GET /api/v1/analytics/assistants/:id` — PROPOSTA_FUTURA
- `GET /api/v1/audit-logs?event=&from=&to=&risk=` — PROPOSTA_FUTURA

### Admin
- `GET/POST /api/v1/users`, `PUT /api/v1/users/:id/roles`, `GET/POST /api/v1/roles` — PROPOSTA_FUTURA

Todos os endpoints assumem header `Authorization: Bearer <jwt>` e isolamento por `tenant_id` derivado do token.

---

## 19. Modelo de Dados Sugerido (INFERIDO)

> Schema **não final**. Derivado da interface; deve ser validado antes da migration inicial.

```text
tenants (id, name, plan, created_at)
users (id, tenant_id, name, email, password_hash, avatar_url, last_login, created_at)
user_roles (id, user_id, role enum('admin','editor','viewer','auditor'))  -- tabela separada
sessions (id, user_id, refresh_token_hash, expires_at)

assistants (id, tenant_id, name, description, area, owner_id, status,
            model, fallback_model, temperature, version, persona, tone, humor,
            objective, tasks, prohibited_tasks, formality, rules, restrictions,
            critical_instructions, response_format, positive_examples,
            negative_examples, limits, escalation_policy, environment,
            created_at, updated_at)
assistant_versions (id, assistant_id, version, changelog, author_id, status, prompt_snapshot, created_at)
assistant_tests (id, assistant_id, prompt, response, model, latency, tokens, sources jsonb, tools jsonb, passed, created_at)
assistant_feedback (id, assistant_id, conversation_id, type, comment, user_id, created_at)
assistant_knowledge (assistant_id, knowledge_base_id)
assistant_mcp_tools (assistant_id, mcp_tool_id, approval_required)

knowledge_bases (id, tenant_id, name, description, classification, connector_type,
                 embedding_model, chunk_size, chunk_overlap, retention, owner_id,
                 status, created_at)
kb_documents (id, knowledge_base_id, name, type, size, status, version, uploaded_by, uploaded_at, last_processed)
kb_chunks (id, document_id, ord, content, tokens)
kb_embeddings (chunk_id, vector vector(1536))     -- pgvector

mcp_servers (id, tenant_id, name, description, url, auth_type, status, risk_level,
             version, owner_id, last_sync, created_at)
mcp_credentials (id, server_id, secret_ref, rotated_at)   -- segredo em vault
mcp_tools (id, server_id, name, description, risk_level, requires_approval, input_schema jsonb)
mcp_resources (id, server_id, name, uri, description, mime_type)
mcp_prompts (id, server_id, name, description, arguments jsonb)
mcp_bindings (id, server_id, assistant_id, tools_enabled jsonb, resources_enabled jsonb, approval_policy, created_at)
tool_execution_logs (id, server_id, tool_id, assistant_id, user_id, status, duration_ms, input jsonb, output jsonb, created_at)

conversations (id, tenant_id, assistant_id, user_id, title, created_at, updated_at)
messages (id, conversation_id, role, content, model, sources jsonb, tools_used jsonb,
          tokens_in, tokens_out, latency_ms, feedback, created_at)

analytics_daily (tenant_id, date, conversations, cost_cents, tool_calls, avg_latency_ms)
audit_logs (id, tenant_id, event, description, user_id, resource, risk_level, payload jsonb, created_at)
```

Todas as tabelas devem ter `tenant_id` + RLS por tenant. Roles via `user_roles` + função `has_role()` SECURITY DEFINER.

---

## 20. Regras de Negócio Identificadas

| Regra | Estado | Onde aparece |
|---|---|---|
| Assistant tem ciclo `draft → published → archived` | Refletida no frontend | enum + badge |
| Wizard exige 12 etapas para criar assistant | Refletida no frontend | `AssistantWizardPage` |
| Tool pode exigir aprovação manual | Refletida no frontend | toggles em McpHubPage |
| Base de conhecimento tem classificação de dado e retenção | Refletida no frontend | tipos `DataClassification`, `RetentionPeriod` |
| Servidor MCP tem nível de risco e política de aprovação | Refletida no frontend | enum `RiskLevel`, política em bindings |
| Versionamento de assistente | Visual / PENDENTE backend | tab Versions |
| Custo por uso de assistente | Visual / PENDENTE | `costThisMonth` |
| Multi-tenant | INFERIDO | topbar com tenant fixo |
| Aprovação humana em tool calls de risco | PENDENTE | UI ainda não implementa o fluxo de aprovação no chat |
| Política de fallback de modelo | Refletida no frontend (campo) / PENDENTE runtime | `fallbackModel` |

---

## 21. Responsividade Real

- Cards e sidebar adaptam ao mobile (sidebar com toggle).
- Tabelas (Admin, Audit, Knowledge) não possuem overflow inteligente em telas estreitas.
- Wizard de 12 etapas pode ser difícil em mobile — RECOMENDADO drawer/stepper vertical.
- Chat ainda não testado em viewport mobile real.

---

## 22. Estados de Interface

| Estado | Cobertura |
|---|---|
| Loading | PARCIAL — quase ausente; recomendar skeletons globais |
| Empty | PARCIAL — `EmptyState` existe |
| Error | AUSENTE — sem ErrorBoundary nem mensagens padronizadas |
| Success | PARCIAL — via toasts |
| Forbidden / 403 | AUSENTE |
| Offline | AUSENTE |
| IA processando / streaming | AUSENTE |
| Buscando em RAG | AUSENTE |
| Executando tool | AUSENTE |
| Aguardando aprovação humana | AUSENTE |
| Erro de provider LLM | AUSENTE |

---

## 23. Inconsistências Técnicas Encontradas

1. Dois sistemas de toast coexistem (`sonner` + Radix Toast).
2. `TanStack Query`, `Axios`, `React Hook Form` e `Zod` instalados mas não utilizados.
3. Páginas com mais de 500 LOC concentram múltiplas responsabilidades — risco de manutenção.
4. Lógica de "estado de domínio" mora dentro das páginas (mutações em arrays locais).
5. Identidade do usuário e tenant hardcoded no `AppTopbar`.
6. Wizard sem validação central — usa `useState` puro.
7. Páginas de `/admin/roles` e `/admin/settings` reutilizam a mesma view de usuários (placeholder).
8. Falta de ErrorBoundary / fallback global.
9. Sem code-splitting por rota.
10. Mistura potencial de classes utilitárias de cor literal com tokens — auditar.

---

## 24. Segurança e Permissões

- Autenticação real: AUSENTE.
- Autorização (RBAC/ABAC): AUSENTE.
- Proteção de rotas: AUSENTE.
- Segredos/API keys de provedores: AUSENTE (precisa cofre — Vault/KMS).
- Credenciais MCP: hoje campos textuais — RISCO ALTO sem vault.
- LGPD: documentos podem conter PII; classificação existe na UI mas sem enforcement.
- XSS: chat renderizará Markdown gerado por IA — RECOMENDADO sanitização (`dompurify` ou renderer seguro).
- IDOR: ao introduzir backend, garantir RLS por `tenant_id` em todas as queries.
- CSRF: usar tokens em mutations não-GET caso a sessão use cookies.
- Rate limit: AUSENTE; necessário em LLM, RAG e MCP por custo.
- Auditoria real: AUSENTE (apenas visual).
- Conteúdo de prompts: pode conter dado sensível — política de retenção/redaction necessária.

### 24.1 Gatilhos para Distribuição, SEO e Aquisição
Produto interno B2B; SEO público não se aplica diretamente. Caso surja portal externo, planejar SSR/SSG dedicado.

### 24.2 Gatilhos para Motion e Microinterações
Cobertos em §6.1. Reforço: respeitar `prefers-reduced-motion`, evitar animações em listas extensas, animar mudanças de status crítico.

---

## 25. CI/CD e Deploy

| Item | Estado |
|---|---|
| Scripts `dev/build/lint/preview/test` | IMPLEMENTADO |
| Dockerfile | AUSENTE |
| docker-compose | AUSENTE |
| `.env.example` | AUSENTE |
| Healthcheck | AUSENTE |
| Pipeline CI | NAO_IDENTIFICADO |
| Estratégia de deploy | NAO_IDENTIFICADO (hoje preview Lovable) |
| Migrations/seeds | AUSENTE (sem DB) |
| Rollback | AUSENTE |

---

## 26. Testes Recomendados

- **Unitários:** componentes shared, helpers (`buildSections`, `estTokens` do Prompt Compilado), reducers do Wizard.
- **Integração:** fluxo do Wizard, vinculação KB/MCP, edição MCP server (5 abas).
- **E2E (Playwright):** login → criar assistant → publicar → conversar; CRUD KB com upload; CRUD MCP com rotação de credencial.
- **Acessibilidade:** axe-core em rotas-chave.
- **Contrato de API:** Pact/Zod schemas compartilhados (assim que API existir).
- **IA / Evals:** golden dataset por assistente, regressão de prompts, eval gates no CI.
- **Smoke MCP/Tool:** validar tools obrigatórias em healthcheck.
- **RAG quality:** recall@k, faithfulness.
- **Chat streaming:** simulação SSE com mock.
- **Segurança:** ZAP/Snyk, lint de secrets.

---

## 27. Critérios de Aceite (gerais para próxima fase)

- Toda página crítica consome serviço real com TanStack Query.
- Formulários sensíveis validados com Zod + RHF.
- Auth real com refresh e `ProtectedRoute`.
- RBAC enforced em frontend (gating de UI) e backend (RLS/policies).
- Mocks isolados em `src/mocks/` com toggle por env.
- Chat com streaming real e indicação de tool/approval.
- Audit log gravado em todas as ações sensíveis.

---

## 28. Pendências e Riscos

| Pendência / Risco | Tipo | Impacto | Prioridade | Ação Recomendada |
|---|---|---|---|---|
| Sem backend | Backend | Bloqueia produto real | Crítica | Provisionar backend gerenciado (Lovable Cloud) |
| Auth simulada | Segurança | Risco alto em produção | Crítica | Implementar auth + RBAC |
| Credenciais MCP sem cofre | Segurança | Vazamento de segredos | Crítica | Vault/KMS + rotação |
| `TanStack Query`/`Axios` não usados | Frontend | Inconsistência | Alta | Introduzir camada `services/` |
| Páginas >500 LOC | Manutenção | Bugs e onboarding lento | Alta | Quebrar em componentes |
| Sem ErrorBoundary | UX | Tela branca em runtime | Alta | Boundary global + por rota |
| Markdown do chat sem sanitização | Segurança | XSS via IA | Alta | DOMPurify / renderer seguro |
| Multi-tenant sem isolamento | Segurança | Vazamento entre tenants | Crítica | RLS por `tenant_id` |
| Sem rate limit em LLM | Custo | Custo descontrolado | Alta | Rate limit + quotas |
| Sem evals de IA | IA | Regressão silenciosa | Alta | Golden dataset por assistente |
| Sem CI/CD | DevOps | Deploy manual | Média | Pipeline + ambientes |
| Lovable artifacts residuais | DevOps | Acoplamento | Média | Remover na higienização |
| Dois sistemas de toast | UX | Inconsistência | Baixa | Padronizar |
| `next-themes` sem toggle | UX | Recurso latente | Baixa | Decidir suporte a dark mode |

---

## 29. Prontidão para Backend Real

**Classificação: Pronto com ajustes.**

Pontos fortes:
- Tipagem rica em `types/index.ts` que pode virar contrato.
- Estrutura modular por domínio.
- Stack de dados (TanStack Query/Axios/Zod) já instalada.

Bloqueios:
- Ausência de camada `services/`.
- Mocks consumidos diretamente nas páginas.
- Falta de auth/route guards.
- Falta de tratamento global de erros.

Plano mínimo antes do backend: criar `src/services/<dominio>.ts` envolvendo os mocks com a mesma assinatura final, migrar páginas para `useQuery`/`useMutation`, introduzir Zod schemas e `ProtectedRoute`.

---

## 30. Roadmap Sugerido

### Fase 1 — Organização e consolidação do frontend
- Higienização pós-Lovable (avaliar remoção de `lovable-tagger`).
- Padronizar lockfile e package manager.
- Refatorar páginas >500 LOC em componentes por aba/seção.
- Introduzir `src/services/`, `src/schemas/`, `src/lib/api.ts` (axios + interceptors).
- Migrar consumo de `mockData` para serviços que devolvem `Promise`.
- Adotar `TanStack Query` em todas as listas/detalhes.
- Migrar Wizard e edições para RHF + Zod.
- Adicionar `ErrorBoundary`, skeletons, toasts unificados.
- Implementar `ProtectedRoute` com mock de sessão.
- Auditoria de acessibilidade e responsividade.

### Fase 2 — Arquitetura, backend, APIs e banco
- Provisionar backend gerenciado (Lovable Cloud / Supabase).
- Modelar tabelas conforme §19 com RLS por `tenant_id`.
- Implementar `user_roles` + `has_role()` SECURITY DEFINER.
- Auth real (e-mail/senha, refresh, OAuth corporativo).
- CRUD de Assistants, KBs, MCP servers, conversations, audit logs.
- Storage para uploads de documentos.
- Seeds a partir dos mocks atuais.

### Fase 3 — Orquestração de IA
- Definir runtime (gateway próprio vs. provider direto).
- Integrar LLM providers (OpenAI/Anthropic/Gemini/Azure).
- Implementar pipeline de embeddings + pgvector.
- Implementar runtime MCP real + logs de execução.
- Guardrails (PII, jailbreak) e human-in-the-loop para tools de risco.
- Versionamento de prompts e snapshots.
- Evals e cost tracking por assistente.

### Fase 4 — Integração frontend + backend + IA
- Substituir todos os mocks por APIs reais.
- Chat com SSE/streaming, citações, exibição de tool calls e estados de aprovação.
- Analytics consumindo dados reais agregados.
- Auditoria gravada em todas as ações sensíveis.

### Fase 5 — Segurança, QA, CI/CD e deploy
- Cofre de segredos (Vault/KMS) para credenciais MCP/LLM.
- Rate limiting e quotas.
- Suíte de testes (unit/integration/e2e/eval).
- Pipeline CI/CD (lint, test, eval gates, build, deploy).
- Observabilidade (logs estruturados, métricas, tracing).

### Fase 6 — Evoluções futuras
- Motion avançado e dark mode.
- Multi-agent / orquestração entre assistentes.
- Marketplace interno de tools/MCP.
- Integrações corporativas (SSO, SCIM, CRM, n8n, WhatsApp).
- Analytics avançado (cohort, funil, atribuição de custo).

---

## 30.1 Matriz Achado → Evidência → Impacto → Camada Técnica Futura

| Achado | Evidência | Impacto | Camada Futura |
|---|---|---|---|
| Auth simulada | `pages/Auth/LoginPage.tsx` sem chamada | Bloqueia produção | Backend + Segurança |
| Dados em memória | `src/data/mockData.ts` | Sem persistência | Banco + APIs |
| Sem services | Páginas importam mocks diretamente | Acoplamento | Frontend / Arquitetura |
| Chat sem LLM | `pages/Chat/ChatPage.tsx` | Funcionalidade central ausente | Orquestração de IA |
| RAG ausente | KBs sem ingestão real | Sem busca semântica | Orquestração de IA |
| MCP sem runtime | `McpDetailPage` sem execução real | Tools não funcionais | Orquestração de IA + Integrações |
| Audit visual | `mockAuditLogs` | Sem rastreabilidade real | Backend + Governança |
| Topbar hardcoded | `AppTopbar.tsx` | Sem identidade real | Backend + Segurança |
| Sem ProtectedRoute | `App.tsx` | Tudo público | Segurança |
| Páginas gigantes | `AssistantDetailPage.tsx` 863 LOC | Manutenção | Frontend |

---

## 31. Handoff Técnico para Próximas Etapas

Para o próximo time/etapa, o material consolidado é:

1. **Tipos como contrato inicial:** `src/types/index.ts` deve ser tratado como rascunho do schema OpenAPI/Zod.
2. **Mocks como seed:** `src/data/mockData.ts` pode ser exportado como JSON de seed para o banco.
3. **Wizard como spec do POST assistant:** `AssistantWizardFormData` é o payload candidato para `POST /assistants`.
4. **Prompt Compilado:** lógica de `buildSections` dentro de `AssistantDetailPage` precisa migrar para o backend (idealmente endpoint `GET /assistants/:id/prompt/compiled`).
5. **Design system estável:** tokens em `src/index.css` / `tailwind.config.ts` devem ser preservados; novos componentes seguem shadcn.
6. **Roadmap:** seguir a sequência das fases 1→6.

Riscos a comunicar a stakeholders antes da Fase 2:
- Custo recorrente de LLM/embeddings.
- Necessidade de cofre de segredos.
- Multi-tenant exige RLS e revisão de queries.
- LGPD em documentos e prompts.

---

## 32. Resumo Executivo Final

**Orquestra** é hoje um **protótipo de frontend de alta fidelidade (Maturidade Nível 2)** que cobre, em interface, todo o ciclo de vida de assistentes de IA corporativos — criação, configuração detalhada, vinculação a bases RAG, integração a servidores MCP, conversação, analytics e auditoria. A base técnica (React 18 + Vite + Tailwind + shadcn/ui + tipagem rica por domínio) está sólida e preparada para receber a próxima camada.

Nada hoje é persistido, autenticado, executado por um LLM real ou auditado de fato — todo o comportamento "ativo" é simulado por mocks e estado local. Para evoluir de protótipo para sistema:

**Próximo passo recomendado:** executar a **Fase 1 (consolidação de frontend)** — introduzir camada `services/`, TanStack Query, RHF+Zod, ProtectedRoute, ErrorBoundary e quebra de páginas grandes — em paralelo à **Fase 2 (provisionamento de backend gerenciado, banco com RLS por tenant, auth real e RBAC via `user_roles`)**. Sem essas duas fases concluídas, nenhum recurso de IA real deve ser conectado, sob risco de custo descontrolado e exposição de credenciais.
