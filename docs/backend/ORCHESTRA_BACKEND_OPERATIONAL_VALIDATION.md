# Orchestra Backend Operational Validation

Status: validado localmente em 2026-06-10.

Este documento registra a validacao operacional local da fundacao backend criada na Fase 04. A validacao usou PostgreSQL real em container, backend real em container, migrations Prisma, seed, healthchecks e chamadas HTTP contra `localhost:3000`.

## Objetivo

Comprovar que a fundacao backend/API/banco roda localmente de ponta a ponta em ambiente Docker/dev, sem implementar novas features de produto e sem integrar o frontend ao backend.

## Pre-Requisitos

- Docker com suporte a Compose.
- Node.js/npm instalados no ambiente local para validacoes estaticas.
- Arquivos de exemplo existentes:
  - `.env.example`
  - `backend/.env.example`
  - `frontend/.env.example`
- Arquivos locais criados a partir dos exemplos:
  - `.env`
  - `backend/.env`

Os arquivos `.env` locais sao ignorados pelo git e nao devem ser versionados.

## Validacao Estatica

Executado em `backend/`:

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run prisma:generate
npx prisma validate
npm audit --audit-level=high
```

Resultado:

- `lint`: sucesso.
- `typecheck`: sucesso.
- `test -- --run`: sucesso, 4 arquivos e 8 testes.
- `build`: sucesso.
- `prisma:generate`: sucesso.
- `prisma validate`: sucesso.
- `npm audit --audit-level=high`: sucesso, 0 vulnerabilidades.

Executado na raiz:

```bash
docker compose -f docker-compose.dev.yml config
docker compose -f docker-compose.prod.yml config
```

Resultado:

- Compose dev: config valido.
- Compose prod: config valido.

## Subida Local

Banco:

```bash
docker compose -f docker-compose.dev.yml up -d db
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs db --tail=100
```

Resultado:

- Container `orchestra-db-1` criado e iniciado.
- Healthcheck do PostgreSQL: `healthy`.
- Porta publicada: `5432`.
- Logs indicaram `database system is ready to accept connections`.

Backend:

```bash
docker compose -f docker-compose.dev.yml build backend
docker compose -f docker-compose.dev.yml up -d backend
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs backend --tail=150
```

Resultado:

- Imagem `orchestra-backend` criada.
- Container `orchestra-backend-1` criado e iniciado.
- Healthcheck do backend: `healthy`.
- Porta publicada: `3000`.
- Logs indicaram `Orchestra backend listening`.

## Migrations E Seed

Executado dentro do container backend:

```bash
docker compose -f docker-compose.dev.yml exec -T backend npx prisma migrate deploy
docker compose -f docker-compose.dev.yml exec -T backend npx prisma migrate status
docker compose -f docker-compose.dev.yml exec -T backend npx prisma db seed
```

Resultado:

- Migration aplicada: `20260609170000_initial_foundation`.
- Status de migrations: `Database schema is up to date`.
- Seed executado com sucesso.
- Seed reexecutado com sucesso para validar idempotencia basica.
- Nao houve erro de constraint, unique violation, env ausente, connection refused, table not found, drift ou permission denied.

## Endpoints Testados

Sem cookie:

| Metodo | Caminho | Status |
| --- | --- | --- |
| GET | `/health` | 200 |
| GET | `/health/db` | 200 |
| GET | `/api/v1/auth/me` | 401 |

Com dev-login:

| Metodo | Caminho | Status |
| --- | --- | --- |
| POST | `/api/v1/auth/dev-login` | 200 |
| GET | `/api/v1/auth/me` | 200 |

Endpoints fundacionais com cookie:

| Metodo | Caminho | Status |
| --- | --- | --- |
| GET | `/api/v1/tenants` | 200 |
| GET | `/api/v1/workspaces` | 200 |
| GET | `/api/v1/users` | 200 |
| GET | `/api/v1/roles` | 200 |
| GET | `/api/v1/permissions` | 200 |
| GET | `/api/v1/assistants` | 200 |
| GET | `/api/v1/audit-logs` | 200 |

CRUD minimo de assistants:

| Metodo | Caminho | Status |
| --- | --- | --- |
| POST | `/api/v1/assistants` | 201 |
| GET | `/api/v1/assistants` | 200 |
| GET | `/api/v1/assistants/{id}` | 200 |
| PATCH | `/api/v1/assistants/{id}` | 200 |

Erros estruturados:

| Metodo | Caminho | Status | Resultado |
| --- | --- | --- | --- |
| GET | `/api/v1/rota-inexistente` | 404 | JSON com `status`, `code`, `message`, `requestId`. |
| POST | `/api/v1/assistants` com `name` vazio | 422 | JSON com `fieldErrors` e `requestId`. |

## Auth Dev-Only

Payload usado:

```json
{
  "email": "admin.dev@orchestra.local"
}
```

Resultado:

- `POST /api/v1/auth/dev-login` retornou 200.
- Resposta criou cookie `orchestra_session` com `HttpOnly` e `SameSite=Lax`.
- `GET /api/v1/auth/me` com cookie retornou usuario autenticado.
- Resposta incluiu tenant, workspace, roles e permissions.
- Resposta nao incluiu senha, hash ou token no corpo JSON.
- Bloqueio de dev-login em producao permanece coberto por teste automatizado.

## Logs E Auditoria

Logs:

- Logs do backend contem `requestId`.
- Headers `cookie` e `set-cookie` aparecem como `[redacted]`.
- Checagem textual em logs nao encontrou JWT, senha dummy, `JWT_SECRET` ou placeholders de API key.

Auditoria:

- Endpoint `/api/v1/audit-logs` retornou eventos.
- Eventos observados na validacao:
  - `dev_login`
  - `assistant_created`
  - `assistant_updated`

## Smoke Script

Foi criado:

```bash
scripts/smoke-local.sh
```

Uso:

```bash
scripts/smoke-local.sh
```

Variaveis opcionais:

```bash
BASE_URL=http://localhost:3000 DEV_EMAIL=admin.dev@orchestra.local scripts/smoke-local.sh
```

O script valida:

- `/health`
- `/health/db`
- `/api/v1/auth/me` sem cookie
- `/api/v1/auth/dev-login`
- `/api/v1/auth/me` com cookie
- `/api/v1/assistants` com cookie

Resultado da execucao local:

```txt
OK health 200
OK health-db 200
OK auth-me-no-cookie 401
OK dev-login 200
OK auth-me 200
OK assistants 200
Smoke local concluido.
```

## Problemas Encontrados

- A primeira tentativa de `docker compose -f docker-compose.dev.yml up -d backend` excedeu o timeout da chamada durante o build da imagem. Nenhum container backend foi criado nessa tentativa. Correcao operacional: executar `docker compose -f docker-compose.dev.yml build backend` explicitamente e depois `up -d backend`.
- Alguns comandos ad hoc de curl falharam por quoting entre PowerShell e WSL ao passar JSON inline. Correcao operacional: executar os curls por script temporario dentro do WSL. A API respondeu corretamente.

## Correcoes Feitas

- Criados `.env` e `backend/.env` locais a partir dos exemplos. Esses arquivos sao ignorados pelo git.
- Criado `scripts/smoke-local.sh` para smoke local nao destrutivo.
- Criada esta documentacao de validacao operacional.
- Atualizados indices de documentacao relacionados.

Nao houve necessidade de alterar contratos de API, schema Prisma, seed, Dockerfiles ou Compose durante esta fase.

## Pendencias

- Build dev do backend ainda e relativamente lento na primeira execucao por instalar pacotes do sistema e dependencias npm.
- Compose de producao foi validado estruturalmente, mas nao houve deploy real de producao.
- Frontend segue mockado e nao foi integrado ao backend.
- Runtime de IA, RAG, MCP, providers reais, SSE de chat e SSO real continuam fora do escopo.

## Proximo Passo Recomendado

Fase 05 - Core Domain + Integracao Frontend Progressiva.
