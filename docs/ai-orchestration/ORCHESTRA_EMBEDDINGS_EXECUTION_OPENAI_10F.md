# Orchestra - Fase 10F: Execucao OpenAI Controlada para Embeddings

Status: implementado no backend com execucao real protegida por flags, cliente HTTP injetavel e testes sem internet.

## Objetivo

A Fase 10F transforma o adapter estrutural OpenAI em um provider capaz de gerar embeddings no backend quando, e somente quando, todas as condicoes explicitas de configuracao e execucao estiverem satisfeitas.

O RAG principal continua lexical/local. Esta fase nao ativa vector search, nao grava automaticamente em `knowledge_chunk_embeddings` e nao altera frontend.

## Condicoes Para Execucao

O provider OpenAI so fica `ready` quando:

- `EMBEDDINGS_ENABLED=true`
- `EMBEDDINGS_PROVIDER=openai`
- `EMBEDDINGS_EXECUTION_ENABLED=true`
- credencial OpenAI configurada no backend
- `EMBEDDINGS_MODEL` configurado
- `EMBEDDINGS_DIMENSION` configurado

Defaults seguros:

```bash
EMBEDDINGS_ENABLED=false
EMBEDDINGS_PROVIDER=disabled
EMBEDDINGS_EXECUTION_ENABLED=false
EMBEDDINGS_MODEL=
EMBEDDINGS_DIMENSION=
EMBEDDINGS_TIMEOUT_MS=10000
EMBEDDINGS_MAX_INPUT_CHARS=8000
EMBEDDINGS_MAX_BATCH_SIZE=16
EMBEDDINGS_STORE_RAW_INPUTS=false
EMBEDDINGS_STORE_RAW_OUTPUTS=false
```

## Readiness

Estados esperados:

- `disabled`: embeddings desligados ou provider `disabled`.
- `misconfigured`: provider OpenAI selecionado sem credencial, modelo ou dimensao suficiente.
- `configured_but_execution_disabled`: provider configurado, mas execucao desligada.
- `ready`: provider configurado e execucao explicitamente habilitada.

Quando `ready`, `failClosed` fica `false`. Nos demais estados, `failClosed` permanece `true`.

## Execucao

O contrato interno suporta:

- `embedText({ text })`
- `embedBatch({ texts })`

As chamadas passam por um cliente HTTP injetavel. Em testes, esse cliente e substituido por mocks locais; nenhuma chamada de internet e necessaria.

O retorno interno contem vetor, modelo, dimensao, uso de tokens quando informado pelo provider e metadata segura:

```json
{
  "provider": "openai",
  "model": "modelo-configurado",
  "dimension": 1536,
  "vector": [],
  "usage": {
    "inputTokens": null
  },
  "metadata": {
    "externalProviderCalled": true,
    "rawInputStored": false,
    "rawOutputStored": false,
    "estimatedCost": null
  }
}
```

## Validacoes e Erros

Validações antes de chamar provider:

- texto vazio: `EMBEDDING_INPUT_EMPTY`
- texto acima do limite: `EMBEDDING_INPUT_TOO_LARGE`
- batch vazio: `EMBEDDING_INPUT_EMPTY`
- batch acima do limite: `EMBEDDING_BATCH_TOO_LARGE`

Falhas do provider:

- dimensao divergente: `EMBEDDING_DIMENSION_MISMATCH`
- resposta invalida: `EMBEDDING_PROVIDER_INVALID_RESPONSE`
- erro HTTP: `EMBEDDING_PROVIDER_REQUEST_FAILED`
- timeout: `EMBEDDING_PROVIDER_TIMEOUT`

Nenhum erro deve conter credencial, header Authorization, texto bruto de input ou output bruto.

## Integracao com RAG

O readiness de RAG pode refletir a subestrutura `embeddings`, inclusive `ready`, mas a execucao RAG permanece:

- `retrievalMode: local_chunks_only`
- `embeddingsEnabled: false`
- `vectorStoreEnabled: false`

Nao ha query vetorial, worker de reindexacao, populacao automatica de embeddings ou indice HNSW/IVFFlat nesta fase.

## Seguranca

- Frontend nao foi alterado e nao chama provider de embeddings.
- Auth/SSO, RBAC, MCP e runtime nao foram alterados.
- O texto enviado para embedding nao e logado pelo modulo.
- Inputs e outputs brutos nao sao persistidos nem retornados em metadata quando os flags de armazenamento estao desligados.
- Testes usam HTTP mockado e nao dependem de internet.

## Proximo Passo

A Fase 10G deve definir o fluxo controlado para persistir embeddings em `knowledge_chunk_embeddings`, com job/reindexacao governado, auditoria, idempotencia e sem mudar a query RAG principal antes de um gate explicito de retrieval semantico.
