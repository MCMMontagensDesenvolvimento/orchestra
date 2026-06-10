# Database

Status: operacional para a fundacao da Fase 04.

Esta pasta concentra a modelagem de dados do Orchestra.

## Documentos

- `ORCHESTRA_DATABASE_FOUNDATION.md`: Prisma schema, migracao inicial, seed, convencoes, auditoria e limites atuais.

## Base Atual

- PostgreSQL.
- Prisma ORM.
- UUID como identificador primario.
- `tenant_id` e `workspace_id` desde o inicio.
- Migration inicial versionada.
- Seed dummy para desenvolvimento.
