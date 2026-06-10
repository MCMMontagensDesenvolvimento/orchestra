# Orchestra Core Domain Backend

Status: implementado parcialmente na Fase 05.

Este documento descreve a evolucao do backend do Orchestra para o core domain do control plane. A fase manteve Express, TypeScript, Prisma, PostgreSQL, Zod, cookie HttpOnly e RBAC server-side como base.

## Modulos Evoluidos

- `auth`: `dev-login`, `logout` e `me` com contrato de sessao consumivel pelo frontend.
- `tenants`: listagem paginada, leitura por id e atualizacao restrita ao tenant da sessao.
- `workspaces`: listagem paginada, detalhe, criacao e atualizacao.
- `users`: listagem paginada, detalhe, criacao estrutural e atualizacao de nome/status.
- `roles`: listagem paginada, detalhe, criacao, atualizacao e vinculo de permissoes.
- `permissions`: listagem paginada e detalhe.
- `assistants`: listagem paginada, detalhe, criacao, atualizacao, archive, restore, versions, publication workflow, rollback, feedback, test results e shares.
- `audit`: listagem paginada com filtros.
- `settings`: leitura paginada por tenant e workspace opcional.

## Auth E Sessao

`GET /api/v1/auth/me` retorna:

```json
{
  "user": { "id": "...", "email": "...", "name": "..." },
  "tenant": {},
  "workspaces": [],
  "roles": [],
  "permissions": [],
  "requestId": "req_..."
}
```

O login de desenvolvimento continua bloqueado em `NODE_ENV=production`. A sessao permanece em cookie HttpOnly assinado.

## Policies

As rotas novas usam `requireAuth` e `requirePermission`. Repositorios filtram por `tenantId` e, quando aplicavel, por workspaces da sessao. O frontend continua sendo apenas camada de experiencia, nao autoridade de autorizacao.

## Auditoria

Eventos relevantes gravados:

- `dev_login`
- `logout`
- `tenant_updated`
- `workspace_created`
- `workspace_updated`
- `user_created`
- `user_updated`
- `role_created`
- `role_updated`
- `role_permission_added`
- `role_permission_removed`
- `assistant_created`
- `assistant_updated`
- `assistant_archived`
- `assistant_restored`
- `assistant_version_created`
- `assistant_published`
- `assistant_unpublished`
- `assistant_rollback`
- `assistant_share_created`
- `assistant_share_removed`
- `assistant_feedback_created`
- `assistant_test_result_created`
- `permission_denied`

O endpoint de leitura de auditoria nao retorna `metadata` bruta.

## Limites

- Microsoft SSO real nao foi implementado.
- Runtime de IA, RAG, MCP, providers externos, streaming e vector store nao foram implementados.
- Publicacao de assistant usa `AssistantPublication` dedicada para historico e publicacao ativa por versao.
- Feedback e test results sao registros manuais/simulados, sem runtime de IA.
