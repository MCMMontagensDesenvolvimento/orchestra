# Orchestra Phase 05B Assistant Governance Handoff

Status: entregue para governanca inicial de assistentes.

## Escopo Entregue

- Workflow de publicacao refinado com entidade dedicada `AssistantPublication`.
- Publicacao ativa apontando para uma versao especifica de assistant.
- Despublicacao, arquivamento, restauracao e rollback preservando historico.
- `AssistantVersion` expandida com `description`, `configuration` e `archivedAt`.
- Endpoints reais de feedback e resultados de teste manual/simulado.
- Policies server-side por acao de assistant.
- Novas permissoes de publicacao, rollback, feedback, test results e restore.
- Auditoria de acoes criticas e bloqueios de permissao.
- Frontend em modo API real conectado a publicacao, despublicacao, rollback, feedback e test results.
- Mock mode preservado em `VITE_USE_MOCKS=true`.
- Smoke local ampliado para o ciclo principal de governanca.

## Endpoints Novos Ou Alterados

- `POST /api/v1/assistants/:id/versions`
- `GET /api/v1/assistants/:id/versions`
- `GET /api/v1/assistants/:id/versions/:versionId`
- `POST /api/v1/assistants/:id/publish`
- `POST /api/v1/assistants/:id/unpublish`
- `POST /api/v1/assistants/:id/archive`
- `POST /api/v1/assistants/:id/restore`
- `POST /api/v1/assistants/:id/rollback`
- `GET /api/v1/assistants/:id/publications`
- `GET /api/v1/assistants/:id/publications/active`
- `GET /api/v1/assistants/:id/feedback`
- `POST /api/v1/assistants/:id/feedback`
- `GET /api/v1/assistants/:id/test-results`
- `POST /api/v1/assistants/:id/test-results`

Todos mantem JSON, `camelCase`, cookie HttpOnly, request id e erro estruturado.

## Modelos Novos Ou Alterados

- `AssistantPublication`: historico de publicacoes, publicacao ativa, despublicacao e rollback.
- `AssistantFeedback`: feedback por assistant e versao opcional.
- `AssistantTestResult`: resultado manual/simulado por assistant e versao.
- `AssistantVersion`: metadados adicionais e arquivamento.
- `AssistantShare`: campos refinados de target e permission, mantendo campos legados para compatibilidade.

## Fluxo De Publicacao

1. O usuario cria ou edita o assistant.
2. A edicao pelo frontend em API mode cria nova versao draft.
3. `publish` escolhe `versionId` informado ou a versao mais recente.
4. A publicacao ativa anterior e inativada.
5. Uma nova `AssistantPublication` ativa aponta para a versao publicada.
6. Audit log registra assistant, version, publication e ator.

## Rollback

Rollback promove uma versao anterior ou publicacao anterior como nova publicacao ativa. O historico anterior nao e apagado. A publicacao ativa corrente e inativada e a nova publicacao registra `rollbackFromPublicationId` e `rollbackReason` quando informados.

## Feedback E Test Results

Feedback aceita `positive`, `negative` e `neutral`, com `assistantVersionId` opcional. Test results aceitam `passed`, `failed` e `needs_review`, com entrada, comportamento esperado, saida observada, score e notas. Nenhum endpoint chama runtime, LLM, RAG, MCP ou provider real.

## Permissoes Novas

- `assistants.unpublish`
- `assistants.rollback`
- `assistants.restore`
- `assistants.feedback.read`
- `assistants.feedback.create`
- `assistants.testResults.read`
- `assistants.testResults.create`

Permissoes existentes de read/create/update/archive/publish/share permanecem.

## Auditoria

Eventos cobertos:

- `assistant_created`
- `assistant_updated`
- `assistant_archived`
- `assistant_restored`
- `assistant_version_created`
- `assistant_published`
- `assistant_unpublished`
- `assistant_rollback`
- `assistant_share_created`
- `assistant_share_removed`
- `assistant_feedback_created`
- `assistant_test_result_created`
- `permission_denied`

Metadados evitam registrar instructions completas ou payloads brutos sensiveis.

## Frontend Integrado

Em `VITE_USE_MOCKS=false`, o frontend consome API real para:

- listar e detalhar assistants;
- publicar, despublicar, arquivar e restaurar;
- aplicar rollback por versao;
- listar versoes;
- criar/listar feedback;
- criar/listar test results.

As acoes visuais consideram permissoes de `auth/me`, mas o backend continua sendo a autoridade final.

## Migrations E Seed

Migration criada:

```txt
backend/prisma/migrations/20260610143000_phase05b_assistant_governance/migration.sql
```

Seed atualizado com novas permissoes e atribuicoes basicas para `admin_platform`, `creator_owner`, `editor`, `consumer` e `auditor`.

## Testes Executados Durante A Implementacao

Executados durante o desenvolvimento:

```bash
cd backend
npm run prisma:generate
npx prisma validate
npm run typecheck
npm run test -- tests/api/assistants-governance.test.ts --run

cd frontend
npm run typecheck
```

A bateria completa recomendada permanece listada abaixo.

## Smoke Local

`scripts/smoke-local.sh` agora cobre:

- healthchecks;
- dev-login;
- `auth/me`;
- listagens fundacionais;
- create/update assistant;
- create version;
- publish;
- active publication;
- create test result;
- create feedback;
- unpublish;
- audit logs;
- 404 estruturado;
- 422 estruturado.

## Nao Implementado Nesta Fase

- Microsoft SSO real.
- OpenAI, Anthropic, Agno ou provider real.
- Runtime de IA.
- RAG real.
- MCP real.
- Vector store.
- SSE/chat runtime real.
- Tool calling real.
- CI/CD completo.
- Deploy de producao.
- Analytics real.

## Pendencias E Riscos

- Sharing refinado foi preparado em schema/API, mas a UI completa de compartilhamento fica para fase posterior.
- Policies ainda dependem dos dados de roles/permissoes carregados na sessao; revisao sera necessaria com SSO e usuarios reais.
- `AssistantPublication` usa indice unico parcial manual na migration para garantir uma publicacao ativa por assistant.
- Test results e feedback sao registros manuais/simulados e ainda nao representam avaliacoes automatizadas.
- Knowledge, MCP, Chat e Analytics seguem mockados ou estruturais.

## Validacao Recomendada

```bash
cd backend
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run prisma:generate
npx prisma validate
npm audit --audit-level=high

cd frontend
npm run lint
npm run typecheck
npm run test -- --run
npm run build

docker compose -f docker-compose.dev.yml config
docker compose -f docker-compose.prod.yml config
scripts/smoke-local.sh
```
