# Orchestra Runtime Local Adapter

Status: implementado na Fase 07A.

## Objetivo

`LocalDeterministicRuntimeAdapter` substitui o runtime fake anterior como adapter local oficial. Ele valida o boundary de execucao sem chamar Agno, LLM, provider externo, embeddings, vector store ou MCP remoto.

## Comportamento

O adapter local:

- retorna health `healthy` quando `RUNTIME_ADAPTER_ENABLED=true`;
- expoe capabilities de sandbox, RAG metadata, MCP metadata, citations e trace events;
- trata text generation como `simulated`;
- nao faz streaming;
- nao usa tool calling remoto;
- gera output deterministico e limitado;
- gera eventos previsiveis para timeline.

## Eventos Normalizados

Eventos do adapter local sao convertidos para `AgentRunEvent`:

- `runtime.run_started`
- `runtime.prompt_compiled`
- `runtime.rag_context_attached`
- `runtime.mcp_tools_attached`
- `runtime.model_started`
- `runtime.model_completed`
- `runtime.run_completed`

Falhas ou indisponibilidade geram:

- `runtime.adapter_warning`
- `runtime.run_failed`

## Metadata

O `AgentRun.metadata.runtime` registra:

- provider;
- status;
- input hash;
- resumo RAG;
- resumo MCP.

Nao registra input bruto completo, output bruto completo ou conteudo sensivel.
