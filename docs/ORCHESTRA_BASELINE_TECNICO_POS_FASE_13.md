# Baseline Tecnico do Orquestra Pos-Fase 13

## 0. Resumo executivo

O Orquestra e hoje um control plane corporativo para criar, configurar, publicar, executar de forma governada, auditar e avaliar assistentes de IA. O estado atual e de MVP avancado em evolucao: backend, banco, RBAC, governanca de assistentes, RAG, MCP, runtime boundary, observabilidade e AI Quality possuem implementacoes reais no repositorio; o chat final em frontend e a integracao produtiva com Agno Runtime ainda estao pendentes.

O estado tecnico atual e forte no backend. O projeto possui Express + TypeScript, Prisma, PostgreSQL, migrations incrementais, controllers/services/repositories/schemas por dominio, testes unitarios/API/runtime e documentacao por fase. O frontend React/Vite esta integrado a varias APIs reais, mas preserva modo mock controlado por `VITE_USE_MOCKS`; a tela de chat permanece prototipo quando a API real esta ativa.

Frentes implementadas: autenticacao com sessao por cookie/JWT, SSO corporativo configuravel, RBAC por permissoes, CRUD/governanca de assistentes, knowledge bases, ingestao local, chunks, RAG local e semantico governado, catalogo MCP e sandbox, runtime adapter boundary, providers de LLM com flags fail-closed, observabilidade de uso/custos/limites/alertas e AI Quality deterministico.

Frentes preparadas, mas ainda nao completas: Agno Runtime via adapter HTTP opcional, mock local e smoke scripts; providers externos por flags; embeddings e vector store com pgvector; MCP remoto governado ate catalogo/read API; observabilidade pronta para instrumentacao mais ampla, mas ainda sem dashboard, delivery real de alertas ou enforcement completo no runtime.

O proximo passo recomendado e a Sprint 20 / Fase 14 com integracao real com Agno Runtime. Essa etapa deve conectar runtime executor real sem transferir governanca para ele: tenant, workspace, auth, RBAC, assistentes, providers, RAG, MCP, secrets, limites, observabilidade, auditoria, qualidade e governanca continuam no Orquestra. LLM-as-judge foi corretamente adiado para depois do runtime real.

Ainda nao existe chat produtivo completo no frontend, streaming real, Agno produtivo integrado, LLM-as-judge, dashboard de AI Quality/observabilidade, scheduler/worker/queue, delivery de alertas, billing real ou execucao MCP remota produtiva.

## 1. State Audit Blueprint

```yaml
state_audit_blueprint:
  project_name: "Orquestra"
  source_type: "Projeto local / Git"
  project_status: "MVP avancado em evolucao"
  maturity_level: "Control plane avancado; runtime produtivo pendente"
  analysis_depth: "Profundo"

  frontend_status: "PARCIAL - app React com rotas e APIs reais em varios dominios; chat real AUSENTE"
  backend_status: "IMPLEMENTADO - control plane modular Express/TypeScript"
  database_status: "IMPLEMENTADO - Prisma/PostgreSQL com migrations ate Fase 13C"
  api_status: "IMPLEMENTADO - /api/v1 por dominio com auth/RBAC"
  auth_status: "IMPLEMENTADO - cookie/JWT, dev login governado e SSO corporativo configuravel"
  rbac_status: "IMPLEMENTADO - permissoes e roles no seed, middleware requirePermission"
  rag_status: "PARCIAL - local/semantico governado; uso pelo runtime real ainda PENDENTE"
  mcp_status: "PARCIAL - catalogo/sandbox/remoto governado; execucao remota produtiva AUSENTE"
  observability_status: "IMPLEMENTADO - usage events, limites, alerts read-only; delivery/enforcement completos PENDENTES"
  quality_evaluation_status: "IMPLEMENTADO - AI Quality deterministico com RBAC e CRUD governado"
  runtime_status: "PARCIAL - boundary e local adapter implementados; runtime produtivo externo PENDENTE"
  agno_status: "PREPARADO - adapter HTTP opcional e mock local; integracao real PENDENTE"

  mock_level: "Medio - frontend chat e Agno local smoke usam mock/simulacao; backend principal usa APIs reais"
  hardcoded_level: "Baixo/Medio - seeds dev e mocks de demonstracao; policies/config via env"
  repository_standard_status: "IMPLEMENTADO - monorepo frontend/backend/docs/scripts"
  package_manager_detected: "npm"
  package_manager_compliant: "Sim - package-lock em frontend e backend"

  ai_detected: true
  ai_orchestration_detected: true
  external_runtime_detected: "PREPARADO via adapter Agno; produtivo PENDENTE"
  agno_runtime_ready: false

  backend_readiness: "Alta para control plane; Media para runtime real"
  production_readiness: "Media - requer hardening operacional, secrets, migrations e runtime"
  agno_integration_readiness: "Media - contrato e adapter existem, mas Sprint 20 deve formalizar execucao real"

  main_capabilities_implemented:
    - "Auth, sessao, RBAC e auditoria"
    - "Governanca de assistentes e publicacoes"
    - "Knowledge/RAG/MCP governados"
    - "Observabilidade de IA"
    - "AI Quality deterministico"
  main_capabilities_partial:
    - "Runtime adapter e execucao local"
    - "Agno via HTTP opcional/mock"
    - "Providers externos por flags"
    - "Embeddings/vector store"
    - "Frontend em API real para todos os dominios, exceto chat"
  main_capabilities_absent:
    - "Agno Runtime produtivo integrado"
    - "Chat real completo no frontend"
    - "LLM-as-judge"
    - "Scheduler/worker/queue"
    - "Dashboard operacional de observabilidade e qualidade"

  critical_risks:
    - "Runtime externo receber escopo amplo demais"
    - "RAG/MCP sem scoping estrito ao enviar contexto ao runtime"
    - "Custo de provider sem quota aplicada no caminho real"
    - "Secrets vazarem para payloads de runtime"
    - "Chat frontend assumir capacidades ainda mockadas"
  blocking_decisions:
    - "Contrato final da Assistant Runtime Spec"
    - "Boundary do servico Agno"
    - "Politica de streaming"
    - "Estrategia minima de observabilidade do runtime"
    - "Politica de secrets para runtime"
  recommended_next_phase: "Sprint 20 / Fase 14 - Integracao real com Agno Runtime"
  main_recommendation: "Integrar Agno como executor governado pelo Orquestra, sem transferir RBAC, dados, secrets ou policy decisions ao runtime externo."
```

Leitura executiva: o repositorio esta maduro como control plane backend e possui boa separacao de dominios. A lacuna central nao e mais modelagem de governanca, mas a conexao produtiva entre essa governanca e um runtime executor real, com chat, RAG, MCP, limites e observabilidade no caminho de execucao.

## 2. Visao geral do produto

O Orquestra e uma plataforma corporativa para gerenciar assistentes de IA em ambientes com tenant, workspace, controle de acesso, auditoria, conhecimento, ferramentas, observabilidade e qualidade.

Publico-alvo: administradores de plataforma, criadores de assistentes, editores, auditores e consumidores corporativos. Evidencia: roles `admin_platform`, `creator_owner`, `editor`, `consumer` e `auditor` em `backend/prisma/seed.ts`. Status: IMPLEMENTADO. Confianca: Alta.

Tipo de sistema: control plane web com backend API, banco relacional e frontend administrativo. Evidencia: `backend/src/app/routes.ts`, `frontend/src/App.tsx`, `backend/prisma/schema.prisma`. Status: IMPLEMENTADO. Confianca: Alta.

Proposta de valor: governar o ciclo de vida de assistentes de IA, conhecimento, ferramentas, execucoes, auditoria, custos/limites e avaliacao de qualidade antes de expor runtime produtivo.

Principais dominios: tenants, workspaces, usuarios, roles, permissions, assistants, agent runs, knowledge/RAG, MCP, runtime, LLM providers, observability, AI Quality, audit e settings.

Papel do Orquestra como control plane: manter a fonte da verdade e as decisoes de governanca. O Orquestra deve continuar responsavel por tenant, workspace, autenticacao, RBAC, assistentes, providers, RAG, MCP, secrets, limites, observabilidade, auditoria, qualidade e governanca.

Papel futuro do Agno: runtime executor externo para executar assistentes com contexto governado pelo Orquestra. O runtime externo nao deve decidir RBAC, nao deve ser fonte da verdade e nao deve receber acesso irrestrito a ferramentas, dados ou segredos.

Fronteira recomendada: Orquestra monta Assistant Runtime Spec, valida policies, resolve RAG/MCP permitidos, aplica limites, registra auditoria/observabilidade e chama Agno com payload minimo. Agno executa e devolve eventos/output sanitizaveis.

## 3. Estrutura do repositorio

| Caminho | Tipo | Responsabilidade | Status | Evidencia | Observacoes |
| ------- | ---- | ---------------- | ------ | --------- | ----------- |
| `/` | Monorepo | Raiz com README, compose, frontend, backend, docs e scripts | IMPLEMENTADO | `README.md`, `docker-compose.dev.yml`, `docker-compose.prod.yml` | README raiz esta historicamente desatualizado frente ao backend atual |
| `frontend/` | App web | React/Vite, rotas autenticadas, pages, services e mocks controlados | PARCIAL | `frontend/src/App.tsx`, `frontend/src/services/api/endpoints.ts` | Chat real ainda ausente em API mode |
| `frontend/src/pages/` | Frontend | Telas de Login, Dashboard, Assistants, Knowledge, MCP, Chat, Audit, Admin | IMPLEMENTADO | `frontend/src/pages/*` | Varias telas usam API real; chat preserva prototipo |
| `frontend/src/services/` | Frontend | Services HTTP e mocks por dominio | PARCIAL | `frontend/src/services/api/api-client.ts`, `frontend/src/services/chat.service.ts` | `chatService` falha em API real |
| `backend/` | API | Backend Express/TypeScript | IMPLEMENTADO | `backend/package.json`, `backend/src/server.ts` | Control plane principal |
| `backend/src/app/` | Backend | Middlewares e registro de rotas | IMPLEMENTADO | `backend/src/app/routes.ts`, `backend/src/app/middlewares.ts` | Base `/api/v1` |
| `backend/src/modules/` | Backend | Modulos por dominio | IMPLEMENTADO | `backend/src/modules/*` | Padrao controller/service/repository/schema |
| `backend/src/modules/runtime/` | Backend IA | Runtime adapter boundary, local adapter, Agno adapter/client | PARCIAL | `runtime.registry.ts`, `runtime.agno-adapter.ts` | Agno produtivo ainda pendente |
| `backend/src/modules/ai-quality/` | Backend IA | AI Quality deterministic evaluation | IMPLEMENTADO | `ai-quality.routes.ts`, `ai-quality-evaluator.service.ts` | LLM-as-judge ausente |
| `backend/src/modules/ai-observability/` | Backend IA | Usage events, limits, alert rules e admin API | IMPLEMENTADO | `ai-observability.routes.ts` | Alert delivery e dashboard ausentes |
| `backend/prisma/` | Banco | Schema, migrations e seed/bootstrap | IMPLEMENTADO | `schema.prisma`, `seed.ts`, `migrations/*` | Ultima migration de AI Quality 13C |
| `backend/tests/` | Testes | API, unit, runtime e schema/migration tests | IMPLEMENTADO | `backend/tests/*` | 37 arquivos identificados |
| `docs/` | Documentacao | Documentacao tecnica por dominio/fase | IMPLEMENTADO | `docs/README.md`, `docs/ai-orchestration/*` | Baseline atual criado na raiz de docs |
| `scripts/` | Operacao | Smoke local/fullstack/SSO/Agno mock | PREPARADO | `scripts/smoke-agno-local.sh`, `scripts/agno-mock-runtime.mjs` | Agno smoke usa mock local |
| `docker-compose.dev.yml` | Infra local | Frontend, backend e pgvector para desenvolvimento | IMPLEMENTADO | `docker-compose.dev.yml` | Usa volume local e healthchecks |
| `docker-compose.prod.yml` | Infra prod-like | Frontend nginx, backend node, Postgres | PREPARADO | `docker-compose.prod.yml` | Nao prova deploy produtivo externo |
| `.env.example` / `backend/.env.example` / `frontend/.env.example` | Config | Templates de ambiente | IMPLEMENTADO | arquivos `.env.example` | Sem garantia de secrets reais configurados |

## 4. Stack tecnica identificada

| Camada | Tecnologia | Uso atual | Status | Evidencia | Observacoes |
| ------ | ---------- | --------- | ------ | --------- | ----------- |
| Frontend | React 18, TypeScript, Vite | SPA administrativa | IMPLEMENTADO | `frontend/package.json`, `frontend/src/App.tsx` | Vite 8 conforme package |
| UI | Tailwind, Radix UI, shadcn-style components, lucide | Componentes e layouts | IMPLEMENTADO | `frontend/src/components/ui/*`, `frontend/package.json` | Design system local |
| Frontend data | TanStack Query + axios | Queries e HTTP com cookies | IMPLEMENTADO | `frontend/src/hooks/queries/*`, `api-client.ts` | `withCredentials: true` |
| Backend | Node.js, Express, TypeScript | API control plane | IMPLEMENTADO | `backend/package.json`, `backend/src/app/routes.ts` | Express 4 |
| Banco | PostgreSQL | Persistencia principal | IMPLEMENTADO | `backend/prisma/schema.prisma` | Dev usa imagem pgvector |
| ORM/migrations | Prisma | Schema, Client, migrations e seed | IMPLEMENTADO | `backend/prisma/schema.prisma`, `backend/prisma/migrations/*` | 19 migrations identificadas |
| Auth | JWT, cookie-parser, bcrypt, SSO corporativo | Sessao, dev login e SSO configuravel | IMPLEMENTADO | `auth.routes.ts`, `microsoft-sso.config.ts` | Dev login bloqueado em producao |
| Validacao | Zod | Schemas de body/query/env | IMPLEMENTADO | `backend/src/config/env.ts`, `*.schema.ts` | Uso amplo de `.strict()` em modulos sensiveis |
| Testes backend | Vitest, supertest | Unit/API/runtime/schema tests | IMPLEMENTADO | `backend/package.json`, `backend/tests/*` | 37 arquivos |
| Testes frontend | Vitest, Testing Library, Playwright package | Unit/service/page tests | IMPLEMENTADO | `frontend/src/test/*`, `frontend/package.json` | Playwright dependency presente |
| IA/RAG/MCP | Modulos internos + pgvector + adapters | RAG/MCP/runtime governados | PARCIAL | `knowledge`, `mcp`, `runtime` modules | Runtime real externo pendente |
| Observabilidade | Pino, usage events IA | Logs HTTP e eventos de IA | PARCIAL | `logger.ts`, `ai-observability/*` | Sem dashboard/delivery real |
| Infra local | Docker Compose | Dev/prod-like local | IMPLEMENTADO | compose e Dockerfiles | Dev com pgvector; prod-like com Postgres |

## 5. Frontend atual

Estrutura: SPA React/Vite com layouts separados (`AuthLayout`, `AppLayout`, `ChatLayout`, `DashboardLayout`, `SettingsLayout`) e rotas autenticadas sob `/app`. Evidencia: `frontend/src/App.tsx`. Status: IMPLEMENTADO. Confianca: Alta.

Rotas principais: `/login`, `/app/dashboard`, `/app/analytics`, `/app/assistants`, `/app/assistants/new`, `/app/assistants/:id`, `/app/knowledge`, `/app/mcp`, `/app/chat`, `/app/audit`, `/app/admin/users`, `/app/admin/roles`, `/app/admin/settings`. Evidencia: `frontend/src/App.tsx`. Status: IMPLEMENTADO. Confianca: Alta.

Integracao com backend: `apiClient` usa base `VITE_API_BASE_URL` ou `/api/v1`, `withCredentials: true` e intercepta erros estruturados. Evidencia: `frontend/src/services/api/api-client.ts`. Status: IMPLEMENTADO. Confianca: Alta.

Auth/session no frontend: `ProtectedRoute`, `useAuth`, `auth.service.ts` e endpoints `/auth/me`, `/auth/dev-login`, `/auth/logout`, `/auth/sso/config`. Evidencia: `frontend/src/components/auth/ProtectedRoute.tsx`, `frontend/src/services/api/endpoints.ts`. Status: IMPLEMENTADO. Confianca: Alta.

Mock mode: controlado por `VITE_USE_MOCKS`; bloqueado fora de ambientes locais/teste/prototipo. Evidencia: `frontend/src/lib/env.ts`. Status: IMPLEMENTADO. Confianca: Alta.

Telas relevantes: Assistants, Knowledge, MCP, Audit e Admin possuem services/hooks dedicados. Evidencia: `frontend/src/services/*.service.ts`, `frontend/src/hooks/queries/*`. Status: PARCIAL. Confianca: Alta.

Chat: a pagina de chat so renderiza prototipo quando `env.useMocks` e verdadeiro; em API real exibe empty state informando contrato real indisponivel. O `chatService` lanca erro em API real. Evidencia: `frontend/src/pages/Chat/ChatPage.tsx`, `frontend/src/services/chat.service.ts`. Status: AUSENTE para chat real. Confianca: Alta.

Lacunas para MVP completo: chat real, envio de mensagem, streaming, run status real, exibicao de RAG/MCP real por run, UX de erros de provider real, dashboard de observabilidade/AI Quality e testes E2E do fluxo Agno. Status: PENDENTE. Confianca: Alta.

Antes da integracao Agno: validar que frontend nao chama Agno direto, que chat consome apenas backend Orquestra, que estados de run usam AgentRun/Runtime APIs e que mocks ficam bloqueados em ambientes produtivos.

## 6. Backend atual

Arquitetura: Express modular, com `registerRoutes` centralizando dominios em `/api/v1`, controllers delegando para services, repositories com Prisma, schemas Zod e middlewares compartilhados de auth/erro/request-id. Evidencia: `backend/src/app/routes.ts`, `backend/src/modules/*`, `backend/src/shared/*`. Status: IMPLEMENTADO. Confianca: Alta.

Padrao de modulo: rotas com `requireAuth`, `requirePermission`, `validateBody`, `validateQuery` e `validateParams`; services aplicam regras de negocio, repositories isolam Prisma, mappers controlam DTOs. Evidencia: `ai-quality.routes.ts`, `assistants.routes.ts`, `knowledge.routes.ts`. Status: IMPLEMENTADO. Confianca: Alta.

Erros: `AppError`, middleware de error handler e not found estruturado. Evidencia: `backend/src/shared/errors/app-error.ts`, `error-handler.middleware.ts`, `not-found.middleware.ts`, `backend/tests/api/errors.test.ts`. Status: IMPLEMENTADO. Confianca: Alta.

Auth/RBAC: sessao por cookie, `requireAuth`, `requirePermission` e auditoria de permission denied. Evidencia: `auth.middleware.ts`. Status: IMPLEMENTADO. Confianca: Alta.

Tabela de modulos:

| Modulo | Responsabilidade | Status | Rotas/servicos | Evidencia | Observacoes |
| ------ | ---------------- | ------ | -------------- | --------- | ----------- |
| `auth` | Login dev, logout, me, SSO corporativo | IMPLEMENTADO | `/auth/*` | `auth.routes.ts` | Dev login governado |
| `tenants` | Consulta/gestao de tenant | IMPLEMENTADO | `/tenants` | `tenants.routes.ts` | RBAC `tenants.*` |
| `workspaces` | Workspaces por tenant | IMPLEMENTADO | `/workspaces` | `workspaces.routes.ts` | Scoping por usuario |
| `users` | Usuarios | IMPLEMENTADO | `/users` | `users.routes.ts` | CRUD parcial governado |
| `roles` | Roles e permissoes | IMPLEMENTADO | `/roles` | `roles.routes.ts` | Vinculo role-permission |
| `permissions` | Leitura de permissoes | IMPLEMENTADO | `/permissions` | `permissions.routes.ts` | Seed controla catalogo |
| `assistants` | CRUD, versoes, publicacao, rollback, approval, policy | IMPLEMENTADO | `/assistants/*` | `assistants.routes.ts` | Base do control plane |
| `agent-runs` | Runs, eventos, cancelamento | IMPLEMENTADO | `/agent-runs/*`, `/assistants/:id/runs` | `agent-runs.routes.ts`, `assistants.routes.ts` | Usa runtime registry |
| `knowledge` | Knowledge bases, docs, chunks, ingestion, RAG | IMPLEMENTADO/PARCIAL | `/knowledge-*`, `/rag/queries`, `/assistants/:id/rag/*` | `knowledge.routes.ts` | Runtime real ainda pendente |
| `mcp` | Catalogo, tools, sandbox, bindings, remote catalog read | PARCIAL | `/mcp/*`, `/assistants/:id/mcp/*` | `mcp.routes.ts` | Execucao remota produtiva ausente |
| `runtime` | Providers, capabilities, health, config | PARCIAL | `/runtime/*` | `runtime.routes.ts` | Sem endpoint de chat direto |
| `llm` | Catalogo/config/test generation de providers | PARCIAL | `/llm/*` | `llm.routes.ts` | External providers por flags |
| `ai-observability` | Usage, summary, limits, alerts | IMPLEMENTADO | `/ai-observability/*` | `ai-observability.routes.ts` | Admin read-only |
| `ai-quality` | Quality deterministic evaluation | IMPLEMENTADO | `/ai-quality/*` | `ai-quality.routes.ts` | Sem LLM-as-judge |
| `audit` | Audit logs | IMPLEMENTADO | `/audit-logs` | `audit.routes.ts` | `audit.read` |
| `settings` | Settings read | PARCIAL | `/settings` | `settings.routes.ts` | CRUD amplo nao identificado |
| `health` | Health e db health | IMPLEMENTADO | `/health`, `/health/db` | `health.routes.ts` | Fora de `/api/v1` |

## 7. Banco de dados e Prisma

Prisma modela o core multi-tenant completo. Models principais identificados: `Tenant`, `Workspace`, `User`, `ExternalIdentity`, `Role`, `Permission`, `UserRole`, `RolePermission`, `WorkspaceMembership`, `Session`, `AuditLog`, `Setting`, `Assistant`, `AssistantVersion`, `AssistantPublication`, `KnowledgeBase`, `McpServer`, `AgentRun`, `RagQuery`, `AiRunUsageEvent`, `AiUsageLimitPolicy`, `AiObservabilityAlertRule`, `AiQualityTestSet`, `AiQualityTestCase`, `AiQualityEvaluationRun`, `AiQualityEvaluationResult`. Evidencia: `backend/prisma/schema.prisma`. Status: IMPLEMENTADO. Confianca: Alta.

Migrations recentes: Fase 10C pgvector embeddings, Fase 11I MCP remote catalog schema, Fase 12A/12B/12D observabilidade, Fase 13A/13B/13C AI Quality. Evidencia: `backend/prisma/migrations/*`. Status: IMPLEMENTADO. Confianca: Alta.

| Dominio | Models/Tabelas | Status | Evidencia | Observacoes |
| ------- | -------------- | ------ | --------- | ----------- |
| Core multi-tenant | `Tenant`, `Workspace`, `User`, `WorkspaceMembership` | IMPLEMENTADO | `schema.prisma` linhas de models | Base de scoping |
| RBAC | `Role`, `Permission`, `UserRole`, `RolePermission` | IMPLEMENTADO | `schema.prisma`, `seed.ts` | AI Quality incluida no seed |
| Auth/SSO | `Session`, `ExternalIdentity` | IMPLEMENTADO | `schema.prisma`, migration Fase 08D | SSO corporativo configuravel |
| Audit/settings | `AuditLog`, `Setting` | IMPLEMENTADO | `schema.prisma` | Auditoria de eventos |
| Assistants | `Assistant`, `AssistantVersion`, `AssistantPublication`, `AssistantApprovalRequest`, `AssistantExecutionPolicy` | IMPLEMENTADO | `schema.prisma` | Governanca e publicacao |
| Knowledge/RAG | `KnowledgeBase`, `KnowledgeDocument`, `KnowledgeChunk`, `KnowledgeChunkEmbedding`, `RagQuery`, `RagQueryResult` | PARCIAL | `schema.prisma`, migrations Fase 06/10 | Sem uso Agno real ainda |
| MCP | `McpServer`, `McpTool`, `McpToolPolicy`, `McpToolCall`, `McpRemoteCatalogEntry`, `McpRemoteCatalogApplyLedger` | PARCIAL | `schema.prisma`, migrations Fase 11I | Remoto governado, execucao produtiva pendente |
| Runtime | `AgentRun`, `AgentRunEvent`, `Conversation`, `ConversationMessage`, `ToolCall` | PARCIAL | `schema.prisma`, `agent-runs` module | Chat real frontend pendente |
| Observabilidade | `AiRunUsageEvent`, `AiUsageLimitPolicy`, `AiObservabilityAlertRule` | IMPLEMENTADO | migrations Fase 12 | Delivery/enforcement completo pendente |
| AI Quality | `AiQualityTestSet`, `AiQualityTestCase`, `AiQualityEvaluationRun`, `AiQualityEvaluationResult` | IMPLEMENTADO | migrations Fase 13 | Sem avaliacao semantica |

Riscos operacionais: migrations dependem de banco acessivel; seeds/permissoes precisam rodar em ambientes existentes; pgvector em dev difere da imagem `postgres:16-alpine` do compose prod-like; retencao/particionamento de eventos de uso ainda nao identificados.

Pendencias antes de Agno Runtime: confirmar migrations aplicadas, seed de permissoes, pgvector em ambiente alvo quando embeddings/semantica forem usados, e estrategia de retencao para eventos/runs.

## 8. Autenticacao, SSO, sessao e RBAC

| Recurso | Status | Evidencia | Confianca | Observacao |
| ------- | ------ | --------- | --------- | ---------- |
| Sessao cookie/JWT | IMPLEMENTADO | `backend/src/shared/security/session.ts`, `auth.middleware.ts` | Alta | Cookie definido por `COOKIE_NAME` |
| Dev login | IMPLEMENTADO | `auth.service.ts`, `DEV_LOGIN_ENABLED` em `env.ts` | Alta | Bloqueado em producao ou sem flag |
| SSO corporativo | IMPLEMENTADO/PARCIAL | `microsoft-sso.config.ts`, `microsoft-sso.service.ts` | Alta | Depende de envs configurados |
| Logout | IMPLEMENTADO | `auth.routes.ts` | Alta | Endpoint `/auth/logout` |
| `/auth/me` | IMPLEMENTADO | `auth.routes.ts`, frontend `auth.service.ts` | Alta | Fonte de usuario autenticado |
| RBAC middleware | IMPLEMENTADO | `requirePermission` em `auth.middleware.ts` | Alta | Registra `permission_denied` |
| Workspace scoping | IMPLEMENTADO | `hasWorkspaceAccess`, services de dominio | Alta | 403/404 por dominio |
| Roles padrao | IMPLEMENTADO | `backend/prisma/seed.ts` | Alta | admin, creator, editor, consumer, auditor |
| Permissoes AI Quality | IMPLEMENTADO | `seed.ts`, `ai-quality.routes.ts` | Alta | `ai.quality.read/write` |
| Permissao observabilidade | PARCIAL | `ai-observability.routes.ts` | Alta | Usa `audit.read`; permissao dedicada futura recomendada |
| Secrets no SSO | IMPLEMENTADO | `microsoft-sso.config.ts` | Alta | Config publica nao expoe segredo |

Lacunas: revisao de permissoes por ambiente existente, documentacao operacional de roles, permissao dedicada para observabilidade de IA e validacao E2E SSO em ambiente alvo.

## 9. Assistentes e configuracao de IA

Implementado:

- CRUD de assistentes, archive/restore, versoes, publicacao, rollback, shares, feedback, test results, approvals e execution policy. Evidencia: `backend/src/modules/assistants/assistants.routes.ts`. Status: IMPLEMENTADO. Confianca: Alta.
- Policies de assistente com ownership/workspace/admin. Evidencia: `assistants.policy.ts`. Status: IMPLEMENTADO. Confianca: Alta.
- AgentRun com precheck, status, eventos, metadata sanitizada, input summary e runtime registry. Evidencia: `agent-runs.service.ts`. Status: IMPLEMENTADO. Confianca: Alta.
- LLM provider registry com provider local deterministic e providers externos governados por flags. Evidencia: `llm.registry.ts`, `llm.config.ts`. Status: PARCIAL. Confianca: Alta.

Preparado:

- Runtime context compila resumo de prompt, RAG, MCP, policy e input hash para envio ao adapter. Evidencia: `runtime.context.ts`. Status: PREPARADO. Confianca: Alta.
- Agno adapter pode montar payload HTTP com assistant, policy snapshot, RAG context e MCP descriptors quando flags permitem. Evidencia: `runtime.agno-adapter.ts`. Status: PREPARADO/PARCIAL. Confianca: Alta.

Pendente:

- Assistant Runtime Spec formal versionada para Sprint 20. Status: PENDENTE. Confianca: Alta.
- Execucao real Agno em ambiente produtivo. Status: PENDENTE. Confianca: Alta.
- Streaming real e contrato de mensagens frontend/backend. Status: AUSENTE/PENDENTE. Confianca: Alta.

Decisao necessaria:

- O quanto do prompt/instructions pode ser enviado ao runtime, com quais redacoes/sanitizacoes e auditoria.
- Politica de provider externo no runtime real: default local/governado, limites, quotas e fail-closed.

## 10. RAG

| Item RAG | Status | Evidencia | Observacao |
| -------- | ------ | --------- | ---------- |
| Knowledge base CRUD | IMPLEMENTADO | `knowledge.routes.ts` `/knowledge-bases` | Auth + RBAC |
| Documentos | IMPLEMENTADO | `KnowledgeDocument`, `/knowledge-documents/*` | Conteudo local controlado |
| Chunks locais | IMPLEMENTADO | `KnowledgeChunk`, `knowledge.chunking.ts` | Chunking textual |
| Source references | IMPLEMENTADO | `KnowledgeSourceReference`, rotas source-references | Citations/readiness |
| Ingestion local | IMPLEMENTADO | `/request-ingestion`, `KnowledgeIngestionJob` | Sem worker externo |
| Embeddings | PARCIAL | `KnowledgeChunkEmbedding`, `embeddings/*`, env flags | Execucao por flags; nao assumir sempre ativo |
| pgvector dev | PREPARADO | `docker-compose.dev.yml` usa `pgvector/pgvector` | Prod-like compose usa Postgres simples |
| RAG local search | IMPLEMENTADO | `/assistants/:id/rag-local-search` | Deterministico/local |
| RAG semantic search | PARCIAL | `/assistants/:id/rag/semantic-search` | Depende embeddings/vector |
| RAG query oficial | IMPLEMENTADO | `/assistants/:id/rag/query`, `/rag/queries/:id` | Persistencia de query/result |
| Uso por Agno | PENDENTE | `runtime.context.ts`, `runtime.agno-adapter.ts` | Contexto preparado, runtime real pendente |

Seguranca: RAG deve continuar resolvido pelo Orquestra, com scoping tenant/workspace/assistant antes de enviar fontes ao runtime. Risco principal: vazamento cross-workspace se o contexto for resolvido fora do control plane.

## 11. MCP

| Item MCP | Status | Evidencia | Observacao |
| -------- | ------ | --------- | ---------- |
| Catalogo MCP local | IMPLEMENTADO | `McpServer`, `McpTool`, `mcp.routes.ts` | CRUD governado |
| Resources/prompts | IMPLEMENTADO | `/mcp/servers/:id/resources`, `/prompts` | Catalogo, nao execucao remota |
| Bindings com assistants | IMPLEMENTADO | `/assistants/:id/mcp-bindings` | Escopo por assistente |
| Sandbox precheck | IMPLEMENTADO | `/assistants/:id/mcp/precheck` | `execution.precheck` |
| Tool calls sandbox | IMPLEMENTADO | `/assistants/:id/mcp/tool-calls` | Governado/sandbox |
| Tool call events | IMPLEMENTADO | `/mcp/tool-calls/:id/events` | Historico/auditoria |
| Policies | IMPLEMENTADO/PARCIAL | `McpToolPolicy`, `mcp.policies.manage` seed | Precisa hardening por ambiente |
| Remote discovery/import | PARCIAL | docs 11A-11K, `remote-catalog` routes | Catalogo governado, execucao produtiva ausente |
| Remote catalog read API | IMPLEMENTADO | `/mcp/remote-catalog/*` | `mcp.manage` |
| Exposicao ao Agno | PENDENTE | `runtime.context.ts`, `runtime.agno-adapter.ts` | Enviar descriptors governados, nao credenciais |

O MCP deve ser exposto ao Agno via gateway/control plane. Agno nao deve receber permissao autonoma para descobrir/executar tools fora das policies do Orquestra.

## 12. Observabilidade, custos, limites e alertas

| Capacidade | Status | Evidencia | Observacao |
| ---------- | ------ | --------- | ---------- |
| Usage events | IMPLEMENTADO | `AiRunUsageEvent`, `ai-observability.service.ts` | Eventos tecnicos de IA |
| Campos de custo | IMPLEMENTADO | `estimatedCostMinorUnits`, `costCurrency` em schema | Custo estimado, nao billing |
| Limits/quotas | IMPLEMENTADO | `AiUsageLimitPolicy`, `ai-usage-limits.service.ts` | Evaluator read-only |
| Admin API | IMPLEMENTADO | `/api/v1/ai-observability/*` | Usa `audit.read` |
| Alert rules | IMPLEMENTADO | `AiObservabilityAlertRule`, `ai-observability-alerts.service.ts` | Sem delivery real |
| Alert evaluation | IMPLEMENTADO | `POST /alert-evaluation` | Simulacao read-only |
| Dashboard | AUSENTE | NAO_IDENTIFICADO no frontend | Recomendado futuro |
| Enforcement runtime | PARCIAL/PENDENTE | Fase 12 docs, runtime atual | `enforce` ainda precisa plugar caminho real |
| Agno Runtime observability | PENDENTE | `runtime.events.ts`, `agent-runs.service.ts` | Precisa minimo para Sprint 20 |

Relacao futura com Agno: cada execucao real deve gerar AgentRun/AgentRunEvent, usage event, status, latencia, provider/model, custo estimado quando aplicavel, traceId e outcome. Limites devem ser avaliados antes e depois conforme contrato.

## 13. AI Quality Evaluation

| Capacidade | Status | Evidencia | Observacao |
| ---------- | ------ | --------- | ---------- |
| 13A foundation | IMPLEMENTADO | `ORCHESTRA_QUALITY_EVALUATION_FOUNDATION_13A.md`, `ai-quality-evaluator.service.ts` | Assertions deterministicas |
| 13B runs/snapshots | IMPLEMENTADO | `ai-quality-runner.service.ts`, migration 13B | Candidate output completo nao persistido |
| 13C RBAC/CRUD | IMPLEMENTADO | `ai-quality.routes.ts`, `seed.ts` | `ai.quality.read/write` |
| 13D handoff | IMPLEMENTADO | documento de fechamento da Fase 13D | Docs/handoff |
| Test sets | IMPLEMENTADO | `AiQualityTestSet` | CRUD governado |
| Test cases | IMPLEMENTADO | `AiQualityTestCase` | Assertions/tags/autoria |
| Evaluator deterministico | IMPLEMENTADO | `evaluateAiQualityTestCase` | Sem provider |
| Evaluation runs/results | IMPLEMENTADO | `AiQualityEvaluationRun`, `AiQualityEvaluationResult` | Persistencia transacional |
| Snapshots | IMPLEMENTADO | `assistantSnapshotHash`, `testSetSnapshotHash` | Summaries sanitizados |
| Audit | IMPLEMENTADO | `ai-quality.service.ts` `recordAuditEvent` | Sem input/output completo |
| LLM-as-judge | AUSENTE/PENDENTE | Documento 13D | Adiado deliberadamente |

Limites: nao gera outputs/casos automaticamente, nao chama runtime, nao possui dashboard/read-model historico e depende de bootstrap de permissoes em ambientes existentes.

## 14. Runtime atual e lacuna Agno

| Capacidade de Runtime | Status | Evidencia | Confianca | Observacao |
| --------------------- | ------ | --------- | --------- | ---------- |
| Runtime adapter boundary | IMPLEMENTADO | `runtime.registry.ts`, `runtime.types.ts` | Alta | Providers `local`, `agno_stub`, `agno` |
| Local deterministic adapter | IMPLEMENTADO | `runtime.local-adapter.ts` | Alta | Pode usar provider local/governado |
| AgentRun integration | IMPLEMENTADO | `agent-runs.service.ts` | Alta | Cria runs, precheck, eventos |
| Runtime config API | IMPLEMENTADO | `/api/v1/runtime/config` | Alta | Read-only |
| Agno stub | IMPLEMENTADO | `AgnoRuntimeAdapter` provider `agno_stub` | Alta | Nao executa HTTP |
| Agno HTTP client | PREPARADO | `runtime.agno-client.ts` | Alta | `fetch` com timeout e auth header opcional |
| Agno HTTP adapter | PARCIAL | `runtime.agno-adapter.ts` | Alta | Flag-gated, sandbox, healthcheck |
| Agno mock service | MOCKADO | `scripts/agno-mock-runtime.mjs` | Alta | Apenas smoke/local |
| Execucao real de assistant via Agno | PENDENTE | NAO_IDENTIFICADO como servico produtivo | Alta | Sprint 20/Fase 14 |
| Streaming | AUSENTE | capabilities indicam false no mock/local | Alta | Decisao pendente |
| Tool calling real via Agno | PENDENTE | adapter envia descriptors sem autonomia | Media | Precisa gateway governado |
| RAG no runtime Agno | PREPARADO/PENDENTE | `AGNO_SEND_RAG_CONTEXT`, `runtime.context.ts` | Alta | Integracao real ainda nao validada |

Conclusao: a integracao real com Agno Runtime ainda e pendente e deve ser tratada como Sprint 20 / Fase 14. O repositorio contem readiness, adapter HTTP opcional e smoke com mock local, mas isso nao equivale a runtime produtivo integrado.

## 15. APIs e contratos atuais

| Dominio | Metodo/Rota | Status | Permissao | Evidencia | Observacao |
| ------- | ----------- | ------ | --------- | --------- | ---------- |
| Health | `GET /health`, `GET /health/db` | IMPLEMENTADO | Publico | `health.routes.ts` | Fora de `/api/v1` |
| Auth | `GET /api/v1/auth/sso/config` | IMPLEMENTADO | Publico/rate limit | `auth.routes.ts` | Config publica |
| Auth | `GET /api/v1/auth/microsoft/*` | IMPLEMENTADO/PARCIAL | Publico/rate limit | `auth.routes.ts` | Depende env SSO |
| Auth | `POST /api/v1/auth/dev-login` | IMPLEMENTADO | Flag dev | `auth.service.ts` | Bloqueado em prod |
| Auth | `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` | IMPLEMENTADO | Sessao | `auth.routes.ts` | Cookie/JWT |
| Assistants | `GET/POST/PATCH /api/v1/assistants` | IMPLEMENTADO | `assistants.*` | `assistants.routes.ts` | CRUD |
| Assistants | `POST publish/unpublish/rollback/archive/restore` | IMPLEMENTADO | `assistants.*` | `assistants.routes.ts` | Governanca |
| Assistants | `approvals`, `execution-policy`, `execution-precheck` | IMPLEMENTADO | `assistants.*` | `assistants.routes.ts` | Controle de execucao |
| Agent runs | `GET /api/v1/agent-runs`, `GET events`, `POST cancel` | IMPLEMENTADO | `agent_runs.*` | `agent-runs.routes.ts` | Historico |
| Agent runs | `POST /api/v1/assistants/:id/runs` | IMPLEMENTADO | `agent_runs.create` | `assistants.routes.ts` | Entrada de execucao |
| Providers | `/api/v1/llm/*` | PARCIAL | `llm.*` | `llm.routes.ts` | Providers por flags |
| RAG | `/api/v1/knowledge-*`, `/api/v1/rag/queries/*`, `/assistants/:id/rag/*` | PARCIAL | `knowledge.*` | `knowledge.routes.ts` | Real local/semantico, runtime pendente |
| MCP | `/api/v1/mcp/*`, `/assistants/:id/mcp/*` | PARCIAL | `mcp.*`, `execution.*` | `mcp.routes.ts` | Sandbox/catalogo |
| Observability | `/api/v1/ai-observability/*` | IMPLEMENTADO | `audit.read` | `ai-observability.routes.ts` | Admin read-only |
| AI Quality | `/api/v1/ai-quality/*` | IMPLEMENTADO | `ai.quality.*` | `ai-quality.routes.ts` | CRUD/runs |
| Runtime | `/api/v1/runtime/providers|capabilities|health|config` | PARCIAL | `agent_runs.read` | `runtime.routes.ts` | Read-only runtime status |
| Audit | `GET /api/v1/audit-logs` | IMPLEMENTADO | `audit.read` | `audit.routes.ts` | Auditoria |

## 16. Testes e qualidade

Estrutura: `backend/tests/api`, `backend/tests/unit`, `backend/tests/runtime`, `backend/tests/helpers` e `frontend/src/test`. Evidencia: listas de arquivos. Status: IMPLEMENTADO. Confianca: Alta.

Quantidade aproximada atual: 37 arquivos de teste backend identificados por `find backend/tests -maxdepth 2 -type f`. Em execucao anterior da Fase 13D, a suite backend reportou 36 test files e 378 tests; este baseline nao rerodou suite completa porque alterou apenas docs. Status: IMPLEMENTADO. Confianca: Alta para estrutura, Media para quantidade dinamica.

Cobertura por area:

- API: auth, health, assistants, agent-runs, knowledge/MCP, LLM, runtime, observability, AI Quality.
- Unit: RBAC, seed policy, SSO config/flow, observability, usage limits, AI Quality, embeddings fail-closed, MCP remote.
- Runtime: `backend/tests/runtime/agno-adapter.test.ts`.
- Frontend: auth service, API client, pages em real mode, runtime service, LLM service.

Lacunas: E2E full browser para fluxo Agno real, testes de streaming, testes de dashboard observability/quality, testes de secrets no runtime real e testes de carga/retencao.

## 17. Infraestrutura, Docker, ambiente e deploy

Compose dev: `docker-compose.dev.yml` sobe frontend, backend e `pgvector/pgvector:0.8.3-pg16`, com volumes e healthchecks. Status: IMPLEMENTADO. Confianca: Alta.

Compose prod-like: `docker-compose.prod.yml` sobe frontend nginx, backend node e `postgres:16-alpine`, com healthchecks e `COOKIE_SECURE=true`. Status: PREPARADO. Confianca: Alta.

Dockerfiles: frontend multi-stage build para nginx; backend multi-stage build com `npm ci`, `prisma generate`, build TypeScript e runner Node. Evidencia: `frontend/Dockerfile.prod`, `backend/Dockerfile.prod`. Status: IMPLEMENTADO. Confianca: Alta.

Env: backend possui defaults e flags extensas em `env.ts`; frontend centraliza env em `frontend/src/lib/env.ts`. Status: IMPLEMENTADO. Confianca: Alta.

Coolify/deploy externo: NAO_IDENTIFICADO no escopo de arquivos inspecionados. Status: NAO_IDENTIFICADO. Confianca: Media.

Riscos antes do Agno Runtime: definir rede interna, URL Agno, secrets, timeout, healthcheck, TLS/seguranca, logs, limites e estrategia de rollback. Nao usar o mock local como evidencia de readiness produtiva.

## 18. Seguranca e privacidade

- Tenant/workspace scoping: implementado em services e policies; workspaces fora de escopo retornam 403/404 conforme dominio. Evidencia: `auth.middleware.ts`, `agent-runs.policy.ts`, `ai-quality.service.ts`. Status: IMPLEMENTADO. Confianca: Alta.
- RBAC: permissao por rota, roles no seed, auditoria de permission denied. Evidencia: `seed.ts`, `requirePermission`. Status: IMPLEMENTADO. Confianca: Alta.
- Secrets: envs aceitam secrets, mas APIs de config tendem a expor apenas flags de configuracao. Evidencia: `llm.config.ts`, `runtime.config.ts`, testes `llm.test.ts` e `runtime.test.ts`. Status: IMPLEMENTADO/PARCIAL. Confianca: Alta.
- Sanitizacao: AI Quality, LLM metadata, AgentRun metadata e observabilidade redigem campos sensiveis. Evidencia: `ai-quality.sanitizer.ts`, `llm.service.ts`, `agent-runs.service.ts`. Status: IMPLEMENTADO. Confianca: Alta.
- Audit logs: `recordAuditEvent` usado em auth, permissions denied, LLM, AI Quality, AgentRuns e outros dominios. Status: IMPLEMENTADO. Confianca: Alta.
- Candidate output: AI Quality nao persiste output completo; guarda hash/excerpt. Evidencia: `ai-quality-evaluator.service.ts`, `ai-quality.repository.ts`. Status: IMPLEMENTADO. Confianca: Alta.
- Prompt/response handling: runtime context usa previews/hashes; raw input existe no contexto interno local e precisa de politica para Agno real. Evidencia: `runtime.context.ts`, `runtime.agno-adapter.ts`. Status: PARCIAL. Confianca: Alta.

Requisitos minimos para integracao externa: fail-closed por default, allowlist de campos do payload, sem secrets de usuario no runtime, timeout, retry controlado, auditoria por traceId, limite/quotas antes da chamada, sanitizacao de eventos retornados e bloqueio de tools sem approval.

## 19. Mapa de capacidades

| Capacidade | Status | Evidencia | Confianca | Proxima acao |
| ---------- | ------ | --------- | --------- | ------------ |
| Auth/SSO | IMPLEMENTADO/PARCIAL | `auth/*`, `microsoft-sso.*` | Alta | Validar SSO real em ambiente alvo |
| RBAC | IMPLEMENTADO | `seed.ts`, `auth.middleware.ts` | Alta | Revisar roles por ambiente |
| Assistants | IMPLEMENTADO | `assistants.routes.ts` | Alta | Conectar chat/runtime real |
| Providers | PARCIAL | `llm.registry.ts`, `llm.config.ts` | Alta | Definir politica de uso real |
| RAG | PARCIAL | `knowledge.routes.ts`, `runtime.context.ts` | Alta | Enviar contexto governado ao Agno |
| MCP | PARCIAL | `mcp.routes.ts`, docs 11A-11K | Alta | Gateway governado para runtime |
| Observability | IMPLEMENTADO/PARCIAL | `ai-observability/*` | Alta | Instrumentar runtime real |
| Limits | IMPLEMENTADO/PARCIAL | `ai-usage-limits.service.ts` | Alta | Aplicar no caminho Agno |
| Alerts | IMPLEMENTADO/PARCIAL | `ai-observability-alerts.service.ts` | Alta | Decidir delivery/scheduler futuro |
| AI Quality deterministic | IMPLEMENTADO | `ai-quality/*` | Alta | Criar dashboard/read-model |
| AI Quality semantic/LLM-as-judge | AUSENTE | 13D docs | Alta | Fazer apos runtime real |
| Runtime adapter | PARCIAL | `runtime/*` | Alta | Formalizar contract/spec |
| Agno Runtime real | PENDENTE | adapter/mock existem | Alta | Sprint 20/Fase 14 |
| Frontend chat | AUSENTE/PARCIAL | `ChatPage.tsx`, `chat.service.ts` | Alta | Implementar via backend |
| Admin APIs | IMPLEMENTADO | `/api/v1/*` routes | Alta | Consolidar docs/OpenAPI futuro |
| Audit | IMPLEMENTADO | `audit.service.ts`, `audit.routes.ts` | Alta | Revisar retencao |
| Seeds/permissions | IMPLEMENTADO | `seed.ts` | Alta | Rodar em ambientes existentes |
| Deploy | PREPARADO | Dockerfiles/compose | Media | Validar ambiente real |

## 20. Matriz de riscos

| Risco | Area | Severidade | Evidencia | Impacto | Mitigacao recomendada |
| ----- | ---- | ---------- | --------- | ------- | --------------------- |
| Agno receber escopo amplo demais | Runtime | Alta | `runtime.agno-adapter.ts` monta payload com assistant/RAG/MCP | Vazamento de dados/tools | Assistant Runtime Spec allowlist e testes de contrato |
| Runtime decidir RBAC | Seguranca | Alta | RBAC hoje esta no Orquestra | Bypass de governanca | Manter Agno como executor sem decisao de acesso |
| Tools/MCP executarem sem approval | MCP | Alta | `mcp.routes.ts`, `runtime.context.ts` | Acao externa indevida | Gateway Orquestra e approval obrigatorio para risco alto |
| RAG vazar dados entre tenants/workspaces | RAG | Alta | RAG context sera enviado ao runtime | Exposicao de dados | Resolver RAG somente no Orquestra com scoping estrito |
| Ausencia de streaming | Frontend/runtime | Media | `ChatPage.tsx`, capabilities locais | UX incompleta | Decidir streaming MVP ou pos-MVP |
| Ausencia de retry/fallback | Runtime | Media | Client Agno trata timeout/erro, retry operacional nao identificado | Falhas transientes | Politica de retry idempotente e circuit breaker |
| Custo de LLM sem quota | Observability | Alta | Limits existem mas enforcement real pendente | Custo inesperado | Avaliar limites antes de provider real |
| Observabilidade incompleta no runtime | Observability | Alta | Usage events prontos; Agno real pendente | Baixa rastreabilidade | Eventos minimos por run e traceId |
| Secrets expostos ao runtime | Seguranca | Alta | Env possui secrets; payload precisa allowlist | Comprometimento de credenciais | Nunca enviar secrets ao runtime; secret broker futuro |
| LLM-as-judge antes do runtime real | Quality | Media | 13D adiou LLM-as-judge | Custo/privacidade sem base operacional | Manter apos Sprint 20 |

## 21. Decisoes pendentes

| Decisao | Opcoes | Recomendacao | Impacto | Deve ser decidida antes de |
| ------- | ------ | ------------ | ------- | -------------------------- |
| Agno como servico separado ou embutido | HTTP interno separado; processo embutido | Servico separado com HTTP interno e healthcheck | Operacao, deploy, isolamento | 14B |
| Protocolo HTTP interno | REST JSON; SSE; gRPC futuro | REST JSON no MVP, SSE se streaming entrar | Simplicidade/observabilidade | 14A |
| Streaming no MVP | MVP sem streaming; streaming ja na Fase 14 | Definir explicitamente; se fora, documentar UX | Chat e contrato frontend | 14A/14D |
| RAG resolvido pelo Orquestra ou pelo runtime | Orquestra resolve; runtime consulta tool | Orquestra resolve contexto inicialmente | Scoping e privacidade | 14E |
| MCP executado por gateway do Orquestra | Gateway; runtime autonomo | Gateway Orquestra | Seguranca de tools | 14F |
| Formato da Assistant Runtime Spec | JSON versionado; DTO interno | JSON versionado com allowlist | Compatibilidade | 14A |
| Politica de secrets para runtime | Nunca enviar; enviar tokens temporarios; secret broker | Nunca enviar no MVP | Privacidade | 14A/14B |
| Observabilidade minima do runtime | Apenas AgentRun; AgentRun + usage; completo | AgentRun + AgentRunEvent + usage event | Auditoria/custo | 14G |
| Ordem entre Agno e LLM-as-judge | Judge antes; Agno antes | Agno antes | Reduz risco/custo | Sprint 20 |

## 22. Preparacao para Sprint 20 / Fase 14

| Subfase | Objetivo | Entregas | Criterios de aceite | Riscos |
| ------- | -------- | -------- | ------------------- | ------ |
| 14A - Runtime contract e Assistant Runtime Spec | Formalizar contrato de entrada/saida do runtime | Spec JSON v1, allowlist, exemplos, erros, eventos | Sem secrets, com tenant/workspace/assistant IDs, policy snapshot e traceId | Contrato amplo demais |
| 14B - Agno Runtime service HTTP minimo | Criar/validar servico Agno minimo | Health, capabilities, execute, config local | Backend consegue healthcheck e execucao sandbox controlada | Confundir mock com prod |
| 14C - Backend Runtime Adapter chamando Agno | Ligar adapter real a AgentRun | Config, timeout, error mapping, eventos normalizados | Run sandbox chama Agno e persiste eventos | Falha sem retry/timeout |
| 14D - Chat real via Agno no Orquestra | Substituir prototipo de chat por backend real | Endpoints/servicos frontend, envio de mensagem, run state | Frontend nao chama Agno direto | UX sem streaming se adiado |
| 14E - RAG governado no runtime | Enviar contexto RAG selecionado pelo Orquestra | Source refs, excerpts, limites de contexto | Agno recebe apenas fontes permitidas | Vazamento cross-workspace |
| 14F - MCP governado no runtime | Expor tools via gateway/control plane | Tool descriptors, approval, sandbox/execution modes | Nenhuma tool executa sem policy | Execucao externa indevida |
| 14G - Observabilidade, limites e hardening | Instrumentar uso, limites e auditoria | Usage events, limits precheck, logs, docs | Run real tem trace completo e fail-closed | Custo sem quota |
| 14H - Handoff do MVP com Agno | Fechar docs, riscos e validacoes | Runbook, smoke, checklist, backlog | Validacoes passam sem segredos | Handoff incompleto |

## 23. Backlog recomendado pos-baseline

P0:

- Definir Assistant Runtime Spec v1.
- Confirmar boundary do servico Agno e rede interna.
- Garantir que runtime nao decide RBAC.
- Implementar chat real via backend Orquestra, nao direto no Agno.
- Validar migrations/seeds/permissoes em ambiente alvo.
- Definir politica de secrets para runtime.

P1:

- Instrumentar usage events no caminho Agno.
- Aplicar limits evaluator antes de provider externo.
- Enviar RAG context governado com limites de tamanho.
- Expor MCP via gateway governado.
- Criar smoke Agno real alem do mock local.
- Testes de contrato para payloads sem secrets.

P2:

- Streaming se ficar fora do MVP inicial.
- Dashboard read-only de observabilidade.
- Dashboard/read-model de AI Quality.
- Export de runs/results.
- Retencao/rollup de usage events.

Pos-MVP:

- LLM-as-judge governado.
- Delivery real de alertas.
- Scheduler/worker/queue se necessario.
- Billing/cost reconciliation.
- Otimizacao semantica avancada e comparacoes historicas.

## 24. Checklist pre-Agno

```txt
[ ] main limpa e sincronizada
[ ] migrations aplicaveis
[ ] seeds/permissoes aplicaveis
[ ] auth/RBAC validado
[ ] RAG validado
[ ] MCP policies validadas
[ ] observability usage event validado
[ ] limits evaluator validado
[ ] AI Quality baseline validado
[ ] secrets strategy definida
[ ] Assistant Runtime Spec definida
[ ] Agno service boundary definido
[ ] runtime nao decide RBAC
[ ] frontend nao chama Agno direto
```

## 25. Resumo executivo final

Estado atual: o Orquestra esta consolidado como control plane de IA com backend robusto, banco modelado, RBAC, governanca de assistentes, RAG/MCP, runtime boundary, observabilidade e AI Quality deterministico. A frente mais critica pendente e transformar o readiness de runtime em execucao real com Agno.

Pontos fortes: modularidade backend, Prisma/migrations incrementais, RBAC por permissao, auditoria, sanitizacao defensiva, seeds, testes por dominio e documentacao faseada.

Principais lacunas: chat real, Agno produtivo integrado, streaming, enforcement completo de limites no runtime, dashboard de observabilidade/quality, delivery real de alertas e LLM-as-judge.

Nivel de prontidao para Agno: Media. O contrato tecnico preliminar e o adapter existem, mas a Sprint 20 precisa formalizar spec, boundary, observabilidade, RAG/MCP governados e UX real.

Recomendacao objetiva: iniciar a proxima branch/fase como `fase-14a-runtime-contract-agno`, comecando pelo contrato versionado e pelos criterios fail-closed antes de qualquer execucao produtiva.
