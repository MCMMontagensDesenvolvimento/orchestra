# Orchestra Knowledge Chunks Data Model

Status: implementado na migration `20260611190000_phase06b_knowledge_ingestion`.

## Novas Tabelas

### `knowledge_chunks`

Armazena chunks textuais locais.

Campos principais:

- `tenant_id`
- `workspace_id`
- `knowledge_base_id`
- `document_id`
- `chunk_index`
- `content`
- `content_hash`
- `token_estimate`
- `char_count`
- `status`
- `metadata`

### `knowledge_source_references`

Prepara citacoes futuras e preview de fonte.

Campos principais:

- `document_id`
- `chunk_id`
- `label`
- `source_type`
- `source_uri`
- `section_title`
- `page_number`
- `start_offset`
- `end_offset`

### `knowledge_ingestion_events`

Registra eventos estruturados do job de ingestao.

Campos principais:

- `job_id`
- `event_type`
- `level`
- `message`
- `metadata`

## Colunas Adicionadas

`knowledge_documents`:

- `content_text`
- `content_hash`
- `ingested_at`
- `chunk_count`

`knowledge_ingestion_jobs`:

- `strategy`
- `chunks_created`
- `source_references_created`
- `created_by_id`

## Fora Do Modelo

Nao existem tabelas de embeddings, vetores, indices vetoriais, traces de retrieval semantico ou credenciais de providers.
