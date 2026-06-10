# Orchestra Phase 05 Handoff

Status: handoff tecnico da Fase 05.

## Entregue

- Core domain backend expandido para tenants, workspaces, users, roles, permissions, assistants, audit logs e settings.
- `auth/me` em contrato proprio para bootstrap do frontend.
- Frontend com modo API real controlado por `VITE_USE_MOCKS=false`.
- Assistants com list/detail/create/update/publish/archive estrutural.
- Assistant versions e shares estruturais.
- Audit logs para acoes criticas do core domain.
- Migration nao destrutiva para `Workspace.description` e indice de auditoria.
- Seed idempotente expandido.
- Smoke local ampliado para endpoints da Fase 05.
- Preparacao documental de Microsoft SSO.

## Como Validar Localmente

Backend:

```bash
cd backend
npm run prisma:generate
npx prisma validate
npm run lint
npm run typecheck
npm run test -- --run
npm run build
```

Frontend:

```bash
cd frontend
npm run lint
npm run typecheck
npm run test -- --run
npm run build
```

Compose:

```bash
docker compose -f docker-compose.dev.yml config
docker compose -f docker-compose.prod.yml config
```

Smoke:

```bash
scripts/smoke-local.sh
```

## Nao Implementado

- Microsoft SSO real.
- OpenAI, Anthropic ou outro provider real.
- Runtime de agents.
- RAG real.
- MCP real.
- Vector store.
- Streaming/SSE real de chat.
- CI/CD ou deploy de producao.

## Pendencias Recomendadas

- Avaliar se `AssistantPublication` dedicada sera necessaria para workflow de aprovacao e rollback.
- Adicionar endpoint real para feedback/test results de assistants em fase posterior.
- Revisar autorizacao por roles com escopos mais granulares quando houver usuarios reais alem do seed local.
- Validar fluxo frontend API mode com Docker e banco local apos aplicar migrations e seed.
