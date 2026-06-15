# Infrastructure

Status: operacional para infraestrutura local fullstack da Fase 05D, validacao Agno local opcional da Fase 07B, toolchain security upgrade da Fase 07B.1 e LLM provider env setup da Fase 07C.

Esta pasta concentra infraestrutura, ambientes e operacao.

## Documentos

- `ORCHESTRA_LOCAL_DEV_INFRASTRUCTURE.md`: base de Dockerfiles, Docker Compose, portas, healthchecks, variaveis e comandos locais.
- `ORCHESTRA_FULLSTACK_LOCAL_DEVELOPMENT.md`: execucao local com `frontend`, `backend` e `db`, API real, smoke fullstack e checklist de navegacao manual.
- `ORCHESTRA_AGNO_LOCAL_RUNTIME_SETUP.md`: mock Agno local, smoke dedicado e variaveis para backend em `RUNTIME_PROVIDER=agno`.
- `ORCHESTRA_TOOLCHAIN_SECURITY_UPGRADE.md`: upgrade controlado de Vite, Vitest, plugin React SWC e esbuild transitive para limpar `npm audit --audit-level=high`.
- `ORCHESTRA_LLM_PROVIDER_ENV_SETUP.md`: variaveis backend-only para LLM providers, defaults seguros e bloqueio de execucao externa.
- `../backend/ORCHESTRA_BACKEND_OPERATIONAL_VALIDATION.md`: validacao operacional local de backend, banco, migrations, seed e smoke tests.

## Base Atual

- Compose de desenvolvimento com `frontend`, `backend` e `db`.
- Compose de producao estrutural.
- Dockerfile de desenvolvimento e producao para frontend.
- Dockerfile de desenvolvimento e producao para backend.
- Healthchecks para frontend, backend e PostgreSQL.
- Smoke local fullstack em `scripts/smoke-local.sh`.
- Smoke Agno local opcional em `scripts/smoke-agno-local.sh`.
- Gate de toolchain com `npm audit --audit-level=high` limpo em backend e frontend.
- Env de LLM providers com externos desabilitados por padrao.

## Fora Do Escopo Atual

- Deploy real de producao.
- CI/CD.
- Secrets management gerenciado.
- Backups e restore.
- Observabilidade gerenciada.
