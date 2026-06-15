# Orchestra LLM Provider Backend Handoff

Status: implementado na Fase 07C.

## Arquitetura

Novo modulo backend:

- `backend/src/modules/llm/llm.types.ts`
- `backend/src/modules/llm/llm.config.ts`
- `backend/src/modules/llm/llm.registry.ts`
- `backend/src/modules/llm/llm.service.ts`
- `backend/src/modules/llm/llm.controller.ts`
- `backend/src/modules/llm/llm.routes.ts`
- `backend/src/modules/llm/providers/local-llm-provider.ts`
- `backend/src/modules/llm/providers/external-fail-closed-provider.ts`

O modulo registra contracts para providers externos, mas so o provider local deterministico executa.

## Runtime Adapter

`LocalDeterministicRuntimeAdapter` chama `llmService.generateForRuntime` com provider `local_deterministic`.

O fluxo preservado:

1. Auth e RBAC.
2. Workspace scope.
3. Execution precheck.
4. Runtime context governado.
5. RuntimeAdapter.
6. LLM provider local.
7. AgentRun e AgentRunEvent persistidos.

## Persistencia

Nao houve migration Prisma nesta fase.

Permissoes adicionadas ao seed:

- `llm.providers.read`
- `llm.providers.test`
- `llm.config.read`

## Testes

Adicionado `backend/tests/api/llm.test.ts` para cobrir:

- catalogo autenticado;
- bloqueio sem auth/permissao;
- config sanitizada;
- geracao local deterministica;
- provider externo desabilitado bloqueado;
- validacao estruturada `422`.
