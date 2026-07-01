# Orchestra RAG Governado no Agno Runtime 14E

## 1. Resumo

A Fase 14E permite que o backend do Orquestra envie ao provider `agno_http` contexto RAG ja resolvido pelo control plane, usando `rag.mode=resolved_context` no `AssistantRuntimeSpecV1`.

O default permanece seguro: RAG para runtime HTTP fica desligado, `RUNTIME_PROVIDER=local` continua sendo o padrao operacional, e `AGNO_RUNTIME_HTTP_ENABLED=false` continua impedindo chamadas ao runtime HTTP ate habilitacao explicita.

## 2. Implementado

- Flags backend-only para habilitar contexto RAG governado no runtime HTTP.
- Extensao do builder `buildAssistantRuntimeSpecV1` para montar `rag.resolved_context` somente quando a flag esta ligada e ha fontes seguras no `RuntimeExecutionContext`.
- Allowlist de campos enviados por fonte: `sourceId`, `documentId`, `chunkId`, `title`, `excerpt`, `score` e metadata minima.
- Limites de quantidade de fontes, tamanho por excerpt e tamanho total de contexto RAG.
- Remocao de fonte insegura quando excerpt ou dados derivados violam o contrato.
- Evento backend `runtime.rag_context_attached` com contadores e IDs de fontes, sem excerpts.
- Cobertura de builder, adapter, runtime HTTP minimo e API `AgentRun`.

## 3. Nao implementado

Esta fase nao adiciona frontend, streaming, provider externo real, retrieval livre no Agno, conexao do Agno ao banco, vector store, documentos brutos, MCP real, tool execution, scheduler, worker, queue, dashboard, billing, migration, seed ou alteracao de schema Prisma.

## 4. Relacao com 14A, 14B, 14C e 14D

- 14A definiu o contrato versionado e strict para `AssistantRuntimeSpecV1`, request/response, eventos, erros, health e capabilities.
- 14B criou o runtime HTTP minimo Agno-compatible e deterministico, que aceita `resolved_context` mas nao faz retrieval.
- 14C criou o adapter backend `agno_http`, client server-to-server e builder inicial da spec com RAG desabilitado.
- 14D conectou o endpoint real de `AgentRun` ao provider `agno_http`, preservando default local e fail-closed.
- 14E usa essa mesma fronteira para anexar contexto RAG ja governado pelo Orquestra.

## 5. Montagem do contexto RAG

O Orquestra continua responsavel por tenant, workspace, assistant, auth, RBAC, precheck, knowledge bindings e resumo RAG. O `RuntimeExecutionContext` recebe somente referencias de fonte ja escopadas pelo backend.

O builder transforma essas referencias em `rag.sources` somente quando:

```txt
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=true
context.rag.ragReady=true
context.rag.sourceReferences possui pelo menos uma fonte segura
```

Com a flag desligada, mesmo que existam fontes no contexto, a spec continua:

```txt
rag.enabled=false
rag.mode=none
rag.sources=[]
```

## 6. Campos enviados ao runtime

Cada fonte enviada ao runtime pode conter apenas:

```txt
sourceId
documentId
chunkId
title
excerpt
score
metadata.citationLabel
metadata.sourceIndex
metadata.lastRagQueryId
```

Nao sao enviados `sourceUri`, documento completo, embeddings, query vetorial, conexao de banco, headers, cookies, credentials, apiKey, token, secret, providerApiKey, secretRef, rawPrompt, rawResponse, rawProviderResponse ou rawDocuments.

## 7. Flags e limites

Defaults seguros em `backend/.env.example`:

```txt
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES=5
AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS=1200
AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS=6000
```

Essas flags existem no backend e nao sao adicionadas ao frontend.

Limites aplicados pelo builder:

- maximo de fontes por spec;
- maximo de caracteres por excerpt;
- maximo de caracteres somados no contexto RAG;
- maximo contratual de excerpt preservado pelo schema 14A;
- metadata minima sanitizada pelo contrato.

## 8. Sanitizacao

O builder normaliza textos, trunca valores e descarta fontes que contenham payload sensivel detectado. Metadata arbitraria da fonte nao e repassada. A metadata criada pelo builder passa por `sanitizeRuntimeContractMetadata`.

A validacao final continua sendo `parseAssistantRuntimeSpecV1`. Se o payload final nao passar no schema 14A, o adapter falha fechado antes de chamar `/execute`.

## 9. Fail-closed

O sistema permanece fail-closed nos seguintes casos:

- flag de RAG para runtime desligada;
- nenhuma fonte segura restante;
- spec final invalida;
- adapter HTTP desabilitado;
- base URL ausente ou invalida;
- runtime indisponivel;
- timeout;
- resposta fora do contrato;
- bloqueio normalizado pelo runtime.

Quando nenhuma fonte segura sobra, o builder volta para `rag.mode=none` em vez de enviar payload parcial inseguro.

## 10. Seguranca de documentos e secrets

O runtime recebe somente excerpts limitados, nunca documentos brutos. A resposta publica do `AgentRun` recebe contadores e metadata de runtime sanitizada, nao o corpo completo das fontes.

`AGNO_RUNTIME_HTTP_SECURITY_KEY` continua restrita ao header server-to-server `Authorization` e nao entra na spec, eventos, metadata persistida ou resposta publica.

## 11. Sem retrieval livre no Agno

A 14E nao muda o runtime minimo para buscar em base vetorial, banco ou storage. O runtime apenas recebe `resolved_context` e gera evento `rag.context.attached` quando sources chegam validadas.

O Agno nao decide RBAC, nao escolhe tenant/workspace/assistant e nao executa RAG/MCP fora das policies do Orquestra.

## 12. Modelo dinamico

A montagem RAG nao depende de modelo especifico. O modelo continua vindo do contexto/policy autorizado do assistant, preservando a regra da 14D. Nao ha hardcode de `gpt-4o-mini` no fluxo de runtime/RAG.

## 13. Como testar

Testes focados:

```bash
cd backend
npm run test -- --run   tests/unit/runtime-assistant-spec-builder.test.ts   tests/runtime/runtime-agno-http-adapter.test.ts   tests/runtime/agno-runtime-http.test.ts   tests/api/agent-runs.test.ts   tests/unit/runtime-contract.test.ts   tests/unit/runtime-frontend-boundary.test.ts
```

Validacao completa recomendada:

```bash
cd backend
npm run typecheck
npm run lint
MICROSOFT_SSO_ENABLED=false MICROSOFT_CLIENT_ID= MICROSOFT_CLIENT_SECRET= MICROSOFT_TENANT_ID= MICROSOFT_REDIRECT_URI= MICROSOFT_POST_LOGOUT_REDIRECT_URI= MICROSOFT_ALLOWED_DOMAINS= MICROSOFT_ALLOWED_TENANT_IDS= npm run test -- --run
npm run build
npx prisma validate
npx prisma generate
npx prisma migrate status
```

## 14. Smoke local

Nao foi criado smoke novo nesta fase. O fluxo real de `AgentRun` depende da persistencia do backend; a cobertura de API exercita o service, registry, adapter e transporte HTTP mockado de forma deterministica, sem internet, Docker ou banco real.

## 15. Handoff para 14F

A proxima fase pode tratar rollout operacional do runtime com contexto RAG governado, observabilidade operacional mais rica, retry/circuit breaker e eventualmente integracao com executor real alem do sandbox minimo.

Qualquer passo futuro com retrieval, vector store, MCP ou tools deve continuar atras do Orquestra, com policies, auditoria, limites e validacao de contrato antes do runtime.

## 16. Riscos remanescentes

- O runtime HTTP minimo continua deterministico e nao mede comportamento de um executor produtivo.
- Nao ha smoke end-to-end com banco real nesta fase.
- A selecao de fontes usa o resumo disponivel no `RuntimeExecutionContext`; ranking/retrieval avancado permanece fora desta subfase.
- Ainda nao ha retry ou circuit breaker no client HTTP.
- Excerpts seguros ainda podem conter informacao sensivel de negocio se a governanca anterior permitir; a mitigacao desta fase e limite, scoping e ausencia de documentos brutos.
