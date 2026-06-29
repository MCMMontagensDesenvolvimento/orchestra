# Orchestra MCP Remoto - Catalog Repository Real 11J

## 1. Objetivo

A Fase 11J substitui o adapter fail-closed da 11G por um repository real, transacional e idempotente para persistir o apply governado do catalogo MCP remoto nas tabelas criadas pela 11I.

Esta fase continua backend-only. Ela nao cria endpoint, nao altera runtime, nao materializa tools em `McpTool`, nao cria `McpToolPolicy`, nao cria `AssistantMcpBinding` e nao executa tool MCP remota.

## 2. Relacao com 11F, 11G, 11H e 11I

- 11F criou `McpRemoteCatalogImportApplyService` com boundary de repository/transaction.
- 11G implementou esse boundary como adapter fail-closed com erro `MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY`.
- 11H definiu a decisao de dados: `McpRemoteCatalogEntry` + `McpRemoteCatalogApplyLedger`, mantendo `McpTool` como catalogo operacional.
- 11I criou a migration/schema base com defaults, CHECKs fail-closed, uniques scoped e ledger de idempotencia.
- 11J conecta o service ao schema 11I sem abrir runtime ou publicacao operacional.

## 3. O que mudou no repository

`McpRemoteCatalogImportApplyPersistenceRepository` agora usa Prisma Client real:

- `findByExternalName` consulta `mcpRemoteCatalogEntry` por `tenantId`, `workspaceId`, `serverId` e `externalName`.
- `createToolDraft` cria uma entry remota em `McpRemoteCatalogEntry`.
- `updateToolDraft` atualiza a entry remota existente, com escopo completo e optimistic locking por `revision` quando informado.
- `deprecateToolDraft` muda lifecycle para `deprecated`, sem hard delete.
- `reserveApply`, `saveApplyResult` e `findApplyByIdempotencyKey` usam `McpRemoteCatalogApplyLedger`.
- A auditoria sanitizada continua passando pelo writer existente.

O export legado `MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY` permanece para compatibilidade, mas create/update/deprecate reais nao usam mais esse erro como comportamento normal.

## 4. Uso das tabelas 11I

### `McpRemoteCatalogEntry`

O repository grava identidade, lifecycle, hashes, schemas sanitizados, provenance e guardrails:

- `source = remote_discovery`;
- `allowRuntimeExecution = false`;
- `sandboxOnly = true`;
- `blockedByDefault = true`;
- `approvalMode = manual`;
- `runtimeEnabled = false`;
- `remoteExecutionEnabled = false`;
- `materializedMcpToolId = null`.

Entries criadas por apply aprovado entram como `approved_for_catalog`, o que ainda nao significa runtime, binding ou materializacao.

### `McpRemoteCatalogApplyLedger`

O ledger guarda reserva e resultado idempotente por escopo:

- unique `(tenantId, workspaceId, serverId, idempotencyKey)`;
- unique `(tenantId, workspaceId, serverId, applyId)`;
- `started` para reserva transacional;
- status final `applied`, `partially_applied`, `failed`, `blocked` ou `no_changes`;
- `summary` e `operationResults` sanitizados.

`AuditLog` continua sendo trilha de auditoria. O ledger e estado de negocio/idempotencia.

## 5. Fluxo transacional

Para apply real, o service usa `withTransaction`:

1. Reserva ledger `started` por escopo/idempotency key.
2. Executa create/update/deprecate por operation.
3. Calcula o resultado final do apply.
4. Atualiza entries aplicadas com `lastApplyId` e `lastApplyHash` finais.
5. Finaliza o ledger com status, summary e operation results sanitizados.
6. Registra auditoria sanitizada fora do boundary de mutacao de catalogo.

O repository usa `$transaction` com isolation `Serializable` quando o Prisma Client real suporta. Em testes, o client fake executa o mesmo contrato sem banco externo.

## 6. Fluxo de idempotencia

Antes de aplicar, o service consulta `findApplyByIdempotencyKey` por escopo completo.

- Se existe resultado final, ele retorna o resultado idempotente sem reaplicar operations.
- Se existe ledger `started`, o repository lança erro controlado `MCP_REMOTE_CATALOG_APPLY_IN_PROGRESS`.
- Se a reserva encontra conflito, o apply e bloqueado para reconciliacao manual.
- O service nao executa operations duas vezes silenciosamente.

## 7. Create, update e deprecate

### Create

Cria `McpRemoteCatalogEntry` com identidade externa scoped e guardrails fechados. Schemas e metadata passam por sanitizacao. Nao cria `McpTool`, `McpToolPolicy` ou binding.

### Update

Busca por id + tenant/workspace/server/externalName, preservando identidade e escopo. Incrementa `revision`, atualiza hashes e schemas sanitizados e rejeita mudanca silenciosa de `externalName`.

### Deprecate

Atualiza lifecycle para `deprecated`, preenche actor/timestamp/hash de motivo e incrementa `revision`. Nao faz delete fisico e nao toca em bindings/runtime.

## 8. Sanitizacao

Payloads persistidos em `internalMetadata`, `summary` e `operationResults` passam por allowlist defensiva:

- remove chaves de credencial, secret, token, password, credential, secretRef, baseUrl, cookie e Authorization;
- redige valores com formato sensivel, bearer, chave conhecida ou URL com userinfo;
- limita profundidade, tamanho de arrays e strings;
- nao grava `catalogDraft` bruto nem `policyDraft` bruto.

## 9. Fora do escopo

Continuam fora da 11J:

- endpoint publico ou privado;
- routes/controllers;
- frontend;
- Auth/SSO, RBAC, RAG e embeddings;
- runtime/agent execution;
- Agno/AgentOS;
- chamada MCP remota real;
- worker/fila/scheduler;
- persistencia de credenciais ou secrets;
- migration nova;
- alteracao de `schema.prisma`;
- `McpTool`, `McpToolPolicy`, `AssistantMcpBinding` e `McpToolCall`;
- materializacao operacional em `McpTool`;
- alteracao de `McpTool.isEnabled`.

## 10. Testes

Os testes da 11J cobrem:

- transacao serializable via boundary fake;
- lookup scoped por tenant/workspace/server/externalName;
- create real de entry com guardrails fail-closed;
- update com incremento de `revision` e preservacao de identidade;
- deprecate sem hard delete;
- reserva/finalizacao de ledger;
- bloqueio de ledger `started`;
- idempotencia via service 11F sem reaplicar operation;
- sanitizacao de audit/payloads;
- ausencia de rede, tool execution, `McpTool`, `McpToolPolicy`, `AssistantMcpBinding` e `McpToolCall`.

## 11. Riscos remanescentes

- A FK composta `(server_id, tenant_id, workspace_id)` segue como melhoria futura; a 11J reforca escopo via queries.
- Concorrencia real deve ser observada em ambiente integrado com PostgreSQL, especialmente conflitos serializables.
- `operationResults` ainda pode ganhar schema/DTO mais estrito antes de endpoint administrativo.
- Reconciliacao de ledger `started` ainda depende de diagnostico/admin futuro; nao ha worker nesta fase.
- Materializacao em `McpTool` permanece uma fase separada e deve revalidar runtime/binding/policy.

## 12. Plano para 11K

A 11K pode introduzir uma API administrativa interna para consultar entries/ledger e apoiar review/reconciliacao, depois de revisar DTOs, RBAC e mapper publico. Essa API nao deve habilitar runtime nem materializar tools automaticamente.
