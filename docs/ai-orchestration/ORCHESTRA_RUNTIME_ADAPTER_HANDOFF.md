# Orchestra Runtime Adapter Handoff

Status: implementado na Fase 07A e evoluido na Fase 07B.

## Boundary

O runtime passa a ser acessado por adapter oficial. O fluxo atual e:

```txt
Frontend
  -> Backend Orchestra
  -> Precheck e policies
  -> AgentRun
  -> RuntimeAdapterRegistry
  -> LocalDeterministicRuntimeAdapter ou AgnoRuntimeAdapter local
  -> Runtime events normalizados
  -> AgentRunEvent e AuditLog
```

## RAG

O contexto de runtime recebe apenas resumo:

- readiness;
- quantidade de bindings;
- quantidade de chunks;
- quantidade de source references;
- ultimo `ragQueryId`;
- lista curta de referencias.

Nao ha embeddings, vector store ou retrieval semantico nesta fase.

## MCP

O contexto recebe apenas resumo:

- quantidade de bindings;
- tools sandbox permitidas;
- tools bloqueadas;
- tools que exigem approval;
- ultimos tool call ids.

Nao ha chamada MCP remota e nenhuma tool externa e executada pelo adapter.

## Eventos

Eventos normalizados usam prefixo `runtime.*` em `AgentRunEvent`, permitindo que a UI exiba timeline independente do provider futuro.

## Agno Local

A Fase 07B adiciona `AgnoRuntimeAdapter` HTTP local atras de flags. O provider local continua padrao. Para validar integracao sem runtime real, usar `scripts/agno-mock-runtime.mjs` e `scripts/smoke-agno-local.sh`.

## Recomendacao Para Proxima Fase

Evoluir traces, streaming e runtime local real mantendo o backend como autoridade de governanca e sem habilitar providers externos ou MCP remoto por padrao.
