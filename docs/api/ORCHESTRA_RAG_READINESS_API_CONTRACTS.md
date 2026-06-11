# Orchestra RAG Readiness API Contracts

Status: implementado na Fase 06B como readiness local e refinado na Fase 06C. Nao executa retrieval semantico real.

## Readiness

Rotas:

- `GET /api/v1/assistants/:id/rag/readiness`
- `GET /api/v1/assistants/:id/rag-readiness` (compatibilidade)

Resposta:

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
  "knowledgeBasesBound": 1,
  "documentsIngested": 1,
  "chunksAvailable": 4,
  "missingRequirements": [],
  "retrievalMode": "local_chunks_only",
  "embeddingsEnabled": false,
  "vectorStoreEnabled": false
}
```

## Busca Local

`POST /api/v1/assistants/:id/rag-local-search`

Body:

```json
{
  "query": "termo"
}
```

Resposta:

```json
{
  "mode": "keyword_local_placeholder",
  "retrievalMode": "local_chunks_only",
  "embeddingsEnabled": false,
  "vectorStoreEnabled": false,
  "results": [
    {
      "chunkId": "...",
      "documentId": "...",
      "knowledgeBaseId": "...",
      "score": 1,
      "snippet": "...",
      "source": {
        "label": "...",
        "sourceUri": "..."
      }
    }
  ]
}
```


## Ingestao Local

`POST /api/v1/knowledge-documents/:documentId/request-ingestion`

Resposta de sucesso (`201`):

```json
{
  "document": { "id": "...", "ingestionStatus": "completed", "chunkCount": 1 },
  "job": { "id": "...", "status": "completed", "chunksCreated": 1, "sourceReferencesCreated": 1 },
  "chunksCreated": 1,
  "sourceReferencesCreated": 1
}
```

Falhas controladas, como documento sem `contentText`, retornam `422` e persistem job `failed` consultavel em `GET /api/v1/knowledge-documents/:documentId/ingestion`.

## Knowledge Endpoints Adicionados

- `GET /api/v1/knowledge-documents/:documentId/chunks`
- `GET /api/v1/knowledge-bases/:id/chunks`
- `GET /api/v1/knowledge-chunks/:chunkId`
- `GET /api/v1/knowledge-documents/:documentId/source-references`
- `GET /api/v1/knowledge-chunks/:chunkId/source-references`
- `GET /api/v1/knowledge-ingestion-jobs/:jobId`

## Seguranca

Todos os endpoints exigem sessao e permissoes Knowledge. O backend filtra tenant e workspaces acessiveis. A busca local usa apenas Knowledge Bases vinculadas ao assistant.
