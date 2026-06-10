# Orchestra Backend Foundation

Status: operacional desde a Fase 04.

Este documento descreve a fundacao real do backend criada em `backend/`. O objetivo desta fase foi trocar placeholders por uma base executavel de control plane, sem implementar runtime de IA, RAG, MCP, providers externos, streaming, SSO ou integracao com o frontend.

## Stack

- Node.js LTS.
- TypeScript em modo `strict`.
- Express 4.
- Prisma ORM.
- PostgreSQL.
- Zod para validacao de entrada.
- Pino e `pino-http` para logs estruturados.
- Vitest e Supertest para testes unitarios e de API.
- Docker e Docker Compose para desenvolvimento local.

## Estrutura

```txt
backend/
|-- prisma/
|   |-- migrations/
|   |-- schema.prisma
|   `-- seed.ts
|-- src/
|   |-- app/
|   |-- config/
|   |-- infrastructure/
|   |-- modules/
|   `-- shared/
|-- tests/
|-- Dockerfile.dev
|-- Dockerfile.prod
|-- package.json
|-- tsconfig.json
`-- tsconfig.build.json
```

## Modulos Ativos

- `app`: cria a instancia Express, registra middlewares e monta rotas.
- `config`: valida variaveis de ambiente com Zod.
- `infrastructure/prisma`: instancia compartilhada do Prisma Client e lifecycle.
- `infrastructure/logger`: logger Pino.
- `shared/errors`: erro de aplicacao padronizado.
- `shared/middleware`: request id, autenticacao, erro e 404.
- `shared/security`: sessao JWT em cookie HttpOnly e helpers RBAC/ABAC.
- `health`: `/health` e `/health/db`.
- `auth`: dev-login, me e logout.
- `tenants`, `workspaces`, `users`, `roles`, `permissions`: endpoints base de listagem.
- `assistants`: CRUD minimo de assistentes para create, read, update e list.
- `audit`: gravacao e listagem inicial de eventos de auditoria.
- `settings`: ponto estrutural reservado, sem endpoint publico nesta fase.

## Seguranca Inicial

- O login disponivel e `POST /api/v1/auth/dev-login`.
- O dev-login e bloqueado quando `NODE_ENV=production`.
- A sessao usa JWT assinado e cookie HttpOnly.
- O cookie usa nome configuravel por `COOKIE_NAME`.
- As rotas protegidas usam `requireAuth`.
- As rotas sensiveis usam `requirePermission`.
- O escopo de workspace e checado nos fluxos de assistente.
- Eventos de login, logout, create e update de assistentes gravam auditoria.

Esta fundacao ainda nao substitui SSO corporativo, MFA, rotacao real de sessoes, refresh tokens ou politicas finais de producao.

## Erros E Observabilidade

Todas as respostas de erro seguem o formato:

```json
{
  "status": 422,
  "code": "VALIDATION_ERROR",
  "message": "Existem campos invalidos.",
  "fieldErrors": [
    {
      "field": "name",
      "message": "String must contain at least 2 character(s)"
    }
  ],
  "requestId": "req_..."
}
```

O middleware de request id aceita `X-Request-Id` recebido ou gera um novo identificador. O mesmo valor e retornado no header `X-Request-Id` e no corpo das respostas JSON principais.

## Scripts

Executar a partir de `backend/`:

```bash
npm install
npm run prisma:generate
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

Scripts de banco:

```bash
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
npm run prisma:seed
npm run prisma:studio
```

## Testes

A suite atual cobre:

- healthcheck HTTP.
- healthcheck de banco com dependencia injetada.
- 404 estruturado com request id.
- `auth/me` sem cookie.
- `auth/me` com cookie assinado.
- dev-login bloqueado em producao.
- helpers RBAC/ABAC.

## Fora Do Escopo Desta Fase

- Microsoft SSO.
- OpenAI, Anthropic ou outro provider real.
- Runtime de agentes.
- RAG, embeddings ou vector store.
- Execucao MCP.
- SSE ou streaming de respostas de IA.
- Workers, filas e Redis.
- Integracao do frontend com o backend real.
- Hardening completo de producao.
