# Orchestra Observabilidade - Fechamento Sprint 16 / Fase 12

## 1. Objetivo da Sprint 16

A Sprint 16 / Fase 12 consolidou a fundacao backend de observabilidade de IA do Orchestra. O objetivo foi criar um control plane capaz de registrar eventos tecnicos de uso/custos, avaliar limites e quotas, expor leitura administrativa read-only e simular alertas governados sem ativar efeitos operacionais irreversiveis.

A sprint foi intencionalmente incremental e defensiva. Ela entregou schema, repositories, services, evaluators, API admin e documentacao, mas manteve fora de escopo frontend, dashboard, billing, delivery real de alertas, scheduler, enforcement produtivo, MCP remoto real e Agno/AgentOS produtivo.

## 2. Linha do tempo de entregas

### 12A - Fundacao de observabilidade/usage/costs

- Feature commit: `f9b966c feat(ai): add usage observability foundation`.
- Merge commit: `e740f3b Merge branch 'fase-12-observabilidade-custos-limites'`.
- Criou `AiRunUsageEvent` e `ai_run_usage_events`.
- Criou service/repository/tipos para registrar eventos normalizados de uso.
- Registrou tokens, latencia, status e custo estimado em minor units.
- Criou sanitizacao defensiva de metadata.
- Nao criou dashboard, limites, billing ou runtime produtivo.

### 12B - Limites e quotas de IA

- Feature commit: `725ad31 feat(ai-observability): add usage limits and quotas foundation`.
- Merge commit: `64f5712 Merge branch 'fase-12b-limites-quotas-ai'`.
- Criou `AiUsageLimitPolicy` e `ai_usage_limit_policies`.
- Criou evaluator read-only de limites/quotas baseado em `AiRunUsageEvent`.
- Suportou modos `monitor_only` e `enforce`.
- Nao plugou enforcement no runtime.

### 12C - API/admin read-only de observabilidade e limites

- Feature commit: `c3f606a feat(ai-observability): add admin read API`.
- Merge commit: `05d41d2 Merge branch 'fase-12c-ai-observability-admin-read-api'`.
- Criou API admin read-only em `/api/v1/ai-observability`.
- Expos usage events, usage summary, limit policies e limit evaluation.
- Usou `requireAuth` e `requirePermission('audit.read')`.
- Aplicou scoping por tenant/workspace e serializacao BigInt como string.
- Nao criou frontend/dashboard.

### 12D - Fundacao de alertas governados

- Feature commit: `b0f1955 feat(ai-observability): add governed alert rules foundation`.
- Merge commit: `60eeec2 Merge branch 'fase-12d-ai-observability-alerts-foundation'`.
- Criou `AiObservabilityAlertRule` e `ai_observability_alert_rules`.
- Criou evaluator read-only de alertas governados.
- Estendeu API admin com alert rules e alert evaluation.
- Nao criou delivery real, scheduler, worker, queue, frontend/dashboard, billing ou runtime enforcement.

### 12E - Fechamento/handoff da Sprint 16

- Fase docs-only.
- Consolida arquitetura, decisoes, riscos, limites de escopo, validacoes e backlog recomendado.
- Nao altera codigo, schema, runtime, Auth/SSO/RBAC, RAG, MCP ou frontend.

## 3. Arquitetura final entregue

Arquitetura logica entregue:

```txt
AiRunUsageEvent
  -> fonte de verdade para eventos tecnicos de uso/custos de IA

AiUsageLimitPolicy
  -> policies de limites/quotas por tenant/workspace/assistant/user

evaluateAiUsageLimits
  -> evaluator read-only de limites, com monitor_only/enforce apenas como decisao retornada

AiObservabilityAlertRule
  -> regras de alerta governadas por tenant/workspace/assistant/user

evaluateAiObservabilityAlerts
  -> evaluator read-only de alertas, sem envio real

/api/v1/ai-observability
  -> API admin read-only para eventos, summary, policies, limit evaluation,
     alert rules e alert evaluation
```

O backend e o control plane da observabilidade. Ele centraliza scoping, DTOs, sanitizacao, BigInt, queries agregadas e permissoes. O frontend nao chama provider diretamente e nao recebeu dashboard nesta sprint.

A observabilidade trabalha com IDs tecnicos, timestamps, contadores, status, latencia, custos estimados, provider/model/source/operation e metadata sanitizada. Nada nesta sprint executa MCP remoto real, integra Agno produtivo ou altera o Runtime Adapter.

## 4. Modelos/tabelas criados

### AiRunUsageEvent / ai_run_usage_events

Objetivo: registrar eventos tecnicos de uso, performance, status e custo estimado de execucoes de IA.

Campos principais:

- escopo: `tenantId`, `workspaceId`, `assistantId`, `userId`;
- correlacao: `runId`, `traceId`;
- origem: `source`, `operation`, `provider`, `model`;
- resultado: `status`, `blockedReason`, `errorCode`, `errorMessageHash`;
- uso: `inputTokens`, `outputTokens`, `totalTokens`, `embeddingTokens`, `cachedTokens`;
- performance: `latencyMs`, `startedAt`, `completedAt`, `createdAt`;
- custo estimado: `costCurrency`, `estimatedCostMinorUnits`;
- contexto seguro: `metadata` sanitizada.

Escopo: tenant e workspace obrigatorios; assistant/user opcionais para cobrir fluxos variados.

Soft delete: nao possui. Eventos sao fatos historicos; futuras politicas de retencao devem tratar volume/expurgo com plano proprio.

Constraints relevantes:

- allowlist de `source`;
- allowlist de `status`;
- tokens, latencia e custo nao negativos quando informados;
- hash de erro em formato SHA-256 hexadecimal quando persistido.

Indices relevantes em alto nivel:

- tenant/workspace/assistant/user;
- run/trace;
- source/operation/status;
- provider/model;
- startedAt/createdAt.

Riscos/limitacoes:

- ainda depende de instrumentacao completa dos fluxos oficiais;
- nao possui particionamento, retencao, rollup ou materialized view;
- custo e estimado, nao billing real.

### AiUsageLimitPolicy / ai_usage_limit_policies

Objetivo: modelar policies de limite/quota de IA e permitir avaliacao read-only contra agregados de `AiRunUsageEvent`.

Campos principais:

- escopo: `tenantId`, `workspaceId`, `assistantId`, `userId`, `scopeType`;
- regra: `metric`, `period`, `mode`, `status`, `limitValue`, `warnThresholdValue`;
- filtros opcionais: `source`, `operation`, `provider`, `model`;
- governanca: `description`, `metadata`, `createdByUserId`, `updatedByUserId`, timestamps;
- soft delete: `deletedAt`.

Escopo: `tenant`, `workspace`, `assistant` ou `user`, com CHECK de coerencia entre `scopeType` e o ID alvo.

Constraints relevantes:

- allowlists de escopo, metrica, periodo, modo e status;
- `limit_value > 0`;
- `warn_threshold_value` entre zero e o limite quando informado;
- coerencia de alvo por escopo.

Indices relevantes em alto nivel:

- tenant, status e deletedAt;
- workspace/assistant/user;
- metric/period/mode;
- source/operation/provider/model;
- createdAt.

Riscos/limitacoes:

- nao ha CRUD governado nesta sprint;
- `enforce` ainda e apenas decisao retornada, sem runtime enforcement;
- avaliacao agrega online e pode ficar cara em alto volume.

### AiObservabilityAlertRule / ai_observability_alert_rules

Objetivo: modelar regras de alerta governadas e permitir simulacao read-only de condicoes de alerta sobre `AiRunUsageEvent`.

Campos principais:

- escopo: `tenantId`, `workspaceId`, `assistantId`, `userId`, `scopeType`;
- condicao: `metric`, `period`, `operator`, `thresholdValue`, `severity`, `status`;
- filtros opcionais: `source`, `operation`, `provider`, `model`;
- governanca: `description`, `metadata`, `cooldownMinutes`, autores e timestamps;
- soft delete: `deletedAt`.

Escopo: `tenant`, `workspace`, `assistant` ou `user`, tambem com CHECK de coerencia de alvo.

Constraints relevantes:

- allowlists de escopo, metrica, periodo, operator, severity e status;
- `threshold_value >= 0`;
- `cooldown_minutes >= 0` quando informado;
- coerencia de alvo por escopo.

Indices relevantes em alto nivel:

- tenant, status e deletedAt;
- workspace/assistant/user;
- metric/period/operator/severity;
- source/operation/provider/model;
- createdAt.

Riscos/limitacoes:

- nao ha CRUD governado nesta sprint;
- `cooldownMinutes` e apenas dado modelado, sem scheduler;
- nao ha delivery real de alertas;
- avaliacao agrega online por regra.

## 5. Services, repositories e evaluators criados

### Usage observability

- `ai-observability.types.ts`: contratos de evento e repository.
- `ai-observability.service.ts`: normalizacao, defaults, hash de erro, custo BigInt e sanitizacao.
- `ai-observability.repository.ts`: persistencia Prisma de `AiRunUsageEvent`.
- `recordAiUsageEvent(input)`: API interna de codigo para registrar evento.

### Usage limits

- `ai-usage-limits.types.ts`: allowlists e contratos.
- `ai-usage-limits.repository.ts`: busca policies aplicaveis e agrega `ai_run_usage_events`.
- `ai-usage-limits.service.ts`: calcula janela UTC, normaliza projecao e avalia policies.
- `evaluateAiUsageLimits(input)`: evaluator read-only de limites.

### Admin observability

- `ai-observability-admin.repository.ts`: queries de eventos, summary, policies e rules.
- `ai-observability-admin.service.ts`: scoping, validacao de contexto e chamada dos evaluators.
- `ai-observability-admin.mapper.ts`: DTOs allowlist e serializacao de BigInt.
- `ai-observability-admin.schema.ts`: filtros/body Zod `.strict()`.
- `ai-observability.routes.ts`: rotas admin protegidas.

### Alert rules

- `ai-observability-alerts.types.ts`: allowlists e contratos.
- `ai-observability-alerts.repository.ts`: busca rules aplicaveis e agrega `ai_run_usage_events`.
- `ai-observability-alerts.service.ts`: calcula janela UTC, normaliza projecao, aplica `gt/gte/eq` e calcula `maxSeverity`.
- `evaluateAiObservabilityAlerts(input)`: evaluator read-only de alertas.

## 6. API admin criada

Base path: `/api/v1/ai-observability`.

Rotas atuais:

```txt
GET  /api/v1/ai-observability/usage-events
GET  /api/v1/ai-observability/usage-events/:id
GET  /api/v1/ai-observability/usage-summary
GET  /api/v1/ai-observability/limit-policies
GET  /api/v1/ai-observability/limit-policies/:id
POST /api/v1/ai-observability/limit-evaluation
GET  /api/v1/ai-observability/alert-rules
GET  /api/v1/ai-observability/alert-rules/:id
POST /api/v1/ai-observability/alert-evaluation
```

Todas usam:

- `requireAuth`;
- `requirePermission('audit.read')`.

`audit.read` foi reaproveitada por consistencia com 12C e por ja existir no RBAC. Ela deve ser considerada temporariamente ampla. Permissao futura recomendada: `ai.observability.read`.

As rotas `POST /limit-evaluation` e `POST /alert-evaluation` sao simulacoes read-only. Elas nao persistem decisao, nao criam usage event, nao alteram policy/rule, nao executam runtime, nao chamam provider e nao enviam alerta.

Nao ha CRUD de policies/rules e nao ha endpoint de envio de alerta.

## 7. Metricas suportadas

### Usage events

Eventos registram ou expõem:

- `inputTokens`;
- `outputTokens`;
- `totalTokens`;
- `embeddingTokens`;
- `cachedTokens`;
- `latencyMs`;
- `estimatedCostMinorUnits`;
- status `started`, `succeeded`, `failed`, `blocked`, `cancelled`.

### Limit policies

Metricas de limite:

```txt
run_count
total_tokens
input_tokens
output_tokens
embedding_tokens
cached_tokens
estimated_cost_minor_units
failed_run_count
blocked_run_count
```

### Alert rules

Metricas de alerta:

```txt
event_count
run_count
total_tokens
input_tokens
output_tokens
embedding_tokens
cached_tokens
estimated_cost_minor_units
avg_latency_ms
failed_run_count
blocked_run_count
```

Custos sao sempre tratados como minor units. Somas e contagens sao bigint-safe e o JSON serializa BigInt como string. `avg_latency_ms` e metrica tecnica de latencia, nao dinheiro.

## 8. Seguranca, privacidade e sanitizacao

A Sprint 16 evita persistir ou retornar:

```txt
prompt completo
response completa
rawDocuments
chunks completos
headers
Authorization
cookies
token
apiKey
password
secret
credential
secretRef
baseUrl
connection string
payload bruto
PII desnecessaria
```

Camadas de defesa entregues:

- `sanitizeAiUsageMetadata` remove chaves e textos sensiveis;
- DTOs sao allowlist;
- Prisma usa `select` explicito nas respostas admin;
- Zod `.strict()` rejeita campos arbitrarios;
- body de simulacao nao aceita `tenantId`, `metadata`, `prompt` ou `response`;
- BigInt nao e retornado cru;
- erro bruto vira hash quando registrado como evento;
- detalhes fora de escopo retornam 404;
- workspace fora de escopo retorna 403.

## 9. Scoping tenant/workspace

O tenant sempre vem da sessao autenticada (`req.user.tenant.id`). Queries e bodies nao podem escolher tenant arbitrario.

Workspaces permitidos sao derivados de `req.user.workspaces`:

- filtro `workspaceId` fora desse conjunto retorna 403 antes do repository;
- listagens usam tenant da sessao e workspaces permitidos;
- detalhes fora do tenant/workspace retornam 404;
- assistant/user em avaliacao sao validados contra tenant e workspace selecionado;
- policies/rules de assistant e user usam relacoes Prisma para garantir visibilidade dentro dos workspaces permitidos.

## 10. BigInt, custos e minor units

Dinheiro nao e modelado como float.

- `estimatedCostMinorUnits` em usage events e BigInt.
- `limitValue`, `warnThresholdValue`, uso atual, projecao e saldo sao BigInt nas policies.
- `thresholdValue`, uso atual, projecao e valor avaliado sao BigInt nas alert rules.
- Queries agregadas convertem somas/contagens para texto no PostgreSQL e depois para `bigint`.
- DTOs serializam BigInt como string.

A sprint nao calcula pricing real, nao consulta provider para preco, nao converte moeda, nao gera invoice e nao cobra cliente.

## 11. O que esta operacional

Esta operacional no backend:

- schema, migrations e models das tabelas 12A/12B/12D;
- repositories e services de observabilidade;
- evaluators read-only de limites e alertas;
- API admin read-only 12C/12D;
- filtros allowlist e schemas Zod estritos;
- scoping por tenant/workspace;
- serializacao BigInt como string;
- sanitizacao defensiva de metadata;
- testes unitarios, API e estruturais das fases;
- documentacao 12A, 12B, 12C, 12D e este handoff 12E;
- base tecnica para futura instrumentacao dos fluxos oficiais.

## 12. O que ainda NAO esta operacional

Ainda nao esta operacional:

- instrumentacao completa de todos os fluxos oficiais de LLM/RAG/MCP/runtime;
- dashboard frontend;
- CRUD governado de limit policies;
- CRUD governado de alert rules;
- delivery real de alertas;
- scheduler, worker ou fila;
- billing real;
- pricing table governada;
- calculo real por provider/model;
- export financeiro;
- avaliacao automatica de qualidade;
- test sets;
- enforcement produtivo no runtime;
- MCP remoto produtivo;
- Agno/AgentOS produtivo;
- timezone por tenant;
- cache, rollup ou materialized views para alto volume.

## 13. Fora de escopo confirmado

A Sprint 16 nao implementou:

- frontend/dashboard;
- billing;
- notificacoes reais;
- scheduler;
- runtime enforcement;
- MCP remoto real;
- Agno produtivo;
- qualidade/eval automatica;
- mudancas de SSO/Auth/RBAC;
- mudancas no RAG semantico;
- mudancas em Runtime Adapter.

## 14. Validacoes executadas por fase

### 12A

- Typecheck passou.
- Lint passou.
- Testes passaram.
- Build passou.
- `prisma validate` passou.
- `prisma generate` passou.
- `prisma migrate status` retornou P1001 por `db:5432`.
- Greps sem segredo real.

### 12B

- Typecheck passou.
- Lint passou.
- Testes passaram.
- Build passou.
- `prisma validate` passou.
- `prisma generate` passou.
- `prisma migrate status` retornou P1001 por `db:5432`.
- Greps sem segredo real.

### 12C

- Typecheck passou.
- Lint passou.
- Testes 283/283 passaram.
- Build passou.
- `prisma validate` passou.
- `prisma generate` passou.
- `prisma migrate status` retornou P1001 por `db:5432`.
- Greps sem segredo real.

### 12D

- Typecheck passou.
- Lint passou.
- Testes 325/325 passaram.
- Build passou.
- `prisma validate` passou.
- `prisma generate` passou.
- `prisma migrate status` retornou P1001 por `db:5432`.
- Greps sem segredo real.

P1001 foi limitacao de ambiente local sem o banco `db:5432` acessivel. Nenhum reset, drop de volume ou comando destrutivo foi executado.

## 15. Riscos remanescentes

- `audit.read` e permissao ampla para observabilidade.
- Summary online pode sofrer com alto volume.
- Ainda nao ha cache, rollup ou materialized views.
- Ainda nao ha retencao ou particionamento de eventos.
- Ainda nao ha pricing table real.
- Ainda nao ha timezone por tenant.
- Ainda nao ha CRUD governado para policies/rules.
- Ainda nao ha delivery real de alertas.
- Ainda nao ha enforcement produtivo.
- Cobertura sera incompleta enquanto os fluxos oficiais nao estiverem instrumentados.
- Alta cardinalidade por provider/model/operation pode afetar queries e dashboards futuros.
- Uma politica futura de retencao de eventos sera necessaria antes de alto volume produtivo.

## 16. Backlog recomendado

### P0/P1

- Instrumentar fluxos oficiais LLM/RAG/MCP/runtime para gravar `AiRunUsageEvent`.
- Criar permissao dedicada `ai.observability.read`.
- Criar CRUD governado para limit policies.
- Criar CRUD governado para alert rules.
- Criar pricing table governada por provider/model.

### P2

- Criar dashboard frontend read-only.
- Criar cache, rollup ou materialized views.
- Definir retencao e particionamento de eventos.
- Adicionar timezone por tenant.
- Criar export tecnico CSV/JSON sanitizado.

### P3

- Implementar delivery real de alertas com opt-in por tenant.
- Criar scheduler governado.
- Integrar Slack, Teams, email e webhook.
- Criar billing/report financeiro.

## 17. Proxima fase recomendada

Proxima fase recomendada:

```txt
13A - Avaliacao simples de qualidade e test sets
```

Tambem seria aceitavel uma fase intermediaria de dashboard/read-model se o produto exigir visualizacao antes de evals. Essa alternativa deve continuar read-only, sem billing e sem delivery real de alertas.

## 18. Checklist de handoff

- [x] Eventos de uso/custos modelados em `AiRunUsageEvent`.
- [x] Custo estimado em minor units, sem float.
- [x] Metadata sanitizada antes de persistir usage event.
- [x] Policies de limite/quota modeladas em `AiUsageLimitPolicy`.
- [x] Evaluator read-only de limites criado.
- [x] Regras de alerta modeladas em `AiObservabilityAlertRule`.
- [x] Evaluator read-only de alertas criado.
- [x] API admin read-only publicada em `/api/v1/ai-observability`.
- [x] API protegida por `requireAuth` e `audit.read`.
- [x] Scoping por tenant/workspace documentado e testado.
- [x] BigInt serializado como string.
- [x] DTOs allowlist e Zod strict usados na API.
- [x] Sem frontend/dashboard.
- [x] Sem billing.
- [x] Sem delivery real de alertas.
- [x] Sem scheduler/worker/queue.
- [x] Sem runtime enforcement.
- [x] Sem MCP remoto real.
- [x] Sem Agno produtivo.
- [x] Riscos remanescentes e backlog documentados.
