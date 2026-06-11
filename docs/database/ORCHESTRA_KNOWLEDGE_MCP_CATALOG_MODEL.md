# Orchestra Knowledge/RAG/MCP Catalog Database Model

Status: implementado na Fase 06 por Prisma schema e migration `20260611160000_phase06_knowledge_mcp_catalog`. A Fase 06B adicionou chunks, source references e eventos de ingestao pela migration `20260611190000_phase06b_knowledge_ingestion`.

## Objetivo

Persistir o catalogo governado de Knowledge/RAG/MCP sem implementar runtime real. As tabelas permitem governanca, RBAC/ABAC, auditoria, bindings e futuras integracoes, mas nao indicam embeddings, vector store, MCP execution ou providers reais em operacao.

## Knowledge

Tabelas principais:

- `knowledge_bases`
- `knowledge_documents`
- `knowledge_data_sources`
- `knowledge_ingestion_jobs`
- `assistant_knowledge_bindings`
- `knowledge_policies`

Caracteristicas:

- `tenant_id` e `workspace_id` em todos os recursos operacionais.
- `deleted_at` para archive/soft delete.
- `data_classification` em bases e documentos.
- `visibility` em bases.
- `metadata` como JSON governado, com validacao de secrets no backend.
- Jobs de ingestao como historico operacional local desde a Fase 06B.

## MCP

Tabelas principais:

- `mcp_servers`
- `mcp_tools`
- `mcp_resources`
- `mcp_prompts`
- `assistant_mcp_bindings`
- `mcp_tool_policies`

Caracteristicas:

- `tenant_id` e `workspace_id` em servers/tools/resources/prompts/bindings.
- `base_url`, `server_type`, `trust_level`, `risk_level`, `auth_type` e `secret_ref` em `mcp_servers`.
- `input_schema` e `output_schema` como JSON estrutural em tools.
- `requires_approval` e `is_enabled` em tools.
- Policies com `allow_runtime_execution=false`, `sandbox_only=true` e `blocked_by_default=true`.

## Bindings

Bindings ligam assistants a recursos catalogados:

- `assistant_knowledge_bindings` usa `retrieval_mode`, `priority` e `is_enabled`.
- `assistant_mcp_bindings` usa `mode`, `requires_approval_override` e `is_enabled`.

Os servicos validam que assistant e recurso pertencem ao mesmo tenant/workspace antes de criar ou alterar bindings.

## Migration

A migration da Fase 06:

- amplia tabelas legadas de Knowledge/MCP quando existentes;
- cria documentos, data sources, ingestion jobs, policies e bindings;
- adiciona indices por tenant/workspace/status;
- cria FKs para tenant, workspace, users, assistants e recursos relacionados;
- normaliza `mcp_servers.url` para `base_url`;
- normaliza status antigo `inactive` para `disabled`;
- preenche `workspace_id` de registros existentes usando workspace padrao/primeiro workspace da tenant;
- marca tools de risco alto/critico como approval obrigatorio.

## Fora Do Modelo Nesta Fase

Nao foram criadas tabelas de:

- embeddings;
- vector indexes;
- retrieval traces reais;
- MCP execution sessions;
- provider credentials;
- webhook deliveries;
- filas/workers.
