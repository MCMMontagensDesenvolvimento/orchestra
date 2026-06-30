# Orchestra Quality Evaluation Runs Snapshots 13B

## 1. Objetivo

A Fase 13B adiciona a fundacao para evaluation runs persistidos de qualidade de IA. Ela evolui a 13A para executar, de forma sincrona e explicita, uma avaliacao deterministica sobre um test set inteiro, persistindo `AiQualityEvaluationRun` e `AiQualityEvaluationResult`.

Esta fase continua sem executar LLM real, provider externo, assistant/runtime, MCP remoto, Agno/AgentOS produtivo, scheduler, worker, dashboard ou billing.

## 2. Relacao com a 13A

A 13A criou o modulo `backend/src/modules/ai-quality`, os models de test sets/cases/runs/results, o evaluator deterministico por assertions e a API admin read-only/simulacao `POST /evaluate-test-case`.

A 13B reutiliza o evaluator `evaluateAiQualityTestCase`, mas cria uma operacao separada de persistencia para test set inteiro. O output candidato ainda precisa ser fornecido explicitamente pelo caller; a API nao chama assistant, nao gera resposta e nao consulta runtime.

## 3. API criada

Base path: `/api/v1/ai-quality`.

Rotas adicionadas:

- `POST /evaluation-runs/deterministic`
- `GET /evaluation-runs/:id/results`

As duas rotas usam `requireAuth` e `requirePermission('audit.read')`, seguindo o padrao das fases 12C/12D/13A. A permissao dedicada ainda fica como divida tecnica: `ai.quality.read` e `ai.quality.write`.

## 4. Criacao de run deterministico

`POST /evaluation-runs/deterministic` recebe:

- `workspaceId` opcional;
- `assistantId` opcional;
- `testSetId` obrigatorio;
- `mode` opcional, limitado a `deterministic`;
- `metadata` opcional e sanitizada;
- `caseOutputs`, com `testCaseId`, `candidateOutput` e `metadata` opcional por caso.

O body e validado por Zod `.strict()`. Campos livres e campos sensiveis como `tenantId`, `providerApiKey`, `headers`, `Authorization`, `cookie`, `rawDocuments`, `secret`, `secretRef`, `credential` e `baseUrl` sao rejeitados pelo schema/metadata sanitizer.

Fluxo:

1. Valida auth e permissao.
2. Valida `workspaceId` contra `req.user.workspaces`.
3. Carrega o test set ativo visivel no tenant/workspace.
4. Carrega apenas test cases ativos do test set.
5. Valida duplicidade, ausencia e pertencimento dos `caseOutputs`.
6. Avalia cada caso com o evaluator deterministico da 13A.
7. Calcula summary e score do run.
8. Monta snapshots sanitizados de assistant e test set.
9. Cria run e results em transacao Prisma.
10. Retorna run criado com results sanitizados.

Se faltar output para qualquer test case ativo, a operacao retorna 422 e nao persiste nada. A fase escolhe rejeitar missing output em vez de marcar skipped para manter o run explicitamente reprodutivel.

## 5. Persistencia de results

Cada result persistido contem:

- `testCaseId`;
- `status`;
- `scoreBasisPoints`;
- `assertionResults` sanitizado;
- `candidateOutputHash`;
- `candidateOutputExcerpt`;
- metadata sanitizada;
- campos de erro controlados, quando existirem.

O `candidateOutput` completo nunca e persistido e nao e retornado em DTO. A entrada completa existe apenas em memoria durante a avaliacao deterministica.

## 6. Scoring e contadores

O run e criado diretamente como `completed` quando a operacao sincrona termina.

Os contadores sao derivados dos results avaliados:

- `totalCases`;
- `passedCases`;
- `failedCases`;
- `warningCases`;
- `errorCases`;
- `skippedCases`.

`scoreBasisPoints` do run e a media inteira, com `Math.round`, dos `scoreBasisPoints` dos results nao skipped. Se todos fossem skipped, o score ficaria `null`; no fluxo atual missing output e rejeitado, entao skipped nao e esperado para runs 13B normais.

## 7. Snapshots sanitizados

A migration da 13B adiciona campos no `AiQualityEvaluationRun`:

- `assistantSnapshotHash` / `assistant_snapshot_hash`;
- `assistantSnapshotSummary` / `assistant_snapshot_summary`;
- `testSetSnapshotHash` / `test_set_snapshot_hash`;
- `testSetSnapshotSummary` / `test_set_snapshot_summary`.

O hash e SHA-256 hex lowercase de 64 caracteres do summary sanitizado e canonicalizado.

`assistantSnapshotSummary` usa allowlist minima:

- `assistantId`;
- `name`;
- `status`;
- `workspaceId`;
- `capturedAt`.

`testSetSnapshotSummary` usa allowlist:

- `testSetId`;
- `name`;
- `status`;
- `workspaceId`;
- `assistantId`;
- `testCaseCount`;
- `activeTestCaseCount`;
- `capturedAt`.

Nao entram snapshots de system prompt, instrucoes completas, secrets, headers, Authorization, cookies, base URL, raw documents, RAG chunks, payload bruto, candidate output completo ou resposta completa de provider.

## 8. Scoping e privacidade

`tenantId` vem exclusivamente de `req.user.tenant.id`. `workspaceId`, quando informado, precisa pertencer ao usuario autenticado. Test set, assistant, run e results sao filtrados por tenant/workspace no repository.

DTOs de saida sao allowlist e passam por sanitizacao. `GET /evaluation-runs/:id/results` primeiro valida que o run esta visivel no escopo do usuario e depois lista results do run com os mesmos filtros.

## 9. Fora de escopo

Permanecem fora desta fase:

- execucao real de LLM;
- chamadas OpenAI, Azure, Anthropic, Gemini ou qualquer provider;
- LLM-as-judge;
- execucao automatica de assistant/runtime;
- MCP remoto produtivo;
- Agno/AgentOS produtivo;
- scheduler, worker, queue ou cron;
- dashboard frontend;
- billing ou eventos artificiais de custo;
- alert delivery, webhook, scraping ou importacao automatica;
- geracao automatica de test cases;
- geracao automatica de candidate outputs;
- CRUD completo de test sets/test cases.

Evaluation run 13B nao representa custo de LLM e nao registra `AiRunUsageEvent`.

## 10. Riscos remanescentes

- RBAC ainda usa `audit.read` por compatibilidade com 13A; a proxima etapa deve criar permissoes dedicadas `ai.quality.read` e `ai.quality.write`.
- Nao ha CRUD governado para manter test sets/cases.
- Nao ha UI ou dashboard para comparar historico de runs.
- Snapshots sao summaries sanitizados, nao uma reproducao completa do assistant.
- LLM-as-judge e avaliacao semantica continuam pendentes de desenho especifico de custo, privacidade e seguranca.

## 11. Proximos passos para 13C

- Criar RBAC dedicado para quality evaluation.
- Adicionar CRUD governado de test sets e test cases.
- Adicionar endpoint read-only de run detail com comparacoes historicas, se necessario.
- Preparar dashboard somente leitura.
- Desenhar avaliacao assistida por LLM-as-judge em fase separada, com budget, logs sanitizados e provider fail-closed.
