# Database

Status: operacional para a fundacao da Fase 04, incrementos da Fase 05 e governanca de assistants/agent runs das Fases 05B/05C/05E.

Esta pasta concentra a modelagem de dados do Orchestra.

## Documentos

- `ORCHESTRA_DATABASE_FOUNDATION.md`: Prisma schema, migracao inicial, seed, convencoes, auditoria e limites atuais.
- `ORCHESTRA_CORE_DOMAIN_DATABASE.md`: migrations incrementais, seed e limites de banco da Fase 05/05B/05C.
- `ORCHESTRA_RUNTIME_EXECUTION_MODEL.md`: AgentRun, AgentRunEvent, indices, relacoes e limites de persistencia.

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
- Seed dummy para desenvolvimento.
