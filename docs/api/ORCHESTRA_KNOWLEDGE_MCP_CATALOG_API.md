# Orchestra Knowledge/RAG/MCP Catalog API

Status: implementado na Fase 06 como catalogo governado. Nao executa RAG real, embeddings, vector store, MCP real, providers externos ou upload binario.

## Escopo

A Fase 06 adiciona endpoints REST para governar:

- Knowledge Bases, documentos, data sources e ingestion jobs placeholder.
- MCP servers, tools, resources, prompts e policies estruturais.
- Bindings entre assistants e Knowledge Bases.
- Bindings entre assistants e MCP servers/tools.

Todos os endpoints usam `/api/v1`, cookie HttpOnly, RBAC/ABAC de backend, workspace scope e envelopes/erros ja padronizados.

## Knowledge

### Knowledge Bases

- `GET /api/v1/knowledge-bases`
- `POST /api/v1/knowledge-bases`
- `GET /api/v1/knowledge-bases/:id`
- `PATCH /api/v1/knowledge-bases/:id`
- `POST /api/v1/knowledge-bases/:id/archive`
- `POST /api/v1/knowledge-bases/:id/restore`

Campos principais: `tenantId`, `workspaceId`, `name`, `description`, `status`, `visibility`, `dataClassification`, `ownerUserId`, `metadata`, contadores e `policy`.

### Documents

- `GET /api/v1/knowledge-bases/:id/documents`
- `POST /api/v1/knowledge-bases/:id/documents`
- `GET /api/v1/knowledge-documents/:documentId`
- `PATCH /api/v1/knowledge-documents/:documentId`
- `POST /api/v1/knowledge-documents/:documentId/archive`
- `POST /api/v1/knowledge-documents/:documentId/request-ingestion`
- `GET /api/v1/knowledge-documents/:documentId/ingestion`

`request-ingestion` cria somente um job `completed_placeholder` e marca o documento como `indexed_placeholder`. Nao ha parsing de arquivo, embeddings, chunking real ou escrita em vector store.

### Data Sources

- `GET /api/v1/knowledge-bases/:id/data-sources`
- `POST /api/v1/knowledge-bases/:id/data-sources`
- `PATCH /api/v1/knowledge-data-sources/:dataSourceId`
- `POST /api/v1/knowledge-data-sources/:dataSourceId/archive`

Data sources registram configuracao governada. A API nao executa conectores.

## MCP

### Servers

- `GET /api/v1/mcp/servers`
- `POST /api/v1/mcp/servers`
- `GET /api/v1/mcp/servers/:id`
- `PATCH /api/v1/mcp/servers/:id`
- `POST /api/v1/mcp/servers/:id/archive`
- `POST /api/v1/mcp/servers/:id/restore`

Campos principais: `tenantId`, `workspaceId`, `name`, `serverType`, `baseUrl`, `status`, `trustLevel`, `riskLevel`, `authType`, `secretRef`, `metadata` e contadores.

### Tools, Resources E Prompts

- `GET /api/v1/mcp/servers/:id/tools`
- `POST /api/v1/mcp/servers/:id/tools`
- `PATCH /api/v1/mcp/tools/:toolId`
- `POST /api/v1/mcp/tools/:toolId/archive`
- `GET /api/v1/mcp/servers/:id/resources`
- `POST /api/v1/mcp/servers/:id/resources`
- `GET /api/v1/mcp/servers/:id/prompts`
- `POST /api/v1/mcp/servers/:id/prompts`

Tools recebem policy estrutural com `allowRuntimeExecution=false`, `sandboxOnly=true` e `blockedByDefault=true`. Tools `high` e `critical` sempre exigem approval.

## Assistant Bindings

### Knowledge Bindings

- `GET /api/v1/assistants/:id/knowledge-bindings`
- `POST /api/v1/assistants/:id/knowledge-bindings`
- `PATCH /api/v1/assistants/:id/knowledge-bindings/:bindingId`
- `DELETE /api/v1/assistants/:id/knowledge-bindings/:bindingId`

Bindings validam mesmo workspace, mesma tenant, Knowledge Base ativa e modo `retrieval_placeholder` por padrao.

### MCP Bindings

- `GET /api/v1/assistants/:id/mcp-bindings`
- `POST /api/v1/assistants/:id/mcp-bindings`
- `PATCH /api/v1/assistants/:id/mcp-bindings/:bindingId`
- `DELETE /api/v1/assistants/:id/mcp-bindings/:bindingId`

Bindings validam server ativo, tool habilitada, mesmo workspace e modo `sandbox_only` por padrao. Override que remove approval e bloqueado quando a tool exige approval ou tem risco `high`/`critical`.

## Permissoes

Knowledge:

- `knowledge.read`
- `knowledge.create`
- `knowledge.update`
- `knowledge.archive`
- `knowledge.restore`
- `knowledge.bind`
- `knowledge.ingestion.read`
- `knowledge.ingestion.manage`

MCP:

- `mcp.read`
- `mcp.create`
- `mcp.update`
- `mcp.archive`
- `mcp.restore`
- `mcp.bind`
- `mcp.tools.read`
- `mcp.tools.manage`
- `mcp.policies.manage`

## Erros

Mantem o envelope padrao:

- `401` sem sessao.
- `403` sem permissao ou fora do workspace.
- `404` recurso inexistente ou fora do escopo acessivel.
- `422` payload invalido, incluindo JSON de catalogo com chaves sensiveis como `secret`, `token`, `password`, `api_key` ou `authorization`.

