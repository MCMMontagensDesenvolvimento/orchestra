# Backend

Status: operacional para a fundacao da Fase 04.

Esta pasta concentra a documentacao do backend real do Orchestra.

## Documentos

- `ORCHESTRA_BACKEND_FOUNDATION.md`: stack, estrutura, modulos, seguranca inicial, testes e limites da fundacao.
- `ORCHESTRA_BACKEND_OPERATIONAL_VALIDATION.md`: evidencias da validacao local com Docker, PostgreSQL, migrations, seed, healthchecks e smoke tests.

## Escopo Atual

- Express + TypeScript strict.
- Prisma + PostgreSQL.
- Zod para validacao.
- Pino para logs.
- Cookie HttpOnly com JWT para sessao de desenvolvimento.
- RBAC/ABAC estrutural.
- Auditoria inicial.
- Endpoints base e CRUD minimo de assistentes.
- Smoke local em `scripts/smoke-local.sh`.

## Fora Do Escopo Atual

- SSO corporativo.
- Runtime de IA.
- Providers reais.
- RAG, MCP, vector store e streaming.
- Workers e filas.
