# Orchestra Core Domain API

Status: contratos operacionais da Fase 05.

Todas as rotas de gestao usam `/api/v1`, JSON, cookie HttpOnly e erro estruturado com `requestId`.

## Paginacao

Listagens aceitam:

```txt
page=1
perPage=20
search=
sortBy=
sortDirection=asc|desc
```

Resposta:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 0,
    "totalPages": 0
  },
  "requestId": "req_..."
}
```

## Auth

- `POST /auth/dev-login`
- `POST /auth/logout`
- `GET /auth/me`

`dev-login` e exclusivo de ambiente nao produtivo.

## Core Domain

- `GET /tenants`
- `GET /tenants/:id`
- `PATCH /tenants/:id`
- `GET /workspaces`
- `GET /workspaces/:id`
- `POST /workspaces`
- `PATCH /workspaces/:id`
- `GET /users`
- `GET /users/:id`
- `POST /users`
- `PATCH /users/:id`
- `GET /roles`
- `GET /roles/:id`
- `POST /roles`
- `PATCH /roles/:id`
- `POST /roles/:id/permissions/:permissionId`
- `DELETE /roles/:id/permissions/:permissionId`
- `GET /permissions`
- `GET /permissions/:id`
- `GET /settings`

## Assistants

- `GET /assistants`
- `GET /assistants/:id`
- `POST /assistants`
- `PATCH /assistants/:id`
- `POST /assistants/:id/archive`
- `GET /assistants/:id/versions`
- `POST /assistants/:id/versions`
- `GET /assistants/:id/versions/:versionId`
- `POST /assistants/:id/publish`
- `POST /assistants/:id/unpublish`
- `GET /assistants/:id/shares`
- `POST /assistants/:id/shares`
- `DELETE /assistants/:id/shares/:shareId`

Publicacao e compartilhamento sao estruturais. Nenhum runtime de assistant e acionado.

## Audit Logs

`GET /audit-logs` aceita filtros:

```txt
page
perPage
search
sortBy
sortDirection
action
entity
actorUserId
from
to
```

O payload retornado evita metadata bruta para reduzir risco de exposicao de dados sensiveis.
