# Security

Status: preparado para seguranca, SSO, RBAC/ABAC, governanca de execucao de assistants/agent runs, catalogo Knowledge/MCP, conteudo textual local, RAG query local, MCP execution sandbox, Runtime Adapter Boundary, Agno local runtime opcional, baseline limpo de dependency audit da Fase 07B.1 e LLM Provider Security da Fase 07C.

Esta pasta deve concentrar seguranca, compliance, autenticacao, autorizacao e auditoria.

Topicos esperados:

- Modelo de identidade.
- Sessoes.
- Permissoes.
- Segredos e configuracao.
- Auditoria.
- Politicas de dados.

## Documentos

- `ORCHESTRA_MICROSOFT_SSO_PREPARATION.md`: preparacao de Microsoft SSO para fase posterior, sem implementacao real nesta fase.
- `ORCHESTRA_ASSISTANT_EXECUTION_GOVERNANCE.md`: approval workflow, execution policy, sandbox policy, auditoria e limites de execucao futura.
- `ORCHESTRA_EXECUTION_GOVERNANCE_SECURITY.md`: controles de AgentRun, sanitizacao, auditoria, cancelamento e observabilidade segura.
- `ORCHESTRA_KNOWLEDGE_MCP_CATALOG_SECURITY.md`: RBAC/ABAC, guard contra secrets, MCP sandbox policy e auditoria do catalogo Knowledge/MCP.
- `ORCHESTRA_KNOWLEDGE_CONTENT_SECURITY.md`: controles para contentText, chunks, source references, auditoria e limites de retencao.
- `ORCHESTRA_RAG_QUERY_SECURITY.md`: autorizacao, escopo, auditoria sanitizada e limites da query RAG local.
- `ORCHESTRA_MCP_EXECUTION_SECURITY.md`: controles de precheck, sandbox MCP, tool calls, approval required e auditoria sanitizada.
- `ORCHESTRA_RUNTIME_BOUNDARY_SECURITY.md`: seguranca do runtime adapter, defaults seguros, sanitizacao e auditoria.
- `ORCHESTRA_AGNO_RUNTIME_SECURITY.md`: seguranca da integracao HTTP local Agno-compatible e comportamento fail-closed.
- `ORCHESTRA_DEPENDENCY_AUDIT_BASELINE.md`: baseline de `npm audit --audit-level=high` para backend e frontend apos upgrade controlado da toolchain.
- `ORCHESTRA_LLM_PROVIDER_SECURITY.md`: controles de provider LLM, backend-only secrets, fail-closed e sanitizacao de prompt/output.
- `ORCHESTRA_OPENAI_PROVIDER_SECURITY_RUNBOOK.md`: handoff operacional do OpenAI provider, opt-in, sandbox, validacao e rollback.

## Estado Atual

- Dev-login permanece restrito a ambiente nao produtivo.
- Sessao web usa cookie HttpOnly.
- Backend aplica permissoes por rota e policies por acao de assistant.
- Bloqueios de permissao registram `permission_denied` em audit log.
- Approval e execution policy sao aplicados no backend.
- Execution precheck nao chama runtime real de IA.
- AgentRun usa Runtime Adapter Boundary, adapter local deterministico, eventos persistidos e metadata sanitizada.
- Knowledge/MCP usa catalogo governado, bindings com workspace scope e guard contra secrets em JSON/templates.
- Ingestao Knowledge local nao grava conteudo bruto em audit logs e filtra chunks por tenant/workspace.
- RAG query local filtra bindings habilitados, documentos ingeridos, chunks ativos e persiste apenas excerpts limitados nos resultados.
- MCP execution sandbox filtra binding/server/tool, exige approval para high/critical e persiste apenas preview/hash.
- Runtime config exposta pela API e sanitizada, sem secrets ou API keys.
- Agno local runtime e desabilitado por padrao e nao recebe secrets, credenciais MCP ou payload bruto extenso.
- Dependency audit alto esta limpo em backend e frontend apos upgrade controlado de Vite/Vitest/esbuild.
- LLM providers externos sao desabilitados por padrao e bloqueados por wrappers fail-closed.
- SSO corporativo real segue reservado para fase posterior.
