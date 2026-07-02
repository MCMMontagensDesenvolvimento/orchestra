# ORCHESTRA Observabilidade, Limites e Auditoria no Runtime Agno 14G

## 1. Resumo da 14G

A Fase 14G consolida observabilidade, limites e auditoria no caminho real `AgentRun -> runtime registry -> agno_http -> runtime HTTP -> resposta validada`. A entrega nao adiciona nova capacidade de execucao: o Orquestra continua como control plane, o Agno HTTP continua como executor minimo e o default operacional permanece local/desligado.

O foco foi transformar eventos e metadata em trilhas seguras, rastreaveis e auditaveis, usando ids, hashes, contadores, usage e flags booleanas. Prompts, respostas brutas, documentos, excerpts completos, schemas de tools, manifests, headers, secrets, URLs internas e payloads arbitrarios do runtime nao entram na trilha persistida do `AgentRun`.

## 2. O que foi implementado

- Summary seguro de invocacao `agno_http` com provider, spec/protocol version, traceId, runId, requestId, tenantId, workspaceId, assistantId, limites e policy aplicada.
- Medicao de latencia do adapter HTTP e preservacao de `usage` valido retornado pelo runtime.
- Normalizacao defensiva de `usage` no client server-to-server: campos invalidos ou perigosos sao descartados antes da validacao pelo schema V1.
- Metadata publica do `AgentRun` para `agno_http` reduzida a hashes, usage, contadores, status, limites e flags externas.
- Remocao de `outputPreview` e metadata arbitraria de output do caminho persistido do `AgentRun` para `agno_http`.
- Registro compativel com `AiRunUsageEvent` para execucoes do runtime adapter, sem criar billing novo e sem tornar o registro secundario bloqueante.
- Auditoria sanitizada para inicio, conclusao, falha, bloqueio por policy, RAG anexado e descriptors de tools anexados.
- Runtime HTTP minimo com metricas deterministicas: `runtimeLatencyMs=0`, `inputChars`, `ragSourceCount`, `ragContextChars`, `toolDescriptorCount`, `toolCallsExecuted=0`, `externalMcpCalled=false` e `externalProviderCalled=false`.
- Testes cobrindo rastreabilidade, usage, latencia, sanitizacao, eventos, falhas seguras e ausencia de payload bruto.

## 3. O que nao foi implementado

- Frontend, dashboard, streaming, scheduler, worker ou queue.
- Provider externo real novo ou chamada real OpenAI/Azure/Anthropic.
- Retrieval livre no Agno.
- MCP remoto direto no Agno.
- Execucao externa real de tools.
- Billing novo.
- Migration, seed ou alteracao de schema Prisma.
- Habilitacao de Agno, RAG ou tools por padrao.

## 4. Relacao com 14A, 14B, 14C, 14D, 14E e 14F

- 14A definiu o contrato V1 estrito usado para request/response, eventos, erros, health e capabilities.
- 14B criou o runtime HTTP minimo, que agora reporta metricas deterministicas mais completas.
- 14C criou o provider `agno_http`, client server-to-server e builder seguro da spec.
- 14D conectou `AgentRun` ao registry/runtime real por configuracao.
- 14E anexou RAG governado como `resolved_context` apenas com flag explicita.
- 14F anexou descriptors governados de tools/MCP como `tools.mode=gateway` apenas com flag explicita.
- 14G nao amplia execucao; ela consolida rastreabilidade, limites, usage, eventos e auditoria nesse caminho.

## 5. Fluxo de observabilidade ponta a ponta

1. `AgentRun` gera `runId`, `traceId` e usa o `requestId` recebido no contexto HTTP.
2. O runtime registry seleciona o provider configurado.
3. O builder monta `AssistantRuntimeSpecV1` com limites, RAG/tools somente quando habilitados e metadata sanitizada.
4. O adapter `agno_http` cria um summary de invocacao com ids, versoes, policy e limites.
5. O client server-to-server valida a request e normaliza usage inseguro na response antes do schema V1.
6. O adapter normaliza status, usage, latencia, eventos e flags externas.
7. O `AgentRun` persiste metadata segura e eventos normalizados.
8. Auditoria e `AiRunUsageEvent` recebem apenas ids, hashes, contadores e status.

## 6. Eventos e metadata seguros

Eventos do runtime sao mapeados para eventos do `AgentRun` como:

- `agno.request_started`
- `agno.request_completed`
- `agno.request_failed`
- `runtime.rag_context_attached`
- `runtime.mcp_tools_attached`
- `runtime.run_completed`
- `runtime.run_failed`

A metadata segura pode conter:

- `runtime.provider`, `runtime.protocolVersion`, `runtime.specVersion`
- `runtime.traceId`, `runtime.runId`, `runtime.requestId`
- `runtime.inputHash`, `runtime.outputHash`
- `runtime.status`, `runtime.errorCode`, `runtime.latencyMs`
- `runtime.usage.inputTokens`, `runtime.usage.outputTokens`, `runtime.usage.totalTokens`
- `runtime.ragSourceCount`, `runtime.ragContextChars`
- `runtime.toolDescriptorCount`, `runtime.maxToolCalls`, `runtime.toolCallsExecuted`
- `runtime.externalMcpCalled`, `runtime.externalProviderCalled`
- `runtime.policy` e `runtime.limits` como resumo numerico/booleano

## 7. Limites e quotas aplicados

A 14G reutiliza os limites existentes:

- `AGNO_RUNTIME_HTTP_TIMEOUT_MS`
- `AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES`
- `AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS`
- `AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS`
- `AGNO_RUNTIME_HTTP_MAX_TOOL_DESCRIPTORS`
- `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS`
- `AGNO_RUNTIME_HTTP_MAX_TOOL_SCHEMA_CHARS`
- `policy.maxContextChars`
- `policy.maxRagResults`
- `policy.maxToolCalls`

RAG e tools continuam desligados por padrao. Quando os limites removem todo o contexto seguro, o builder degrada para `none`. Quando a precheck/policy bloqueia antes do runtime, `/execute` nao e chamado.

## 8. Auditoria e rastreabilidade

A auditoria de `AgentRun` agora sanitiza metadata antes de persistir. Para `agno_http`, os registros podem indicar:

- runtime resolvido e execucao iniciada;
- execucao concluida, falhou ou foi bloqueada;
- bloqueio por policy;
- RAG governado anexado;
- descriptors de tools governados anexados.

A auditoria contem no maximo ids, status, provider, errorCode seguro, traceId, contadores, hashes e flags booleanas.

## 9. Sanitizacao e dados proibidos

Continuam proibidos em eventos, metadata, auditoria e usage:

- prompt bruto;
- output bruto;
- documentos ou excerpts completos fora da spec governada;
- manifests de tools;
- `inputSchema` completo em eventos/metadata;
- headers, Authorization, cookies e credentials;
- `apiKey`, token, secret, `providerApiKey` e `secretRef`;
- `baseUrl`, endpoint interno e connection string;
- `rawPrompt`, `rawResponse`, `rawProviderResponse`, `rawDocuments`, `rawToolManifest`, `rawMcpServerConfig`.

## 10. Tratamento de falhas

- Runtime desabilitado ou mal configurado falha fechado sem `/execute`.
- Timeout e indisponibilidade viram erro normalizado seguro.
- Response fora do contrato vira `RUNTIME_INVALID_RESPONSE` sem persistir corpo bruto.
- Usage parcialmente invalido e sanitizavel tem campos ruins descartados.
- Bloqueio por policy retorna status controlado e auditavel.
- Falha ao registrar `AiRunUsageEvent` nao derruba a execucao do `AgentRun`.

## 11. Garantias de ausencia de execucao nova

A 14G nao adiciona provider externo, MCP remoto direto, retrieval livre ou tool execution externa. O runtime minimo continua sem `fetch`, sem cliente MCP real e sem execucao irrestrita de tools. `externalProviderCalled`, `externalMcpCalled` e `toolCallsExecuted` permanecem normalizados e testados.

## 12. Modelo dinamico

A observabilidade nao depende de modelo especifico. O modelo continua vindo do contexto/politica autorizada do assistant. `gpt-4o-mini` pode existir como env operacional em outras areas, mas nao foi hardcodado no fluxo `agno_http`/observabilidade da 14G.

## 13. Como testar

No backend:

```bash
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

Se `migrate status` nao conseguir acessar `db:5432`, a limitacao e ambiental; nao executar reset, drop de volume ou comando destrutivo.

## 14. Handoff para 14H

A 14H pode evoluir a partir desta base para correlacionar eventos agregados, dashboards ou enforcement de quotas, desde que preserve os principios: Orquestra como control plane, runtime sem RBAC proprio, sem payload bruto em observabilidade, sem discovery livre e sem execucao externa sem gateway governado.

## 15. Riscos remanescentes

- Auditoria e usage ainda dependem de disponibilidade do banco; o registro de usage e nao bloqueante para evitar indisponibilidade operacional.
- O runtime real futuro deve manter a mesma disciplina de eventos seguros, pois a 14G nao executa provider/MCP real.
- A remocao de output preview de metadata exige que consumidores usem hashes/status/usage em vez de texto persistido.
- Limites agregados continuam registrados e resumidos, mas enforcement amplo de quotas permanece fora desta subfase.
