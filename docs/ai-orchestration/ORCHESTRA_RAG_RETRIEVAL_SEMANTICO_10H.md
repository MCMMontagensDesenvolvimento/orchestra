# Orchestra RAG Retrieval Semantico 10H

## Objetivo

A Fase 10H adiciona uma capacidade backend-only e controlada de retrieval semantico usando pgvector e a tabela `knowledge_chunk_embeddings`.

Esta fase nao transforma o `knowledgeService.queryRag` oficial em busca semantica. O RAG oficial continua lexical/local, com `mode = local_keyword` e `retrievalMode = local_chunks_only`. A integracao oficial com `RagQuery`, `RagQueryResult`, citacoes persistidas e auditoria definitiva fica para a Fase 10I.

## Endpoint

```http
POST /api/v1/assistants/:id/rag/semantic-search
```

Permissao exigida:

```text
knowledge.read
```

O endpoint existe para validar a capacidade semantica de forma isolada, sem alterar runtime, MCP, frontend ou o contrato oficial de RAG.

## Payload

```json
{
  "query": "politica operacional",
  "limit": 5,
  "fallback": true
}
```

Campos:

- `query`: texto da busca, minimo `2` e maximo `500` caracteres.
- `limit`: quantidade maxima de resultados, de `1` a `20`, default `5`.
- `fallback`: quando `true`, permite fallback lexical controlado quando a etapa semantica nao estiver disponivel ou nao retornar resultados. Default `true`.

O endpoint nunca aceita vetor vindo do usuario. O vetor da query sempre e gerado no backend por `embeddingsService.embedText`.

## Fluxo

1. O backend valida autenticacao, permissao `knowledge.read` e payload.
2. A readiness atual do RAG local e carregada para respeitar assistente, tenant, workspace e bindings ativos.
3. A readiness de embeddings e lida por `embeddingsService.getEmbeddingReadiness()`.
4. Se embeddings nao estiverem `ready`, o endpoint usa fallback lexical quando permitido.
5. Quando embeddings estao `ready`, o backend gera o embedding da query via `embeddingsService.embedText`.
6. O vetor gerado e validado como `number[]`, finito, nao vazio e com tamanho igual a `dimension`.
7. O repository consulta `knowledge_chunk_embeddings` com SQL raw parametrizado e operador pgvector.
8. Se a busca semantica retornar candidatos, a resposta usa `retrievalMode = semantic_vector`.
9. Se a busca semantica nao retornar resultados ou falhar de forma controlada, o endpoint usa fallback lexical quando permitido.

## Filtros de seguranca

A consulta semantica considera somente registros que atendem a todos estes criterios:

- `knowledge_chunk_embeddings.status = 'embedded'`;
- `knowledge_chunk_embeddings.embedding IS NOT NULL`;
- provider, model e dimension compativeis com a readiness atual de embeddings;
- `knowledge_chunk_embeddings.content_hash = knowledge_chunks.content_hash`;
- chunk ativo;
- documento nao deletado, nao arquivado e com `ingestionStatus = completed`;
- base de conhecimento ativa e nao deletada;
- tenant e workspace no escopo do usuario autenticado;
- base vinculada ao assistente por binding ativo;
- binding com `retrievalMode` diferente de `disabled`.

O endpoint nao retorna:

- vetor da query;
- vetor dos chunks;
- raw input/output do provider;
- prompt bruto;
- output bruto;
- secrets, tokens, cookies ou header `Authorization`;
- API key ou valor de ambiente sensivel.

## Consulta pgvector

A busca usa SQL raw parametrizado e seguro. O literal pgvector e montado apenas depois que o vetor gerado pelo provider e validado.

O operador usado e cosine distance:

```sql
embedding <=> query_vector
```

O score retornado e derivado como:

```text
score = 1 - semanticDistance
```

Resultados sao ordenados por menor distancia vetorial, com desempate por prioridade do binding, titulo do documento, indice do chunk e id do chunk.

## Resposta

Exemplo semantico:

```json
{
  "assistantId": "uuid",
  "status": "completed",
  "retrievalMode": "semantic_vector",
  "semanticEnabled": true,
  "vectorStoreUsed": true,
  "fallbackUsed": false,
  "fallbackReason": null,
  "provider": "openai",
  "model": "text-embedding-3-small",
  "dimension": 1536,
  "resultCount": 1,
  "results": [
    {
      "chunkId": "uuid",
      "documentId": "uuid",
      "knowledgeBaseId": "uuid",
      "score": 0.82,
      "semanticDistance": 0.18,
      "matchType": "semantic_vector",
      "snippet": "trecho sanitizado",
      "source": {
        "label": "Fonte 1",
        "sourceUri": "knowledge-document://uuid",
        "sectionTitle": "Secao"
      }
    }
  ]
}
```

Exemplo com fallback:

```json
{
  "assistantId": "uuid",
  "status": "completed",
  "retrievalMode": "fallback_local_keyword",
  "semanticEnabled": false,
  "vectorStoreUsed": false,
  "fallbackUsed": true,
  "fallbackReason": "EMBEDDINGS_NOT_READY",
  "resultCount": 1,
  "results": []
}
```

## Fallback lexical

O fallback usa o fluxo lexical existente de `knowledgeRepository.findRagRetrievalCandidates`, com scoring local reaproveitado no service.

Razoes esperadas:

- `EMBEDDINGS_NOT_READY`: embeddings nao estao prontos.
- `NO_SEMANTIC_EMBEDDINGS`: nao ha embeddings elegiveis persistidos.
- `SEMANTIC_NO_RESULTS`: a etapa semantica nao produziu resultados carregaveis.
- `SEMANTIC_RETRIEVAL_FAILED`: erro controlado durante embed ou consulta vetorial.
- `RAG_NOT_READY`: o assistente nao possui RAG local pronto.

Quando `fallback=false`, o endpoint retorna resposta controlada sem resultados e nao chama o fallback lexical.

## Auditoria

Eventos usados:

- `rag_semantic_search_requested`;
- `rag_semantic_search_completed`;
- `rag_semantic_search_fallback`;
- `rag_semantic_search_failed`, quando a falha semantica nao e mascarada por fallback.

A auditoria registra metadados sanitizados, sem query vector, chunk vector, raw input/output ou secrets.

## Limites

- Sem frontend.
- Sem worker automatico.
- Sem execucao automatica de embeddings.
- Sem novo indice HNSW ou IVFFlat.
- Sem migration.
- Sem alteracao de Prisma schema.
- Sem persistencia em `RagQuery` ou `RagQueryResult`.
- Sem mudanca no `queryRag` oficial.

## Rollback

Rollback seguro:

1. Remover ou desabilitar a rota `POST /api/v1/assistants/:id/rag/semantic-search`.
2. Remover o metodo `semanticSearch` do service.
3. Remover `findSemanticRagRetrievalCandidates` do repository.
4. Manter `knowledge_chunk_embeddings` intacta, pois ela pertence a 10G.
5. Manter `queryRag` oficial ativo, pois ele continua lexical/local e independente desta capacidade.

## Criterios de aceite

- Backend compila.
- Lint passa.
- Testes passam sem internet usando mocks.
- Build passa.
- `npx prisma validate` e `npx prisma generate` passam.
- `migrate status` indica schema atualizado.
- Nenhum segredo real foi adicionado.
- Nenhum vetor e retornado pelo endpoint.
- Nenhum raw input/output e retornado.
- Retrieval semantico consulta `knowledge_chunk_embeddings`.
- Retrieval semantico respeita tenant, workspace e bindings ativos.
- Retrieval semantico respeita provider, model, dimension e content hash.
- Fallback lexical e usado quando necessario.
- `queryRag` oficial nao foi alterado.
- `RagQuery` e `RagQueryResult` nao foram alterados nesta fase.
- Frontend, Auth/SSO, MCP, runtime, Prisma schema e migrations nao foram alterados.

## Proxima fase

A Fase 10I deve integrar semantic retrieval ao contrato oficial de `RagQuery`, incluindo citations, persistencia de resultados, auditoria operacional completa e politica de ativacao controlada para uso pelo runtime.
