# Orchestra MCP Remoto - Catalog Admin Read API 11K

Status: implementado no backend. A Fase 11K adiciona uma API interna, autenticada e somente leitura para consultar o catalogo MCP remoto importado e os ledgers de apply gerados pela Fase 11J.

## Escopo

- Listar e detalhar entradas persistidas em `McpRemoteCatalogEntry`.
- Listar e detalhar ledgers persistidos em `McpRemoteCatalogApplyLedger`.
- Manter scoping por `tenantId` da sessao e por workspaces do usuario autenticado.
- Usar DTOs allowlist e sanitizacao explicita para schemas e resultados de apply.
- Expor apenas rotas `GET`.

Fora do escopo:

- Criar, atualizar, aprovar, aplicar, materializar ou arquivar entradas.
- Criar `McpTool`, `McpToolPolicy`, `AssistantMcpBinding` ou `McpToolCall`.
- Alterar `McpTool.isEnabled`.
- Chamar MCP remoto, executar tool, alterar discovery, Runtime, Agno, worker ou frontend.
- Alterar `schema.prisma`, migrations ou seeds.

## Autenticacao e permissao

Todas as rotas usam o padrao existente do backend:

- `requireAuth`
- `requirePermission('mcp.manage')`

A escolha foi `mcp.manage` porque esta API e de leitura administrativa interna do catalogo remoto e dos ledgers de apply. Ela nao usa `mcp.read`, que tambem existe, para evitar abrir dados de reconciliacao administrativa a perfis de leitura operacional mais amplos.

## Rotas

Base: `/api/v1/mcp`

- `GET /remote-catalog/entries`
- `GET /remote-catalog/entries/:id`
- `GET /remote-catalog/apply-ledgers`
- `GET /remote-catalog/apply-ledgers/:id`

Nao ha rotas `POST`, `PUT`, `PATCH` ou `DELETE` nesse escopo.

## Filtros e paginacao

As listas usam `page`, `perPage`, `search`, `sortBy` e `sortDirection`, com `perPage` limitado a 100.

Entradas aceitam:

- `workspaceId`
- `serverId`
- `externalName`
- `lifecycleStatus`
- `riskLevel`
- `requiresApproval`
- `snapshotHash`
- `specHash`
- `catalogHash`
- `lastPlanHash`
- `lastApplyHash`

Sort allowlist de entradas:

- `createdAt`
- `updatedAt`
- `externalName`
- `displayName`
- `lifecycleStatus`
- `riskLevel`
- `importedAt`
- `approvedAt`
- `deprecatedAt`
- `revision`

Ledgers aceitam:

- `workspaceId`
- `serverId`
- `status`
- `planId`
- `planHash`
- `snapshotHash`
- `applyId`
- `applyHash`
- `idempotencyKey`
- `approvedByUserId`
- `createdAtFrom`
- `createdAtTo`

`idempotencyKey` e validado como hash hexadecimal de 64 caracteres e usado apenas como filtro exato. A lista de ledgers nao retorna esse campo.

Sort allowlist de ledgers:

- `createdAt`
- `completedAt`
- `status`
- `planId`
- `applyId`

## DTOs

Entradas retornam campos explicitamente permitidos:

- ids de tenant, workspace, server e entrada
- nomes, descricao, origem, lifecycle, risco e approval
- hashes de spec/catalog/snapshot/plan/apply
- policy fail-closed persistida
- revision, timestamps e ids de usuarios de import/approval/deprecation
- indicador booleano `materialization.isMaterialized`

Detalhe de entrada tambem retorna `schemas.input`, `schemas.output` e `schemas.summary`. Os schemas sao sanitizados, limitados por profundidade, tamanho de strings, numero de chaves e numero de itens de array.

Ledgers em lista retornam:

- ids de tenant, workspace, server e ledger
- plan/apply/snapshot hashes
- status, summary numerico, schemaVersion e timestamps
- `approvedByUserId`

Detalhe de ledger tambem retorna:

- `idempotencyKey`
- `approvalReasonHash`
- `operationResults` sanitizado

## Redacao e seguranca

Os mappers sao allowlist e nao fazem spread direto de rows Prisma para a resposta publica.

Nao sao selecionados nem expostos:

- `internalMetadata`
- `secretRef`
- `baseUrl`
- auth, headers, cookies, tokens, passwords, credentials ou Authorization
- drafts internos de catalogo/policy
- operation results crus em listas

Chaves sensiveis sao removidas dos JSONs sanitizados. Textos com formato sensivel sao substituidos por `[redacted]`. Arrays, objetos, profundidade e strings sao limitados.

## Garantias de nao mutacao

A API 11K usa um repository separado de leitura:

- `findMany`
- `count`
- `findFirst`

Nao usa:

- `create`
- `update`
- `updateMany`
- `delete`
- transacoes de apply
- chamadas a MCP remoto
- fetch/http client
- tabelas operacionais de tools/bindings/tool calls

## Testes adicionados

Arquivo:

- `backend/tests/api/mcp-remote-catalog-admin.test.ts`

Cobertura:

- auth obrigatoria
- permissao `mcp.manage`
- scoping por workspace
- filtros de entrada e ledger
- paginacao maxima
- sort allowlist
- invalid filters com erro de validacao
- redacao de DTOs de entrada e ledger
- lista de ledger sem `idempotencyKey`, `approvalReasonHash` ou payload de results
- detalhe de ledger com hashes permitidos e results sanitizados
- inexistencia de rotas mutaveis para entries e ledgers

## Arquivos backend

- `backend/src/modules/mcp/remote/mcp-remote-catalog-admin.schema.ts`
- `backend/src/modules/mcp/remote/mcp-remote-catalog-admin.repository.ts`
- `backend/src/modules/mcp/remote/mcp-remote-catalog-admin.mapper.ts`
- `backend/src/modules/mcp/remote/mcp-remote-catalog-admin.service.ts`
- `backend/src/modules/mcp/remote/mcp-remote-catalog-admin.controller.ts`
- `backend/src/modules/mcp/mcp.routes.ts`

## Handoff

A Fase 11K entrega somente leitura administrativa. Proximas fases podem adicionar fluxos de revisao ou materializacao, mas devem continuar separando read API, approval/apply, materializacao operacional e runtime execution em boundaries distintos.
