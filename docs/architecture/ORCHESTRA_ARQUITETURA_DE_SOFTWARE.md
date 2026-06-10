# Orchestra - Arquitetura De Software

Status: arquitetura operacional consolidada para orientar implementacao futura.

Este documento define a arquitetura alvo do Orchestra sem implementar backend, banco de dados, autenticacao real, integracoes reais ou runtime de IA. O objetivo e separar o estado atual observado da arquitetura recomendada para as proximas fases.

## 1. Sumario Executivo

Orchestra e uma plataforma corporativa para criacao, configuracao, publicacao, uso, governanca e auditoria de assistentes de IA.

Estado atual:

- Frontend React/Vite existente em `/frontend`.
- Experiencia visual baseada em mocks controlados por `VITE_USE_MOCKS`.
- Rotas principais em `/app/*`.
- Tipos, services, hooks e paginas ja representam parte importante do dominio.
- Backend real, banco real, autenticacao real, RAG real, MCP real, providers reais e runtime real ainda nao existem.

Arquitetura alvo:

- Orchestra atua como control plane corporativo.
- Backend/API e a autoridade de configuracao, permissao, auditoria, contratos e persistencia.
- Runtime de IA e um servico separado responsavel por execucao de agent runs, chamadas de modelo, RAG, tool calls, streaming e traces.
- Frontend entrega a experiencia visual, wizard, chat, dashboards, configuracao e governanca, sempre consumindo contratos do backend.

Decisoes centrais assumidas:

- Control plane e runtime devem ser separados desde a arquitetura.
- Backend deve ser fonte de verdade para usuarios, permissoes, publicacao, versionamento, auditoria e governanca.
- PostgreSQL + Prisma sao a base recomendada para persistencia inicial.
- REST + JSON atendem gestao e configuracao; SSE atende streaming inicial de IA.
- `tenant_id` e `workspace_id` devem existir desde o MVP.
- Secrets, prompts sensiveis, RAG, tools e providers devem ficar server-side.

Esta arquitetura habilita:

- Fase 04 - Backend/API/Banco Foundation.
- Fase 05 - Core Domain do Orchestra.
- Fase 06 - Knowledge/RAG/MCP Catalog.
- Fase 07 - Runtime/IA Integration Boundary.
- Fase 08 - Integracoes reais controladas.

## 2. Estado Atual Observado

| Area | Status | Evidencia | Leitura Arquitetural |
|---|---|---|---|
| Frontend React/Vite | confirmado | `/frontend`, `package.json`, `vite.config.ts` | Base visual e tecnica existente. |
| Porta Vite 5173 | confirmado | `vite.config.ts` | Dev local padronizado. |
| Rotas `/app/*` | confirmado | `src/App.tsx` | Area autenticada visualmente agrupada. |
| Redirects legados | confirmado | `LegacyRedirect` em `src/App.tsx` | Compatibilidade visual temporaria. |
| Services por dominio | confirmado | `src/services/*.service.ts` | Preparados para migrar de mock para HTTP. |
| Hooks TanStack Query | confirmado | `src/hooks/queries/*` | Boa base para cache, loading, empty e error states. |
| API client base | observado | `src/services/api/api-client.ts` | Existe, mas nao e usado enquanto mocks estiverem ligados. |
| Endpoints futuros | observado | `src/services/api/endpoints.ts` | Catalogo inicial util para contratos de API. |
| Assistentes | observado | paginas, tipos e mocks | Dominio mais maduro visualmente. |
| Assistant versions | observado | detalhe de assistente e hooks | Requer imutabilidade e auditoria no backend. |
| Knowledge bases | observado | paginas Knowledge | RAG real ainda ausente. |
| MCP servers/tools | observado | paginas MCP | Catalogo visual existe; execucao real ausente. |
| Chat | observado | `ChatPage`, componentes de IA | Streaming, RAG e tools sao simulados. |
| Audit e analytics | observado | paginas Audit/Analytics | Dados mockados; fonte real futura. |
| Auth real | pendente | `ProtectedRoute` simbolico | Backend/IdP ainda nao implementados. |
| Banco real | pendente | sem schema/migrations | Modelagem sera definida a partir desta arquitetura. |
| Runtime de IA real | pendente | sem integracao real | Deve ser servico separado. |
| SSO real | pendente | login visual | Microsoft SSO/OIDC e alvo de producao. |
| Multi-tenancy | inferido | stubs de workspace/admin | Deve ser previsto desde o MVP. |
| CI/CD real | fora do escopo desta fase | sem pipeline criado nesta fase | Deve ser documentado antes de implementar. |

## 3. Objetivos Arquiteturais

- Separar control plane e runtime de IA.
- Garantir backend como autoridade de usuarios, permissoes, configuracoes, publicacao e auditoria.
- Preparar multi-tenancy desde o inicio, ainda que o MVP comece com um tenant.
- Suportar workspaces, ownership e compartilhamento.
- Suportar versionamento de assistentes, prompts compilados e publicacoes.
- Suportar RAG, MCP e tools de forma governada.
- Suportar auditoria, metricas, custos e rastreabilidade.
- Evitar secrets no frontend.
- Permitir evolucao incremental service-by-service.
- Manter deploy e operacao simples no MVP.
- Evitar overengineering prematuro.
- Permitir evolucao futura para filas, workers, vector store, tracing distribuido e avaliacoes de IA.

## 4. Principios De Arquitetura

- Modularidade por dominio.
- Separacao clara de responsabilidades.
- Seguranca por padrao.
- Menor privilegio.
- Backend como fonte de verdade.
- Contratos explicitos entre frontend, backend e runtime.
- Versionamento de recursos criticos.
- Rastreabilidade ponta a ponta.
- Documentacao viva e versionada.
- Infraestrutura simples antes de complexidade.
- Observabilidade desde o primeiro backend real.
- Evolucao progressiva para workers, filas, vector store, tracing e evals apenas quando houver necessidade confirmada.

## 5. Visao Macro Da Arquitetura

Camadas alvo:

- Frontend Web.
- Backend/API Control Plane.
- Banco de Dados PostgreSQL.
- Runtime de IA / Agent Runtime.
- Providers externos.
- MCP servers/tools.
- Knowledge/RAG pipeline.
- Observabilidade/Metricas.
- Infraestrutura/Deploy.

Diagrama textual:

```txt
[Usuario]
   |
   v
[Frontend React/Vite]
   |
   | REST / SSE
   v
[Backend Control Plane]
   |-- [PostgreSQL]
   |-- [Audit Logs / Technical Logs / Metrics]
   |-- [LLM Providers]
   |-- [Embedding Provider / Vector Store]
   |-- [MCP Servers / Tools]
   |-- [AI Runtime / Agent Runtime]
   `-- [External Integrations]
```

Regra de leitura: o frontend nunca deve chamar diretamente provider de IA, vector store, MCP server ou runtime quando houver segredo, dado protegido, prompt sensivel, RAG ou tool envolvida.

## 6. Separacao Control Plane Vs Runtime

### Control Plane - Responsabilidade Do Orchestra

O control plane e o produto Orchestra propriamente dito. Ele controla:

- Usuarios.
- Autenticacao e sessao.
- Tenants.
- Workspaces.
- Roles e permissoes.
- Assistentes.
- Versoes de assistentes.
- Wizard e configuracao.
- Publication workflow.
- Sharing.
- Bases de conhecimento.
- Catalogo de MCP/tools.
- Politicas de aprovacao.
- Auditoria.
- Metricas.
- Governanca.
- Custos.
- Limites.
- Configuracoes de providers.
- Contratos API.

### Runtime - Responsabilidade De Servico Executor

O runtime de IA executa:

- Agent runs.
- Model calls.
- Tool calls.
- RAG retrieval.
- Streaming de resposta.
- Workflows.
- Runtime policies.
- Traces.
- Coleta de latencia e tokens.
- Retorno de eventos para o backend.

### Regra Obrigatoria

O runtime nao deve ser fonte de verdade para permissoes, usuarios, publicacao, versionamento ou governanca.

O backend/control plane deve autorizar, persistir e auditar operacoes. O runtime executa sob contexto autorizado e deve retornar eventos correlacionados ao backend.

## 7. Stack Tecnica Recomendada

### Frontend

- React.
- Vite.
- TypeScript.
- React Router.
- TanStack Query.
- Tailwind CSS e shadcn/ui.
- Axios ou fetch client centralizado.
- Vitest e Testing Library.
- Playwright apenas para fluxos criticos.

### Backend

- Node.js.
- TypeScript.
- Fastify recomendado para API, performance e schemas; Express e aceitavel se a equipe priorizar familiaridade.
- Prisma.
- PostgreSQL.
- Zod para validacao de input e env.
- Pino + pino-http.
- Vitest + Supertest.
- OpenAPI quando aplicavel.
- Microsoft SSO/OIDC em producao.
- Cookie HttpOnly para sessao web.

### Banco

- PostgreSQL.
- Prisma migrations.
- Tabelas em `snake_case`.
- Models Prisma em `PascalCase`.
- IDs ULID recomendados para ordenacao aproximada por tempo e boa legibilidade operacional. UUID tambem e aceitavel se a equipe preferir padrao mais comum.
- `created_at`, `updated_at`, `deleted_at` quando aplicavel.
- Soft delete para recursos de dominio que tenham auditoria ou historico.
- Audit logs append-only.
- Indices para `tenant_id`, `workspace_id`, `status`, `created_at` e relacionamentos criticos.

### Infraestrutura

- Docker.
- Docker Compose.
- Coolify.
- Traefik.
- `frontend` na porta 5173 em dev.
- `backend` na porta 3000.
- `db` como service name do PostgreSQL.
- `env_file` por servico.
- `COMPOSE_PROJECT_NAME`.
- Sem `container_name`.
- Healthchecks para frontend, backend e db.

### IA/Runtime

- Runtime externo ou servico separado.
- Integracao server-side.
- SSE para streaming inicial.
- Filas/workers apenas quando necessario.
- Vector store definido em fase posterior.
- MCP servers internos/externos como catalogo governado.

## 8. Estrutura De Repositorio Alvo

```txt
/
|-- frontend/
|-- backend/
|   |-- src/
|   |   |-- app/
|   |   |-- config/
|   |   |-- modules/
|   |   |-- infrastructure/
|   |   |-- shared/
|   |   `-- server.ts
|   |-- prisma/
|   |   `-- schema.prisma
|   |-- tests/
|   |-- Dockerfile.dev
|   |-- Dockerfile.prod
|   |-- .env.example
|   `-- .dockerignore
|-- docs/
|-- docker-compose.dev.yml
|-- docker-compose.prod.yml
|-- .env.example
|-- .gitignore
`-- README.md
```

Modulos backend propostos:

```txt
auth
users
tenants
workspaces
roles
permissions
assistants
assistant-versions
assistant-sharing
assistant-publications
knowledge-bases
knowledge-documents
mcp-servers
mcp-tools
conversations
messages
agent-runs
tool-calls
approvals
feedback
audit
metrics
integrations
settings
```

Diretriz: criar a estrutura apenas na fase de backend. Esta fase documenta a estrutura, mas nao cria implementation files.

## 9. Dominios E Entidades Arquiteturais

### 9.1 Identidade E Governanca

Entidades candidatas:

- Tenant.
- Workspace.
- User.
- Role.
- Permission.
- Session.
- Invite.
- UserWorkspaceMembership.

Finalidade: controlar organizacao, areas, usuarios, sessoes, roles e escopos de acesso.

Fonte provavel dos dados: IdP corporativo, cadastro administrativo, convites e configuracao interna.

Relacao com backend: dominio essencial e autoridade de autorizacao.

Relacao com banco: persistencia transacional, indices por tenant/workspace/user.

Relacao com runtime: runtime recebe apenas contexto autorizado, nunca decide permissao final.

Riscos: permissao apenas no frontend, vazamento entre workspaces, sessoes inseguras.

Fase sugerida: Fase 04 para base auth/session; Fase 05 para RBAC/workspaces.

### 9.2 Assistentes

Entidades candidatas:

- Assistant.
- AssistantVersion.
- AssistantPublication.
- AssistantShare.
- AssistantWizardDraft.
- PromptCompiled.
- AssistantFeedback.
- AssistantTestResult.

Finalidade: configurar, versionar, publicar, compartilhar e avaliar assistentes.

Fonte provavel dos dados: wizard, acoes de publicacao, testes, feedback e revisoes.

Relacao com backend: core domain do Orchestra.

Relacao com banco: versionamento imutavel, publicacoes auditaveis e snapshots de prompt.

Relacao com runtime: backend envia ao runtime a versao publicada e autorizada do assistente.

Riscos: prompt sem versionamento, publicacao sem workflow, rollback impossivel, feedback sem contexto.

Fase sugerida: Fase 05.

### 9.3 Conhecimento/RAG

Entidades candidatas:

- KnowledgeBase.
- KnowledgeDocument.
- KnowledgeChunk.
- Embedding.
- DataSource.
- Connector.
- DataClassification.
- RetentionPolicy.

Finalidade: governar fontes, documentos, chunks, embeddings, classificacao e retencao.

Fonte provavel dos dados: uploads, conectores, importacoes e pipelines de processamento.

Relacao com backend: cadastro, permissoes, status de ingestao, metadados e auditoria.

Relacao com banco: documentos, chunks, metadados e referencia para embeddings/vector store.

Relacao com runtime: runtime solicita retrieval sob contexto autorizado e retorna fontes.

Riscos: vazamento de dados, embedding sem versionamento, fontes sem ACL, reindexacao inconsistente.

Fase sugerida: Fase 06 para catalogo; Fase 08 para integracoes reais.

### 9.4 MCP/Tools

Entidades candidatas:

- McpServer.
- McpTool.
- McpResource.
- McpPrompt.
- McpBinding.
- ToolExecutionLog.
- ToolApprovalPolicy.
- ApprovalRequest.

Finalidade: governar catalogo, permissoes, riscos, bindings e execucao auditada de tools.

Fonte provavel dos dados: cadastro manual, discovery, runtime events e politicas administrativas.

Relacao com backend: cadastro e autorizacao de uso por assistant/workspace.

Relacao com banco: catalogo, bindings, policies, approvals e logs append-only.

Relacao com runtime: runtime executa tool apenas quando backend autoriza e retorna eventos.

Riscos: tool abuse, segredo exposto, tool sensivel sem aprovacao, payload em log.

Fase sugerida: Fase 06 para catalogo; Fase 07/08 para execucao real.

### 9.5 Conversas/Runtime

Entidades candidatas:

- Conversation.
- ConversationMessage.
- MessagePart.
- AgentRun.
- RuntimeEvent.
- RagRetrieval.
- RagSource.
- ModelCall.
- ModelFallback.
- ToolCall.

Finalidade: persistir conversas, mensagens, execucoes, fontes, chamadas de modelo, eventos e falhas.

Fonte provavel dos dados: chat frontend, backend, runtime e providers.

Relacao com backend: cria contexto, autoriza, persiste mensagens e emite SSE.

Relacao com banco: conversas e mensagens append-only, eventos correlacionados por run.

Relacao com runtime: runtime executa e reporta eventos.

Riscos: perda de streaming, duplicidade por retry, traces com dados sensiveis, custo sem correlacao.

Fase sugerida: Fase 07.

### 9.6 Auditoria, Metricas E Custos

Entidades candidatas:

- AuditLog.
- UsageMetric.
- ProviderUsageCost.
- TokenUsage.
- EvalDataset.
- EvalRun.
- EvalResult.
- GuardrailEvent.
- SecurityEvent.

Finalidade: rastrear acoes, uso, qualidade, custo, seguranca e governanca.

Fonte provavel dos dados: backend, runtime, providers, eventos de seguranca, feedback e pipelines de agregacao.

Relacao com backend: audit log e metricas de negocio sao gerados no control plane.

Relacao com banco: audit append-only; metricas podem ser agregadas/materializadas.

Relacao com runtime: runtime fornece eventos tecnicos, tokens, latencia, fallback e traces.

Riscos: metricas sem fonte real, logs com dados sensiveis, custo subestimado.

Fase sugerida: Fase 04 para base de logs; Fase 07/08 para metricas de IA.

## 10. Multi-Tenancy E Workspaces

Estrategia minima:

- `tenant_id` desde o inicio em entidades de dominio.
- Tenant inicial representando a organizacao atual.
- Workspaces representam areas, departamentos ou unidades operacionais.
- Usuario pode pertencer a multiplos workspaces.
- Assistant pertence a um workspace.
- Compartilhamento pode ocorrer por usuario, workspace, grupo/role ou organizacao.
- Knowledge bases podem ser globais ou restritas.
- MCP/tools podem ser globais ou restritas.
- Queries e policies devem respeitar tenant/workspace.

Mesmo que o MVP comece com um unico tenant, isolamento multi-tenant e uma preocupacao arquitetural desde o inicio. Isso reduz retrabalho e evita que permissoes sejam tratadas como detalhe tardio.

Diretriz de implementacao futura:

- Todo repository/service de dominio deve receber contexto com `tenantId`, `workspaceId` quando aplicavel e `userId`.
- Endpoints devem filtrar por tenant/workspace no backend.
- Auditoria deve registrar tenant/workspace quando houver escopo.

## 11. Autenticacao, Sessao E Autorizacao

Alvo:

- Microsoft SSO/OIDC em producao.
- Cookie HttpOnly como padrao preferencial para sessao web.
- Backend como autoridade final.
- Frontend apenas oculta ou mostra acoes por UX.
- RBAC + ABAC quando aplicavel.
- Policies no backend.
- Permissoes por endpoint e acao.
- Ownership e workspace scope.
- CSRF a avaliar quando cookies forem usados.
- Rate limit em rotas sensiveis.

Perfis iniciais sugeridos:

- Admin Platform.
- Creator/Owner.
- Editor.
- Consumer.
- Auditor/Compliance.

Regras:

- Autorizacao nunca deve depender apenas de `PermissionGate` no frontend.
- Sessoes devem ser revogaveis.
- Login, logout, falha de login, troca de role e alteracao de permissao devem gerar audit log.

## 12. APIs E Contratos

Padroes:

- Base path `/api/v1`.
- REST + JSON para gestao/configuracao.
- camelCase nos payloads.
- Paginacao server-side.
- Filtros e ordenacao explicitos.
- Erro estruturado com `requestId`.
- Status codes consistentes.
- Endpoints protegidos por auth/permissions.
- OpenAPI quando aplicavel.

Contrato de erro recomendado:

```json
{
  "status": 422,
  "code": "VALIDATION_ERROR",
  "message": "Existem campos invalidos.",
  "fieldErrors": [
    {
      "field": "name",
      "message": "Campo obrigatorio."
    }
  ],
  "requestId": "req_xxx"
}
```

Padrao de lista recomendado:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0
  },
  "requestId": "req_xxx"
}
```

## 13. Streaming E Eventos De IA

O chat/runtime deve usar inicialmente SSE para streaming, salvo decisao contraria posterior.

Eventos minimos:

```txt
run.started
message.delta
sources.retrieved
tool.started
tool.completed
tool.failed
approval.required
model.fallback
message.completed
run.failed
run.completed
```

Todo evento deve carregar correlacao quando aplicavel:

```txt
requestId
traceId
conversationId
messageId
agentRunId
toolCallId
ragRetrievalId
```

Regra: o backend deve mediar o stream para aplicar autorizacao, registrar auditoria e evitar exposicao direta de segredo ou runtime interno ao frontend.

## 14. RAG E Bases De Conhecimento

Arquitetura alvo:

- Upload/importacao de documentos.
- Processamento assincrono futuro.
- Chunks.
- Embeddings.
- Indexacao.
- Metadados.
- Classificacao de dados.
- ACL por tenant/workspace.
- RAG respeitando permissoes.
- Citations/sources no chat.
- Retencao.
- Reindexacao.
- Avaliacao de qualidade.

Fases:

- Fase 06: catalogo, entidades, status e metadados.
- Fase 07: eventos de retrieval e sources no runtime boundary.
- Fase 08: embeddings, vector store e pipelines reais.

Nesta fase, RAG real nao deve ser implementado.

## 15. MCP E Tools

Arquitetura alvo:

- Catalogo de MCP servers.
- Tools descobertas ou cadastradas.
- Recursos/prompts MCP quando aplicavel.
- Allowlist de tools.
- Permissoes por tool.
- Policies por workspace/assistant.
- Human-in-the-loop para tools sensiveis.
- Logs seguros.
- Auditoria.
- Sandbox/test mode.
- Separacao entre configuracao e execucao.

Regras:

- Cadastro e binding sao responsabilidades do control plane.
- Execucao e responsabilidade do runtime, sob autorizacao do backend.
- Tools sensiveis devem exigir policy e possivelmente aprovacao humana.
- Payloads de tool devem ser redigidos em logs quando contiverem dado sensivel.

## 16. Integracoes Externas

| Tipo | Finalidade | Fluxo | Credencial | Onde Fica O Secret | Risco | Fallback | Observabilidade | Sandbox | Fase |
|---|---|---|---|---|---|---|---|---|---|
| OpenAI | Model calls | backend/runtime -> provider | API key | backend/ambiente seguro | custo, vazamento, indisponibilidade | provider alternativo | latencia, tokens, erro | sim | 08 |
| Anthropic | Model calls | backend/runtime -> provider | API key | backend/ambiente seguro | custo, indisponibilidade | provider alternativo | latencia, tokens, erro | sim | 08 |
| Microsoft Entra ID/OIDC | identidade | browser/backend/IdP | client secret/cert | backend/ambiente seguro | auth incorreta | login indisponivel controlado | login events | ambiente dev | 04/05 |
| Agno/agent runtime | execucao de agents | backend -> runtime | service token | backend/ambiente seguro | falha de execucao | retry/fallback | traceId, run events | sim | 07 |
| MCP servers | tools/recursos | runtime -> MCP | token por server | backend/vault | tool abuse | disable tool/server | tool logs | sim | 06/08 |
| Embedding provider | embeddings | worker/runtime -> provider | API key | backend/ambiente seguro | custo, dados sensiveis | fila/retry | tokens, latencia | sim | 08 |
| Vector store | retrieval | backend/worker/runtime -> store | connection secret | backend/ambiente seguro | leakage, inconsistencia | fallback sem RAG | hit rate, erros | sim | 08 |
| Observability/eval provider | traces/evals | backend/runtime -> provider | API key | backend/ambiente seguro | dados sensiveis em traces | local logs | trace/export status | sim | futuro |
| Webhooks | eventos externos | backend -> externo ou externo -> backend | secret assinador | backend/ambiente seguro | spoofing/replay | retry/DLQ futura | delivery status | sim | futuro |

Regra: providers de IA, embeddings, MCP, vector store e runtime nunca devem ser chamados diretamente pelo frontend quando envolverem segredo, prompt sensivel, RAG, tool ou dado protegido.

## 17. Seguranca E Compliance

Controles arquiteturais:

- Dados sensiveis devem ser classificados.
- Prompts, respostas, embeddings, tool payloads e traces devem ser tratados como potencialmente sensiveis.
- Secrets apenas no backend ou ambiente seguro.
- Logs sem dados sensiveis.
- Masking de prompts, respostas e traces quando necessario.
- Protecao contra prompt injection.
- Protecao contra RAG leakage.
- Protecao contra tool abuse.
- Approval para tools sensiveis.
- Audit log para acoes criticas.
- Retencao de conversas e traces.
- Hard delete restrito.
- Anonimizacao quando aplicavel.
- Incident response para IA e integracoes.

Eventos criticos para audit log:

- Login/logout.
- Alteracao de permissao.
- Criacao/edicao/publicacao de assistant.
- Alteracao de knowledge base.
- Binding de tool/MCP.
- Execucao de tool sensivel.
- Aprovacao/rejeicao humana.
- Alteracao de provider/model policy.
- Exportacao de dados.

## 18. Observabilidade

Padroes:

- Pino + pino-http no backend.
- Logs em stdout/stderr.
- `requestId` obrigatorio.
- `traceId` quando houver multiplos servicos.
- Healthcheck frontend/backend/db.
- Audit logs separados de logs tecnicos.
- Eventos de seguranca.
- Eventos de deploy/runtime.
- Metricas de agent runs.
- Metricas de RAG.
- Metricas de tool calls.
- Metricas de token usage/custos.
- Runbooks futuros.

Metricas minimas de IA:

```txt
agent_run_count
agent_run_failure_rate
model_latency_p95
rag_hit_rate
tool_success_rate
tool_failure_rate
fallback_rate
token_usage
cost_estimate
eval_score
feedback_positive_rate
feedback_negative_rate
```

## 19. Metricas E Dashboards

Dashboards alvo:

- Dashboard tecnico.
- Dashboard executivo.
- Dashboard de uso por workspace/area.
- Dashboard de IA orquestrada.
- Dashboard de integracoes/providers.
- Dashboard de qualidade/release.
- Dashboard de seguranca/governanca.

Perguntas que as metricas devem responder:

- Os assistentes estao sendo usados?
- Quais areas usam mais?
- Quais agents custam mais?
- A qualidade das respostas esta boa?
- Ha falhas recorrentes em tools/MCP?
- O RAG esta retornando fontes uteis?
- O custo por run esta sustentavel?
- As releases estao aumentando incidentes?

Regra: toda metrica deve apoiar uma decisao. Evitar metricas de vaidade.

## 20. Testes E Qualidade

Estrategia alvo:

- Vitest no frontend e backend.
- Testing Library para componentes.
- Supertest para backend/API.
- Playwright para E2E dos fluxos criticos.
- Testes de contrato.
- Testes de RBAC/ABAC.
- Testes de auth/sessao.
- Testes de banco/repositories.
- Smoke pos-deploy.
- Evals de IA.
- Golden datasets.
- Red teaming minimo.
- Testes de prompt injection.
- Testes de RAG leakage.
- Testes de tool abuse.
- Testes de custos/latencia.

Regra: resposta HTTP 200 nao valida qualidade de IA. Runs de IA devem ser avaliados por criterios de qualidade, fontes, seguranca, custo e rastreabilidade.

## 21. CI/CD E Release

Estrategia alvo:

- GitHub.
- Coolify.
- Docker.
- `npm ci` no pipeline.
- `package-lock.json`.
- `npx prisma generate`.
- `npx prisma migrate deploy`.
- lint/typecheck/test/build.
- Validacao Docker Compose.
- Migrations controladas.
- Smoke pos-deploy.
- Rollback separado para app e banco.
- Release rastreavel por commit.
- Versionamento de agents/prompts/RAG index/eval dataset quando aplicavel.

Esta fase nao cria pipeline. Apenas define diretrizes.

## 22. Infraestrutura

Servicos do MVP inicial:

```txt
frontend
backend
db
```

Possiveis servicos futuros:

```txt
redis
worker
ai-worker
vector-store
mcp-server
ai-tracing
```

Regra: nao adicionar Redis, worker, vector store ou MCP server sem justificativa arquitetural e fase clara.

Diretrizes:

- Docker Compose dev/prod.
- Healthchecks.
- Backups.
- Restore documentado.
- Coolify.
- Traefik.
- `.env.example` por servico.
- `.dockerignore`.
- Sem `container_name`.
- `COMPOSE_PROJECT_NAME`.
- Banco nao exposto em producao.

## 23. Fluxos Arquiteturais Obrigatorios

### 23.1 Login E Sessao

1. Usuario acessa frontend.
2. Frontend redireciona para login quando nao ha sessao valida.
3. Backend inicia fluxo OIDC.
4. IdP autentica usuario.
5. Backend valida callback.
6. Backend cria sessao segura com cookie HttpOnly.
7. Backend registra audit log de login.
8. Frontend consulta `/api/v1/auth/me`.

### 23.2 Bootstrap Do Usuario Logado

1. Frontend chama `/api/v1/auth/me`.
2. Backend carrega usuario, tenant, workspaces e permissoes.
3. Backend retorna dados seguros para UI.
4. Frontend monta navegacao e gates visuais.

### 23.3 Listagem De Assistentes Disponiveis

1. Frontend chama `/api/v1/assistants`.
2. Backend aplica tenant, workspace e permissoes.
3. Backend pagina e ordena.
4. Frontend exibe cards/tabela com estados de query.

### 23.4 Criacao De Assistente Via Wizard

1. Usuario inicia wizard.
2. Frontend salva draft futuro.
3. Backend valida campos com schema.
4. Backend persiste `AssistantWizardDraft`.
5. Usuario conclui.
6. Backend cria `Assistant` em draft e registra audit log.

### 23.5 Teste De Assistente Antes Da Publicacao

1. Usuario dispara teste.
2. Backend valida permissao.
3. Backend cria `AssistantTestResult` ou `AgentRun` de teste.
4. Runtime executa sob contexto controlado.
5. Backend registra resultado, tokens, latencia e fontes.

### 23.6 Publicacao E Versionamento

1. Usuario solicita publicacao.
2. Backend valida permissao e estado.
3. Backend cria `AssistantVersion` imutavel.
4. Backend cria `AssistantPublication`.
5. Backend registra audit log.
6. Versao publicada fica disponivel para chat.

### 23.7 Compartilhamento Por Workspace/Usuario

1. Owner define escopo de compartilhamento.
2. Backend valida ownership e policy.
3. Backend cria `AssistantShare`.
4. Queries futuras passam a considerar esse share.

### 23.8 Upload/Importacao De Documento

1. Usuario envia ou conecta documento.
2. Backend valida permissao e classificacao.
3. Backend cria `KnowledgeDocument` com status `pending`.
4. Pipeline futuro processa conteudo.

### 23.9 Processamento Futuro De RAG

1. Worker futuro busca documento pendente.
2. Texto e extraido e segmentado em chunks.
3. Embeddings sao gerados server-side.
4. Indice e atualizado.
5. Status muda para `completed` ou `failed`.
6. Audit/log tecnico registra resultado.

### 23.10 Chat Com Assistente

1. Usuario abre conversa.
2. Frontend envia mensagem para backend.
3. Backend valida acesso ao assistant publicado.
4. Backend cria `ConversationMessage` do usuario.
5. Backend inicia `AgentRun`.
6. Runtime executa e retorna eventos.

### 23.11 Streaming Via SSE

1. Frontend abre stream SSE.
2. Backend emite `run.started`.
3. Backend emite `message.delta`.
4. Backend emite eventos de source/tool/fallback.
5. Backend encerra com `run.completed` ou `run.failed`.

### 23.12 Recuperacao De Fontes RAG

1. Runtime solicita retrieval.
2. Backend/runtime aplica filtros de tenant/workspace.
3. Retrieval retorna chunks autorizados.
4. Backend registra `RagRetrieval`.
5. Fontes aparecem como citations no chat.

### 23.13 Execucao De Tool/MCP

1. Runtime solicita tool.
2. Backend valida binding, policy e permissao.
3. Se permitido, runtime executa tool.
4. Backend registra `ToolCall` e `ToolExecutionLog`.

### 23.14 Aprovacao Humana Para Tool Sensivel

1. Tool requer aprovacao.
2. Backend cria `ApprovalRequest`.
3. Frontend exibe pendencia ao aprovador.
4. Aprovador aprova ou rejeita.
5. Backend registra decisao.
6. Runtime continua ou aborta.

### 23.15 Feedback De Resposta

1. Usuario avalia mensagem.
2. Backend valida contexto.
3. Backend persiste feedback ligado a message/run/version.
4. Metricas agregam qualidade por assistant e versao.

### 23.16 Auditoria De Acao Critica

1. Backend identifica acao critica.
2. Backend grava audit log append-only.
3. Auditor visualiza em dashboard/filtros.

### 23.17 Metricas De Uso/Custo/Qualidade

1. Runtime retorna tokens, latencia, modelo e custo estimado.
2. Backend persiste eventos brutos.
3. Agregacao futura gera dashboards.

### 23.18 Falha De Provider E Fallback

1. Provider falha ou viola policy.
2. Runtime aciona fallback permitido.
3. Backend registra `model.fallback`.
4. Usuario ve badge de fallback seguro.
5. Metricas registram taxa de fallback.

### 23.19 Rollback De Agent/Prompt/Versionamento

1. Owner seleciona versao anterior.
2. Backend valida permissao.
3. Backend cria nova publicacao apontando para versao aprovada.
4. Backend registra audit log.
5. Conversas futuras usam a versao rollback.

## 24. Decisoes Arquiteturais

| ID | Decisao | Status | Justificativa | Impacto | Proxima Revisao |
|---|---|---|---|---|---|
| DEC-ARCH-001 | Orchestra como control plane e runtime de IA separado | decidida | Reduz acoplamento e preserva governanca corporativa | Define fronteiras de backend/runtime | Fase 07 |
| DEC-ARCH-002 | Backend como autoridade de permissoes e governanca | decidida | Frontend nao e camada de seguranca | Centraliza auth, RBAC, audit e policies | Fase 04/05 |
| DEC-ARCH-003 | PostgreSQL + Prisma como base de persistencia | recomendada | Stack produtiva, tipada e adequada ao MVP | Orienta modelagem e migrations futuras | Fase 04 |
| DEC-ARCH-004 | REST para gestao e SSE para streaming de IA | decidida | REST simplifica CRUD; SSE atende streaming inicial | Orienta API e chat runtime boundary | Fase 07 |
| DEC-ARCH-005 | `tenant_id` e `workspace_id` desde o MVP | decidida | Evita retrabalho de isolamento e permissao | Impacta todas as entidades de dominio | Fase 04/05 |
| DEC-ARCH-006 | Secrets de IA apenas no backend/ambiente seguro | decidida | Evita exposicao de credenciais e dados sensiveis | Proibe chamadas diretas do frontend a providers | Fase 08 |
| DEC-ARCH-007 | Publicacao de assistant via versionamento | decidida | Permite auditoria, rollback e reproducibilidade | Exige AssistantVersion e Publication | Fase 05 |
| DEC-ARCH-008 | Tool calls sensiveis com policy e aprovacao humana | recomendada | Reduz risco operacional | Exige ApprovalRequest e logs seguros | Fase 06/07 |
| DEC-ARCH-009 | Observabilidade de agent runs, RAG, tools, tokens e custos | recomendada | Necessaria para operacao e governanca | Define eventos e metricas minimas | Fase 07/08 |
| DEC-ARCH-010 | Infraestrutura inicial sem Redis/vector store ate necessidade confirmada | decidida | Evita overengineering no MVP | Mantem stack inicial simples | Fase 06/08 |

## 25. Riscos E Pendencias

| Risco | Impacto | Mitigacao | Fase Recomendada |
|---|---|---|---|
| Escopo amplo de IA | Atraso e complexidade | Separar control plane, catalogo e runtime em fases | 04-08 |
| Runtime ainda nao implementado | Chat permanece visual | Criar boundary claro antes da integracao | 07 |
| Ausencia de backend real | Frontend depende de mocks | Implementar foundation com contratos minimos | 04 |
| Modelagem de dados complexa | Retrabalho em permissoes e historico | Comecar por tenant/workspace/core domain | 04/05 |
| Seguranca de prompts/traces/tools | Vazamento de dados sensiveis | Redaction, policies, audit e server-side secrets | 07/08 |
| Custos variaveis de LLM | Surpresas financeiras | TokenUsage, cost_estimate e limites por workspace | 07/08 |
| Overengineering | Atraso do MVP | Nao adicionar filas/vector store sem necessidade confirmada | todas |
| RAG leakage | Exposicao indevida de fontes | ACL por tenant/workspace e retrieval autorizado | 06/08 |
| Tool abuse | Acao externa indevida | Allowlist, policy, aprovacao humana e audit | 06/08 |
| Metricas sem fonte real | Dashboards enganosos | Distinguir mock, evento bruto e metrica real | 04/07 |
| Frontend mockado confundido com produto pronto | Expectativa errada | Documentar limites e manter mocks explicitos | todas |

## 26. Handoff Para Proximas Fases

### Para Fase 04 - Backend/API/Banco Foundation

Entregar:

- Estrutura `/backend`.
- Fastify ou Express + TypeScript.
- Prisma.
- PostgreSQL.
- Zod.
- Pino.
- Healthcheck.
- Error handler.
- `requestId`.
- Envs.
- Dockerfiles.
- Docker Compose.
- Modulos base.
- Contratos iniciais.

### Para Fase 05 - Core Domain

Entregar:

- Tenants.
- Workspaces.
- Users.
- Roles.
- Permissions.
- Assistants.
- Assistant versions.
- Sharing.
- Publication.
- Audit.

### Para Fase 06 - Knowledge/RAG/MCP Catalog

Entregar:

- Knowledge bases.
- Documents.
- Chunks.
- Connector/data source.
- MCP servers.
- Tools.
- Bindings.
- Policies.

### Para Fase 07 - Runtime/IA Boundary

Entregar:

- Conversations.
- Messages.
- Agent runs.
- Runtime events.
- SSE.
- `traceId`.
- Model routing.
- Fallback.
- Tool calls.
- RAG retrieval events.

### Para Fase 08 - Integracoes Reais

Entregar:

- OpenAI/Anthropic.
- Agno/agent runtime.
- Embeddings.
- Vector store.
- MCP servers reais.
- Sandbox.
- Rate limit.
- Idempotencia.
- Observabilidade.
- Evals.
- Custos.

## 27. Checklist De Aceite Arquitetural

- Estado atual diferenciado da arquitetura alvo.
- Control plane e runtime separados.
- Backend definido como autoridade.
- Multi-tenancy/workspaces previstos desde o MVP.
- REST + SSE definidos como estrategia inicial.
- Secrets e providers mantidos server-side.
- Dominios e entidades candidatas mapeados.
- Riscos e pendencias registrados.
- Handoff por fase documentado.
- Nenhum backend, migration, endpoint real ou integracao real implementado nesta fase.
- Nenhum mock do frontend removido nesta fase.
- Nenhum secret real criado nesta fase.
