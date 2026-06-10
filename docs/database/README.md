# Database

Status: operacional para a fundacao da Fase 04, incrementos da Fase 05 e governanca de assistants da Fase 05B.

Esta pasta concentra a modelagem de dados do Orchestra.

## Documentos

- `ORCHESTRA_DATABASE_FOUNDATION.md`: Prisma schema, migracao inicial, seed, convencoes, auditoria e limites atuais.
- `ORCHESTRA_CORE_DOMAIN_DATABASE.md`: migrations incrementais, seed e limites de banco da Fase 05/05B.

## Base Atual

- PostgreSQL.
- Prisma ORM.
- UUID como identificador primario.
- `tenant_id` e `workspace_id` desde o inicio.
- Migration inicial versionada.
- Migration incremental de core domain versionada.
- Migration de governanca de assistants versionada.
- Seed dummy para desenvolvimento.
