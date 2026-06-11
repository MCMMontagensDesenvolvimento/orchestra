# API

Status: operacional para a fundacao da Fase 04, contratos de core domain da Fase 05, governanca de assistants/agent runs das Fases 05B/05C/05E e catalogo Knowledge/MCP da Fase 06.

Esta pasta concentra contratos HTTP e convencoes de integracao do backend.

## Documentos

- `ORCHESTRA_API_FOUNDATION.md`: prefixos, envelopes de resposta, erros, autenticacao e endpoints implementados.
- `ORCHESTRA_CORE_DOMAIN_API.md`: endpoints, paginacao, filtros e acoes de governanca de assistants.
- `ORCHESTRA_ASSISTANT_GOVERNANCE_API.md`: approval workflow, execution policy e execution precheck.
- `ORCHESTRA_RUNTIME_EXECUTION_CONTRACTS.md`: contratos REST de AgentRun, eventos, precheck bloqueante e cancelamento.
- `ORCHESTRA_KNOWLEDGE_MCP_CATALOG_API.md`: contratos REST de Knowledge Bases, documentos, ingestion placeholder, MCP catalog e assistant bindings.

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
- MCP usa `/mcp/servers`, `/mcp/tools` e bindings sob `/assistants/:id`.
