# Orchestra API Foundation

Status: operacional desde a Fase 04.

Este documento registra os contratos HTTP implementados na fundacao backend. A API de gestao usa REST + JSON e prefixo versionado `/api/v1`. Healthchecks ficam fora do prefixo para facilitar uso por Docker e infraestrutura.

## Convencoes

- Base de gestao: `/api/v1`.
- Healthchecks: `/health` e `/health/db`.
- Autenticacao: cookie HttpOnly com JWT.
- Request id: header `X-Request-Id` opcional na entrada e sempre retornado como `X-Request-Id`.
- Sucesso de listagem/leitura/escrita: `{ "data": ..., "requestId": "..." }`.
- Sucesso de autenticacao: `{ "user": ..., "requestId": "..." }`.
- Logout: `204 No Content`.
- Erros: `{ "status", "code", "message", "fieldErrors?", "requestId" }`.

## Endpoints Publicos

| Metodo | Caminho | Descricao |
| --- | --- | --- |
| GET | `/health` | Verifica se a aplicacao esta viva. |
| GET | `/health/db` | Verifica conectividade com PostgreSQL via Prisma. |
| GET | `/api/v1/auth/sso/config` | Retorna readiness Microsoft SSO sanitizada. |
| GET | `/api/v1/auth/microsoft/start` | Inicia Microsoft Authorization Code Flow. |
| GET | `/api/v1/auth/microsoft/callback` | Valida callback Microsoft e cria sessao Orchestra. |
| POST | `/api/v1/auth/dev-login` | Login de desenvolvimento, bloqueado em producao. |

`POST /api/v1/auth/dev-login` aceita:

```json
{
  "email": "admin.dev@orchestra.local"
}
```

O campo `email` e opcional. Sem ele, o backend usa o usuario dummy criado pela seed.

`GET /api/v1/auth/sso/config` nao exige sessao e retorna somente provider, flags de
readiness, dominios permitidos e a rota interna reservada para login. Client secret,
tokens, authorization code, IDs internos e redirect URIs externas nao sao retornados.
O fluxo backend Microsoft esta ativo quando explicitamente habilitado e configurado.
O frontend da Fase 08C usa esse contrato para habilitar o botao Microsoft apenas
quando o backend permite e redireciona somente para a rota interna de start.

## Endpoints Autenticados

| Metodo | Caminho | Permissao | Descricao |
| --- | --- | --- | --- |
| GET | `/api/v1/auth/me` | sessao valida | Retorna usuario autenticado. |
| POST | `/api/v1/auth/logout` | sessao valida | Limpa cookie de sessao e audita logout. |
| GET | `/api/v1/tenants` | `tenants.read` | Lista tenants ativos. |
| GET | `/api/v1/workspaces` | `workspaces.read` | Lista workspaces do tenant do usuario. |
| GET | `/api/v1/users` | `users.read` | Lista usuarios do tenant do usuario. |
| GET | `/api/v1/roles` | `roles.read` | Lista roles do tenant com permissoes. |
| GET | `/api/v1/permissions` | `permissions.read` | Lista permissoes globais. |
| GET | `/api/v1/audit-logs` | `audit.read` | Lista os 100 eventos mais recentes do tenant. |
| GET | `/api/v1/assistants` | `assistants.read` | Lista assistentes no escopo de workspace do usuario. |
| GET | `/api/v1/assistants/:id` | `assistants.read` | Le assistente por id dentro do escopo. |
| POST | `/api/v1/assistants` | `assistants.create` | Cria assistente e versao inicial. |
| PATCH | `/api/v1/assistants/:id` | `assistants.update` | Atualiza metadados basicos do assistente. |

## Assistants

Payload de criacao:

```json
{
  "workspaceId": "uuid-opcional",
  "name": "Assistant name",
  "description": "Descricao opcional",
  "status": "draft",
  "version": {
    "displayName": "Initial draft",
    "instructions": "Instrucoes opcionais",
    "modelProvider": "provider-opcional",
    "modelName": "modelo-opcional",
    "temperature": 0.2
  }
}
```

Campos de `status` aceitos: `draft`, `published`, `archived`.

Payload de atualizacao:

```json
{
  "name": "Novo nome",
  "description": "Nova descricao",
  "status": "draft"
}
```

A criacao usa o primeiro workspace do usuario quando `workspaceId` nao e informado. Se o workspace informado nao pertencer ao escopo do usuario, a API retorna `403 WORKSPACE_FORBIDDEN`.

## Validacao

Requests com payload invalido retornam `422 VALIDATION_ERROR` e `fieldErrors`. Rotas nao encontradas retornam `404 ROUTE_NOT_FOUND`. Falta de sessao retorna `401 UNAUTHENTICATED`. Falta de permissao retorna `403 FORBIDDEN`.

## Limites Do Contrato Atual

- Nao ha paginacao ou filtros publicos nos endpoints de listagem.
- Nao ha OpenAPI gerado nesta fase.
- Nao ha streaming SSE.
- Nao ha execucao de agentes, chamadas de modelo, RAG, MCP ou tools.
- Nao ha contrato com o frontend real nesta fase.
