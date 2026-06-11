# Orchestra RAG Query Data Model

Status: implementado na Fase 06C por migration `20260611210000_phase06c_rag_query`.

## Tabelas

### `rag_queries`

Registra cada tentativa de consulta RAG local.

Campos principais:

- `id`;
- `tenant_id`;
- `workspace_id`;
- `assistant_id`;
- `assistant_version_id`;
- `agent_run_id`;
- `query_text`;
- `normalized_query`;
- `mode`;
- `status`;
- `result_limit`;
- `result_count`;
- `blocked_reason`;
- `error_code`;
- `error_message`;
- `created_by_id`;
- `request_id`;
- `trace_id`;
- `metadata`;
- `created_at`.

Status esperados:

- `completed`;
- `no_results`;
- `blocked`;
- `failed`.

Modos esperados:

- `local_keyword`;
- `local_readiness`;
- `future_vector`.

### `rag_query_results`

Registra cada fonte retornada para uma query.

Campos principais:

- `id`;
- `tenant_id`;
- `workspace_id`;
- `rag_query_id`;
- `knowledge_base_id`;
- `document_id`;
- `chunk_id`;
- `source_reference_id`;
- `rank`;
- `score`;
- `match_type`;
- `excerpt`;
- `citation_label`;
- `metadata`;
- `created_at`.

`excerpt` e limitado pelo service. O documento completo e o chunk completo nao sao duplicados nesta tabela.

## Relacoes

- `RagQuery` pertence a tenant, workspace, assistant, usuario criador e opcionalmente assistant version e agent run.
- `RagQueryResult` pertence a `RagQuery`, Knowledge Base, documento, chunk e opcionalmente source reference.
- `RagQueryResult` usa `@@unique([ragQueryId, rank])` para manter ranking deterministico por query.

## Indices

As tabelas possuem indices por:

- tenant;
- workspace;
- assistant;
- assistant version;
- agent run;
- usuario criador;
- status;
- mode;
- request id;
- trace id;
- created at;
- query/result ids;
- knowledge/document/chunk/source ids.

## Limites De Persistencia

- A pergunta e persistida nesta fase por ser ambiente de desenvolvimento/control plane.
- Auditoria nao armazena pergunta completa.
- Resultados persistem excerpt limitado, score, rank e ids de fonte.
- Conteudo integral permanece em `knowledge_documents` e `knowledge_chunks`.
- A ligacao opcional com `AgentRun` prepara correlacao futura, mas nao torna runtime obrigatorio.
