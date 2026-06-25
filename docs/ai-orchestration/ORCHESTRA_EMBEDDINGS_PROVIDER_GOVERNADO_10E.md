# Orchestra - Fase 10E: Embedding Provider Governado

Status: implementado como contrato backend-only para provider real governado, sem chamada externa automatica e sem RAG semantico ativo.

## Objetivo

A Fase 10E evolui a base fail-closed da 10D para reconhecer provider real de embeddings de forma governada no backend. O modulo passa a diferenciar provider desabilitado, provider selecionado sem configuracao suficiente e provider configurado com execucao real ainda bloqueada.

## Decisao de Execucao

Nesta fase, o adapter OpenAI e estrutural. Ele valida readiness e contratos internos, mas nao implementa chamada HTTP real. Mesmo quando `EMBEDDINGS_EXECUTION_ENABLED=true` for solicitado, a readiness permanece em `configured_but_execution_disabled` porque a execucao real fica para fase posterior.

Essa decisao evita chamada acidental para provider externo antes dos guardrails finais de execucao, auditoria, custo, limites e reprocessamento.

## Configuracao Backend-Only

Defaults seguros:

```bash
EMBEDDINGS_ENABLED=false
EMBEDDINGS_PROVIDER=disabled
EMBEDDINGS_EXECUTION_ENABLED=false
EMBEDDINGS_MODEL=
EMBEDDINGS_DIMENSION=
EMBEDDINGS_STORE_RAW_INPUTS=false
EMBEDDINGS_STORE_RAW_OUTPUTS=false
```

Para o adapter estrutural OpenAI, a readiness considera configurado somente quando:

- `EMBEDDINGS_ENABLED=true`
- `EMBEDDINGS_PROVIDER=openai`
- `OPENAI_API_KEY` esta configurada no backend
- `EMBEDDINGS_MODEL` esta configurado
- `EMBEDDINGS_DIMENSION` esta configurado

A chave OpenAI nao e retornada em readiness, logs, docs ou testes.

## Estados de Readiness

Default:

```json
{
  "enabled": false,
  "configured": false,
  "executionEnabled": false,
  "provider": "disabled",
  "status": "disabled",
  "failClosed": true
}
```

Provider OpenAI selecionado sem configuracao suficiente:

```json
{
  "enabled": true,
  "configured": false,
  "executionEnabled": false,
  "provider": "openai",
  "status": "misconfigured",
  "failClosed": true
}
```

Provider OpenAI configurado, com execucao real ainda bloqueada:

```json
{
  "enabled": true,
  "configured": true,
  "executionEnabled": false,
  "provider": "openai",
  "status": "configured_but_execution_disabled",
  "failClosed": true
}
```

## Erros de Dominio

- `EMBEDDINGS_DISABLED`: embeddings desabilitados.
- `EMBEDDING_PROVIDER_NOT_CONFIGURED`: provider selecionado sem credencial, modelo ou dimensao suficiente.
- `EMBEDDING_EXECUTION_DISABLED`: provider configurado, mas execucao real bloqueada nesta fase.

Nenhum erro deve conter chave, token, header Authorization, texto bruto de input ou output bruto.

## Integracao com RAG

O readiness de RAG continua carregando a subestrutura `embeddings`, mas o retrieval permanece lexical/local:

- `retrievalMode: local_chunks_only`
- `embeddingsEnabled: false`
- `vectorStoreEnabled: false`

Nao ha alteracao em `queryRag`, ingestion, chunking, populacao de `knowledge_chunk_embeddings`, worker de reindexacao ou indice vetorial.

## Garantias

- Nao ha alteracao no frontend.
- Nao ha alteracao em Auth/SSO, RBAC, MCP ou runtime.
- Nao ha endpoint publico novo.
- Nao ha chamada externa a OpenAI, Azure OpenAI, Anthropic, Ollama, Hugging Face ou outro provider.
- Nao ha segredo real em `.env.example`, testes ou documentacao.

## Proximo Passo

A Fase 10F deve implementar a execucao real de embeddings com cliente HTTP injetavel/mockavel, auditoria, limites, timeout, custo estimado, testes sem internet e um caminho explicito para populacao controlada de `knowledge_chunk_embeddings`.
