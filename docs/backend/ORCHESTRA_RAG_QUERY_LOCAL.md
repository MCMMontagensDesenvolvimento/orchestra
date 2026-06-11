# Orchestra RAG Query Local

Status: implementado na Fase 06C como retrieval local deterministico. Nao executa LLM, embeddings, vector store, provider externo, runtime real ou MCP real.

## Objetivo

A Fase 06C transforma os chunks e source references da ingestao local em um contrato governado de consulta. O backend continua sendo o control plane: valida sessao, permissao, tenant, workspace, assistant, bindings habilitados, readiness, auditoria e persistencia da consulta.

## Fluxo

1. O cliente chama `POST /api/v1/assistants/:id/rag/query`.
2. O backend valida payload, sessao e permissao `knowledge.read`.
3. O backend calcula readiness do assistant a partir de bindings de Knowledge habilitados.
4. Se nao houver fontes prontas, cria `RagQuery` com `status=blocked` e retorna razoes estruturadas.
5. Se houver fontes prontas, busca chunks ativos de Knowledge Bases vinculadas ao assistant.
6. A busca usa matching local por keyword e score deterministico sobre titulo, conteudo e metadata de fonte.
7. O backend persiste `RagQuery` e `RagQueryResult` com excerpts limitados, ranks, scores e citation labels.
8. A resposta retorna fontes/citacoes para uma resposta futura, sem gerar texto por LLM.

## Retrieval Local

O retrieval atual usa `local_keyword`. Ele prioriza previsibilidade e rastreabilidade:

- apenas Knowledge Bases vinculadas ao assistant;
- apenas bindings habilitados e nao `disabled`;
- apenas bases ativas;
- apenas documentos nao arquivados com `ingestionStatus=completed`;
- apenas chunks ativos;
- fallback local limitado quando o filtro SQL nao encontra candidatos, permitindo score normalizado no service;
- limite maximo de 20 resultados por request.

## Readiness

`GET /api/v1/assistants/:id/rag/readiness` retorna:

- `ready`;
- `knowledgeBaseCount`;
- `documentCount`;
- `chunkCount`;
- `sourceReferenceCount`;
- `enabledBindingCount`;
- `blockedReasons`;
- `warnings`;
- campos legados preservados para compatibilidade.

Razoes esperadas incluem `NO_KNOWLEDGE_BINDINGS`, `NO_ENABLED_KNOWLEDGE_BINDINGS`, `NO_INGESTED_DOCUMENTS`, `NO_CHUNKS_AVAILABLE`, `KNOWLEDGE_BASE_ARCHIVED` e `WORKSPACE_SCOPE_MISMATCH`.

## Auditoria

Eventos emitidos:

- `rag_query_requested`;
- `rag_query_completed`;
- `rag_query_no_results`;
- `rag_query_blocked`;
- `rag_query_failed`;
- `rag_source_returned`.

Audit logs gravam ids, status, contadores, request id e listas de ids. Conteudo completo de documento, chunk completo, prompt final, secrets e payloads extensos nao sao gravados em auditoria.

## Limites

- Nao ha retrieval semantico.
- Nao ha embeddings.
- Nao ha vector store.
- Nao ha resposta gerada por LLM.
- Nao ha runtime real de IA.
- Nao ha execucao MCP real.
- Excerpts persistidos sao limitados e nao substituem o documento original.
