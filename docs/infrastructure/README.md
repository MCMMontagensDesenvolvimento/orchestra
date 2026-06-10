# Infrastructure

Status: operacional para infraestrutura local da Fase 04.

Esta pasta concentra infraestrutura, ambientes e operacao.

## Documentos

- `ORCHESTRA_LOCAL_DEV_INFRASTRUCTURE.md`: Dockerfiles, Docker Compose, portas, healthchecks, variaveis e comandos locais.
- `../backend/ORCHESTRA_BACKEND_OPERATIONAL_VALIDATION.md`: validacao operacional local de backend, banco, migrations, seed e smoke tests.

## Base Atual

- Compose de desenvolvimento com `frontend`, `backend` e `db`.
- Compose de producao estrutural.
- Dockerfile de desenvolvimento e producao para backend.
- Healthchecks para backend e PostgreSQL.
- Smoke local nao destrutivo em `scripts/smoke-local.sh`.

## Fora Do Escopo Atual

- Deploy real de producao.
- CI/CD.
- Secrets management gerenciado.
- Backups e restore.
- Observabilidade gerenciada.
