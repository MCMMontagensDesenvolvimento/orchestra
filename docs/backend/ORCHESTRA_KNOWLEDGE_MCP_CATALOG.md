# Orchestra Knowledge/RAG/MCP Catalog Backend

Status: implementado na Fase 06 como catalogo governado e auditavel. Esta fase nao implementa RAG real, embeddings, vector store, MCP execution, Agno, providers reais, upload binario, SSO, webhooks ou workers.

## Modulos

### `backend/src/modules/knowledge`

Responsavel por:

- CRUD governado de Knowledge Bases.
- Documentos como metadados catalogados.
- Data sources como referencias estruturais.
- Ingestion jobs placeholder.
- Bindings entre assistants e Knowledge Bases.
- Policies estruturais de Knowledge.

Arquivos principais:

- `knowledge.schema.ts`: validacao Zod, enums e guard contra secrets em JSON.
- `knowledge.repository.ts`: acesso Prisma.
- `knowledge.service.ts`: regras de tenancy, workspace, archive/restore, placeholder ingestion e auditoria.
- `knowledge.controller.ts`: envelope HTTP.
- `knowledge.routes.ts`: rotas, permissao e validacao.

### `backend/src/modules/mcp`

Responsavel por:

- CRUD governado de MCP servers.
- Catalogo de tools, resources e prompts.
- Policies estruturais de tools.
- Bindings entre assistants e MCP servers/tools.
- Bloqueio de runtime real por padrao.

Arquivos principais:

- `mcp.schema.ts`: validacao Zod, enums e guard contra secrets em JSON/templates.
- `mcp.repository.ts`: acesso Prisma.
- `mcp.service.ts`: regras de tenancy, workspace, risco, approval e auditoria.
- `mcp.controller.ts`: envelope HTTP.
- `mcp.routes.ts`: rotas, permissao e validacao.

## Regras De Governanca

- Toda leitura/escrita exige `requireAuth`.
- Toda rota exige permissao granular.
- Recursos sao filtrados por tenant e workspaces acessiveis pela sessao.
- Bindings exigem assistant e recurso no mesmo workspace.
- Recursos arquivados nao podem receber binding novo.
- JSON de catalogo rejeita chaves sensiveis como `secret`, `token`, `password`, `api_key`, `authorization` e variantes normalizadas.
- MCP tools `high` e `critical` exigem approval.
- MCP policies sao criadas com `allowRuntimeExecution=false`, `sandboxOnly=true` e `blockedByDefault=true`.
- `requiresApprovalOverride=false` e bloqueado para tool que exige approval ou tem risco alto/critico.

## Auditoria

Eventos sensiveis registram audit log com payload sanitizado:

- Knowledge Base create/update/archive/restore.
- Knowledge document create/update/archive.
- Ingestion placeholder requested.
- Knowledge data source create/update/archive.
- Assistant Knowledge binding create/update/remove.
- MCP server create/update/archive/restore.
- MCP tool create/update/archive.
- MCP resource/prompt create.
- Assistant MCP binding create/update/remove.

Os audit logs nao registram secrets nem credenciais.

## Ingestion Placeholder

`POST /knowledge-documents/:documentId/request-ingestion`:

- cria `KnowledgeIngestionJob`;
- marca o job como `completed_placeholder`;
- marca o documento como `indexed_placeholder`;
- preserva metadados auditaveis;
- nao executa parser, chunker, embedding, vector store ou retrieval.

## MCP Placeholder

O catalogo MCP registra servidores, tools, resources e prompts, mas nao:

- abre conexao com servidor MCP;
- descobre tools automaticamente;
- executa tool;
- cria worker;
- chama runtime externo.

## Testes

Cobertura adicionada em `backend/tests/api/knowledge-mcp-catalog.test.ts`:

- CRUD/listagem de Knowledge Base.
- Documento, data source e ingestion placeholder.
- Binding Knowledge por assistant.
- Bloqueio cross-workspace.
- CRUD/listagem de MCP server/tool.
- Binding MCP e bloqueio de override inseguro.
- Erros estruturados `403`, `404` e `422`.

