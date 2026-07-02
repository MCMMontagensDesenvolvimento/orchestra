# Orchestra MVP Agno Runtime Handoff 14H

## 1. Resumo executivo

A Fase 14H fecha o MVP tecnico da integracao entre o Orquestra e um runtime Agno-compatible. O resultado consolida contrato, runtime HTTP minimo, adapter backend, fluxo real de `AgentRun`, RAG governado, descriptors governados de tools/MCP, observabilidade, limites, auditoria, smoke seguro e roteiro operacional.

O Orquestra permanece como control plane. O runtime Agno permanece como executor. Nenhum default operacional foi relaxado: o provider padrao continua local, o Agno HTTP continua desligado, RAG e tools para runtime continuam desligados e `maxToolCalls=0` continua sendo o default seguro.

## 2. Estado final do MVP tecnico

O MVP permite acionar o runtime HTTP Agno-compatible somente por configuracao explicita do backend. Quando habilitado, o backend monta uma `AssistantRuntimeSpecV1` validada, chama `/execute` por server-to-server, valida `RuntimeExecuteResponseV1`, normaliza eventos, registra usage/auditoria e devolve resposta publica sanitizada.

O runtime HTTP minimo e deterministico. Ele valida `/health`, `/capabilities` e `/execute`, aceita contexto governado ja resolvido, nao faz chamada de rede externa, nao consulta MCP remoto, nao executa tools externas e nao chama provider real.

## 3. Entregas das fases 14A a 14G

- 14A: contrato versionado `AssistantRuntimeSpecV1`, request/response, eventos, erros, health e capabilities com schemas Zod strict.
- 14B: runtime HTTP minimo Agno-compatible com sandbox deterministico.
- 14C: provider backend `agno_http`, client HTTP server-to-server e builder seguro da spec.
- 14D: endpoint real de `AgentRun` usando `agno_http` por configuracao, sem fallback silencioso.
- 14E: RAG governado como `resolved_context`, atras de flag explicita e sem retrieval livre no runtime.
- 14F: descriptors governados de tools/MCP como `tools.mode=gateway`, atras de flag explicita e sem MCP remoto direto.
- 14G: observabilidade, limites, usage e auditoria ponta a ponta com metadata sanitizada.

## 4. O que a 14H validou e endureceu

A 14H consolidou o handoff operacional e adicionou um smoke de MVP seguro que reaproveita o smoke de contrato do runtime HTTP minimo e valida que `frontend/src` nao contem chamada direta ao runtime Agno.

Tambem foi adicionada cobertura unitario-documental para garantir que os smoke scripts do runtime Agno permanecam presentes, sem comandos destrutivos e sem secrets reais hardcoded.

## 5. Arquitetura final

```txt
Frontend
  -> Backend Orquestra API
    -> auth/RBAC/tenant/workspace/assistant
    -> AgentRun service
    -> runtime registry
    -> AssistantRuntimeSpecV1 builder
    -> agno_http adapter
    -> Agno-compatible runtime HTTP
    -> RuntimeExecuteResponseV1 validada
    -> eventos, usage, auditoria e resposta publica sanitizados
```

Responsabilidades:

- Frontend: chama somente o backend Orquestra.
- Orquestra: decide identidade, escopo, RBAC, policies, RAG, tools, limites, auditoria e observabilidade.
- Runtime Agno: executa somente a spec recebida e devolve resposta normalizada.
- Server-to-server: `backend -> runtime` com header de seguranca opcional, nunca exposto ao frontend.

## 6. Fluxo ponta a ponta

1. `POST /api/v1/assistants/:id/runs` entra no backend.
2. Auth, RBAC, tenant, workspace e assistant sao validados.
3. O precheck define se a execucao pode seguir.
4. O `RuntimeExecutionContext` e montado com dados autorizados.
5. O runtime registry seleciona `RUNTIME_PROVIDER`.
6. O builder monta `AssistantRuntimeSpecV1` com RAG/tools somente quando flags explicitas permitem.
7. O adapter `agno_http` valida a request e chama `/execute`.
8. O client valida a response pelo contrato V1 e normaliza usage inseguro.
9. O service persiste status, eventos, metadata segura, usage e auditoria.
10. A API publica retorna apenas dados sanitizados.

## 7. Flags e variaveis

Runtime principal:

```txt
RUNTIME_PROVIDER=local
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_DEFAULT_TIMEOUT_MS=15000
RUNTIME_REQUEST_TIMEOUT_MS=15000
RUNTIME_REQUIRE_PRECHECK=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
RUNTIME_ALLOW_EXTERNAL_TOOLS=false
```

Agno HTTP:

```txt
AGNO_RUNTIME_HTTP_ENABLED=false
AGNO_RUNTIME_HTTP_BASE_URL=http://127.0.0.1:8091
AGNO_RUNTIME_HTTP_TIMEOUT_MS=15000
AGNO_RUNTIME_HTTP_SECURITY_KEY=
```

RAG governado:

```txt
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES=5
AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS=1200
AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS=6000
```

Tools/MCP governados:

```txt
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_DESCRIPTORS=8
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
AGNO_RUNTIME_HTTP_MAX_TOOL_SCHEMA_CHARS=6000
```

## 8. Defaults seguros

O default preservado e:

```txt
RUNTIME_PROVIDER=local
AGNO_RUNTIME_HTTP_ENABLED=false
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
RUNTIME_ALLOW_EXTERNAL_TOOLS=false
```

Com esses valores, o backend nao chama o runtime HTTP Agno, nao envia RAG ao runtime, nao envia descriptors de tools e nao autoriza tool calls.

## 9. Como rodar o runtime HTTP minimo

Em um terminal:

```bash
cd backend
npm run agno:runtime
```

Por padrao, o servidor usa:

```txt
AGNO_RUNTIME_HTTP_HOST=127.0.0.1
AGNO_RUNTIME_HTTP_PORT=8091
```

Endpoints locais:

```txt
GET  http://127.0.0.1:8091/health
GET  http://127.0.0.1:8091/capabilities
POST http://127.0.0.1:8091/execute
```

## 10. Como executar smoke e testes

Smoke de contrato do runtime:

```bash
scripts/smoke-agno-runtime-contract.sh
```

Smoke de MVP:

```bash
scripts/smoke-agno-runtime-mvp.sh
```

O smoke de MVP valida o runtime HTTP minimo e a fronteira de frontend. Ele nao exige banco real, nao sobe stack complexa, nao chama internet, nao chama provider externo, nao chama MCP remoto e nao usa segredo real.

Suite backend recomendada:

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

Se `migrate status` falhar com `P1001` em `db:5432`, tratar como limitacao ambiental e nao executar reset/drop de banco.

## 11. Como habilitar em ambiente controlado

Habilitacao minima para homologacao controlada:

```txt
RUNTIME_PROVIDER=agno_http
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
AGNO_RUNTIME_HTTP_ENABLED=true
AGNO_RUNTIME_HTTP_BASE_URL=http://127.0.0.1:8091
AGNO_RUNTIME_HTTP_TIMEOUT_MS=15000
AGNO_RUNTIME_HTTP_SECURITY_KEY=<valor-operacional>
```

Para RAG governado:

```txt
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=true
```

Para descriptors governados de tools/MCP:

```txt
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=true
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
```

`AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS` so deve ser maior que zero em uma fase futura com gateway governado de execucao de tools.

## 12. Como desabilitar e rollback

Rollback operacional simples:

```txt
RUNTIME_PROVIDER=local
AGNO_RUNTIME_HTTP_ENABLED=false
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
```

Essa configuracao volta o `AgentRun` ao runtime local deterministico e impede chamadas HTTP ao runtime Agno.

## 13. Como validar que frontend nao chama Agno

Comando local:

```bash
grep -RInE "AGNO_RUNTIME_HTTP|127\.0\.0\.1:8091|localhost:8091|/execute\b" frontend/src || true
```

Resultado esperado: nenhuma ocorrencia. O teste `runtime-frontend-boundary.test.ts` e o smoke de MVP tambem validam essa fronteira.

## 14. Como validar que secrets nao vazam

Greps recomendados:

```bash
grep -RInE "sk-[A-Za-z0-9]|Bearer [A-Za-z0-9]|OPENAI_API_KEY=.*[A-Za-z0-9]{12,}|AZURE_OPENAI_API_KEY=.*[A-Za-z0-9]{12,}|MCP_.*KEY=.*[A-Za-z0-9]{12,}|MCP_.*TOKEN=.*[A-Za-z0-9]{12,}" backend/prisma backend/src backend/tests scripts docs/ai-orchestration || true
```

Ocorrencias aceitaveis ficam restritas a valores sinteticos em testes defensivos ou exemplos sem segredo real.

## 15. Limites atuais

- Sem streaming.
- Sem provider externo real no runtime minimo.
- Sem retrieval livre no runtime.
- Sem MCP remoto direto pelo runtime.
- Sem tool execution externa real.
- Sem dashboard novo.
- Sem enforcement amplo de quotas fora do caminho ja instrumentado.
- Sem retry/circuit breaker avancado no client HTTP.
- Sem smoke end-to-end com banco real nesta subfase.

## 16. Observabilidade, auditoria e usage

O caminho `agno_http` registra traceId, runId, requestId, provider, status, errorCode seguro, latencia, usage valido, hashes, contadores de RAG/tools, flags externas e summaries de limites.

Nao sao persistidos em metadata publica: prompt bruto, output bruto, documentos brutos, excerpts completos, `inputSchema` completo, manifests, headers, Authorization, cookies, credentials, API keys, tokens, secrets, URLs internas ou payloads brutos do provider/runtime.

## 17. O que ainda nao esta implementado

- Runtime Agno produtivo externo com provider real.
- Streaming.
- Gateway produtivo de tool call.
- Execucao MCP remota produtiva.
- Retrieval livre dentro do runtime.
- Chat frontend produtivo completo.
- Dashboard operacional de runtime/observabilidade.
- LLM-as-judge.
- Scheduler, worker ou queue.
- Billing novo.

## 18. Riscos remanescentes

- Um runtime produtivo futuro precisa manter o mesmo contrato e a mesma disciplina de sanitizacao.
- Homologacao com banco real ainda depende de ambiente disponivel.
- Rotacao de `AGNO_RUNTIME_HTTP_SECURITY_KEY` e controles de rede ficam para operacao futura.
- Retry, circuit breaker e backoff permanecem fora do MVP.
- Excerpts RAG permitidos ainda podem conter informacao de negocio; o controle atual e scoping, limites e ausencia de documento bruto.

## 19. Checklist de homologacao

- Confirmar branch e commit base esperados.
- Rodar `npm run typecheck`, `npm run lint`, testes, build e Prisma.
- Rodar `scripts/smoke-agno-runtime-mvp.sh`.
- Confirmar `git diff --check` sem saida.
- Confirmar frontend sem referencias diretas a Agno.
- Confirmar greps sem segredo real.
- Confirmar `RUNTIME_PROVIDER=local` no default.
- Confirmar `AGNO_RUNTIME_HTTP_ENABLED=false` no default.
- Confirmar RAG/tools desligados por default.
- Confirmar ausencia de migration/schema/seed.

## 20. Checklist de producao futura

- Definir runtime Agno produtivo e rede privada.
- Definir rotacao e escopo da security key.
- Adicionar observabilidade operacional de disponibilidade do runtime.
- Avaliar retry/circuit breaker com limites explicitos.
- Validar homologacao com banco e dados reais controlados.
- Definir gateway governado para tool calls antes de elevar `maxToolCalls`.
- Definir plano de rollout progressivo por ambiente/tenant/workspace.

## 21. Proximos passos pos-MVP

Proximas fases recomendadas:

- homologacao controlada do `agno_http` com runtime real;
- melhoria operacional de resiliencia do client HTTP;
- gateway governado para execucao de tools, se aprovado;
- dashboards ou consultas operacionais sobre usage/auditoria;
- eventual streaming, mantendo contrato versionado e sanitizacao.

