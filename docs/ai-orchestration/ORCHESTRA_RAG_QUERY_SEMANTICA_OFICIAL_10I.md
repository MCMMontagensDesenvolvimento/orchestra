# Orchestra RAG Query Semantica Oficial 10I

## Objetivo

A Fase 10I integra o retrieval semantico ao contrato oficial:

```http
POST /api/v1/assistants/:id/rag/query
```

O objetivo e usar busca vetorial quando embeddings estiverem prontos e existirem candidatos elegiveis, preservando o comportamento governado ja existente de readiness, fallback local, persistencia em `RagQuery` e `RagQueryResult`, citations e auditoria.

Esta fase nao altera frontend, Auth/SSO, RBAC, MCP, runtime, Prisma schema ou migrations.

## Contrato Oficial Preservado

A rota continua exigindo `knowledge.read` e mantendo os campos oficiais:

- `queryId`;
- `assistantId`;
- `status`;
- `query`;
- `resultCount`;
- `sources`;
- `warnings`;
- citations com `citationLabel` no formato `Fonte 1`, `Fonte 2`;
- `sourceReferenceId` quando houver referencia de fonte persistida.

Campos operacionais adicionais:

- `retrievalMode`;
- `semanticEnabled`;
- `vectorStoreUsed`;
- `fallbackUsed`;
- `fallbackReason`;
- `provider`;
- `model`;
- `dimension`.

## Fluxo Semantico

1. O backend carrega os candidatos locais via `knowledgeRepository.findRagRetrievalCandidates` para preservar readiness e fallback lexical.
2. A readiness de embeddings e lida via `embeddingsService.getEmbeddingReadiness()`.
3. Se o RAG local nao estiver pronto, a query e persistida como bloqueada com `mode = local_readiness`.
4. Se embeddings estiverem `ready`, o backend gera o embedding da query com `embeddingsService.embedText`.
5. O vetor gerado e validado no backend quanto a tipo, tamanho e valores finitos.
6. O repository executa `findSemanticRagRetrievalCandidates` contra `knowledge_chunk_embeddings`, filtrando tenant, workspace, bindings ativos, provider, model, dimension e `content_hash`.
7. Se houver candidatos semanticos, a query oficial e persistida com `mode = semantic_vector`.
8. Se nao houver candidatos semanticos elegiveis, nao houver resultados ou ocorrer falha controlada, o backend usa fallback lexical/local e persiste `mode = semantic_fallback_local_keyword`.

## Modos Persistidos

`RagQuery.mode` passa a registrar o modo efetivo:

- `semantic_vector`: retrieval semantico usado e resultados persistidos com `matchType = semantic_vector`.
- `semantic_fallback_local_keyword`: tentativa semantica indisponivel, vazia ou com falha controlada, com fallback lexical/local persistido.
- `local_keyword`: modo local preservado para compatibilidade operacional quando aplicavel.
- `local_readiness`: readiness bloqueou a query antes de retrieval.

`RagQueryResult.matchType` usa:

- `semantic_vector` para resultados semanticos;
- tipos lexicais existentes, como `content`, `title`, `metadata` ou `mixed`, quando o fallback local e usado.

## Metadados Seguros

`RagQuery.metadata` registra apenas metadados operacionais seguros:

- `retrievalMode`;
- `semanticEnabled`;
- `vectorStoreUsed`;
- `fallbackUsed`;
- `fallbackReason`;
- `provider`;
- `model`;
- `dimension`;
- `queryLength`;
- `includeArchived`;
- `terms`.

`RagQueryResult.metadata` registra:

- `chunkIndex`;
- `tokenEstimate`;
- `charCount`;
- `documentTitle`;
- `sourceReferenceLabel`;
- `semanticDistance` e `semanticScore` quando o resultado for semantico;
- `rawScore` quando o resultado vier do fallback lexical.

Nao sao persistidos ou retornados:

- vetor da query;
- vetor de chunk;
- texto bruto de entrada do provider;
- saida bruta do provider;
- prompts ou outputs brutos;
- secrets, tokens, cookies, API keys ou headers sensiveis.

## Fallbacks Controlados

Razoes esperadas:

- `EMBEDDINGS_NOT_READY`: embeddings nao estao prontos.
- `NO_SEMANTIC_EMBEDDINGS`: nao ha embeddings elegiveis persistidos.
- `SEMANTIC_NO_RESULTS`: a consulta semantica nao retornou chunks carregaveis.
- `SEMANTIC_RETRIEVAL_FAILED`: erro controlado durante embedding da query ou consulta vetorial.
- `RAG_NOT_READY`: o assistente nao possui conhecimento pronto para consulta.

Quando o fallback e usado, a rota continua persistindo `RagQuery`, `RagQueryResult`, citations e auditoria com as mesmas garantias do contrato oficial.

## Auditoria

Eventos mantidos:

- `rag_query_requested`;
- `rag_query_completed`;
- `rag_query_no_results`;
- `rag_query_blocked`;
- `rag_source_returned`;
- `rag_query_failed`, em falhas nao controladas.

A auditoria inclui `retrievalMode`, `semanticEnabled`, `vectorStoreUsed`, `fallbackUsed`, `fallbackReason`, provider/model/dimension e contadores. Nao inclui vetores, payload bruto de provider, prompts, outputs brutos ou credenciais.

## Relacao Com Runtime E RAG

O contrato oficial passa a devolver fontes semanticas quando possivel, mas ainda nao gera resposta por LLM. O runtime continua consumindo `sources`, `queryId` e citations.

A consulta vetorial fica restrita ao backend e ao repository governado. O frontend e runtimes nao recebem vetores e nao chamam providers de embeddings diretamente.

## Validacao Local

Com o backend configurado:

```bash
cd backend
npm run typecheck
npm run lint
MICROSOFT_SSO_ENABLED=false MICROSOFT_CLIENT_ID= MICROSOFT_CLIENT_SECRET= MICROSOFT_TENANT_ID= MICROSOFT_REDIRECT_URI= MICROSOFT_POST_LOGOUT_REDIRECT_URI= MICROSOFT_ALLOWED_DOMAINS= MICROSOFT_ALLOWED_TENANT_IDS= npm run test -- --run
npm run build
npx prisma validate
npx prisma generate
```

Na raiz:

```bash
docker compose -f docker-compose.dev.yml exec -T backend npx prisma migrate status
git status --short
git diff --check
git diff --stat
git diff --name-status
```

## Rollback

Rollback seguro:

1. Reverter o uso semantico dentro de `knowledgeService.queryRag`.
2. Manter `POST /api/v1/assistants/:id/rag/semantic-search` da 10H, se ainda for necessario validar semantic search isolado.
3. Manter `knowledge_chunk_embeddings`, pois a persistencia controlada pertence a 10G.
4. Preservar `findRagRetrievalCandidates`, `RagQuery`, `RagQueryResult`, citations e auditoria lexical/local.

## Criterios De Aceite

- `queryRag` usa `semantic_vector` quando embeddings estao prontos e ha candidatos semanticos.
- `queryRag` cai para `semantic_fallback_local_keyword` quando embeddings nao estao prontos, nao ha embeddings elegiveis, nao ha resultados semanticos ou ocorre falha controlada.
- `RagQuery` e `RagQueryResult` sempre sao persistidos para bloqueio, sucesso, no results e fallback.
- Citations e `sourceReferenceId` sao preservados.
- `RagQuery.mode` e `RagQueryResult.matchType` indicam o modo efetivo.
- Metadados de query e resultado sao seguros e auditaveis.
- Vetores, raw input/output, prompts, outputs e credenciais nao sao retornados nem persistidos.
- Readiness bloqueante e warning de `includeArchived` sao mantidos.
- Frontend, Auth/SSO, RBAC, MCP, runtime, Prisma schema e migrations permanecem fora do escopo.
