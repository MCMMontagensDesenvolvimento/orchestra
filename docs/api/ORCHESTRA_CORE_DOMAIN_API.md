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
- `POST /assistants/:id/restore`
- `GET /assistants/:id/versions`
- `POST /assistants/:id/versions`
- `GET /assistants/:id/versions/:versionId`
- `POST /assistants/:id/publish`
- `POST /assistants/:id/unpublish`
- `POST /assistants/:id/rollback`
- `GET /assistants/:id/publications`
- `GET /assistants/:id/publications/active`
- `GET /assistants/:id/feedback`
- `POST /assistants/:id/feedback`
- `GET /assistants/:id/test-results`
- `POST /assistants/:id/test-results`
- `GET /assistants/:id/shares`
- `POST /assistants/:id/shares`
- `DELETE /assistants/:id/shares/:shareId`

Publicacao aponta para uma versao especifica e cria historico em `AssistantPublication`. Rollback promove versao ou publicacao anterior sem apagar historico. Feedback e test results sao registros manuais/simulados. Nenhum runtime de assistant e acionado.

Payload de `publish`:

```json
{
  "versionId": "uuid-opcional",
  "reason": "texto opcional"
}
```

Payload de `rollback`:

```json
{
  "versionId": "uuid-opcional",
  "publicationId": "uuid-opcional",
  "reason": "motivo operacional"
}
```

Payload de `feedback`:

```json
{
  "assistantVersionId": "uuid-opcional",
  "rating": "positive",
  "comment": "texto opcional"
}
```

Payload de `test-results`:

```json
{
  "assistantVersionId": "uuid-opcional",
  "input": "entrada testada",
  "expectedBehavior": "comportamento esperado",
  "actualOutput": "saida observada",
  "status": "passed",
  "score": 100,
  "notes": "observacoes opcionais"
}
```

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
