# Orquestra — Frontend

> Documento corporativo de arquitetura, organização e evolução do frontend do projeto Orquestra.  
> Preparado para uso interno na MCM.

---

## 1. Objetivo

Definir como o frontend do Orquestra deve ser organizado, evoluído, higienizado, integrado e preparado para sair de um protótipo visual no Lovable para uma aplicação React/Vite/TypeScript sustentável, modular, responsiva, acessível, testável e pronta para integração futura com backend, APIs, banco de dados e runtime de IA.

Este documento também serve como handoff operacional para ajustes no Lovable, futura exportação, refatoração pós-exportação e preparação do frontend para integração real.

---

## 2. Sumário executivo

O Orquestra está atualmente em fase de protótipo visual no Lovable, ainda não exportado para o ambiente local/Docker/WSL. O frontend demonstra a visão do produto, mas não deve ser tratado como arquitetura final, nem como sistema pronto para produção.

A etapa correta agora é consolidar o frontend como blueprint técnico e funcional, definindo telas, rotas, módulos, componentes, hooks, services, mocks, permissões, estados de IA, responsividade e handoffs para backend, APIs e banco.

Antes de implementar backend real, o frontend precisa estar minimamente organizado para:

- separar mocks de UI;
- mapear entidades e fluxos;
- definir rotas e permissões;
- preparar API client;
- definir services por domínio;
- prever hooks com TanStack Query;
- padronizar formulários;
- tratar estados de IA, RAG e MCP;
- garantir responsividade real;
- suportar futura higienização pós-Lovable;
- gerar um roteiro seguro de ajuste no Lovable.

---

## 3. Frontend Blueprint

```yaml
frontend_blueprint:
  app:
    name: "Orquestra"
    type: "Plataforma corporativa de assistentes de IA"
    organization: "MCM"
    execution_mode: "Projeto existente no Lovable, ainda não exportado"
    frontend_source: "Lovable"
    repository_target:
      root: "orquestra/"
      frontend_dir: "frontend/"
      backend_dir: "backend/"
      docs_dir: "docs/"

  maturity_level:
    current: "level_1_prototype_visual_com_mocks"
    target_before_backend: "level_2_mock_organizado_pronto_para_derivar_apis_banco"
    target_after_backend: "level_3_integrado_com_api"
    production_target: "level_5_pronto_para_producao"

  stack:
    framework: "React"
    build_tool: "Vite"
    language: "TypeScript"
    package_manager: "npm"
    styling: "Tailwind CSS"
    ui_library: "shadcn/ui"
    state_server: "TanStack Query"
    forms: "React Hook Form + Zod"
    toast: "Sonner"
    charts: "Recharts quando aplicável"
    pwa: "Não obrigatório no MVP"
    router:
      preferred: "React Router DOM"
      exception_allowed: "TanStack Router se o projeto exportado já vier funcional e a migração gerar retrabalho desnecessário"

  ai_experience:
    required: true
    areas:
      - "Chat com assistentes"
      - "Streaming de respostas"
      - "Fontes RAG"
      - "Tool calls MCP"
      - "Feedback de resposta"
      - "Fallback de modelo"
      - "Estados de runtime"
      - "Erros de provider"

  post_lovable_normalization:
    required_after_export: true
    move_to_frontend_dir: true
    package_manager: "npm"
    lockfile: "package-lock.json"
    vite_port: 5173
    vite_host: "0.0.0.0"
    vite_strict_port: true
    remove_lovable_specific_dependencies_when_unused: true
```

---

## 4. Diagnóstico frontend

### 4.1 Situação atual

```txt
Projeto ainda no Lovable.
Projeto ainda não exportado.
Projeto ainda não está no WSL/Docker.
Frontend é protótipo visual.
Dados reais ainda não existem.
Backend ainda não existe.
APIs reais ainda não existem.
Banco de dados ainda não existe.
Runtime de IA ainda não existe.
RAG e MCP reais ainda não existem.
```

### 4.2 Interpretação

O frontend atual deve ser tratado como fonte de descoberta, validação visual e mapeamento de produto, não como base produtiva.

A próxima intervenção no Lovable deve preparar o frontend para ser exportável e integrável, sem tentar criar backend real dentro do Lovable.

### 4.3 Nível de maturidade

| Aspecto | Classificação |
|---|---|
| Visual | Alto, por ser protótipo de alta fidelidade |
| Arquitetura frontend | Pendente de revisão pós-exportação |
| Mocks | Devem ser isolados por módulo |
| API client | Deve ser preparado |
| Services | Devem ser previstos |
| Hooks | Devem ser previstos |
| Permissões | Devem ser estruturadas visualmente |
| Produção | Não aplicável ainda |

---

## 5. Decisões frontend registráveis

| ID | Tema | Decisão | Impacto |
|---|---|---|---|
| DEC-FRONT-001 | Origem do frontend | Projeto existente no Lovable, ainda não exportado. | Tratar como protótipo visual/mockado até exportação e validação. |
| DEC-FRONT-002 | Nível atual | Nível 1/2 — protótipo visual com mocks e algumas bases de organização. | Não considerar pronto para produção. |
| DEC-FRONT-003 | Nível alvo antes do backend | Nível 2 — mock organizado e pronto para derivar APIs/banco. | Ajuste Lovable deve focar organização visual/técnica, não backend real. |
| DEC-FRONT-004 | Roteamento | Preferência por React Router DOM; TanStack Router pode ser mantido se o export vier funcional e migração gerar retrabalho. | Registrar decisão após exportação. |
| DEC-FRONT-005 | Mocks | Mocks devem ficar isolados por módulo e acionáveis por variável. | Pages/components não devem importar mocks diretamente. |
| DEC-FRONT-006 | IA no frontend | Chat, fontes RAG, tool calls, streaming e feedback são parte central. | Manter componentes e estados explícitos de IA. |
| DEC-FRONT-007 | Prompt Lovable | Gerar prompt de ajuste antes da arquitetura completa. | Usar guardrails arquiteturais mínimos sem criar backend real. |

---

## 6. Estrutura alvo de repositório

Quando o projeto for exportado do Lovable e organizado localmente, a estrutura alvo deverá ser:

```txt
orquestra/
├── frontend/
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   ├── .dockerignore
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts
│   ├── public/
│   │   └── health.html
│   └── src/
├── backend/
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   ├── .dockerignore
│   └── .env.example
├── docs/
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── .gitignore
└── README.md
```

### 6.1 Regras

- O Git deve versionar a raiz do projeto.
- O frontend deve viver em `/frontend`.
- O backend futuro deve viver em `/backend`.
- Compose deve ficar na raiz.
- `.env` real nunca deve ser versionado.
- O frontend deve ter `.env.example` próprio.
- O backend deve ter `.env.example` próprio.

---

## 7. Estrutura alvo do frontend

```txt
frontend/src/
├── app/
│   ├── App.tsx
│   ├── main.tsx
│   ├── providers/
│   ├── routes/
│   └── config/
├── components/
│   ├── ui/
│   ├── shared/
│   ├── feedback/
│   ├── layout/
│   ├── forms/
│   ├── data-display/
│   ├── ai/
│   ├── integrations/
│   └── motion/
├── layouts/
├── modules/
│   ├── auth/
│   ├── dashboard/
│   ├── assistants/
│   ├── chat/
│   ├── knowledge/
│   ├── mcp/
│   ├── analytics/
│   ├── audit/
│   ├── admin/
│   ├── settings/
│   └── profile/
├── services/
│   ├── api/
│   ├── errors/
│   ├── ai/
│   ├── mocks/
│   └── runtime/
├── hooks/
├── lib/
├── types/
├── utils/
└── styles/
```

---

## 8. Mapa de rotas

| Tela | Rota | Tipo | Layout | Permissão | Objetivo |
|---|---|---|---|---|---|
| Login | /login | public | AuthLayout | Nenhuma | Autenticação corporativa |
| Dashboard | /app | authenticated | DashboardLayout | dashboard.view | Resumo executivo e operacional |
| Assistentes | /app/assistants | protected | AppLayout | assistant.view | Catálogo/listagem de assistentes |
| Novo assistente | /app/assistants/new | protected | AppLayout | assistant.create | Wizard de criação |
| Detalhe do assistente | /app/assistants/:id | protected | AppLayout | assistant.view | Detalhes, versões, publicação, bases e tools |
| Chat | /app/chat | protected | ChatLayout | assistant.use | Conversas com assistentes publicados |
| Knowledge Hub | /app/knowledge | protected | AppLayout | knowledge_base.view | Bases, documentos e indexação |
| MCP Hub | /app/mcp | protected | AppLayout | mcp.view | Servidores, tools, risco e aprovação |
| Analytics | /app/analytics | protected | DashboardLayout | analytics.view | Uso, custos, feedbacks e qualidade |
| Audit Logs | /app/audit | protected | AppLayout | audit.read | Eventos críticos auditáveis |
| Admin | /app/admin | protected | SettingsLayout | admin.access | Usuários, perfis, workspaces e configs |
| Perfil | /app/profile | authenticated | AppLayout | profile.view | Perfil do usuário |
| Configurações | /app/settings | protected | SettingsLayout | settings.view | Configurações gerais |
| Sem permissão | /403 | error | EmptyLayout | Nenhuma | Acesso negado |
| Não encontrado | /404 | error | EmptyLayout | Nenhuma | Página/recurso não encontrado |
| Erro geral | /500 | error | EmptyLayout | Nenhuma | Falha inesperada |

---

## 9. Mapa de módulos

| Módulo | Responsabilidade | Pages | Componentes | Hooks | Service |
|---|---|---|---|---|---|
| auth | Login, sessão, logout, usuário atual e guards | LoginPage | AuthProvider, ProtectedRoute | useAuth, useMe | auth.service.ts |
| dashboard | Painel inicial e indicadores | DashboardPage | MetricCard, ActivityList | useDashboard | dashboard.service.ts |
| assistants | Assistentes, wizard, versões, publicação e compartilhamento | AssistantsPage, AssistantDetailsPage, AssistantWizardPage | AssistantCard, AssistantStepper, ShareDialog | useAssistants, useAssistant, usePublishAssistant | assistants.service.ts |
| chat | Chat, streaming, mensagens, fontes e feedback | ChatPage | ChatWindow, MessageBubble, SourceList, ToolCallCard | useConversation, useChatStream, useFeedback | chat.service.ts |
| knowledge | Bases, documentos, upload e indexação | KnowledgePage | KnowledgeBaseCard, DocumentTable, FileUpload | useKnowledgeBases, useUploadDocument | knowledge.service.ts |
| mcp | MCP servers, tools, risco e status | McpHubPage | McpServerCard, ToolCard, ToolRiskBadge | useMcpServers, useMcpTools | mcp.service.ts |
| analytics | Uso, custos, feedbacks, evals e métricas | AnalyticsPage | MetricCard, ChartCard, CostTable | useAnalytics, useCosts | analytics.service.ts |
| audit | Logs de auditoria | AuditLogsPage | AuditTable, AuditDetailsDrawer | useAuditLogs | audit.service.ts |
| admin | Usuários, perfis, permissões e workspaces | AdminPage, UsersPage, WorkspacesPage | UserTable, RoleBadge, WorkspaceForm | useUsers, useRoles, useWorkspaces | admin.service.ts |
| settings | Configurações globais e preferências | SettingsPage | SettingsSection, ProviderConfigCard | useSettings | settings.service.ts |

---

## 10. Mapa tela por tela

| Tela | Rota | Layout | Acesso | Módulo | Componentes | Estados | API candidata | Entidades |
|---|---|---|---|---|---|---|---|---|
| Login | /login | AuthLayout | public | auth | Button, Alert, LoadingState | loading, error, success | auth/session | users/session |
| Dashboard | /app | DashboardLayout | authenticated | dashboard | MetricCards, charts, activity | loading, empty, error, success | dashboard summary | conversations, costs, feedbacks |
| Assistentes | /app/assistants | AppLayout | protected | assistants | DataTable/CardList, filters, actions | loading, empty, error, forbidden | assistants list | assistants, shares |
| Wizard | /app/assistants/new | AppLayout | protected | assistants | Stepper, forms, review, test | draft, saving, validation_error, success | assistants create | assistants, versions |
| Detalhe | /app/assistants/:id | AppLayout | protected | assistants | Tabs, badges, cards, version list | loading, not_found, forbidden, success | assistant detail | assistants, versions, shares |
| Chat | /app/chat | ChatLayout | protected | chat | ChatWindow, Composer, Sources, ToolCalls | thinking, streaming, tool_call, fallback, error | chat stream | conversations, messages, feedbacks |
| Knowledge Hub | /app/knowledge | AppLayout | protected | knowledge | DataTable, upload, status badges | uploading, indexing, indexed, failed | knowledge bases | knowledge_bases, documents, chunks |
| MCP Hub | /app/mcp | AppLayout | protected | mcp | ServerCards, ToolCards, risk badges | connected, pending, approved, error | mcp registry | mcp_servers, mcp_tools |
| Analytics | /app/analytics | DashboardLayout | protected | analytics | MetricCards, ChartCards, tables | loading, empty, error, success | analytics summary | usage, costs, evals |
| Audit Logs | /app/audit | AppLayout | protected | audit | AuditTable, filters, drawer | loading, empty, filtered, error | audit logs | audit_logs |
| Admin | /app/admin | SettingsLayout | protected | admin | Tabs, DataTables, forms | loading, empty, forbidden, success | admin resources | users, roles, workspaces |

---

## 11. Componentes globais esperados

### 11.1 Componentes de layout

```txt
AppShell
Sidebar
Topbar
PageHeader
ContentContainer
Breadcrumbs
WorkspaceSelector
UserMenu
```

### 11.2 Componentes de feedback

```txt
ErrorState
EmptyState
LoadingState
ForbiddenState
NotFoundState
ConfirmDialog
ToastProvider
```

### 11.3 Componentes de dados

```txt
DataTable
MobileCardList
MetricCard
ChartCard
StatusBadge
VersionBadge
RiskBadge
```

### 11.4 Componentes de formulário

```txt
FormInput
FormTextarea
FormSelect
FormCombobox
FormMultiCombobox
FormSwitch
FormCheckbox
FormActions
FormFieldError
```

### 11.5 Componentes de IA

```txt
AIChatWindow
AIMessageBubble
AIStreamingMessage
AIThinkingState
AIToolCallCard
RAGSourcesList
AIResponseFeedback
AIErrorState
ModelFallbackNotice
```

### 11.6 Componentes de integração

```txt
ProviderCard
IntegrationStatusBadge
McpServerCard
ToolCard
ToolRiskBadge
ConnectionStatusAlert
```

---

## 12. Estratégia de mocks

### 12.1 Regra principal

O fluxo de dados deve ser:

```txt
Page → Hook → Service → API real ou Mock
```

Nunca:

```txt
Page → Mock
Component → Mock
```

### 12.2 Variáveis

| Variável | Finalidade | Valor inicial sugerido |
|---|---|---|
| VITE_API_BASE_URL | URL base da API futura | http://localhost:3000/api/v1 |
| VITE_APP_NAME | Nome do app | Orquestra |
| VITE_APP_ENV | Ambiente atual | local |
| VITE_USE_MOCKS | Liga/desliga mocks | true |
| VITE_MOCK_DELAY_MS | Latência simulada dos mocks | 500 |
| VITE_MOCK_SCENARIO | Cenário mockado | success |
| VITE_ENABLE_DEMO_MODE | Modo demonstração | true |
| VITE_ENABLE_PWA | PWA | false |
| VITE_DEFAULT_LOCALE | Locale | pt-BR |
| VITE_DEFAULT_TIMEZONE | Timezone | America/Recife |
| VITE_ENABLE_FRONTEND_HEALTHCHECK | Healthcheck estático | true |

### 12.3 Cenários de mock

Mocks devem suportar:

- success;
- empty;
- error;
- forbidden;
- loading delay;
- tenant/workspace;
- assistente privado;
- assistente publicado;
- assistente arquivado;
- RAG com fonte;
- RAG sem fonte;
- tool call em execução;
- provider error;
- runtime error;
- fallback model.

---

## 13. API client e services

### 13.1 API client centralizado

O frontend deve possuir:

```txt
services/api/api-client.ts
services/api/api-error.ts
services/api/api-response.ts
services/api/endpoints.ts
services/api/http-status.ts
```

Responsabilidades:

- usar `VITE_API_BASE_URL`;
- normalizar respostas;
- normalizar erros;
- tratar `401`;
- tratar `403`;
- tratar `422`;
- tratar `500`;
- usar `credentials: "include"` quando o backend usar cookie HttpOnly;
- impedir `fetch` direto em pages/components.

### 13.2 Services por domínio

Cada módulo deve ter service próprio:

```txt
modules/assistants/services/assistants.service.ts
modules/chat/services/chat.service.ts
modules/knowledge/services/knowledge.service.ts
modules/mcp/services/mcp.service.ts
modules/analytics/services/analytics.service.ts
modules/audit/services/audit.service.ts
modules/admin/services/admin.service.ts
```

---

## 14. Estado remoto com TanStack Query

Hooks esperados:

```txt
useAssistants
useAssistant
useCreateAssistant
useUpdateAssistant
usePublishAssistant
useShareAssistant
useConversations
useChatStream
useKnowledgeBases
useDocuments
useUploadDocument
useMcpServers
useMcpTools
useAnalytics
useAuditLogs
useUsers
useRoles
useWorkspaces
```

Query keys sugeridas:

```txt
["assistants", "list", filters]
["assistants", "detail", assistantId]
["assistants", "versions", assistantId]
["chat", "conversations", filters]
["knowledge", "bases", filters]
["mcp", "tools", filters]
["analytics", "summary", filters]
["audit", "logs", filters]
```

---

## 15. Formulários e schemas

Formulários relevantes:

```txt
AssistantIdentityForm
AssistantPersonaForm
AssistantRulesForm
AssistantModelForm
AssistantKnowledgeForm
AssistantToolsForm
AssistantSharingForm
AssistantReviewForm
KnowledgeBaseForm
DocumentUploadForm
McpServerForm
ToolApprovalForm
UserForm
WorkspaceForm
ProviderConfigForm
```

Schemas esperados:

```txt
assistant.schema.ts
knowledge.schema.ts
mcp.schema.ts
admin.schema.ts
settings.schema.ts
feedback.schema.ts
```

Regras:

- usar React Hook Form + Zod;
- erro de campo inline;
- erro geral no topo;
- bloquear submit duplicado;
- validar recursos não autorizados;
- campos bloqueados devem explicar motivo.

---

## 16. Permissões visuais

| Permissão | Descrição | Quem pode | Condição |
|---|---|---|---|
| assistant.view | Ver assistentes autorizados | Admin, Owner, Editor, Consumer | Filtrar por tenant/share/status |
| assistant.create | Criar assistentes | Admin, Owner | Criar como rascunho |
| assistant.edit | Editar assistente | Admin, Owner, Editor | Editor não amplia permissões indevidas |
| assistant.publish | Publicar assistente | Admin, Owner | Publicação ampla exige admin |
| assistant.share | Compartilhar assistente | Admin, Owner | Uso e edição separados |
| assistant.use | Usar assistente no chat | Usuários autorizados | Apenas published e compartilhado |
| knowledge_base.view | Ver bases autorizadas | Admin, Owner, Editor | Respeitar restrição |
| knowledge_base.upload | Enviar documentos | Admin, Owner autorizado | Validar base e classificação |
| mcp.view | Ver MCP/tools | Admin, Owner, Editor autorizado | Exibir apenas tools permitidas |
| mcp.manage | Gerenciar MCP/tools | Admin | Credenciais protegidas |
| audit.read | Ler auditoria | Admin | Owner pode ler escopo próprio quando definido |
| analytics.view | Ver métricas | Admin, Owner | Escopo global ou próprio |
| admin.access | Acessar administração | Admin | Bloqueio 403 |

### 16.1 Componentes de permissão

```txt
ProtectedRoute
PermissionGate
Can
ProtectedAction
RoleBadge
ForbiddenPage
```

### 16.2 Regras

- Menu sem acesso deve ser ocultado.
- Ação visível, mas bloqueada por estado, deve aparecer desabilitada com explicação.
- Rota sem permissão deve exibir 403.
- Frontend não substitui autorização backend.

---

## 17. Padrões para IA no frontend

### 17.1 Estados obrigatórios

```yaml
ai_frontend_states:
  idle: "Aguardando interação"
  composing: "Usuário digitando"
  sending: "Mensagem sendo enviada"
  thinking: "IA processando"
  streaming: "Resposta parcial sendo recebida"
  retrieving_sources: "Buscando fontes"
  tool_calling: "Tool sendo executada"
  completed: "Resposta concluída"
  failed: "Falha controlada"
  fallback: "Modelo alternativo usado"
```

### 17.2 Componentes

- `AIChatWindow`;
- `AIStreamingMessage`;
- `AIToolCallCard`;
- `RAGSourcesList`;
- `AIResponseFeedback`;
- `AIErrorState`.

### 17.3 Regras

- Frontend não expõe chaves de providers, MCP ou tools.
- Tool call deve mostrar status seguro e resumido.
- Fontes RAG devem ser claras.
- Feedback deve ser estruturado.
- Erros de IA devem ser amigáveis.
- Streaming deve ter fallback visual.

---

## 18. DataTable responsiva

### 18.1 Desktop

Usar DataTable com:

- busca;
- filtros;
- ordenação;
- paginação;
- ações por linha;
- bulk actions quando aplicável.

### 18.2 Mobile

Usar CardList com:

- título;
- status;
- metadados principais;
- ação principal;
- menu de ações;
- filtros em drawer;
- ordenação por select.

### 18.3 Telas que exigem padrão responsivo

- Assistentes;
- Knowledge Hub;
- MCP Hub;
- Audit Logs;
- Admin/Usuários;
- Analytics detalhado;
- Histórico de conversas.

---

## 19. Tratamento global de erros

| Status | Tratamento |
|---|---|
| 400 | Requisição inválida |
| 401 | Sessão expirada, redirecionar para login |
| 403 | Sem permissão |
| 404 | Recurso não encontrado |
| 409 | Conflito de estado |
| 422 | Erros por campo |
| 429 | Muitas requisições |
| 500 | Erro interno amigável |
| 503 | Serviço indisponível |

Componentes:

```txt
ErrorBoundary
ErrorState
ForbiddenPage
NotFoundPage
UnexpectedErrorPage
```

---

## 20. Motion e microinterações

Motion será funcional, discreta e acessível.

Aplicar em:

- streaming de resposta;
- skeletons;
- upload/indexação;
- mudança de etapa do wizard;
- tool call;
- abertura de dialogs/drawers;
- feedbacks de sucesso/erro.

Regras:

- respeitar `prefers-reduced-motion`;
- não causar layout shift;
- não esconder erro ou permissão;
- não depender de animação para comunicar estado.

---

## 21. Healthcheck frontend

Quando o frontend for para Docker/homologação/produção, prever:

```txt
frontend/public/health.html
```

Regras:

- não depende de login;
- não expõe dados sensíveis;
- valida apenas disponibilidade do frontend;
- saúde de API, banco e runtime pertence ao backend/infraestrutura.

---

## 22. Higienização pós-Lovable

Após exportação do Lovable, aplicar checklist:

```txt
[ ] Garantir frontend em /frontend
[ ] Remover bun.lock
[ ] Remover bun.lockb
[ ] Remover yarn.lock, se existir
[ ] Remover pnpm-lock.yaml, se existir
[ ] Garantir npm e package-lock.json
[ ] Remover dependências específicas do Lovable quando não aplicáveis
[ ] Normalizar vite.config.ts
[ ] Definir host 0.0.0.0
[ ] Definir porta 5173
[ ] Definir strictPort true
[ ] Garantir alias @ para ./src
[ ] Revisar package.json
[ ] Criar frontend/.env.example
[ ] Criar frontend/.dockerignore
[ ] Criar Dockerfile.dev se o projeto usar Docker
[ ] Criar Dockerfile.prod se o projeto usar Docker
[ ] Isolar mocks por módulo
[ ] Criar API client
[ ] Criar services por domínio
[ ] Criar hooks com TanStack Query
[ ] Revisar forms e schemas
[ ] Revisar rotas e permissions
[ ] Validar npm run build
```

---

## 23. Handoff para backend

| Módulo | Necessidade backend | Entidades | Permissões | Observações |
|---|---|---|---|---|
| auth | Microsoft SSO, sessão, logout, usuário atual | users, sessions, roles, permissions | auth.login, auth.logout, auth.me | SSO, 401, 403 |
| assistants | CRUD, wizard, versions, shares, publication | assistants, assistant_versions, assistant_shares | assistant.* | Versionamento, publicação, owner |
| chat | Conversas, mensagens, streaming, feedback | conversations, messages, feedbacks | assistant.use, chat.feedback | SSE, RAG, tools, custos |
| knowledge | Bases, documentos, upload, ingestão | knowledge_bases, documents, chunks, embeddings | knowledge_base.* | Upload, jobs, restrição |
| mcp | Servers, tools, risco, aprovação | mcp_servers, mcp_tools, assistant_tools | mcp.* | Secrets e tool risk |
| analytics | Uso, custos, feedback, evals | provider_usage_costs, eval_runs | analytics.view | Agregações |
| audit | Eventos críticos | audit_logs | audit.read | Não logar secrets |
| admin | Usuários, perfis, workspaces | users, roles, permissions, workspaces | admin.* | RBAC/ABAC |

---

## 24. Handoff para APIs e contratos

Endpoints candidatos:

```txt
GET    /auth/me
POST   /auth/logout

GET    /users
GET    /roles
GET    /permissions
GET    /workspaces

GET    /assistants
POST   /assistants
GET    /assistants/:id
PATCH  /assistants/:id
POST   /assistants/:id/test
POST   /assistants/:id/publish
POST   /assistants/:id/archive
GET    /assistants/:id/versions
POST   /assistants/:id/versions/:versionId/restore
GET    /assistants/:id/shares
POST   /assistants/:id/shares

GET    /chat/conversations
POST   /chat/conversations
GET    /chat/conversations/:id/messages
POST   /chat/messages
GET    /chat/messages/stream
POST   /chat/messages/:id/feedback

GET    /knowledge-bases
POST   /knowledge-bases
GET    /knowledge-bases/:id/documents
POST   /knowledge-bases/:id/documents
POST   /knowledge-bases/:id/reindex

GET    /mcp/servers
POST   /mcp/servers
GET    /mcp/tools
POST   /mcp/tools/:id/approve
POST   /assistants/:id/tools

GET    /analytics/summary
GET    /analytics/costs
GET    /audit-logs
```

---

## 25. Handoff para banco de dados

Entidades derivadas do frontend:

```txt
tenants
users
roles
permissions
workspaces
workspace_members
assistants
assistant_versions
assistant_shares
assistant_publication_requests
knowledge_bases
knowledge_base_documents
document_chunks
embeddings
mcp_servers
mcp_tools
assistant_tools
conversations
messages
feedbacks
audit_logs
provider_usage_costs
eval_datasets
eval_runs
runtime_deployments
```

---

## 26. Checklist de aceite frontend

| ID | Critério |
|---|---|
| CA-FRONT-001 | O frontend possui mapa de rotas definido. |
| CA-FRONT-002 | Telas críticas possuem estados de loading, empty, error e forbidden. |
| CA-FRONT-003 | Mocks estão previstos por módulo. |
| CA-FRONT-004 | Pages/components não devem importar mocks diretamente. |
| CA-FRONT-005 | API client centralizado foi previsto. |
| CA-FRONT-006 | Services por domínio foram previstos. |
| CA-FRONT-007 | Hooks com TanStack Query foram previstos. |
| CA-FRONT-008 | Forms com React Hook Form + Zod foram previstos. |
| CA-FRONT-009 | Permissões visuais foram mapeadas. |
| CA-FRONT-010 | Chat possui estados de IA definidos. |
| CA-FRONT-011 | RAG sources possuem representação visual. |
| CA-FRONT-012 | Tool calls possuem representação visual. |
| CA-FRONT-013 | DataTables possuem comportamento mobile. |
| CA-FRONT-014 | Acessibilidade mínima foi prevista. |
| CA-FRONT-015 | Motion é funcional e respeita redução de movimento. |
| CA-FRONT-016 | Higienização pós-Lovable foi definida. |
| CA-FRONT-017 | Handoff para backend foi gerado. |
| CA-FRONT-018 | Handoff para APIs foi gerado. |
| CA-FRONT-019 | Handoff para banco foi gerado. |
| CA-FRONT-020 | O frontend não foi classificado como pronto para produção enquanto estiver mockado. |

---

## 27. Próximos passos

1. Revisar este documento com produto e engenharia.
2. Aplicar roteiro de ajuste no Lovable.
3. Ajustar o protótipo para refletir frontend modular e integrável.
4. Manter backend real fora do Lovable nesta etapa.
5. Após exportação, aplicar higienização pós-Lovable.
6. Organizar o projeto em `/frontend`.
7. Validar build local.
8. Avançar para arquitetura de software.
9. Em seguida, detalhar backend, APIs, banco, segurança, infraestrutura e orquestração de IA.

---

## 28. Conclusão

O frontend do Orquestra deve evoluir de protótipo visual para uma base organizada e integrável antes da implementação real de backend, APIs, banco e runtime.

O próximo passo operacional recomendado é usar o roteiro de ajuste no Lovable para melhorar o protótipo e preparar a futura exportação, mantendo os limites claros entre frontend mockado, integração futura e arquitetura real.
