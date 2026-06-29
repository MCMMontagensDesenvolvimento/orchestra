# Orchestra Observabilidade - Alertas Governados 12D

## 1. Objetivo

A Fase 12D cria a fundacao backend para regras e simulacao de alertas de observabilidade de IA no Orchestra. Ela usa `AiRunUsageEvent`, criado na 12A, como fonte exclusiva de agregacao e segue a mesma linha governada da 12B e da 12C.

A entrega e backend-only e read-only do ponto de vista operacional: modela regras, agrega uso e avalia condicoes, mas nao envia notificacao real, nao cria scheduler produtivo e nao pluga decisoes no runtime.

## 2. Relacao com 12A, 12B e 12C

- 12A registra eventos tecnicos de uso, tokens, latencia, status e custo estimado em minor units.
- 12B adiciona policies de limite/quota e evaluator read-only sobre os eventos da 12A.
- 12C expoe API admin read-only para eventos, summaries, policies e simulacao de limites com `audit.read`.
- 12D adiciona regras de alerta e simulacao de alerta usando a mesma base de eventos e o mesmo padrao de DTOs/scoping.

## 3. Modelo de regra

O model `AiObservabilityAlertRule`, mapeado para `ai_observability_alert_rules`, armazena:

- escopo: `tenantId`, `workspaceId`, `assistantId`, `userId` e `scopeType`;
- condicao: `metric`, `period`, `operator`, `thresholdValue`, `severity` e `status`;
- filtros opcionais: `source`, `operation`, `provider` e `model`;
- governanca: `description`, `metadata`, `cooldownMinutes`, autores de criacao/atualizacao e timestamps;
- soft delete por `deletedAt`.

A migration `20260629210000_phase_12d_ai_observability_alert_rules` cria a tabela, FKs, indices e CHECK constraints. As constraints fecham allowlists, exigem `threshold_value >= 0`, validam `cooldown_minutes >= 0` quando informado e garantem coerencia entre `scope_type` e o alvo do escopo.

Nao existe backfill, drop de tabela, alteracao de dados existentes, delivery real ou tabela de notificacao.

## 4. Metricas suportadas

As regras podem avaliar:

- `event_count`: quantidade de eventos;
- `run_count`: quantidade de `runId` distintos;
- `total_tokens`;
- `input_tokens`;
- `output_tokens`;
- `embedding_tokens`;
- `cached_tokens`;
- `estimated_cost_minor_units`;
- `avg_latency_ms`;
- `failed_run_count`: `runId` distintos com status `failed`;
- `blocked_run_count`: `runId` distintos com status `blocked`.

Contagens, tokens e custo sao agregados no PostgreSQL como texto e convertidos diretamente para `bigint`. `estimated_cost_minor_units` continua em minor units e nunca passa por float. `avg_latency_ms` e uma metrica tecnica: a agregacao arredonda a media de latencia para inteiro em milissegundos antes de comparar com `thresholdValue`.

## 5. Escopos

Uma regra so e aplicavel quando pertence ao mesmo tenant, esta `active`, nao foi removida por soft delete e atende ao escopo:

- `tenant`: cobre eventos do tenant;
- `workspace`: exige o mesmo `workspaceId`;
- `assistant`: exige o mesmo `assistantId`;
- `user`: exige o mesmo `userId`.

Filtros opcionais de `source`, `operation`, `provider` e `model` funcionam como refinamentos exatos. Quando a regra define um filtro, o contexto de avaliacao precisa fornecer o mesmo valor.

Na API admin, `tenantId` vem exclusivamente da sessao. `workspaceId` fora dos workspaces permitidos retorna 403. Detalhes fora do escopo retornam 404.

## 6. Periodos UTC

O evaluator calcula janelas semiabertas `[inicio, fim)` usando `startedAt`:

- `minute`: inicio do minuto UTC;
- `hour`: inicio da hora UTC;
- `day`: 00:00 UTC;
- `month`: primeiro dia do mes em 00:00 UTC.

Timezone por tenant fica para fase posterior.

## 7. Operators e severidades

Operators:

- `gt`: dispara quando `evaluatedValue > thresholdValue`;
- `gte`: dispara quando `evaluatedValue >= thresholdValue`;
- `eq`: dispara quando `evaluatedValue === thresholdValue`.

Severidades:

- `info`;
- `warning`;
- `critical`.

O resultado geral usa `maxSeverity` considerando apenas decisoes disparadas.

## 8. Avaliacao read-only

A API interna de codigo e `evaluateAiObservabilityAlerts(input)`.

Para cada regra aplicavel, o evaluator:

1. calcula a janela UTC;
2. agrega o valor atual em `ai_run_usage_events`;
3. normaliza a projecao como `bigint`;
4. avalia `currentValue + projectedValue`;
5. compara com `thresholdValue`;
6. retorna decisoes normalizadas com janela, valores e motivo.

Sem regras aplicaveis, retorna `status: ok`, `triggered: false`, `maxSeverity: null` e `decisions: []`.

Quando `projectedUsage` e omitido, a projecao e zero para todas as metricas, incluindo `event_count`. `total_tokens` usa o valor explicito ou deriva input mais output.

A avaliacao nao persiste resultado, nao cria audit obrigatorio, nao registra usage event, nao altera regra, nao chama runtime, provider, MCP, rede externa ou scheduler.

## 9. API admin

Base path: `/api/v1/ai-observability`.

- `GET /alert-rules`: lista regras visiveis com filtros allowlist e paginacao.
- `GET /alert-rules/:id`: retorna detalhe sanitizado de uma regra nao removida.
- `POST /alert-evaluation`: simula `evaluateAiObservabilityAlerts` sem persistencia ou delivery.

Todas as rotas usam `requireAuth` e `requirePermission('audit.read')`, preservando a decisao da 12C e sem alterar seeds/RBAC.

Nao existem rotas `POST`, `PUT`, `PATCH` ou `DELETE` para `alert-rules`. A fase nao implementa CRUD de regras.

Sort permitido na listagem:

- `createdAt:desc`;
- `createdAt:asc`;
- `updatedAt:desc`;
- `updatedAt:asc`.

Sort por `severity` ficou fora desta fase para evitar uma ordenacao lexicografica enganosa; pode ser adicionado depois com uma ordem explicita `info < warning < critical`.

## 10. Seguranca e privacidade

DTOs usam selects Prisma explicitos e mappers allowlist. BigInts sao serializados como string. A listagem de regras nao seleciona nem retorna `metadata`. O detalhe retorna `metadata` sanitizada por `sanitizeAiUsageMetadata`.

Nao sao persistidos nem retornados:

- prompt completo;
- resposta completa;
- documentos RAG completos;
- chunks completos;
- headers;
- Authorization;
- cookies;
- token;
- apiKey;
- password;
- secret;
- credential;
- secretRef;
- baseUrl;
- connection string;
- payload bruto de request/response;
- PII desnecessaria.

Campos livres no body de simulacao sao rejeitados por Zod `.strict()`. A API nao aceita `tenantId`, `metadata`, `prompt`, `response` ou campos arbitrarios.

## 11. O que nao e enviado

A 12D nao implementa delivery real de:

- email;
- Slack;
- Teams;
- WhatsApp;
- webhook;
- SMS;
- push notification.

Nao ha chamada externa, fetch, provider LLM, scraping ou execucao MCP remota no fluxo de alertas.

## 12. Fora de escopo

Permanecem fora da 12D:

- frontend, dashboard visual e graficos;
- notificacoes reais;
- scheduler, worker, fila, cron ou automacao em background;
- billing, invoice, payment gateway e export financeiro;
- avaliacao automatica de qualidade e test sets;
- CRUD de alert rules;
- enforcement automatico no runtime;
- alteracao das policies de limite da 12B;
- execucao MCP remota e materializacao em `McpTool`;
- integracao Agno/AgentOS produtiva;
- alteracoes em SSO Microsoft, Auth base, RBAC global/seeds, RAG semantics ou Runtime Adapter.

## 13. Testes

Os testes unitarios cobrem ausencia de regras, escopos tenant/workspace/assistant/user, isolamento de tenant, filtros opcionais, janelas UTC, operators `gt/gte/eq`, BigInt/minor units, latencia media tecnica, falhas, bloqueios, regras disabled/deleted, sanitizacao e ausencia de chamada externa.

Os testes API cobrem auth, `audit.read`, workspace 403, detalhe 404 fora do escopo, DTOs sem metadata na listagem, metadata sanitizada no detalhe, simulacao read-only com BigInt como string, rejeicao de campos sensiveis e ausencia de CRUD de `alert-rules`.

O teste estrutural cobre migration, allowlists, `threshold_value`, `cooldown_minutes`, CHECK de escopo, FKs, indices, uso exclusivo de `ai_run_usage_events`, ausencia de SQL destrutivo e ausencia de delivery/scheduler/billing/dashboard.

## 14. Riscos remanescentes

- Ainda nao existe CRUD governado para manter regras em ambiente real.
- O evaluator faz uma agregacao por regra, sem cache, rollup ou materializacao para alto volume.
- `cooldownMinutes` e apenas dado de regra; a 12D nao possui scheduler nem controle de reenvio.
- Timezone e calendario por tenant ainda nao existem.
- Alertas dependem da cobertura e qualidade dos eventos instrumentados pela 12A.
- Delivery real precisara de desenho especifico de seguranca, opt-in, auditoria, rate limit e canal por tenant.

## 15. Proximos passos

- fechamento/hardening da Sprint 16;
- 13A avaliacao simples e test sets;
- dashboard frontend posterior consumindo API read-only;
- delivery real de alertas em fase futura, com scheduler governado e canais explicitamente aprovados.
