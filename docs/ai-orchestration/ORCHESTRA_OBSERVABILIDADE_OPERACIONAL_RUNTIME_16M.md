# Orchestra — Observabilidade Operacional do Runtime 16M

## Objetivo

A Fase 16M entrega a primeira visualização operacional real do Runtime Chat/RAG em `/app/analytics`. A tela usa dados já persistidos em `agent_runs`, `agent_run_events`, `rag_queries`, `rag_query_results` e `ai_run_usage_events`, sem migration, sem alteração do schema Prisma e sem mudar a execução do runtime.

O objetivo é leitura e diagnóstico. Custos só aparecem quando há valor persistido no evento de uso; limites, enforcement, MCP externo, execução real de tools e hardening de produção permanecem fora do escopo.

## Escopo implementado

- cards com volume de runs, taxa de conclusão, latência média e tokens persistidos;
- listagem paginada de runs recentes;
- filtros por status, runtime provider, `ragMode`, `responseScopeMode`, fallback fora da base, provider externo, MCP externo e busca por `input_summary`;
- drawer com identificação, runtime/LLM, response scope, RAG, tools, usage, eventos e fontes RAG;
- estados de loading, erro, vazio geral e filtros sem resultado;
- mocks somente quando o mecanismo protegido por `VITE_USE_MOCKS` está ativo;
- API read-only protegida por autenticação e `audit.read`, com tenant e workspaces derivados da sessão.

Não foram alterados `backend/prisma/schema.prisma`, migrations, defaults de provider, secrets ou semântica do Runtime Chat/RAG.

## Tela e endpoints

Rota de frontend: `/app/analytics`.

Endpoints sob `/api/v1/ai-observability`:

| Método | Endpoint | Finalidade |
| --- | --- | --- |
| `GET` | `/runtime-runs` | listagem paginada e filtros allowlistados |
| `GET` | `/runtime-runs/:id` | detalhe sanitizado de um run acessível |
| `GET` | `/runtime-summary` | cards operacionais no escopo da sessão |

Todos são estritamente read-only. O backend recebe tenant e workspaces da sessão autenticada. Um `workspaceId` opcional só é aceito quando pertence à lista de workspaces do usuário.

### Paginação e filtros

`GET /runtime-runs` aceita:

- `page` e `perPage` (`perPage` limitado a 100);
- `status`;
- `runtimeProvider`;
- `ragMode`;
- `responseScopeMode` com `knowledge_only`, `knowledge_first` ou `general_allowed`;
- `fallbackOutsideKnowledgeUsed`;
- `externalProviderCalled`;
- `externalMcpCalled`;
- `search`, aplicado exclusivamente a `agent_runs.input_summary`.

Parâmetros desconhecidos são rejeitados pelo schema strict. Flags booleanas aceitam apenas `true` ou `false`.

## Campos allowlistados

### Listagem e identificação

- `runId`, `requestId`, `traceId`;
- `assistantId`, nome do assistente, `assistantVersionId` e versão;
- `status`, `mode`;
- `inputSummary` derivado de `input_summary`, normalizado e limitado a 500 caracteres;
- `startedAt`, `completedAt`, `createdAt`.

### Runtime, response scope e RAG

- `runtimeProvider`;
- `llmProvider` e `model`, quando disponíveis;
- `responseScopeMode`;
- `ragMode`, `ragQueryId`, `ragSourceCount`;
- `ragIntentDetected`, `ragSkippedReason`;
- `fallbackOutsideKnowledgeUsed`;
- `rawContentLogged`;
- `externalProviderCalled`, `externalMcpCalled`;
- `toolCallsExecuted`;
- `latencyMs`.

### Usage e custo

- `inputTokens`, `outputTokens`, `totalTokens`;
- custo somente como `currency` e `estimatedMinorUnits` quando ambos já estão persistidos em `ai_run_usage_events`;
- o card de tokens usa eventos `runtime_adapter`/`agent_run.runtime_execute`, evitando misturar fontes de contabilização distintas.

### Eventos

Eventos retornam somente:

- `id`, `type`, `sequence`, `status`, `createdAt`;
- subconjunto explícito de metadata: providers/model, response scope, resumo RAG, flags externas/tools, latência e contadores de tokens.

`agent_run_events.message` não é selecionado. O objeto de metadata persistido nunca é devolvido integralmente.

### Fontes RAG

- `ragQueryId`, `rank`;
- `documentTitle`, `sourceLabel`;
- `matchType`, `score`;
- `excerpt` já persistido em `rag_query_results`, normalizado e truncado novamente em 240 caracteres na saída.

Não são retornados URI da fonte, conteúdo do chunk, texto ou texto normalizado da consulta RAG.

## Campos explicitamente proibidos

A API 16M não retorna:

- prompt ou instruções brutas;
- contexto conversacional ou contexto RAG bruto;
- input bruto do usuário (somente `input_summary`);
- query RAG bruta ou normalizada;
- mensagem genérica do evento;
- request/response ou payload bruto de provider;
- argumentos, outputs ou descritores brutos de tools;
- conteúdo completo de documento ou chunk;
- headers, cookies, bearer tokens, credenciais, API keys ou secrets;
- `precheckSnapshot`, metadata completa do run, evento, consulta ou resultado;
- mensagens de erro potencialmente originadas do provider.

A proteção principal é estrutural: os repositórios selecionam apenas as colunas necessárias e os mappers constroem DTOs novos com propriedades explícitas. Não se depende de retornar um objeto amplo para sanitizá-lo depois.

## Critérios de aceite

- `/app/analytics` não usa dados vazios/mockados no modo de API real;
- os três endpoints respondem apenas a usuário autenticado com `audit.read`;
- tenant/workspace são aplicados em todas as leituras;
- listagem é paginada e todos os filtros são allowlistados;
- busca textual só consulta `input_summary`;
- drawer apresenta os campos operacionais disponíveis e “Não informado” para ausência;
- detalhe não retorna objetos persistidos amplos nem campos proibidos;
- excerpts RAG são limitados a 240 caracteres;
- custo só aparece quando persistido com moeda;
- nenhum endpoint de escrita, migration ou mudança de runtime é introduzido;
- smokes 16I e 16K continuam presentes e válidos.

## Consultas SQL opcionais para comparação

Execute apenas em ambiente autorizado, substituindo os parâmetros. As consultas abaixo evitam input, query, conteúdo e payloads brutos.

### Runs recentes e metadata operacional allowlistada

```sql
SELECT
  ar.id AS run_id,
  ar.status,
  ar.input_summary,
  ar.request_id,
  ar.trace_id,
  ar.metadata #>> '{runtime,provider}' AS runtime_provider,
  ar.metadata #>> '{runtime,responseScopeMode}' AS response_scope_mode,
  ar.metadata #>> '{runtime,ragMode}' AS rag_mode,
  ar.metadata #>> '{runtime,ragSourceCount}' AS rag_source_count,
  ar.metadata #>> '{runtime,externalProviderCalled}' AS external_provider_called,
  ar.metadata #>> '{runtime,externalMcpCalled}' AS external_mcp_called,
  ar.created_at
FROM agent_runs ar
WHERE ar.tenant_id = :tenant_id::uuid
  AND ar.workspace_id = :workspace_id::uuid
  AND ar.created_at >= :created_at_from
ORDER BY ar.created_at DESC
LIMIT 100;
```

### Usage do runtime

```sql
SELECT
  run_id,
  provider,
  model,
  status,
  input_tokens,
  output_tokens,
  total_tokens,
  latency_ms,
  cost_currency,
  estimated_cost_minor_units,
  started_at
FROM ai_run_usage_events
WHERE tenant_id = :tenant_id::uuid
  AND workspace_id = :workspace_id::uuid
  AND source = 'runtime_adapter'
  AND operation = 'agent_run.runtime_execute'
  AND started_at >= :started_at_from
ORDER BY started_at DESC
LIMIT 100;
```

### Eventos sem mensagem ou metadata ampla

```sql
SELECT
  are.agent_run_id,
  are.sequence,
  are.type,
  are.status,
  are.created_at
FROM agent_run_events are
WHERE are.tenant_id = :tenant_id::uuid
  AND are.workspace_id = :workspace_id::uuid
  AND are.agent_run_id = :run_id::uuid
ORDER BY are.sequence ASC
LIMIT 100;
```

### Fontes RAG truncadas

```sql
SELECT
  rq.agent_run_id,
  rqr.rank,
  kd.title AS document_title,
  ksr.label AS source_label,
  rqr.match_type,
  rqr.score,
  LEFT(regexp_replace(rqr.excerpt, '\s+', ' ', 'g'), 240) AS excerpt
FROM rag_queries rq
JOIN rag_query_results rqr ON rqr.rag_query_id = rq.id
JOIN knowledge_documents kd ON kd.id = rqr.document_id
LEFT JOIN knowledge_source_references ksr ON ksr.id = rqr.source_reference_id
WHERE rq.tenant_id = :tenant_id::uuid
  AND rq.workspace_id = :workspace_id::uuid
  AND rq.agent_run_id = :run_id::uuid
ORDER BY rq.created_at DESC, rqr.rank ASC
LIMIT 20;
```

## Validação manual

1. Autenticar com usuário que possua `audit.read` e acesso a um workspace com runs.
2. Abrir `/app/analytics` com `VITE_USE_MOCKS=false`.
3. Confirmar cards, paginação e ordenação dos runs mais recentes.
4. Exercitar cada filtro isoladamente e em combinação; testar busca por trecho de `input_summary`.
5. Abrir runs local, Agno, com/sem RAG, concluído, bloqueado e falho quando existirem.
6. Verificar fallback “Não informado” em metadata antiga ou ausente.
7. Comparar uma amostra com as consultas SQL seguras acima.
8. Inspecionar a resposta HTTP e confirmar ausência dos campos proibidos.
9. Repetir com usuário sem `audit.read` e com workspace fora do escopo; ambos devem falhar fechados.
10. Executar as validações automatizadas documentadas na entrega da fase.

Não registrar em evidências prompt, contexto, input completo, conteúdo de documento, excerpt além do limite, headers, cookies, tokens ou credenciais.

## Rollback

O rollback é somente de código:

1. restaurar a página, hook, service e endpoints do frontend anteriores à 16M;
2. remover as rotas `/runtime-runs`, `/runtime-runs/:id` e `/runtime-summary` e os módulos `runtime-observability.*`;
3. remover o teste, smoke e este runbook da fase;
4. executar typechecks, build e smokes 16I/16K.

Não existe rollback de banco: a fase não cria migration, não altera schema e não grava dados. O runtime continua operando mesmo se a tela ou os endpoints forem removidos.
