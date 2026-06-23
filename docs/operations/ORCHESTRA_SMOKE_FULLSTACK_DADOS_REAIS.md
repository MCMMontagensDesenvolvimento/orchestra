# Orchestra - Smoke Fullstack com Dados Reais

Fase 09E / Sprint 18

## Objetivo

O smoke valida o caminho fullstack local atual com frontend, backend e PostgreSQL reais, sem mock mode e sem depender de seed demo.

O script e deliberadamente nao destrutivo para dados de negocio. Ele nao cria Assistant, Knowledge Base, MCP Server, AgentRun ou qualquer fixture demonstrativa. Listas vazias sao resultados validos.

## Pre-requisitos

- Docker e Docker Compose disponiveis.
- Stack iniciada por `docker-compose.dev.yml`.
- `frontend`, `backend` e `db` em execucao.
- `backend/.env` configurado para o ambiente local, quando necessario.
- `frontend/.env` com `VITE_USE_MOCKS=false`, preferencialmente explicito.
- PostgreSQL acessivel pelo backend.
- Migrations aplicadas.
- Nenhum segredo real registrado em scripts ou documentacao.

Subida recomendada:

```bash
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml ps
```

## Execucao

Na raiz do repositorio:

```bash
bash scripts/smoke-fullstack-real.sh
```

Overrides locais opcionais:

```bash
BASE_URL=http://localhost:3000 \
FRONTEND_URL=http://localhost:5173 \
DEV_EMAIL=admin.dev@orchestra.local \
bash scripts/smoke-fullstack-real.sh
```

Tambem e possivel informar outro arquivo Compose:

```bash
COMPOSE_FILE=docker-compose.dev.yml bash scripts/smoke-fullstack-real.sh
```

## O Que E Validado Automaticamente

1. Docker Compose esta disponivel.
2. Os services `frontend`, `backend` e `db` estao em execucao.
3. `VITE_USE_MOCKS` nao esta ativo nos arquivos de ambiente nem no container frontend.
4. Flags de seed demo nao estao ativas no container backend.
5. `GET /login` retorna HTML pelo frontend.
6. `GET /health` e `GET /health/db` retornam sucesso.
7. `npx prisma migrate status` confirma migrations aplicadas.
8. O bootstrap real roda com `ORCHESTRA_SEED_DEMO=false` e `SEED_DEMO_DATA=false`.
9. Tenant, workspace e admin local do bootstrap existem.
10. O contador do Assistant demo permanece igual antes e depois do bootstrap.
11. `GET /api/v1/auth/me` sem sessao retorna `401`.
12. `GET /api/v1/auth/sso/config` retorna contrato Microsoft sanitizado.
13. Quando dev-login esta habilitado em ambiente nao produtivo, o script cria um cookie jar temporario e valida:
    - `/api/v1/auth/me`;
    - `/api/v1/assistants`;
    - `/api/v1/audit-logs`;
    - `/api/v1/mcp/servers`;
    - `/api/v1/knowledge-bases`;
    - `/api/v1/llm/providers`;
    - `/api/v1/runtime/providers`;
    - `/api/v1/agent-runs`.

Os endpoints de catalogo podem retornar listas vazias. O smoke comprova acesso e contrato HTTP real, nao a existencia de fixtures.

## Bootstrap Sem Seed Demo

O script executa somente:

```bash
docker compose -f docker-compose.dev.yml exec -T backend \
  env ORCHESTRA_SEED_DEMO=false SEED_DEMO_DATA=false \
  npm run prisma:seed
```

Ele nunca chama `prisma:seed:demo` e nunca passa `--demo`.

Antes e depois do bootstrap, o script consulta o contador do ID reservado ao Assistant demo. Qualquer aumento faz o smoke falhar. Dados demo preexistentes sao informados, mas nao sao usados para aprovar checks.

## Autenticacao e SKIPPED

O smoke automatizado nao depende de login Microsoft interativo.

O dev-login e usado somente quando:

- `DEV_LOGIN_ENABLED=true` no container backend; e
- `NODE_ENV` nao e `production`.

Quando essas condicoes nao sao atendidas, o grupo de endpoints autenticados recebe `SKIPPED`. Isso nao representa falha dos checks publicos, de banco, migrations ou bootstrap.

Nesse caso:

1. abra `http://localhost:5173/login`;
2. conclua o login Microsoft com uma conta corporativa permitida;
3. valide a navegacao pos-login manual descrita abaixo.

## Smoke Microsoft Manual

Se `/api/v1/auth/sso/config` indicar `enabled=true` e `configured=true`:

1. Abra `http://localhost:5173/login`.
2. Clique em `Entrar com Microsoft`.
3. Complete o login no Entra ID.
4. Confirme o retorno para `/app/dashboard`.
5. Confirme que a aplicacao obtem a sessao por `/api/v1/auth/me`.
6. Navegue por Dashboard, Assistants, Knowledge, MCP e configuracoes LLM.
7. Abra um Assistant e confirme os paineis Runtime e LLM.
8. Confirme que Chat e Analytics consolidado exibem estado explicito de prototipo/indisponibilidade no modo real.
9. Efetue logout e confirme que a sessao Orchestra e encerrada.

O redirect federado pode ser validado separadamente, com opt-in:

```bash
RUN_REAL_MICROSOFT_SSO_SMOKE=true \
bash scripts/smoke-microsoft-sso-real.sh
```

## Criterios de Sucesso

O resultado esperado termina com:

```text
Smoke summary: PASS=<quantidade> SKIPPED=<quantidade> FAIL=0
RESULT PASS
```

- `PASS`: check automatizado concluido.
- `SKIPPED`: check autenticado nao executado por dev-login indisponivel ou ambiente produtivo.
- `FAIL`: inconsistencia operacional; o script encerra imediatamente.

## Seguranca

- O cookie de dev-login fica somente em arquivo temporario e e removido ao sair.
- Cookies, tokens, secrets e headers sensiveis nao sao impressos.
- O script nao chama Microsoft, OpenAI ou outro provider externo.
- O script apenas consulta catalogos de LLM e Runtime.
- O script nao executa MCP remoto, RAG semantico, embeddings ou vector store.
- O script falha se mock mode estiver ativo.
- O script falha se o ambiente solicitar seed demo.

## Diagnostico Rapido

- Service ausente: execute `docker compose -f docker-compose.dev.yml ps`.
- Health do banco falhou: confira o status do service `db` e `DATABASE_URL`.
- Migration status falhou: revise migrations pendentes antes de aplicar `migrate deploy`.
- Bootstrap falhou: execute manualmente o comando exibido nesta documentacao, mantendo demo desligado.
- Dev-login foi ignorado: use o smoke manual Microsoft ou habilite dev-login somente em ambiente local controlado.
- Frontend esta em mock mode: defina `VITE_USE_MOCKS=false` e recrie/reinicie o service frontend.
