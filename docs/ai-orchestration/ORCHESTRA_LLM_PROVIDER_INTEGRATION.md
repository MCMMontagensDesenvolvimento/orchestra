# Orchestra LLM Provider Integration

Status: implementado na Fase 07C.

## Objetivo

A Fase 07C adiciona um catalogo controlado de LLM providers para o Orchestra, preservando o backend como autoridade e mantendo a execucao externa desabilitada por padrao.

O Orchestra continua sendo o control plane. AgentRun permanece passando por precheck, execution policy, RuntimeAdapter, persistencia de eventos e auditoria antes de qualquer geracao.

## Providers

Providers representados pelo contrato:

- `local_deterministic`: provider local, deterministico, sem credenciais e sem chamada externa.
- `agno_local`: representacao sanitizada da integracao Agno local existente.
- `openai`: contrato planejado, fail-closed.
- `azure_openai`: contrato planejado, fail-closed.
- `anthropic`: contrato planejado, fail-closed.

## Comportamento Padrao

- `LLM_DEFAULT_PROVIDER=local_deterministic`.
- `LLM_PROVIDERS_ENABLED=false`.
- `LLM_EXECUTION_ENABLED=false`.
- Providers externos ficam `disabled` ou `configured_but_execution_disabled`.
- O smoke local usa apenas `local_deterministic`.
- O endpoint de teste bloqueia providers externos com erro estruturado.

## AgentRun

O `LocalDeterministicRuntimeAdapter` passa a chamar o `local_deterministic` por meio do modulo `llm`, sem criar rota paralela de execucao para assistants.

Eventos normalizados adicionados:

- `llm.provider_selected`.
- `runtime.llm_context_attached`.
- `llm.generation_started`.
- `llm.generation_completed`.
- `llm.generation_blocked`.
- `llm.generation_failed`.

## Limites

Esta fase nao implementa streaming final, tool calling autonomo, embeddings, vector store, reranking, chat livre, custo real ou chamadas HTTP reais para provedores externos.
