# Backend

Status: operacional para a fundacao da Fase 04, core domain inicial da Fase 05 e governanca de assistants da Fase 05B.

Esta pasta concentra a documentacao do backend real do Orchestra.

## Documentos

- `ORCHESTRA_BACKEND_FOUNDATION.md`: stack, estrutura, modulos, seguranca inicial, testes e limites da fundacao.
- `ORCHESTRA_BACKEND_OPERATIONAL_VALIDATION.md`: evidencias da validacao local com Docker, PostgreSQL, migrations, seed, healthchecks e smoke tests.
- `ORCHESTRA_CORE_DOMAIN_BACKEND.md`: modulos, policies, auditoria e limites do core domain da Fase 05.
- `ORCHESTRA_PHASE_05_HANDOFF.md`: handoff tecnico, validacoes e pendencias da Fase 05.
- `ORCHESTRA_PHASE_05B_ASSISTANT_GOVERNANCE_HANDOFF.md`: handoff tecnico da governanca de assistants, publicacao, rollback, feedback e test results.

## Escopo Atual

- Express + TypeScript strict.
- Prisma + PostgreSQL.
- Zod para validacao.
- Pino para logs.
- Cookie HttpOnly com JWT para sessao de desenvolvimento.
- RBAC/ABAC estrutural.
- Auditoria inicial.
- Endpoints base e CRUD minimo de assistentes.
- Core domain inicial com tenants, workspaces, users, roles, permissions, assistants, audit logs e settings.
- Governanca de assistants com publicacoes versionadas, rollback, feedback e test results manuais/simulados.
- Smoke local em `scripts/smoke-local.sh`.

## Fora Do Escopo Atual

- SSO corporativo.
- Runtime de IA.
- Providers reais.
- RAG, MCP, vector store e streaming.
- Workers e filas.
