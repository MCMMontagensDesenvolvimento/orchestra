# Orchestra Local Development Infrastructure

Status: operacional e atualizado na Fase 05D.

Este documento registra a infraestrutura local criada para desenvolver a fundacao backend e atualizada para execucao fullstack local. O objetivo e permitir subir frontend, backend e PostgreSQL em Docker Compose sem introduzir servicos futuros como Redis, vector store, runtime de IA ou MCP server dedicado.

## Arquivos

- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- `.env.example`
- `backend/Dockerfile.dev`
- `backend/Dockerfile.prod`
- `frontend/Dockerfile.dev`
- `frontend/Dockerfile.prod`
- `frontend/.dockerignore`
- `backend/.env.example`
- `frontend/.env.example`
- `frontend/public/health.html`

## Compose De Desenvolvimento

Servicos:

- `frontend`: imagem local de desenvolvimento com Node.js, porta `5173`, executa Vite em `0.0.0.0`.
- `backend`: imagem local de desenvolvimento, porta `3000`, executa `npx prisma generate` e `npm run dev`.
- `db`: PostgreSQL 16 Alpine, porta `5432`.

Volumes:

- `frontend_node_modules`
- `backend_node_modules`
- `db_data`

Healthchecks:

- `frontend`: `GET /health.html`.
- `backend`: `GET /health`.
- `db`: `pg_isready`.

Comando base:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Depois que o banco estiver disponivel:

```bash
docker compose -f docker-compose.dev.yml exec backend npm run prisma:migrate:deploy
docker compose -f docker-compose.dev.yml exec backend npm run prisma:seed
```

Fluxo fullstack recomendado:

```bash
docker compose -f docker-compose.dev.yml up -d db backend frontend
./scripts/smoke-local.sh
```

## Execucao Local Sem Docker

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

O backend usa `PORT=3000` por padrao. O frontend usa `5173`.

## Compose De Producao

`docker-compose.prod.yml` e estrutural nesta fase. Ele define:

- build de frontend com `frontend/Dockerfile.prod`.
- build de backend com `backend/Dockerfile.prod`.
- PostgreSQL sem porta publica exposta.
- healthchecks para frontend, backend e banco.
- variaveis por `env_file`.

Ele nao representa deploy final, secrets management, TLS, backup, observabilidade gerenciada, autoscaling ou CI/CD.

## Variaveis

Raiz:

- `COMPOSE_PROJECT_NAME`
- `TZ`

Backend:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `FRONTEND_ORIGIN`
- `JWT_SECRET`
- `JWT_EXPIRES_IN_SECONDS`
- `COOKIE_NAME`
- `COOKIE_SECURE`
- `COOKIE_SAME_SITE`
- `BCRYPT_SALT_ROUNDS`
- `LOG_LEVEL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Variaveis futuras de IA e providers existem apenas como placeholders backend-only no `.env.example`; nao sao consumidas pelo codigo desta fase.

Frontend:

- `VITE_APP_NAME`
- `VITE_APP_ENV`
- `VITE_API_BASE_URL`
- `VITE_USE_MOCKS`
- `VITE_MOCK_DELAY_MS`
- `VITE_MOCK_SCENARIO`

O modo fullstack local usa `VITE_USE_MOCKS=false` e `VITE_API_BASE_URL=http://localhost:3000/api/v1`.

## Validacoes Estruturais

Validadas nesta fase:

```bash
docker compose -f docker-compose.dev.yml config
docker compose -f docker-compose.prod.yml config
```

Nao foi feito deploy de producao nesta fase.

## Guia Fullstack

O procedimento detalhado de execucao local ponta a ponta esta em `ORCHESTRA_FULLSTACK_LOCAL_DEVELOPMENT.md`.
