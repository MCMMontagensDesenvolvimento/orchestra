# Infrastructure

Status: operacional para infraestrutura local fullstack da Fase 05D e validacao Agno local opcional da Fase 07B.

Esta pasta concentra infraestrutura, ambientes e operacao.

## Documentos

- `ORCHESTRA_LOCAL_DEV_INFRASTRUCTURE.md`: base de Dockerfiles, Docker Compose, portas, healthchecks, variaveis e comandos locais.
- `ORCHESTRA_FULLSTACK_LOCAL_DEVELOPMENT.md`: execucao local com `frontend`, `backend` e `db`, API real, smoke fullstack e checklist de navegacao manual.
- `ORCHESTRA_AGNO_LOCAL_RUNTIME_SETUP.md`: mock Agno local, smoke dedicado e variaveis para backend em `RUNTIME_PROVIDER=agno`.
- `../backend/ORCHESTRA_BACKEND_OPERATIONAL_VALIDATION.md`: validacao operacional local de backend, banco, migrations, seed e smoke tests.

## Base Atual

- Compose de desenvolvimento com `frontend`, `backend` e `db`.
- Compose de producao estrutural.
- Dockerfile de desenvolvimento e producao para frontend.
- Dockerfile de desenvolvimento e producao para backend.
- Healthchecks para frontend, backend e PostgreSQL.
- Smoke local fullstack em `scripts/smoke-local.sh`.
- Smoke Agno local opcional em `scripts/smoke-agno-local.sh`.

## Fora Do Escopo Atual

- Deploy real de producao.
- CI/CD.
- Secrets management gerenciado.
- Backups e restore.
- Observabilidade gerenciada.
