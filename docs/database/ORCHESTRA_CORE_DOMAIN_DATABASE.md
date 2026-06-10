# Orchestra Core Domain Database

Status: migrations incrementais da Fase 05 e Fase 05B.

## Migration

Foi adicionada a migration:

```txt
backend/prisma/migrations/20260610110000_phase05_core_domain/migration.sql
```

Alteracoes:

- `workspaces.description` como campo opcional.
- indice `audit_logs_entity_idx` para filtros por entidade.

Nao houve migration destrutiva.

Foi adicionada a migration:

```txt
backend/prisma/migrations/20260610143000_phase05b_assistant_governance/migration.sql
```

Alteracoes:

- campos adicionais em `assistant_versions`: `description`, `configuration`, `archived_at`;
- refinamento de `assistant_shares` com target e permission;
- nova tabela `assistant_publications`;
- nova tabela `assistant_feedback`;
- nova tabela `assistant_test_results`;
- indice unico parcial para garantir no maximo uma publicacao ativa por assistant.

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
- `AssistantPublication`
- `AssistantShare`
- `AssistantFeedback`
- `AssistantTestResult`
- `AuditLog`

Publicacao agora e estruturada por `AssistantPublication`, com `Assistant.status`, `AssistantVersion.status` e `AssistantVersion.publishedAt` como estados auxiliares de leitura.

## Seed

O seed permanece idempotente e foi expandido com permissoes:

- `roles.manage`
- `permissions.manage`
- `settings.read`
- `assistants.unpublish`
- `assistants.rollback`
- `assistants.restore`
- `assistants.feedback.read`
- `assistants.feedback.create`
- `assistants.testResults.read`
- `assistants.testResults.create`

O workspace padrao recebe descricao estrutural.

## Limites

- Nao ha dados reais de IA.
- Nao ha vector store.
- Nao ha secrets persistidos em banco.
- Nao ha tabela dedicada de publicacoes nesta fase.
