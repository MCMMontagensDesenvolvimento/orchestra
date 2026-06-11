# Orchestra Phase 06 Frontend Knowledge/MCP Integration

Status: implementado na Fase 06.

## Escopo

O frontend passa a consumir a API real para catalogos de Knowledge/RAG/MCP quando `VITE_USE_MOCKS=false`, preservando o modo mock quando `VITE_USE_MOCKS=true`.

## Services

Arquivos principais:

- `frontend/src/services/knowledge.service.ts`
- `frontend/src/services/mcp.service.ts`
- `frontend/src/services/api/endpoints.ts`

Os services mapeiam o envelope da API para os tipos de UI existentes e mantem fallback mock.

## Query Hooks

Arquivos principais:

- `frontend/src/hooks/queries/useKnowledge.ts`
- `frontend/src/hooks/queries/useMcp.ts`
- `frontend/src/hooks/queries/queryKeys.ts`

Novas queries/mutations cobrem:

- Knowledge Bases create/update/archive/restore.
- Documents create/archive/request ingestion placeholder.
- Data sources create/list.
- Assistant Knowledge bindings create/remove.
- MCP servers create/update/archive/restore.
- MCP tools create/update/archive.
- Assistant MCP bindings create/update/remove.

## Telas Integradas

- `KnowledgePage`: catalogo de Knowledge Bases com create/update/archive/duplicate em API mode.
- `KnowledgeDetailPage`: documentos catalogados, ingestion placeholder e data sources.
- `McpHubPage`: catalogo de MCP servers com create/update/archive e status active/disabled.
- `McpDetailPage`: browser de tools/resources/prompts e criacao de tool catalogada.
- `AssistantDetailPage`: bindings governados de Knowledge e MCP com fallback para arrays mock/legado.

## Limites Visuais

A UI evita prometer runtime real nesta fase:

- documento e registrado como metadado, sem upload binario;
- ingestion e placeholder;
- MCP sync, healthcheck e tool execution sao placeholders;
- bindings MCP usam modo sandbox;
- nenhuma credencial real deve ser digitada em metadados/configs.

## Validacao

Validacao minima:

- `npm run typecheck`
- `npm run build`
- smoke local fullstack com `VITE_USE_MOCKS=false`
- navegacao manual em `/app/knowledge`, `/app/mcp` e `/app/assistants/:id`

