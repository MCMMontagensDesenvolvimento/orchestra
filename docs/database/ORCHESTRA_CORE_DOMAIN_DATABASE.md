# Orchestra Core Domain Database

Status: migration incremental da Fase 05.

## Migration

Foi adicionada a migration:

```txt
backend/prisma/migrations/20260610110000_phase05_core_domain/migration.sql
```

Alteracoes:

- `workspaces.description` como campo opcional.
- indice `audit_logs_entity_idx` para filtros por entidade.

Nao houve migration destrutiva.

## Schema

O schema existente da Fase 04 ja continha as entidades necessarias para a maior parte da Fase 05:

- `Tenant`
- `Workspace`
- `User`
- `Role`
- `Permission`
- `UserRole`
- `RolePermission`
- `WorkspaceMembership`
- `Setting`
- `Assistant`
- `AssistantVersion`
- `AssistantShare`
- `AuditLog`

Publicacao foi estruturada por `Assistant.status`, `AssistantVersion.status` e `AssistantVersion.publishedAt`. Uma entidade dedicada de publicacao pode ser criada em fase posterior se houver workflow de aprovacao, rollback ou historico mais complexo.

## Seed

O seed permanece idempotente e foi expandido com permissoes:

- `roles.manage`
- `permissions.manage`
- `settings.read`

O workspace padrao recebe descricao estrutural.

## Limites

- Nao ha dados reais de IA.
- Nao ha vector store.
- Nao ha secrets persistidos em banco.
- Nao ha tabela dedicada de publicacoes nesta fase.
