# Orchestra Agno Local Runtime Setup

Status: implementado na Fase 07B.

## Objetivo

Este documento descreve como validar a integracao local Agno-compatible sem instalar Agno real e sem alterar o compose principal.

## Mock Runtime

Executar somente o mock:

```bash
AGNO_MOCK_PORT=7777 node scripts/agno-mock-runtime.mjs
```

Endpoints:

- `GET http://127.0.0.1:7777/health`
- `GET http://127.0.0.1:7777/capabilities`
- `POST http://127.0.0.1:7777/runs`

## Smoke Dedicado

Pre-requisitos:

- PostgreSQL local ou container `db` disponivel;
- migrations aplicadas;
- seed executado;
- dependencias do backend instaladas.

Com banco local exposto em `localhost:5432`:

```bash
./scripts/smoke-agno-local.sh
```

Por padrao o script:

- sobe `scripts/agno-mock-runtime.mjs` em `127.0.0.1:7777`;
- sobe backend em `localhost:3001` com `RUNTIME_PROVIDER=agno`;
- valida `/runtime/config`, `/runtime/providers`, `/runtime/health`;
- cria assistant, knowledge base, documento, binding RAG, MCP server/tool/binding;
- cria `AgentRun` em sandbox via Agno mock;
- valida eventos `agno.*` e `runtime.*`.

Para usar backend ja iniciado manualmente:

```bash
START_BACKEND=false BASE_URL=http://localhost:3000 ./scripts/smoke-agno-local.sh
```

Nesse caso, o backend existente precisa estar iniciado com as flags Agno habilitadas.

## Variaveis Principais

```env
RUNTIME_PROVIDER=agno
AGNO_ENABLED=true
AGNO_EXECUTION_ENABLED=true
AGNO_BASE_URL=http://127.0.0.1:7777
AGNO_HEALTHCHECK_ENABLED=true
AGNO_REQUIRE_SANDBOX=true
AGNO_ALLOW_EXTERNAL_TOOLS=false
AGNO_ALLOW_REMOTE_MCP=false
```

## Limites

O compose principal nao inclui Agno real. O smoke padrao `scripts/smoke-local.sh` continua usando provider local e nao depende do mock.
