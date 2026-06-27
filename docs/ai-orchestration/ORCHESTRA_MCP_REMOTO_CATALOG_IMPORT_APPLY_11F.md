# Orchestra MCP Remoto - Catalog Import Apply Governado 11F

## 1. Objetivo

A Fase 11F cria a base backend para aplicar, de forma governada, um `McpRemoteCatalogImportPlan` produzido na 11E. O foco e transformar operations draft aprovadas em chamadas a uma porta de repositorio injetavel, mantendo o Orchestra como control plane e fonte da verdade.

Esta fase nao publica endpoint, nao habilita runtime, nao chama servidor MCP remoto e nao executa tools. A aplicacao e uma capacidade interna de dominio para fases posteriores conectarem a persistencia real.

## 2. Relacao com 11A/11B/11C/11D/11E

- 11A documentou o contrato de discovery MCP remoto governado.
- 11B criou flags fail-closed, readiness e client stub sem chamada externa.
- 11C criou discovery remoto com transporte injetavel, sanitizacao, diff e policy fechada.
- 11D criou review package, snapshot/hash, approval gate e auditoria sanitizada.
- 11E criou o catalog import plan como draft nao aplicavel.
- 11F consome o plano da 11E e aplica operations somente via repository/transaction boundary governado.

## 3. O Que Foi Implementado

- Types de apply request, authorization, options, operation result, result, audit event, rollback notes, repository e transaction.
- `McpRemoteCatalogImportApplyService`.
- Boundary `McpRemoteCatalogImportApplyRepository` e `McpRemoteCatalogImportApplyTransaction`.
- Idempotency key derivada de `planHash`, `snapshotHash`, `tenantId`, `workspaceId`, `serverId` e `approvedByUserId`.
- Audit event sanitizado `mcp.remote.catalog_import_apply.executed`.
- Testes unitarios com fake repository in-memory.

## 4. Fora De Escopo

- Frontend.
- Endpoint publico.
- Auth/SSO e RBAC novo.
- RAG, embeddings e runtime/agent execution.
- Integracao Agno/AgentOS.
- Adapter Agno.
- Execucao real de tool MCP.
- Chamada real a servidor MCP remoto.
- Worker, fila ou scheduler.
- Prisma schema, migration ou tabelas novas.
- Persistencia real caso o catalogo MCP ainda nao tenha adapter compativel.

## 5. Fluxo De Apply Governado

1. O caller interno envia um `McpRemoteCatalogImportPlan`, contexto de autorizacao explicita e opcoes.
2. O service valida autorizacao manual.
3. O service valida status, preflight, operations, policy fechada e ausencia de payload sensivel.
4. O service busca resultado idempotente quando o repositorio suporta `findApplyByIdempotencyKey`.
5. O service aplica operations dentro de `withTransaction`.
6. O service grava audit event sanitizado e, quando nao for dry-run, salva o resultado idempotente.

## 6. Autorizacao Explicita

O apply exige:

- `confirmManualApply=true`.
- `approvedByUserId` preenchido.
- `approvalReason` preenchido.

Planos `pending_approval` so podem ser aplicados com `allowPendingApprovalApply=true`. Planos `ready_for_manual_apply` sao aceitos por default, salvo `allowReadyForManualApply=false`.

## 7. Repository/Transaction Boundary

A fase define uma porta de repositorio para:

- buscar item atual por `externalName`;
- criar draft de tool;
- atualizar draft de tool;
- marcar item como deprecated;
- registrar audit event;
- executar a operacao dentro de uma transacao abstrata;
- opcionalmente consultar e salvar resultado idempotente.

Os testes usam apenas fake repository. Nenhum teste toca Prisma ou banco real.

## 8. Idempotencia

A idempotency key e deterministica e nao inclui timestamp. Assim, a mesma combinacao de plano, snapshot, tenant, workspace, server e aprovador retorna o resultado ja salvo no fake repository, sem reaplicar mutations.

`dryRun=true` registra auditoria, mas nao salva resultado idempotente. Isso evita que um dry-run bloqueie uma aplicacao real posterior com a mesma chave.

## 9. Aplicacao Das Operations

- `create_tool_draft`: cria draft no catalogo via repository com policy fechada.
- `update_tool_draft`: atualiza draft existente via repository com policy fechada.
- `deprecate_tool_draft`: marca item como deprecated/inactive, sem delete fisico.
- `noop`: retorna sem alteracao.
- `blocked`: retorna bloqueado e nao altera catalogo.

Falhas de repository em uma operation viram resultado `failed`; se uma operation anterior ja aplicou, o status agregado vira `partially_applied`.

## 10. Runtime Permanece Bloqueado

Todas as policies e resultados preservam:

- `allowRuntimeExecution=false`;
- `sandboxOnly=true`;
- `blockedByDefault=true`;
- `requiresApproval=true`;
- `runtimeEnabled=false`;
- `remoteExecutionEnabled=false`.

O service tambem bloqueia qualquer operation que tente abrir runtime.

## 11. Audit Event Sanitizado

O audit event inclui:

- tipo `mcp.remote.catalog_import_apply.executed`;
- tenant/workspace/server;
- `planHash`;
- `applyHash`;
- `approvedByUserId`;
- status;
- counts;
- operation types;
- metadata operacional sem payload sensivel.

O evento nao inclui catalog draft, credenciais, endpoint sensivel ou payload bruto.

## 12. Seguranca E Secrets

A fase rejeita campos de autorizacao com formato textual de credencial e bloqueia operations com payload sensivel no catalog draft. O retorno nao expande referencia de segredo, nao carrega token, senha, chave de API, authorization header nem URL com credencial.

Nao ha chamada de rede no apply service. Nao ha execucao remota. Nao ha persistencia de credenciais em texto puro.

## 13. Testes

`backend/tests/unit/mcp-remote-catalog-import-apply.test.ts` cobre:

- autorizacao obrigatoria;
- status `blocked`, `no_changes`, `pending_approval` e `ready_for_manual_apply`;
- `dryRun`;
- create/update/deprecate/noop/blocked;
- runtime e remote execution sempre falsos;
- audit event sanitizado;
- ausencia de chamada de rede e execucao de tool;
- idempotencia;
- falha parcial;
- uso exclusivo de fake repository.

## 14. Rollback

Como nao ha migration, schema Prisma, endpoint ou runtime novo, o rollback tecnico e remover:

- `mcp-remote-catalog-import-apply.service.ts`;
- os types 11F adicionados em `mcp-remote.types.ts`;
- o export em `remote/index.ts`;
- os testes 11F;
- este documento e a entrada do README.

Para um apply real futuro, rollback operacional devera ser definido por uma fase propria ou por reconciliacao manual do catalogo.

## 15. Proximo Passo 11G

A proxima fase pode criar um adapter de persistencia real para o catalogo MCP existente, se o modelo atual estiver estavel, ainda sem expor endpoint publico nem habilitar runtime automaticamente.

## 16. Preparacao Para Agno/AgentOS Futuro

A porta de apply nao assume runtime especifico. O resultado fica desacoplado o suficiente para ser consumido depois por runtime interno, Agno/AgentOS ou runtime on-premise, mantendo o Orchestra como control plane e mantendo tools remotas bloqueadas ate aprovacao futura.
