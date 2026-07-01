# Orchestra Chat via Agno Runtime 14D

## 1. Resumo

A Fase 14D conecta o fluxo real de `AgentRun` do backend do Orquestra ao provider `agno_http` registrado na 14C. A requisicao continua entrando pela API do Orquestra, passa por autenticacao, RBAC, escopo de tenant/workspace/assistant e precheck antes de chegar ao runtime executor.

O default permanece local e deterministico. O runtime HTTP somente e chamado quando `agno_http` e selecionado e todas as flags obrigatorias estao habilitadas.

## 2. Implementacao

O fluxo existente de `AgentRun` foi preservado:

```txt
POST /api/v1/assistants/:id/runs
  -> agentRunsService
  -> precheck e RuntimeExecutionContext autorizado
  -> runtimeService e runtimeAdapterRegistry
  -> agno_http
  -> RuntimeExecuteResponseV1 validada
  -> eventos e metadata sanitizados
  -> persistencia do AgentRun
  -> resposta publica do backend
```

A 14D adiciona cobertura de API para esse caminho e reforca a sanitizacao do resultado do adapter. Metricas seguras de uso (`inputTokens`, `outputTokens` e `totalTokens`) e `outputMetadata` validada pelo contrato sao preservadas; chaves de credencial, headers, URLs internas e payloads brutos continuam bloqueados.

## 3. Fora de escopo

Esta fase nao implementa:

- frontend novo ou chamada direta do frontend ao runtime;
- streaming;
- provider externo real;
- OpenAI, Azure OpenAI, Anthropic ou equivalente;
- RAG real dentro do runtime;
- MCP real, descriptors executaveis ou tool execution;
- scheduler, worker, queue, dashboard ou billing;
- migration, seed ou alteracao de schema Prisma;
- mudanca funcional em RBAC, auth/SSO, observabilidade ampla ou AI Quality.

## 4. Relacao com 14A, 14B e 14C

- A 14A definiu `AssistantRuntimeSpecV1`, `RuntimeExecuteRequestV1`, `RuntimeExecuteResponseV1`, health, capabilities, eventos e erros normalizados.
- A 14B implementou o runtime HTTP minimo e deterministico com `/health`, `/capabilities` e `/execute`.
- A 14C implementou o adapter `agno_http`, o client server-to-server e o builder seguro da spec.
- A 14D comprova e consolida o uso desse adapter pelo endpoint real de `AgentRun`, sem criar um segundo fluxo de chat.

## 5. Selecao do provider

O provider e resolvido pelo `runtimeAdapterRegistry` a partir de `RUNTIME_PROVIDER`. O contexto de execucao registra o provider selecionado antes da chamada.

Para usar o runtime HTTP:

```txt
RUNTIME_PROVIDER=agno_http
RUNTIME_ADAPTER_ENABLED=true
AGNO_RUNTIME_HTTP_ENABLED=true
AGNO_RUNTIME_HTTP_BASE_URL=http://127.0.0.1:8091
AGNO_RUNTIME_HTTP_TIMEOUT_MS=15000
```

Se `agno_http` estiver selecionado e falhar, o resultado e `failed` ou `blocked`. Nao existe fallback automatico silencioso para `local`.

## 6. Control plane

O Orquestra permanece responsavel por:

- autenticacao e RBAC;
- tenant, workspace, usuario e assistant;
- versao/publicacao do assistant;
- precheck e execution policy;
- selecao autorizada de modelo;
- construcao da spec;
- validacao da resposta;
- auditoria, eventos, persistencia e resposta publica.

O runtime recebe apenas a spec versionada e atua como executor. Ele nao escolhe identidade, escopo, assistant ou policy e nao se torna fonte da verdade.

## 7. Contrato e resposta publica

O client valida o body antes do envio como `RuntimeExecuteRequestV1`. A resposta HTTP e validada como `RuntimeExecuteResponseV1` antes de qualquer mapeamento.

Em sucesso, o output textual e convertido para `metadata.runtime.outputPreview`, com hash do output e metadata allowlist. Eventos do contrato sao normalizados para os eventos existentes do `AgentRun`. O contrato publico atual do endpoint nao foi ampliado.

## 8. Defaults e flags

Defaults seguros:

```txt
RUNTIME_PROVIDER=local
RUNTIME_ADAPTER_ENABLED=true
AGNO_RUNTIME_HTTP_ENABLED=false
```

Com esses valores, o `AgentRun` continua no runtime local/deterministico. A URL e a security key existem apenas na configuracao do backend e nao sao expostas pelo mapper publico.

## 9. Fail-closed

O caminho `agno_http` falha fechado quando ocorrer:

- adapter global ou HTTP desabilitado;
- base URL ausente ou invalida;
- indisponibilidade de rede;
- timeout;
- resposta fora do schema;
- erro HTTP normalizado;
- bloqueio de policy.

A falha e persistida como estado controlado do `AgentRun`, com codigo e mensagem seguros, sem stack trace, request bruto, response bruta ou detalhes de conexao.

## 10. Secrets

`AGNO_RUNTIME_HTTP_SECURITY_KEY` e enviada somente no header server-to-server `Authorization`. Ela nao entra no body, spec, evento, metadata persistida ou resposta da API.

A base URL e os headers tambem nao entram na resposta publica. Metadata recebida do runtime passa primeiro pelo schema strict e depois pela sanitizacao do adapter. Token metrics numericas sao dados operacionais permitidos; chaves de token/secret/credential continuam bloqueadas.

## 11. Modelo dinamico

A spec usa o modelo resolvido no contexto autorizado do assistant:

1. `compiledPrompt.modelProvider` e `compiledPrompt.modelName`;
2. policy default autorizada quando aplicavel;
3. fallback local deterministico existente.

O core de chat/runtime nao fixa `gpt-4o-mini`. Esse valor pode permanecer em env operacional, mas nao governa o adapter.

## 12. RAG e MCP

O contexto de RAG e MCP continua sob governanca do Orquestra e pode ser resumido para auditoria do `AgentRun`. Na spec enviada ao runtime nesta fase:

```txt
rag.enabled=false
rag.mode=none
rag.sources=[]
tools.enabled=false
tools.mode=none
tools.descriptors=[]
```

Nenhum documento bruto, descriptor executavel, chamada MCP ou tool execution e enviado ao runtime.

## 13. Testes

Cobertura principal:

```bash
cd backend
npm run test -- --run \
  tests/api/agent-runs.test.ts \
  tests/runtime/runtime-agno-http-adapter.test.ts \
  tests/runtime/runtime-agno-http-client.test.ts \
  tests/unit/runtime-assistant-spec-builder.test.ts \
  tests/unit/runtime-contract.test.ts \
  tests/unit/runtime-frontend-boundary.test.ts
```

Os testes confirmam default local, chamada a `/execute`, request/response V1, output no `AgentRun`, modelo dinamico, metricas de uso, eventos sanitizados, disabled sem fetch, indisponibilidade, response invalida, policy blocked, isolamento do header e ausencia de URL/secret no frontend e na resposta publica.

Nao foi criado smoke de chat nesta fase. O endpoint real depende da persistencia de `AgentRun`; os testes de API exercitam o mesmo service/registry/adapter com repository e transporte HTTP isolados, sem banco, Docker, internet ou provider externo.

## 14. Handoff para 14E

A proxima fase pode tratar rollout operacional e integracao com um runtime real alem do sandbox minimo, mantendo gates explicitos para providers, RAG, MCP e tools. Streaming, retries, circuit breaker, rotacao de credenciais e telemetria operacional devem permanecer incrementais e governados pelo Orquestra.

## 15. Riscos remanescentes

- O runtime HTTP minimo continua deterministico e nao representa latencia/capacidade de um executor produtivo.
- Nao ha smoke end-to-end com banco real nesta fase.
- Nao ha retry ou circuit breaker no client; falhas sao retornadas imediatamente e de forma fail-closed.
- A security key e configuracao simples; rotacao e escopo operacional ficam para fase posterior.
- O output publico permanece limitado a preview no contrato atual de `AgentRun`.
