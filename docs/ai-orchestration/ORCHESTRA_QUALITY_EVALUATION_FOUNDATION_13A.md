# Orchestra Quality Evaluation Foundation 13A

## 1. Objetivo

A Fase 13A cria a fundacao backend para avaliacao simples de qualidade de assistentes de IA no Orchestra. A entrega modela test sets, test cases, evaluation runs e evaluation results, e adiciona um evaluator deterministico baseado em assertions controladas.

Esta fase nao executa LLM real, nao chama provider externo, nao roda assistant/runtime, nao usa MCP remoto, nao integra Agno/AgentOS produtivo, nao agenda jobs e nao cria dashboard.

## 2. Relacao com a Sprint 16

A Sprint 16/Fase 12 criou observabilidade de uso/custos, limites/quotas, API admin read-only e alertas governados sobre `AiRunUsageEvent`.

A 13A usa a mesma linha governada: backend-first, API admin com `audit.read`, DTOs allowlist, scoping por tenant/workspace e simulacao sem efeitos colaterais. Diferente da Fase 12, o evaluator da 13A trabalha com conteudo deliberadamente criado em test sets, nao com logs produtivos brutos.

## 3. Modelos e tabelas

Migration: `20260630130000_phase_13a_ai_quality_evaluation_foundation`.

Tabelas criadas:

- `ai_quality_test_sets`
- `ai_quality_test_cases`
- `ai_quality_evaluation_runs`
- `ai_quality_evaluation_results`

Models Prisma:

- `AiQualityTestSet`: tenant, workspace opcional, assistant opcional, nome, descricao, status, metadata sanitizavel, autores e soft delete.
- `AiQualityTestCase`: tenant, test set, assistant opcional, `inputText`, `expectedOutput`, `assertions`, tags, status, ordenacao, metadata e soft delete.
- `AiQualityEvaluationRun`: tenant, workspace/assistant opcionais, test set, status, mode, contadores, `scoreBasisPoints`, metadata e soft delete.
- `AiQualityEvaluationResult`: tenant, run, test case, status, `scoreBasisPoints`, `assertionResults`, hash/excerpt de candidate output e hashes de erro.

A migration adiciona FKs, indices basicos, CHECK constraints para allowlists, ranges de score, contadores nao negativos, tamanho de conteudo controlado e formato SHA-256.

## 4. Assertions suportadas

O evaluator 13A suporta:

- `contains_any`: passa se o candidate output contem pelo menos um termo.
- `contains_all`: passa se contem todos os termos.
- `not_contains_any`: passa se nao contem termos proibidos.
- `min_length`: passa se o tamanho e maior ou igual ao valor.
- `max_length`: passa se o tamanho e menor ou igual ao valor.
- `regex_contains`: passa se uma regex limitada e segura encontra match.
- `regex_not_contains`: passa se uma regex limitada e segura nao encontra match.
- `json_valid`: passa se o candidate output e JSON valido.

Comparacoes `contains_*` sao case-insensitive por padrao. Regex tem limite de tamanho, flags allowlist (`i`, `m`, `u`), captura de erro e execucao sobre texto limitado.

## 5. Evaluator deterministico

Funcao principal: `evaluateAiQualityTestCase(input)`.

Entrada principal:

- `tenantId`
- `workspaceId` opcional
- `assistantId` opcional
- `testCaseId` opcional
- `inputText`
- `candidateOutput`
- `assertions`
- `now` opcional
- `metadata` opcional

Saida:

- `status`: `passed`, `failed`, `warning`, `error` ou `skipped`
- `scoreBasisPoints`
- `assertionResults`
- `candidateOutputHash`
- `candidateOutputExcerpt`
- `evaluatedAt`

Falha em assertion `required` gera `failed`. Falhas apenas `warning` geram `warning`. Tudo passando gera `passed`. O score e calculado por proporcao simples de assertions passadas e retornado como inteiro de 0 a 10000.

O evaluator nao chama `fetch`, LLM, provider, runtime, MCP, Agno ou rede externa.

## 6. API admin

Base path: `/api/v1/ai-quality`.

Rotas criadas:

- `GET /test-sets`
- `GET /test-sets/:id`
- `GET /test-cases`
- `GET /test-cases/:id`
- `GET /evaluation-runs`
- `GET /evaluation-runs/:id`
- `GET /evaluation-results`
- `POST /evaluate-test-case`

Todas as rotas usam `requireAuth` e `requirePermission('audit.read')`.

As rotas `GET` sao read-only. `POST /evaluate-test-case` e uma simulacao deterministica e nao persiste run/result. Nao existem endpoints de CRUD para test sets, test cases, runs ou results nesta fase.

## 7. Scoping

`tenantId` vem exclusivamente de `req.user.tenant.id`.

`workspaceId`, quando informado em query/body, precisa existir em `req.user.workspaces`; caso contrario, a API retorna 403 antes de acessar o repository. Detalhes fora do escopo retornam 404.

Test sets globais de tenant podem ser listados para usuarios com `audit.read`, respeitando tenant. Test sets/workspace e test sets/assistant sao filtrados pelos workspaces visiveis. Assistant informado em simulacao precisa pertencer ao tenant e ao workspace visivel.

## 8. Seguranca e privacidade

Test sets podem conter entradas e criterios controlados, mas devem ser tratados como sensiveis. A 13A aplica:

- limites de tamanho para `inputText`, `expectedOutput`, assertions, metadata e candidate output;
- schemas Zod `.strict()`;
- DTOs allowlist;
- sanitizacao de metadata, excerpts e summaries;
- rejeicao de campos livres como `tenantId`, `providerApiKey`, `headers`, `Authorization`, `cookie`, `rawDocuments`, `token`, `password`, `secret`, `credential`, `secretRef` e `baseUrl`.

Test sets nao devem conter segredos, tokens, chaves, credenciais, PII desnecessaria, payload bruto de producao ou documentos corporativos sensiveis.

## 9. O que nao e persistido

A 13A nao copia conteudo de `AiRunUsageEvent.metadata` para test cases.

Evaluation results armazenam metricas, status, score, assertion results, SHA-256 e excerpt curto/sanitizado quando houver candidate output. Candidate output completo nao e persistido. Resposta real de provider nao e persistida.

## 10. Fora de escopo

Permanecem fora desta fase:

- execucao real de LLM;
- chamadas OpenAI, Azure, Anthropic, Gemini ou qualquer provider;
- LLM-as-judge;
- execucao automatica de assistant/runtime;
- MCP remoto produtivo;
- Agno/AgentOS produtivo;
- scheduler, worker, queue ou cron;
- dashboard frontend;
- billing;
- alert delivery;
- scraping, webhooks ou importacao automatica de documentos;
- geracao automatica de test cases por IA;
- CRUD governado de test sets/cases.

## 11. Limitacoes

- Nao ha worker para executar test sets inteiros.
- Nao ha armazenamento de candidate output completo.
- Regex safety e intencionalmente conservador.
- CRUD governado e dashboard ficam para fases futuras.
- A qualidade medida e deterministica e baseada apenas em assertions declaradas.

## 12. Proximos passos

- CRUD governado de test sets e test cases.
- Persistencia controlada de runs/results por operacao admin explicita.
- Dashboard read-only de qualidade.
- Execucao governada de test set inteiro sem worker produtivo inicialmente.
- Avaliacao assistida por LLM-as-judge apenas em fase futura, com desenho especifico de seguranca e custo.
