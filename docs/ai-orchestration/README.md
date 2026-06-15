# AI Orchestration

Status: preparado. A Fase 06 criou catalogo governado de Knowledge/RAG/MCP, a Fase 06B adicionou readiness local com chunks textuais, a Fase 06C adicionou query RAG local com citations, a Fase 06D adicionou MCP execution sandbox, a Fase 07A adicionou Runtime Adapter Boundary, a Fase 07B adicionou Agno local runtime opcional e a Fase 07C adicionou LLM Provider Integration controlada. Runtime produtivo de IA, RAG semantico real, MCP externo real, chamadas HTTP reais a providers externos, embeddings, vector store e tool calls produtivos continuam fora do escopo.

Esta pasta deve concentrar a estrategia de IA do Orchestra.

Topicos esperados:

- Runtime de assistentes.
- Providers de modelos.
- RAG.
- MCP.
- Tool calls.
- Guardrails.
- Avaliacao e auditoria de respostas.

## Documentos

- `ORCHESTRA_RAG_READINESS_HANDOFF.md`: readiness local, busca textual em chunks autorizados e handoff para RAG semantico futuro.
- `ORCHESTRA_RAG_RETRIEVAL_CONTRACT_HANDOFF.md`: contrato de retrieval local, citations, queryId e handoff para runtime futuro.
- `ORCHESTRA_MCP_EXECUTION_HANDOFF.md`: contrato de precheck/tool call sandbox, eventos e handoff para executor MCP futuro.
- `ORCHESTRA_AGNO_READINESS_HANDOFF.md`: stub/readiness Agno, flags e caminho para integracao futura.
- `ORCHESTRA_RUNTIME_ADAPTER_HANDOFF.md`: boundary de runtime, resumos RAG/MCP e eventos normalizados.
- `ORCHESTRA_AGNO_LOCAL_RUNTIME_HANDOFF.md`: handoff da integracao HTTP local Agno-compatible e mock runtime.
- `ORCHESTRA_LLM_PROVIDER_INTEGRATION.md`: catalogo LLM, provider local deterministico, providers externos fail-closed e eventos LLM em AgentRun.
