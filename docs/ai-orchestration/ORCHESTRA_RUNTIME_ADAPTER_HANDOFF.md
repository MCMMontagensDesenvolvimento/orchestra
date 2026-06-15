# Orchestra Runtime Adapter Handoff

Status: implementado na Fase 07A.

## Boundary

O runtime passa a ser acessado por adapter oficial. O fluxo atual e:

```txt
Frontend
  -> Backend Orchestra
  -> Precheck e policies
  -> AgentRun
  -> RuntimeAdapterRegistry
  -> LocalDeterministicRuntimeAdapter
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

## Recomendacao Para Proxima Fase

Adicionar adapter real atras de feature flag, com healthcheck opcional, limites de timeout, allowlist de endpoints, testes de seguranca e fallback local.
