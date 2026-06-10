# Database

Status: operacional para a fundacao da Fase 04 e incrementos da Fase 05.

Esta pasta concentra a modelagem de dados do Orchestra.

## Documentos

- `ORCHESTRA_DATABASE_FOUNDATION.md`: Prisma schema, migracao inicial, seed, convencoes, auditoria e limites atuais.
- `ORCHESTRA_CORE_DOMAIN_DATABASE.md`: migration incremental, seed e limites de banco da Fase 05.

## Base Atual

- PostgreSQL.
- Prisma ORM.
- UUID como identificador primario.
- `tenant_id` e `workspace_id` desde o inicio.
- Migration inicial versionada.
- Migration incremental de core domain versionada.
- Seed dummy para desenvolvimento.
