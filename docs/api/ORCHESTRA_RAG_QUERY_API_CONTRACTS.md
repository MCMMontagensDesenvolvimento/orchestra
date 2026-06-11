# Orchestra RAG Query API Contracts

Status: implementado na Fase 06C para consulta local deterministica com citations. Nao executa LLM, embeddings, vector store, provider externo ou runtime real.

## Query Local

`POST /api/v1/assistants/:id/rag/query`

Body:

```json
{
  "query": "Como funciona a politica de aprovacao?",
  "limit": 5,
  "includeArchived": false
}
```

Validacoes:

- `query`: obrigatoria, 2 a 500 caracteres;
- `limit`: default 5, maximo 20;
- `includeArchived`: aceito para contrato, mas conteudo arquivado permanece excluido;
- sessao e permissao `knowledge.read` obrigatorias.

Resposta `201` com resultados:

```json
{
  "queryId": "...",
  "assistantId": "...",
  "status": "completed",
  "query": "Como funciona a politica de aprovacao?",
  "resultCount": 1,
  "sources": [
    {
      "rank": 1,
      "score": 0.87,
      "knowledgeBaseId": "...",
      "documentId": "...",
      "chunkId": "...",
      "sourceReferenceId": "...",
      "citationLabel": "Fonte 1",
      "documentTitle": "Politica operacional",
      "excerpt": "...",
      "sourceUri": "knowledge-document://...",
      "matchType": "mixed"
    }
  ],
  "warnings": []
}
```

Resposta `201` sem resultados:

```json
{
  "queryId": "...",
  "assistantId": "...",
  "status": "no_results",
  "resultCount": 0,
  "sources": [],
  "warnings": [
    {
      "code": "NO_RELEVANT_CHUNKS_FOUND",
      "message": "Nenhum trecho local foi encontrado para esta consulta."
    }
  ]
}
```

Resposta `201` bloqueada:

```json
{
  "queryId": "...",
  "assistantId": "...",
  "status": "blocked",
  "code": "RAG_NOT_READY",
  "message": "O assistente nao possui fontes de conhecimento prontas para consulta.",
  "reasons": ["NO_CHUNKS_AVAILABLE"],
  "resultCount": 0,
  "sources": [],
  "warnings": []
}
```

## Historico Por Assistant

`GET /api/v1/assistants/:id/rag/queries`

Retorna envelope paginado com registros `RagQuery`. Filtros aceitos:

- `page`;
- `perPage`;
- `search`;
- `status`;
- `sortBy=createdAt|status|resultCount`;
- `sortDirection=asc|desc`.

## Detalhe E Sources

- `GET /api/v1/rag/queries/:queryId`
- `GET /api/v1/rag/queries/:queryId/sources`

Ambos validam tenant/workspace do usuario autenticado e retornam `404 RAG_QUERY_NOT_FOUND` fora do escopo.

## Readiness V2

`GET /api/v1/assistants/:id/rag/readiness`

Preserva compatibilidade com `GET /api/v1/assistants/:id/rag-readiness` e adiciona contadores refinados:

```json
{
  "assistantId": "...",
  "ready": true,
  "canUseKnowledge": true,
  "knowledgeBaseCount": 1,
  "documentCount": 1,
  "chunkCount": 4,
  "sourceReferenceCount": 4,
  "enabledBindingCount": 1,
  "blockedReasons": [],
  "warnings": [],
  "retrievalMode": "local_chunks_only",
  "embeddingsEnabled": false,
  "vectorStoreEnabled": false
}
```

## Rotas Legadas Mantidas

- `GET /api/v1/assistants/:id/rag-readiness`
- `POST /api/v1/assistants/:id/rag-local-search`

Elas continuam disponiveis para compatibilidade, mas o contrato oficial de consulta da Fase 06C e `/rag/query`.
