# Orchestra Observabilidade - Usage e Costs 12A

## 1. Objetivo

A Fase 12A cria a fundacao backend para observabilidade de uso, latencia, status e custo estimado de execucoes de IA no Orchestra.

Esta fase e deliberadamente estrutural. Ela adiciona schema, migration, repository, service, tipos e testes unitarios para registrar eventos normalizados de uso. Ela nao conecta o registro aos fluxos produtivos de runtime, RAG, MCP, LLM provider, dashboard, billing, alertas ou limites automaticos.

## 2. Escopo implementado

A implementacao adiciona o model `AiRunUsageEvent`, mapeado para a tabela `ai_run_usage_events`, com os seguintes grupos de campos:

- Escopo: `tenantId`, `workspaceId`, `assistantId`, `userId`.
- Correlacao: `runId`, `traceId`.
- Origem: `source`, `operation`, `provider`, `model`.
- Resultado: `status`, `blockedReason`, `errorCode`, `errorMessageHash`.
- Uso: `inputTokens`, `outputTokens`, `totalTokens`, `embeddingTokens`, `cachedTokens`.
- Performance: `latencyMs`, `startedAt`, `completedAt`, `createdAt`.
- Custo estimado: `costCurrency`, `estimatedCostMinorUnits`.
- Contexto sanitizado: `metadata`.

Tambem foram adicionadas relacoes inversas em `Tenant`, `Workspace`, `Assistant` e `User`, sem alterar semantica de Auth/SSO, RBAC, RAG, MCP remoto, runtime adapter ou frontend.

## 3. Decisao de modelagem

Foi criado um model novo em vez de expandir `UsageRecord`.

Motivos:

- `UsageRecord` e legado e cobre um recorte simples por tenant/assistant/run.
- A 12A precisa de workspace obrigatorio, status operacional, latencia, tokens detalhados, custo em unidades menores e metadata sanitizada.
- A separacao evita mudar contratos antigos antes de existir um pipeline completo de observabilidade.
- `runId` permanece `String`, sem FK obrigatoria para `AgentRun`, para permitir eventos futuros de RAG, MCP, embeddings e runtime adapter.

## 4. Migration e constraints

Migration criada:

`backend/prisma/migrations/20260629120000_phase_12a_ai_usage_observability/migration.sql`

A migration cria apenas a tabela `ai_run_usage_events`, indices, FKs simples e CHECK constraints.

Valores permitidos de `source`:

- `llm_provider`
- `rag`
- `mcp`
- `runtime_adapter`
- `embedding`
- `unknown`

Valores permitidos de `status`:

- `started`
- `succeeded`
- `failed`
- `blocked`
- `cancelled`

As constraints tambem garantem tokens, latencia e custo nao negativos quando informados, moeda em `CHAR(3)` pelo schema Prisma e hash de erro no formato SHA-256 hexadecimal minusculo quando persistido.

## 5. Custo estimado

O custo e armazenado como `estimatedCostMinorUnits` em `BigInt`, acompanhado de `costCurrency`.

A 12A nao calcula preco por provider, nao consulta tabela externa de pricing, nao faz billing e nao emite cobranca. O campo existe para receber uma estimativa ja calculada por uma fase futura ou por um adaptador controlado. Isso evita armazenar dinheiro como float.

## 6. Tokens e latencia

Tokens sao opcionais e nao negativos:

- `inputTokens`
- `outputTokens`
- `totalTokens`
- `embeddingTokens`
- `cachedTokens`

Quando `totalTokens` nao e informado, o service calcula `inputTokens + outputTokens` se ambos existirem.

`latencyMs` tambem e opcional e nao negativa. `startedAt` recebe o valor informado ou o tempo atual no service; `completedAt` permanece opcional.

## 7. Sanitizacao e privacidade

O service exporta `sanitizeAiUsageMetadata` e normaliza `metadata` antes de chamar o repository.

A sanitizacao remove chaves sensiveis conhecidas, incluindo `Authorization`, `apiKey`, `secret`, `token`, `password`, `credential`, `secretRef`, `baseUrl`, `prompt`, `response`, `rawDocuments`, `headers` e `cookie`.

Strings com padroes sensiveis, como `Bearer ...`, chaves no formato `sk-...` ou URL com userinfo, sao substituidas por `[redacted]`.

O erro bruto nao e persistido. Quando `errorMessage` e recebido, o service grava somente `errorMessageHash` usando SHA-256.

Tambem ha limites defensivos para tamanho de string, quantidade de itens de array, quantidade de chaves por objeto e profundidade de objeto. A fase nao persiste raw prompt, raw response, documentos brutos, headers, cookies, credenciais ou secrets.

## 8. API interna de codigo

Entrada principal:

`recordAiUsageEvent(input)`

O service:

- valida `tenantId`, `workspaceId`, `runId` e `operation`;
- normaliza `source` e `status` para allowlists fechadas;
- normaliza moeda e custo em unidades menores;
- normaliza datas;
- calcula `totalTokens` quando possivel;
- gera hash de erro quando necessario;
- sanitiza `metadata`;
- delega a persistencia ao repository Prisma.

O repository usa somente `prisma.aiRunUsageEvent.create`. Nao executa chamada externa, nao aciona MCP remoto, nao chama provider de modelo e nao materializa qualquer runtime.

## 9. Fora do escopo

Continuam fora da 12A:

- dashboard, frontend ou visualizacao de custos;
- alertas, budgets, quotas ou limites automaticos;
- billing, pagamento, invoice, chargeback ou export contabil;
- avaliacao automatica de respostas;
- Agno/AgentOS produtivo;
- runtime produtivo de IA;
- publicacao/materializacao de MCP remoto;
- workers, filas, schedules ou tarefas periodicas;
- scraping ou enriquecimento externo;
- tracking de prompt/response bruto;
- alteracao de Auth/SSO, RBAC, RAG, MCP remote apply/discovery ou runtime adapter.

## 10. Testes

Teste unitario adicionado:

`backend/tests/unit/ai-observability.test.ts`

O teste cobre:

- registro minimo com tenant, workspace, run e status;
- provider/model, tokens, latencia e fallback de `totalTokens`;
- tokens explicitos e embeddings;
- custo estimado em unidades menores;
- status `failed` e `blocked`, com hash de erro;
- sanitizacao de metadata sensivel;
- truncamento defensivo de strings, arrays, objetos e profundidade;
- provider/model nulos;
- garantia de que o service nao executa fetch externo nem MCP remoto.

## 11. Rollback

Enquanto a tabela estiver vazia, rollback inicial seguro:

1. Remover a migration 12A.
2. Remover o model `AiRunUsageEvent` e relacoes inversas do `schema.prisma`.
3. Remover o modulo `backend/src/modules/ai-observability`.
4. Remover o teste unitario e esta documentacao.

Depois que houver dados reais, rollback exige exportacao ou plano de reconciliacao aprovado. Nao se deve dropar a tabela com eventos produtivos sem plano operacional.

## 12. Riscos remanescentes

- Ainda nao ha instrumentacao nos fluxos oficiais de runtime/RAG/MCP/LLM.
- Ainda nao ha politica de retencao, agregacao ou particionamento para alto volume.
- Ainda nao ha tabela de pricing governada.
- Ainda nao ha endpoint ou dashboard de leitura.
- Futuras fases devem definir exatamente quais eventos cada fluxo emitira e quais campos de metadata serao permitidos por fonte.
