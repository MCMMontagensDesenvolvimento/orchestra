# Database

Status: operacional para a fundacao da Fase 04, incrementos da Fase 05, governanca de assistants/agent runs das Fases 05B/05C/05E, catalogo Knowledge/MCP da Fase 06, chunks/source references da Fase 06B e RAG query da Fase 06C.

Esta pasta concentra a modelagem de dados do Orchestra.

## Documentos

- `ORCHESTRA_DATABASE_FOUNDATION.md`: Prisma schema, migracao inicial, seed, convencoes, auditoria e limites atuais.
- `ORCHESTRA_CORE_DOMAIN_DATABASE.md`: migrations incrementais, seed e limites de banco da Fase 05/05B/05C.
- `ORCHESTRA_RUNTIME_EXECUTION_MODEL.md`: AgentRun, AgentRunEvent, indices, relacoes e limites de persistencia.
- `ORCHESTRA_KNOWLEDGE_MCP_CATALOG_MODEL.md`: tabelas, relacoes, indices e limites do catalogo Knowledge/RAG/MCP.
- `ORCHESTRA_KNOWLEDGE_CHUNKS_DATA_MODEL.md`: KnowledgeChunk, KnowledgeSourceReference, KnowledgeIngestionEvent e colunas de ingestao local.
- `ORCHESTRA_RAG_QUERY_DATA_MODEL.md`: RagQuery, RagQueryResult, relacoes, indices e limites de persistencia.

## Base Atual

- PostgreSQL.
- Prisma ORM.
- UUID como identificador primario.
- `tenant_id` e `workspace_id` desde o inicio.
- Migration inicial versionada.
- Migration incremental de core domain versionada.
- Migration de governanca de assistants versionada.
- Migration de approval e execution governance versionada.
- Migration de runtime execution governance versionada.
- Migration de catalogo Knowledge/MCP versionada.
- Migration de ingestao local, chunks e source references versionada.
- Migration de RAG query local e resultados versionada.
- Seed dummy para desenvolvimento.
