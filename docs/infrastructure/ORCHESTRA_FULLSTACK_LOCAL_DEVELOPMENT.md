# Orchestra Fullstack Local Development

Status: operacional para desenvolvimento local fullstack ate a Fase 05F.

## Objetivo

Permitir que o Orchestra rode localmente com frontend, backend e PostgreSQL em Docker Compose, usando API real e banco real para validacao manual no navegador.

Comando principal:

```bash
docker compose -f docker-compose.dev.yml up -d db backend frontend
```

Frontend local:

```txt
http://localhost:5173
```

Backend local:

```txt
http://localhost:3000
```

## Servicos Locais

| Servico | Container | Porta local | Funcao |
| --- | --- | --- | --- |
| `frontend` | React/Vite em Node.js | `5173` | Interface web em modo desenvolvimento. |
| `backend` | Express/TypeScript | `3000` | API real em `/api/v1`, healthchecks e sessao. |
| `db` | PostgreSQL 16 | `5432` | Banco local de desenvolvimento. |

## Variaveis Necessarias

Arquivos de exemplo versionados:

```txt
.env.example
backend/.env.example
frontend/.env.example
```

Arquivos locais recomendados:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Os arquivos `.env` locais nao devem ser versionados.

Variaveis principais do frontend:

```env
VITE_APP_NAME=Orchestra
VITE_APP_ENV=local
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_USE_MOCKS=false
VITE_MOCK_DELAY_MS=400
VITE_MOCK_SCENARIO=success
```

Variaveis principais do backend para local:

```env
DATABASE_URL=postgresql://orchestra:orchestra@db:5432/orchestra
FRONTEND_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
```

Variaveis de SSO, providers de IA, runtime, MCP e vector store permanecem backend-only e nao devem ser adicionadas ao frontend.

## Subir O Ambiente

Subir todos os servicos:

```bash
docker compose -f docker-compose.dev.yml up -d db backend frontend
```

Verificar estado:

```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs backend --tail=100
docker compose -f docker-compose.dev.yml logs frontend --tail=100
```

Healthchecks esperados:

```bash
curl -f http://localhost:5173/health.html
curl -f http://localhost:5173
curl -f http://localhost:3000/health
curl -f http://localhost:3000/health/db
```

## Migrations E Seed

Quando o banco local estiver vazio ou desatualizado:

```bash
docker compose -f docker-compose.dev.yml exec backend npx prisma migrate deploy
docker compose -f docker-compose.dev.yml exec backend npx prisma db seed
```

Para consultar status de migrations:

```bash
docker compose -f docker-compose.dev.yml exec backend npx prisma migrate status
```

## Smoke Local

Com o stack no ar:

```bash
./scripts/smoke-local.sh
```

Variaveis opcionais:

```bash
FRONTEND_URL=http://localhost:5173 BASE_URL=http://localhost:3000 DEV_EMAIL=admin.dev@orchestra.local ./scripts/smoke-local.sh
```

O smoke valida:

- frontend `/health.html` e raiz;
- backend `/health` e `/health/db`;
- `auth/me` sem cookie retornando `401`;
- dev-login com cookie HttpOnly;
- `auth/me` com cookie;
- tenants, workspaces, users, roles, permissions, assistants e audit logs;
- criacao, leitura, update, workflow de approval, publish, precheck, feedback e test result de assistant;
- criacao e leitura de agent runs em modo sandbox e bloqueado, sem provider externo;
- erro `404` estruturado;
- erro `422` estruturado.

O smoke cria registros locais com nome `Smoke Assistant`, versions, approvals, agent runs e audit logs. Em bancos reaproveitados, a lista de assistants pode acumular registros de execucoes anteriores.

## Navegacao Manual

Fluxo recomendado:

1. Acessar `http://localhost:5173/login`.
2. Usar o e-mail `admin.dev@orchestra.local`.
3. Entrar e validar redirecionamento para `/app/dashboard`.
4. Acessar `/app/assistants`.
5. Abrir um assistant existente.
6. Validar a aba `Governanca`.
7. Validar a aba `Execucoes`.
8. Executar acoes basicas ja disponiveis de assistants e governanca em API mode.
9. Verificar o console do navegador. Na Fase 05F nao foram observados erros; apenas warnings conhecidos de future flags do React Router v7.

## Alternar Mock E API Real

API real:

```env
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Mocks locais:

```env
VITE_USE_MOCKS=true
```

Apos alterar `frontend/.env`, reinicie o frontend:

```bash
docker compose -f docker-compose.dev.yml up -d --force-recreate frontend
```

Em build estatico de producao, variaveis `VITE_*` sao aplicadas em build time. Rebuild e necessario quando elas mudam.

## CORS E Cookies

Configuracao local esperada:

- frontend em `http://localhost:5173`;
- backend com `FRONTEND_ORIGIN=http://localhost:5173`;
- API base `http://localhost:3000/api/v1`;
- frontend usando credentials nas chamadas HTTP;
- backend usando cookie HttpOnly;
- `COOKIE_SECURE=false` apenas em local/dev;
- producao deve usar `COOKIE_SECURE=true` com HTTPS.

## Comandos Uteis

Rebuild do frontend:

```bash
docker compose -f docker-compose.dev.yml build frontend
docker compose -f docker-compose.dev.yml up -d frontend
```

Rebuild completo:

```bash
docker compose -f docker-compose.dev.yml build db backend frontend
docker compose -f docker-compose.dev.yml up -d db backend frontend
```

Parar o stack:

```bash
docker compose -f docker-compose.dev.yml down
```

Remover volumes locais de desenvolvimento:

```bash
docker compose -f docker-compose.dev.yml down -v
```

## Troubleshooting

- Frontend nao abre: verificar `docker compose -f docker-compose.dev.yml logs frontend --tail=100`.
- Backend retorna erro de CORS: conferir `FRONTEND_ORIGIN=http://localhost:5173` em `backend/.env`.
- Login nao persiste: conferir `COOKIE_SECURE=false` em local e se o navegador esta usando `localhost`.
- `/health/db` falha: verificar se `db` esta healthy e se `DATABASE_URL` aponta para o service name `db`.
- Alteracao de `VITE_USE_MOCKS` nao refletiu: reiniciar o servico frontend.
- Banco inconsistente: rodar `npx prisma migrate status` dentro do backend e aplicar migrations/seed quando necessario.

## Pendencias

- Compose de producao permanece estrutural e nao substitui deploy real.
- CI/CD, backups, observabilidade gerenciada e secrets management ficam para fase posterior.
- Runtime real de IA, RAG, MCP, providers reais, SSE/chat runtime e SSO real nao fazem parte desta fase.
