# Orchestra MCP Remoto - Catalog Schema Migration 11I

## 1. Objetivo

A Fase 11I implementa a migration/schema base para persistencia futura do catalogo MCP remoto governado, conforme o design 11H.

Esta fase cria somente as estruturas de dados para identity, lifecycle, hashes, provenance e ledger idempotente. Ela nao implementa adapter real, endpoint, binding, runtime, worker, materializacao em `McpTool`, chamada externa MCP ou integracao Agno/AgentOS.

## 2. Relacao com 11H

A 11H escolheu a Opcao C: `McpRemoteCatalogEntry` + `McpRemoteCatalogApplyLedger`, com `McpTool` permanecendo como catalogo operacional atual e materializacao em fase posterior.

A 11I aplica essa decisao em Prisma/PostgreSQL:

- `McpRemoteCatalogEntry` guarda o estado governado do item remoto importado.
- `McpRemoteCatalogApplyLedger` guarda idempotencia e reconciliacao do apply.
- `McpTool` nao recebe draft remoto bruto.
- `AssistantMcpBinding`, `McpToolCall`, runtime e publicacao continuam separados.

## 3. Models criados

### `McpRemoteCatalogEntry`

Representa uma entry remota governada, ainda isolada do catalogo operacional.

Campos principais:

- Escopo: `tenantId`, `workspaceId`, `mcpServerId`.
- Identidade externa: `externalName`, `displayName`, `description`, `source`.
- Lifecycle/catalogo: `lifecycleStatus`, `riskLevel`, `requiresApproval`.
- Integridade/reconciliacao: `specHash`, `catalogHash`, `snapshotId`, `snapshotHash`, `lastPlanId`, `lastPlanHash`, `lastApplyId`, `lastApplyHash`, `revision`.
- Schemas sanitizados: `inputSchema`, `outputSchema`.
- Guardrails fail-closed: `allowRuntimeExecution`, `sandboxOnly`, `blockedByDefault`, `approvalMode`, `runtimeEnabled`, `remoteExecutionEnabled`.
- Provenance: `importedByUserId`, `importedAt`, `approvedByUserId`, `approvedAt`, `deprecatedByUserId`, `deprecatedAt`, `deprecationReasonHash`.
- Materializacao futura: `materializedMcpToolId`, nullable e unico.
- Interno: `internalMetadata`, `createdAt`, `updatedAt`, `deletedAt`.

### `McpRemoteCatalogApplyLedger`

Representa o ledger transacional/idempotente de apply. Ele nao substitui `AuditLog`: o ledger guarda estado de negocio e reconciliacao; `AuditLog` continua sendo a trilha de auditoria.

Campos principais:

- Escopo: `tenantId`, `workspaceId`, `mcpServerId`.
- Plano/snapshot/apply: `planId`, `planHash`, `snapshotHash`, `applyId`, `applyHash`.
- Idempotencia: `idempotencyKey`.
- Aprovacao: `approvedByUserId`, `approvalReasonHash`.
- Resultado sanitizado: `status`, `summary`, `operationResults`, `schemaVersion`.
- Tempo: `createdAt`, `completedAt`.

## 4. Decisao de status

A 11I usa `String` no Prisma + CHECK constraints no SQL da migration, em vez de Prisma enum.

Justificativa:

- O schema atual ja usa `String` para status/risk/mode em varios models.
- CHECK em PostgreSQL permite rollback e evolucao de valores sem o custo operacional de enum nativo.
- A allowlist fica enforceada no banco sem acoplar o Prisma Client a enum nativo nesta fase.

Valores aplicados:

- `lifecycleStatus`: `draft`, `blocked`, `approved_for_catalog`, `active`, `deprecated`, `archived`.
- `source`: `remote_discovery`.
- `riskLevel`: `low`, `medium`, `high`, `critical`.
- `approvalMode`: `manual`.
- Ledger `status`: `started`, `applied`, `partially_applied`, `failed`, `blocked`, `no_changes`.

## 5. Constraints e indices

### Entry

- Unique de identidade externa: `(tenant_id, workspace_id, server_id, external_name)`.
- Indice de lifecycle: `(tenant_id, workspace_id, server_id, lifecycle_status)`.
- Indices de reconciliacao: `snapshot_hash`, `spec_hash`, `catalog_hash`, `last_plan_hash`, `last_apply_hash`.
- Unique nullable para materializacao futura: `materialized_mcp_tool_id`.
- CHECK `revision > 0`.
- CHECKs fail-closed:
  - `allow_runtime_execution = false`;
  - `sandbox_only = true`;
  - `blocked_by_default = true`;
  - `approval_mode = 'manual'`;
  - `runtime_enabled = false`;
  - `remote_execution_enabled = false`.
- CHECKs de valores permitidos para source, lifecycle e risk.
- CHECKs de hash SHA-256 hexadecimal para hashes persistidos.

### Ledger

- Unique idempotente: `(tenant_id, workspace_id, server_id, idempotency_key)`.
- Unique de apply: `(tenant_id, workspace_id, server_id, apply_id)`.
- Indice de status scoped: `(tenant_id, workspace_id, server_id, status)`.
- Indices de reconciliacao: `plan_hash`, `snapshot_hash`, `apply_hash`, `created_at`.
- CHECK `schema_version > 0`.
- CHECK de status permitido.
- CHECKs de hash SHA-256 hexadecimal para hashes persistidos.

## 6. Relacoes e escopo

As novas tabelas possuem FKs simples para `Tenant`, `Workspace`, `McpServer`, `User` e, de forma nullable, `McpTool`.

A FK composta `(server_id, tenant_id, workspace_id)` nao foi adicionada nesta fase. O schema atual de `McpServer` nao possui unique composto auxiliar para essa FK, e adiciona-lo em model existente ampliaria o escopo da 11I. O isolamento planejado fica garantido nesta fase por colunas obrigatorias, FKs simples, uniques/indices scoped e deve ser reforcado no adapter real da 11J com queries sempre filtrando tenant/workspace/server.

## 7. Fail-closed preservado

A migration preserva fail-closed no nivel de banco:

- Runtime continua sempre fechado nas entries remotas.
- Sandbox permanece obrigatorio.
- Bloqueio default permanece verdadeiro.
- Approval mode permanece manual.
- `runtimeEnabled` e `remoteExecutionEnabled` permanecem falsos.
- `materializedMcpToolId` inicia nullable.

Nao ha persistencia de `catalogDraft` bruto, `policyDraft` bruto, secret, token, header de autorizacao, API key, password, payload de credencial, cookie ou URL com userinfo nas novas tabelas.

## 8. Fora do escopo

Continuam fora desta fase:

- adapter real em `McpRemoteCatalogImportApplyPersistenceRepository`;
- endpoint publico ou privado;
- alteracao de services MCP remotos;
- frontend;
- Auth/SSO, RBAC, RAG, embeddings;
- runtime/agent execution;
- Agno/AgentOS;
- chamada a servidor MCP remoto;
- worker/fila/scheduler;
- persistencia de credenciais ou secrets;
- `AssistantMcpBinding`;
- criacao automatica de `McpTool`;
- alteracao de `McpTool.isEnabled`;
- policy operacional permissiva.

## 9. Migration

Migration criada:

`backend/prisma/migrations/20260627164042_phase_11i_mcp_remote_catalog_schema/migration.sql`

Ela cria apenas:

- `mcp_remote_catalog_entries`;
- `mcp_remote_catalog_apply_ledgers`;
- indices, uniques, FKs simples e CHECKs dessas tabelas.

Nenhuma tabela existente e dropada. Nenhuma coluna existente e removida. Nao ha backfill, seed ou dado inicial.

## 10. Rollback

Rollback seguro inicial, enquanto as tabelas estiverem vazias:

1. Remover a migration 11I.
2. Remover os models/relations adicionados ao `schema.prisma`.
3. Remover os testes/docs 11I.

Depois que houver dados reais, rollback exige export/reconciliacao operacional. Nao deve simplesmente derrubar as tabelas sem plano aprovado.

## 11. Testes executados

Durante a implementacao desta fase foram executados:

- `npx prisma validate`;
- `npx prisma generate`;
- `npm run test -- tests/unit/mcp-remote-catalog-schema-migration.test.ts --run`.

O teste estrutural valida:

- delegates `mcpRemoteCatalogEntry` e `mcpRemoteCatalogApplyLedger` no Prisma Client;
- defaults fail-closed e CHECKs principais;
- uniques/idempotency constraints;
- materializacao nullable;
- ausencia de criacao de `McpTool`, `AssistantMcpBinding` e `McpToolCall` na migration;
- ausencia de campos de credencial nos novos models.

## 12. Riscos remanescentes para 11J

- Adapter real ainda precisa implementar transacao, idempotencia, retry e optimistic locking.
- FK composta de escopo pode ser reavaliada se a 11J aceitar unique auxiliar em `McpServer`.
- `summary`, `operationResults` e `internalMetadata` ainda precisam de allowlist/limites no codigo antes de uso real.
- Mapper/DTO publico deve ser revisado antes de qualquer endpoint de import.
- Hash canonicalization deve ser implementado no app antes da primeira escrita real.
- Ledger `started` abandonado exigira diagnostico/admin futuro; nao ha worker nesta fase.
