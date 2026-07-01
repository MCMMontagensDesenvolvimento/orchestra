# Orchestra Backend Agno Runtime Adapter 14C

## 1. Resumo da 14C

A Fase 14C conecta o backend principal do Orquestra ao runtime HTTP minimo Agno-compatible criado na 14B, usando o contrato versionado da 14A. A entrega adiciona um provider `agno_http` no registry de runtime, um client HTTP server-to-server, um builder puro de `AssistantRuntimeSpecV1` e testes deterministas para garantir validacao de request/response, fail-closed e ausencia de secrets no payload.

O default permanece seguro: `RUNTIME_PROVIDER=local` e `AGNO_RUNTIME_HTTP_ENABLED=false`.

## 2. O que foi implementado

- Adapter backend `agno_http` em `backend/src/modules/runtime/runtime.agno-http-adapter.ts`.
- Client HTTP server-to-server em `backend/src/modules/runtime/runtime.agno-http-client.ts`.
- Builder puro de `AssistantRuntimeSpecV1` em `backend/src/modules/runtime/runtime.assistant-spec.builder.ts`.
- Registro do provider `agno_http` no runtime registry.
- Flags/envs para habilitar o adapter HTTP sem mudar o default local.
- Validacao local de `RuntimeExecuteRequestV1` antes do envio.
- Validacao de `RuntimeExecuteResponseV1`, health e capabilities recebidos do runtime.
- Mapeamento de erros normalizados para indisponibilidade, timeout, bad request, policy blocked, invalid response e unknown error.
- Testes de client, adapter, spec builder, boundary de frontend e contrato.

## 3. O que nao foi implementado

- Frontend.
- Chat real amplo na UI.
- Streaming.
- Provider externo real.
- Chamada OpenAI, Azure, Anthropic ou equivalente.
- RAG real dentro do Agno/runtime.
- MCP real dentro do Agno/runtime.
- Tool execution gateway.
- Scheduler, worker, queue, dashboard ou billing.
- Migration, seed ou alteracao de schema Prisma.
- Alteracao funcional em RBAC, auth/SSO, observabilidade ou AI Quality.
- Habilitacao de Agno por padrao.

## 4. Relacao com 14A e 14B

A 14A definiu os contratos:

- `AssistantRuntimeSpecV1`;
- `RuntimeExecuteRequestV1`;
- `RuntimeExecuteResponseV1`;
- `RuntimeHealthResponseV1`;
- `RuntimeCapabilitiesResponseV1`;
- eventos e erros normalizados.

A 14B implementou o runtime HTTP minimo com `GET /health`, `GET /capabilities` e `POST /execute`, ainda sem plugar o backend principal.

A 14C usa esses contratos para permitir que o backend principal chame esse runtime como executor. O Orquestra continua sendo o control plane; o runtime nao decide tenant, workspace, assistant, RBAC, policies, secrets, RAG ou MCP.

## 5. Builder de AssistantRuntimeSpecV1

O builder recebe um `RuntimeExecutionContext` ja autorizado pelo backend e monta uma spec allowlist:

- `specVersion = orchestra.runtime.assistant.v1`;
- `policy.executionMode = sync`;
- `policy.streaming = false`;
- `policy.failClosed = true`;
- `rag.enabled = false`;
- `rag.mode = none`;
- `rag.sources = []`;
- `tools.enabled = false`;
- `tools.mode = none`;
- `tools.descriptors = []`;
- `observability` e `limits` derivados do contexto seguro;
- `metadata` sanitizada com `sanitizeRuntimeContractMetadata`.

O builder nao inclui provider API key, headers, base URL, secretRef, raw prompt, raw response, raw provider response ou raw documents.

## 6. Chamada HTTP ao runtime minimo

O client chama somente as rotas internas configuradas:

```txt
GET /health
GET /capabilities
POST /execute
```

O `POST /execute` envia:

```txt
RuntimeExecuteRequestV1
specVersion = orchestra.runtime.execute.v1
assistantRuntimeSpec = AssistantRuntimeSpecV1
```

Antes de enviar, o client valida o payload com `runtimeExecuteRequestV1Schema`. Depois de receber, valida a resposta com `runtimeExecuteResponseV1Schema`. Health e capabilities tambem sao validados pelos schemas 14A.

## 7. Flags e envs

Defaults seguros em `backend/.env.example`:

```txt
RUNTIME_PROVIDER=local
AGNO_RUNTIME_HTTP_ENABLED=false
AGNO_RUNTIME_HTTP_BASE_URL=http://127.0.0.1:8091
AGNO_RUNTIME_HTTP_TIMEOUT_MS=15000
AGNO_RUNTIME_HTTP_SECURITY_KEY=
```

Regras:

- `RUNTIME_PROVIDER=local` preserva o runtime deterministico local como default;
- `AGNO_RUNTIME_HTTP_ENABLED=false` impede chamadas HTTP ao runtime;
- `AGNO_RUNTIME_HTTP_BASE_URL` so e usado pelo backend quando o adapter esta habilitado;
- timeout invalido cai para `15000`;
- security key vazia nao quebra o startup;
- security key nunca entra na spec, responses, events ou mapper publico.

## 8. Fail-closed

O adapter falha fechado nos seguintes casos:

- boundary de runtime desabilitado;
- `AGNO_RUNTIME_HTTP_ENABLED=false`;
- adapter habilitado sem base URL valida;
- erro de rede ou runtime indisponivel;
- timeout;
- resposta fora de `RuntimeExecuteResponseV1`;
- HTTP 400, 403, 408, 413, 415, 504 ou 5xx.

Mapeamento minimo:

```txt
Runtime indisponivel -> RUNTIME_UNAVAILABLE
Timeout -> RUNTIME_TIMEOUT
HTTP 400/413/415 -> RUNTIME_BAD_REQUEST
HTTP 403 -> RUNTIME_POLICY_BLOCKED
Response invalida -> RUNTIME_INVALID_RESPONSE
Erro inesperado -> RUNTIME_UNKNOWN_ERROR
```

Nao ha fallback automatico para outro provider quando o `agno_http` e selecionado e falha.

## 9. Seguranca de secrets

O adapter e o client mantem secrets fora do body:

- `AGNO_RUNTIME_HTTP_SECURITY_KEY`, quando configurada, e enviada apenas como header server-to-server `Authorization`;
- o header nao entra em `AssistantRuntimeSpecV1`;
- o header nao entra em metadata, event, response ou mapper;
- `baseUrl`, `headers`, `apiKey`, `providerApiKey`, `secretRef`, `token`, `rawPrompt`, `rawResponse`, `rawProviderResponse` e `rawDocuments` sao bloqueados/sanitizados pelo contrato e pelos testes;
- erros nao retornam stack trace, raw request, raw response, headers ou secrets.

## 10. Modelo dinamico

O builder nao hardcoda `gpt-4o-mini`. O modelo da spec vem do contexto autorizado:

1. `context.compiledPrompt.modelProvider` e `context.compiledPrompt.modelName`;
2. fallback de provider para `context.llmPolicySnapshot.defaultLlmProvider`;
3. fallback seguro local quando o contexto nao traz modelo.

`OPENAI_DEFAULT_MODEL=gpt-4o-mini` pode continuar existindo como exemplo operacional/env do MVP, mas o adapter/builder/runtime core nao dependem desse valor.

## 11. Como testar localmente

Testes focados:

```bash
cd backend
npm run test -- --run \
  tests/unit/runtime-contract.test.ts \
  tests/unit/runtime-assistant-spec-builder.test.ts \
  tests/runtime/runtime-agno-http-client.test.ts \
  tests/runtime/runtime-agno-http-adapter.test.ts \
  tests/unit/runtime-frontend-boundary.test.ts \
  tests/api/runtime.test.ts
```

Validacao completa recomendada:

```bash
cd backend
npm run typecheck
npm run lint
MICROSOFT_SSO_ENABLED=false \
MICROSOFT_CLIENT_ID= \
MICROSOFT_CLIENT_SECRET= \
MICROSOFT_TENANT_ID= \
MICROSOFT_REDIRECT_URI= \
MICROSOFT_POST_LOGOUT_REDIRECT_URI= \
MICROSOFT_ALLOWED_DOMAINS= \
MICROSOFT_ALLOWED_TENANT_IDS= \
npm run test -- --run
npm run build
npx prisma validate
npx prisma generate
npx prisma migrate status
```

Smoke local end-to-end backend -> runtime minimo nao foi criado nesta fase porque o caminho produtivo de chat/AgentRun ainda depende da arquitetura atual do backend e pode envolver banco. A cobertura 14C valida o adapter diretamente com runtime HTTP mockado, sem internet, sem provider externo e sem banco real.

## 12. Handoff para 14D

A 14D deve plugar este adapter no fluxo de chat real de forma incremental:

- manter o Orquestra como control plane;
- selecionar `agno_http` apenas por flag/config e scoping autorizado;
- resolver tenant, workspace, assistant, model, RAG, MCP, limits e RBAC antes da chamada ao runtime;
- enviar ao runtime apenas `RuntimeExecuteRequestV1`;
- manter RAG/MCP reais atras de gateway/policies do Orquestra;
- registrar auditoria e usage com metadados sanitizados;
- continuar fail-closed em qualquer resposta invalida.

## 13. Riscos remanescentes

- Ainda nao ha smoke end-to-end sem banco para backend -> runtime minimo.
- A integracao com chat real fica para 14D e deve ser feita com rollout controlado.
- RAG/MCP reais continuam fora do runtime nesta fase; a futura integracao precisa preservar gateway e policies do Orquestra.
- A security key do runtime ainda e configuracao simples server-to-server; rotacao, escopo e observabilidade operacional ficam para fases futuras.
