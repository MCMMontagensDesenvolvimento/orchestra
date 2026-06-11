# Orchestra RAG Retrieval Contract Handoff

Status: implementado na Fase 06C como contrato local para fase futura de runtime.

## O Que Esta Pronto

- Readiness refinado por assistant.
- Query local deterministica por keyword.
- Persistencia de `RagQuery`.
- Persistencia de `RagQueryResult`.
- Citations via `KnowledgeChunk` e `KnowledgeSourceReference`.
- Historico consultavel por assistant.
- Detalhe e sources consultaveis por query.
- Auditoria de request, completion, no results, blocked e failed.
- Frontend com readiness, formulario de query, fontes/citacoes e historico.

## Contrato Para Runtime Futuro

Um runtime futuro pode consumir o contrato assim:

1. Chamar readiness do assistant.
2. Chamar `POST /api/v1/assistants/:id/rag/query`.
3. Receber `sources` ordenadas por `rank`.
4. Incluir `citationLabel`, `excerpt`, `documentTitle` e `sourceUri` no contexto de resposta.
5. Persistir `ragQueryId` em metadata de eventos futuros de runtime.
6. Usar `GET /api/v1/rag/queries/:queryId/sources` para auditoria ou reconstruir evidencias.

## Campos Importantes

- `queryId`: correlacao de auditoria.
- `status`: `completed`, `no_results`, `blocked` ou `failed`.
- `sources[].citationLabel`: label humano para citações.
- `sources[].chunkId`: evidencia textual recuperada.
- `sources[].sourceReferenceId`: fonte rastreavel.
- `sources[].excerpt`: trecho limitado para contexto.
- `warnings`: limitacoes nao bloqueantes.
- `reasons`: bloqueios estruturados.

## Fora Do Escopo Mantido

- Resposta gerada por LLM.
- Retrieval semantico.
- Embeddings.
- Vector store.
- Reranking real.
- Streaming.
- Provider externo.
- Execucao MCP real.
- Parser robusto de arquivos.

## Evolucao Recomendada

1. Separar permissao dedicada `rag.query` quando o modelo operacional exigir.
2. Introduzir embeddings em pipeline controlado e manter `RagQuery.mode`.
3. Adicionar vector store em fase propria, preservando `RagQueryResult` como fonte auditavel.
4. Correlacionar `RagQuery` com `AgentRun` quando o runtime real passar a usar fontes.
5. Adicionar metricas de qualidade, cobertura de fonte e taxa de no results.
