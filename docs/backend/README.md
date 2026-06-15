# Backend

Status: operacional para a fundacao da Fase 04, core domain inicial da Fase 05, governanca de assistants e agent runs das Fases 05B/05C/05E, catalogo Knowledge/MCP da Fase 06, ingestao local da Fase 06B, RAG query local da Fase 06C, MCP execution sandbox da Fase 06D, Runtime Adapter Boundary da Fase 07A e Agno local runtime opcional da Fase 07B.

Esta pasta concentra a documentacao do backend real do Orchestra.

## Documentos

- `ORCHESTRA_BACKEND_FOUNDATION.md`: stack, estrutura, modulos, seguranca inicial, testes e limites da fundacao.
- `ORCHESTRA_BACKEND_OPERATIONAL_VALIDATION.md`: evidencias da validacao local com Docker, PostgreSQL, migrations, seed, healthchecks e smoke tests.
- `ORCHESTRA_CORE_DOMAIN_BACKEND.md`: modulos, policies, auditoria e limites do core domain da Fase 05.
- `ORCHESTRA_PHASE_05_HANDOFF.md`: handoff tecnico, validacoes e pendencias da Fase 05.
- `ORCHESTRA_PHASE_05B_ASSISTANT_GOVERNANCE_HANDOFF.md`: handoff tecnico da governanca de assistants, publicacao, rollback, feedback e test results.
- `ORCHESTRA_PHASE_05C_APPROVAL_EXECUTION_GOVERNANCE.md`: approval workflow, execution policy, sandbox policy e precheck.
- `ORCHESTRA_AGENT_RUN_GOVERNANCE.md`: runtime boundary fake, AgentRun, eventos, precheck obrigatorio, cancelamento e auditoria.
- `ORCHESTRA_KNOWLEDGE_MCP_CATALOG.md`: catalogo governado de Knowledge/RAG/MCP, ingestion placeholder, policies, bindings e auditoria.
- `ORCHESTRA_KNOWLEDGE_INGESTION_PIPELINE.md`: ingestao local controlada, jobs, eventos, status e auditoria.
- `ORCHESTRA_KNOWLEDGE_CHUNKING_LOCAL.md`: chunking textual local, limites, hashes, offsets e source references.
- `ORCHESTRA_RAG_QUERY_LOCAL.md`: query RAG local, readiness refinado, retrieval keyword, citations, historico e auditoria.
- `ORCHESTRA_MCP_EXECUTION_SANDBOX.md`: precheck MCP, execucao sandbox local, policies, bloqueios e limites.
- `ORCHESTRA_MCP_TOOL_CALLS.md`: persistencia de tool calls MCP, eventos, snapshots e integracao com AgentRun.
- `ORCHESTRA_RUNTIME_ADAPTER_BOUNDARY.md`: contrato oficial de runtime adapter, registry, contexto governado e auditoria.
- `ORCHESTRA_RUNTIME_LOCAL_ADAPTER.md`: adapter local deterministico, eventos normalizados e limites.
- `ORCHESTRA_AGNO_RUNTIME_LOCAL_INTEGRATION.md`: integracao HTTP local Agno-compatible, flags, fail-closed e mock runtime.

## Escopo Atual

- Express + TypeScript strict.
- Prisma + PostgreSQL.
- Zod para validacao.
- Pino para logs.
- Cookie HttpOnly com JWT para sessao de desenvolvimento.
- RBAC/ABAC estrutural.
- Auditoria inicial.
- Endpoints base e CRUD minimo de assistentes.
- Core domain inicial com tenants, workspaces, users, roles, permissions, assistants, audit logs e settings.
- Governanca de assistants com publicacoes versionadas, rollback, feedback e test results manuais/simulados.
- Approval workflow, execution policy, sandbox policy e execution precheck sem runtime real.
- Agent runs com Runtime Adapter Boundary, adapter local deterministico, eventos persistidos e contratos de cancelamento.
- Catalogo Knowledge/RAG/MCP com policies e bindings governados.
- Knowledge ingestion local com contentText, chunking textual, source references, jobs e readiness para RAG futuro.
- RAG query local com persistencia de queries/resultados e citations.
- MCP execution sandbox com precheck, tool calls persistidas, eventos e output sintetico local.
- Runtime endpoints de provider, health, capabilities e config sanitizada.
- Agno local runtime opcional via HTTP, desabilitado por padrao.
- Smoke local em `scripts/smoke-local.sh`.

## Fora Do Escopo Atual

- SSO corporativo.
- Runtime real de IA produtivo.
- Providers reais.
- RAG semantico real, MCP externo real, embeddings, vector store e streaming.
- Workers e filas.
