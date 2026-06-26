# Orchestra Embeddings Persistencia Controlada 10G

## Objetivo

A Fase 10G adiciona persistencia controlada e idempotente de embeddings para chunks de conhecimento ja ingeridos, sem ativar busca vetorial no RAG e sem mudar o comportamento de execucao dos assistentes.

O backend passa a permitir uma solicitacao explicita para gerar embeddings via `embeddingsService` e persistir os resultados em `knowledge_chunk_embeddings`. A operacao e sempre backend-only, governada por permissao, escopada por tenant/workspace e fail-closed quando embeddings nao estao prontos.

## Endpoints

### Documento

```http
POST /api/v1/knowledge-documents/:documentId/request-embeddings
```

Solicita embeddings para chunks elegiveis de um documento especifico.

### Base de conhecimento

```http
POST /api/v1/knowledge-bases/:id/request-embeddings
```

Solicita embeddings para chunks elegiveis de uma base de conhecimento.

## Payload

```json
{
  "limit": 50,
  "force": false,
  "chunkIds": ["uuid-do-chunk"],
  "metadata": {
    "scenario": "manual-request"
  }
}
```

Campos:

- `limit`: quantidade maxima de chunks selecionados. Padrao `50`, maximo `100`.
- `force`: quando `false`, chunks ja persistidos para o mesmo provider/model/dimensao/hash sao ignorados. Padrao `false`.
- `chunkIds`: lista opcional de chunks especificos. Maximo `100`.
- `metadata`: objeto opcional para contexto operacional. Chaves sensiveis como secrets, tokens, passwords, api keys, cookies e `authorization` sao rejeitadas.

## Permissao

Os dois endpoints exigem autenticacao e a permissao:

```text
knowledge.ingestion.manage
```

Essa permissao foi reutilizada porque a operacao faz parte do ciclo controlado de ingestao/enriquecimento de conhecimento.

## Elegibilidade

Somente chunks elegiveis podem receber embeddings:

- chunk com `status = active`;
- tenant e workspace dentro do escopo do usuario autenticado;
- documento nao arquivado e nao deletado;
- documento com `ingestionStatus = completed`;
- base de conhecimento ativa e nao deletada;
- documento ou base acessivel pelo usuario.

## Idempotencia

A idempotencia e definida por:

```text
chunk_id + provider + model + dimension + content_hash
```

Quando ja existe registro `embedded` para essa combinacao e `force=false`, o chunk e contabilizado como `skipped` e nenhuma chamada ao provider e feita para ele.

Quando `force=true`, a chamada de embedding e executada novamente e o registro correspondente e atualizado por upsert.

## Persistencia

Os resultados sao persistidos em:

```text
knowledge_chunk_embeddings
```

Campos persistidos:

- `tenant_id`
- `workspace_id`
- `knowledge_base_id`
- `document_id`
- `chunk_id`
- `provider`
- `model`
- `dimension`
- `embedding`
- `content_hash`
- `embedding_hash`
- `status`
- `embedded_at`
- `metadata`

Falhas por chunk tambem sao persistidas com:

- `status = failed`
- `error_code`
- `error_message` sanitizada
- `metadata` segura

O upsert usa o conflict target:

```sql
ON CONFLICT ("chunk_id", "provider", "model", "dimension", "content_hash")
```

Esse formato e necessario porque a migracao da 10C criou a unicidade como unique index.

## Resposta

A resposta e um resumo sanitizado:

```json
{
  "scope": "document",
  "scopeId": "uuid",
  "status": "completed",
  "provider": "openai",
  "model": "text-embedding-3-small",
  "dimension": 1536,
  "requestedChunks": 10,
  "selectedForEmbedding": 8,
  "embedded": 8,
  "skipped": 2,
  "failed": 0,
  "failures": [],
  "retrievalMode": "local_chunks_only",
  "ragUpdated": false,
  "vectorSearchEnabled": false
}
```

Status possiveis:

- `completed`: todos os chunks selecionados foram persistidos ou ignorados por idempotencia.
- `partial`: ao menos um chunk falhou, mas houve sucesso ou skip.
- `failed`: todos os chunks selecionados falharam.

## Seguranca

A 10G nao retorna e nao armazena em metadata:

- texto bruto do chunk na resposta;
- vetor na resposta;
- prompt bruto;
- output bruto;
- raw input de embedding;
- raw output de embedding;
- secrets, tokens, api keys, cookies ou `Authorization`.

O frontend nao chama provider externo. A chamada ao provider, quando habilitada, fica concentrada no backend via `embeddingsService`.

## Relacao com RAG

A Fase 10G nao altera `queryRag`.

O RAG segue usando:

```text
mode: local_keyword
retrievalMode: local_chunks_only
```

A busca vetorial e o uso semantico dos embeddings permanecem fora do escopo da 10G e ficam reservados para a Fase 10H.

## Rollback

Rollback funcional:

1. Remover ou desabilitar as rotas `request-embeddings`.
2. Reverter os metodos de service/repository adicionados para persistencia de embeddings.
3. Manter os registros ja criados em `knowledge_chunk_embeddings` sem uso pelo RAG, pois a 10G nao conecta esses dados a `queryRag`.

Rollback operacional:

1. Desabilitar a configuracao de execucao de embeddings no backend.
2. Confirmar que readiness de embeddings volta para fail-closed.
3. Validar que `queryRag` continua respondendo via `local_keyword/local_chunks_only`.

Nao ha migration nova nesta fase.

## Criterios de aceite

- Endpoints de documento e base existem e exigem `knowledge.ingestion.manage`.
- Payload aceita `limit`, `force`, `chunkIds` e `metadata` segura.
- Metadata com chaves sensiveis e rejeitada.
- Chunks elegiveis respeitam tenant, workspace, status ativo e documento ingerido.
- Embeddings sao persistidos em `knowledge_chunk_embeddings`.
- Upsert usa idempotencia por `chunk_id + provider + model + dimension + content_hash`.
- `force=false` pula chunks ja persistidos.
- `force=true` atualiza registros existentes.
- Falhas por chunk sao persistidas sem vazar segredo.
- Resposta nao retorna chunk text, vetor, raw input/output, segredo ou `Authorization`.
- `queryRag` permanece local keyword/local chunks only.
- Vector search permanece para 10H.
- Testes, typecheck, lint, build e Prisma validate/generate passam.
