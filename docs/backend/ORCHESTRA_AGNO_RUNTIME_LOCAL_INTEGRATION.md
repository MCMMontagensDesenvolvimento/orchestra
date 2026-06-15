# Orchestra Agno Runtime Local Integration

Status: implementado na Fase 07B.

## Objetivo

A Fase 07B evolui o `AgnoRuntimeAdapter` para chamar um runtime HTTP local compativel com Agno, sem tornar esse runtime obrigatorio no fluxo padrao. O Orchestra continua sendo o control plane e a autoridade de autenticacao, permissao, policy, auditoria e persistencia.

## Defaults

O provider padrao permanece local:

```env
RUNTIME_PROVIDER=local
AGNO_ENABLED=false
AGNO_EXECUTION_ENABLED=false
```

Com esses defaults, nenhuma chamada HTTP ao runtime Agno local e feita.

## Componentes

- `runtime.agno-client.ts`: cliente HTTP com timeout, headers backend-only, JSON parsing e erro estruturado.
- `runtime.agno-adapter.ts`: adapter Agno com health, capabilities, execute e fail-closed.
- `runtime.config.ts`: flags e limites sanitizados.
- `RuntimeExecutionContext`: contexto governado com input hash/preview, RAG e MCP.
- `scripts/agno-mock-runtime.mjs`: runtime HTTP deterministico para validacao local.
- `scripts/smoke-agno-local.sh`: smoke opcional com backend em `RUNTIME_PROVIDER=agno`.

## Fluxo

```txt
AgentRun request
  -> auth, RBAC, workspace e assistant
  -> execution precheck
  -> RuntimeExecutionContext
  -> RuntimeAdapterRegistry
  -> AgnoRuntimeAdapter
  -> GET health opcional
  -> POST execute
  -> RuntimeExecutionResult normalizado
  -> AgentRun, AgentRunEvent e AuditLog
```

## Fail-Closed

O adapter retorna `failed` controlado quando:

- `AGNO_ENABLED=false`;
- `AGNO_EXECUTION_ENABLED=false`;
- `AGNO_BASE_URL` esta ausente;
- `AGNO_REQUIRE_SANDBOX=true` e o run nao esta em `sandbox`;
- healthcheck habilitado retorna erro ou status nao saudavel;
- request HTTP excede timeout;
- resposta JSON e invalida;
- runtime retorna status `failed`.

Nao ha fallback automatico para outro provider durante a execucao Agno.

## Payload Governado

O request enviado ao runtime local contem:

- ids tecnicos de run, trace, tenant, workspace e assistant;
- input hash e preview truncado;
- preview de instrucoes da versao;
- policy snapshot reduzido;
- fontes RAG ja governadas com citation, titulo e excerpt curto;
- descriptors MCP permitidos em sandbox;
- metadata de contrato.

O payload nao contem secrets, tokens, credenciais MCP, headers de autorizacao externos, conteudo completo de documentos ou payload bruto extenso.

## Eventos

Eventos persistidos no `AgentRunEvent` incluem:

- `runtime.provider_selected`
- `agno.health_checked`
- `agno.request_started`
- `agno.request_completed`
- `agno.request_failed`
- `runtime.rag_context_attached`
- `runtime.mcp_tools_attached`
- `runtime.model_started`
- `runtime.model_completed`
- `runtime.run_completed`
- `runtime.run_failed`

## Fora Do Escopo

- Agno produtivo obrigatorio.
- LLM provider real.
- tool calling autonomo externo.
- MCP remoto real acionado pelo Agno.
- embeddings, vector store, reranking ou streaming final.
