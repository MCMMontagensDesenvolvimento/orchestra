# Orchestra Knowledge Ingestion Pipeline

Status: implementado na Fase 06B como ingestao local controlada para texto simples.

## Objetivo

A Fase 06B transforma o catalogo Knowledge em uma base operacional inicial para preparacao de RAG. O backend continua sendo a autoridade de permissao, escopo, auditoria e persistencia. A ingestao atual e sincrona, local e limitada a `contentText` em documentos cadastrados.

## Fluxo

1. O usuario cria ou atualiza um `KnowledgeDocument` com `contentText`.
2. `POST /api/v1/knowledge-documents/:documentId/request-ingestion` valida permissao, tenant, workspace, documento ativo e conteudo textual.
3. O backend cria um `KnowledgeIngestionJob` com estrategia `local_text_chunking`.
4. Chunks ativos anteriores do documento sao marcados como `stale`.
5. O chunker local cria `KnowledgeChunk`.
6. O backend cria `KnowledgeSourceReference` para cada chunk.
7. O documento recebe `ingestionStatus=completed`, `status=indexed`, `ingestedAt`, `contentHash` e `chunkCount`.
8. O job recebe contadores e eventos estruturados.

## Limites

- Sem parser robusto de PDF, DOCX ou arquivos binarios.
- Sem worker ou fila real.
- Sem embeddings.
- Sem vector store.
- Sem chamada a LLM, provider externo, runtime Agno ou execucao MCP.
- Limite documentado de 100000 caracteres por documento textual.

## Auditoria

Eventos auditados:

- `knowledge_document_ingestion_requested`
- `knowledge_ingestion_started`
- `knowledge_ingestion_completed`
- `knowledge_ingestion_failed`
- `knowledge_chunks_created`
- `knowledge_source_references_created`

O conteudo bruto do documento nao e gravado em audit logs.

## Handoff

A evolucao natural e mover o processamento para worker dedicado, adicionar extracao segura de arquivos, classificar conteudo antes de persistir, gerar embeddings e persistir vetores em tecnologia definida em fase posterior.
