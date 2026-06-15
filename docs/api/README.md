# API

Status: operacional para a fundacao da Fase 04, contratos de core domain da Fase 05, governanca de assistants/agent runs das Fases 05B/05C/05E, catalogo Knowledge/MCP da Fase 06, readiness local da Fase 06B, RAG query local da Fase 06C, MCP execution sandbox da Fase 06D e Runtime Adapter API da Fase 07A.

Esta pasta concentra contratos HTTP e convencoes de integracao do backend.

## Documentos

- `ORCHESTRA_API_FOUNDATION.md`: prefixos, envelopes de resposta, erros, autenticacao e endpoints implementados.
- `ORCHESTRA_CORE_DOMAIN_API.md`: endpoints, paginacao, filtros e acoes de governanca de assistants.
- `ORCHESTRA_ASSISTANT_GOVERNANCE_API.md`: approval workflow, execution policy e execution precheck.
- `ORCHESTRA_RUNTIME_EXECUTION_CONTRACTS.md`: contratos REST de AgentRun, eventos, precheck bloqueante e cancelamento.
- `ORCHESTRA_KNOWLEDGE_MCP_CATALOG_API.md`: contratos REST de Knowledge Bases, documentos, ingestion placeholder, MCP catalog e assistant bindings.
- `ORCHESTRA_RAG_READINESS_API_CONTRACTS.md`: contratos de chunks, source references, ingestion jobs, readiness e busca textual local.
- `ORCHESTRA_RAG_QUERY_API_CONTRACTS.md`: contratos de query RAG local, citations, historico, detalhe e sources.
- `ORCHESTRA_MCP_EXECUTION_API_CONTRACTS.md`: contratos de precheck MCP, sandbox tool calls, historico, detalhe e eventos.
- `ORCHESTRA_RUNTIME_ADAPTER_API_CONTRACTS.md`: contratos de runtime providers, health, capabilities e config sanitizada.

## Convencoes Atuais

- API de gestao em `/api/v1`.
- Healthchecks em `/health` e `/health/db`.
- REST + JSON.
- Cookie HttpOnly para sessao.
- Request id em header e corpo JSON.
- Erros estruturados com `status`, `code`, `message`, `fieldErrors` e `requestId`.
- Listagens paginadas com `data`, `pagination` e `requestId`.
- Acoes criticas usam `POST` dedicado, como `publish`, `unpublish`, `rollback`, `archive` e `restore`.
- Approval, execution policy e precheck ficam sob `/assistants/:id`.
- Agent runs usam `/assistants/:id/runs` e `/agent-runs/:runId`.
- Knowledge usa `/knowledge-bases`, `/knowledge-documents` e `/knowledge-data-sources`.
- Chunks usam `/knowledge-chunks`; readiness usa `/assistants/:id/rag/readiness` e a rota legada `/assistants/:id/rag-readiness`.
- RAG query local usa `/assistants/:id/rag/query`, historico usa `/assistants/:id/rag/queries` e detalhes usam `/rag/queries/:queryId`.
- MCP usa `/mcp/servers`, `/mcp/tools` e bindings sob `/assistants/:id`.
- MCP execution sandbox usa `/assistants/:id/mcp/precheck`, `/assistants/:id/mcp/tool-calls` e detalhe/eventos sob `/mcp/tool-calls/:toolCallId`.
- Runtime adapter usa `/runtime/providers`, `/runtime/capabilities`, `/runtime/health` e `/runtime/config`.
