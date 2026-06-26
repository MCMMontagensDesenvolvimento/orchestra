# Orchestra MCP Remoto Catalog Import Plan 11E

Status: implementado como base backend estrutural, sem aplicar ou persistir alteracoes no catalogo operacional.

## 1. Objetivo

A Fase 11E cria um plano governado de importacao/reconciliacao de tools MCP remotas para o catalogo operacional. O plano consome o review package da 11D e descreve o que seria criado, atualizado, deprecated ou mantido em uma fase futura.

O plano e deterministico, auditavel e bloqueado por default. Ele nao aplica nenhuma operacao.

## 2. Relacao Com 11A/11B/11C/11D

A 11A definiu o contrato governado para MCP remoto real.

A 11B criou readiness e client fail-closed.

A 11C criou discovery governado com transporte injetavel, sanitizacao, diff e `specHash`.

A 11D criou review package, approval gate, proposed actions e audit event sanitizado.

A 11E transforma as proposed actions da 11D em operations de plano de catalogo, ainda sem persistencia.

## 3. O Que Foi Implementado

Foram adicionados:

- types de import plan, operation, catalog draft, policy draft, validation, preflight e audit event em `mcp-remote.types.ts`;
- `mcp-remote-catalog-import-plan.service.ts`;
- export no index da subcamada remota;
- testes unitarios em `backend/tests/unit/mcp-remote-catalog-import-plan.test.ts`.

O service principal e `McpRemoteCatalogImportPlanService`, com `createImportPlan`.

## 4. O Que Continua Fora De Escopo

Nao foi implementado:

- aplicacao real do plano;
- persistencia em banco;
- import automatico de tools descobertas;
- habilitacao de runtime;
- execucao real de tools MCP;
- endpoint publico de apply;
- worker, fila ou scheduler;
- alteracao de frontend;
- alteracao de Auth/SSO;
- alteracao de RBAC;
- alteracao de RAG ou embeddings;
- alteracao de runtime/AgentRun;
- integracao Agno/AgentOS;
- Prisma schema ou migration.

## 5. Fluxo Do Import Plan

O fluxo:

1. recebe `McpRemoteDiscoveryReviewPackage`;
2. calcula status do plano a partir da decision da 11D;
3. mapeia proposed actions para operations de catalogo;
4. cria catalog drafts sanitizados quando aplicavel;
5. cria policy drafts fechadas;
6. executa validation/preflight;
7. calcula `planHash` deterministico;
8. gera audit event sanitizado.

## 6. Mapeamento Proposed Action -> Catalog Operation

Mapeamento:

- `propose_add` -> `create_tool_draft`;
- `propose_update` -> `update_tool_draft`;
- `propose_remove` -> `deprecate_tool_draft`;
- `keep_existing` -> `noop`;
- `blocked` -> `blocked`.

Se o review package estiver `blocked` ou `rejected`, operations tambem sao bloqueadas ou omitidas.

## 7. Catalog Draft

`catalogDraft` e criado apenas como rascunho seguro. Ele contem:

- `externalName`;
- `displayName` derivado de forma deterministica;
- description sanitizada quando disponivel;
- `specHash`;
- source `remote_discovery`;
- referencia ao snapshot;
- metadata sanitizada.

O draft nao contem `secretRef`, credenciais, token, password, api key, authorization ou URL de transporte.

## 8. Policy Draft Bloqueada

Toda operation recebe policy draft fechada:

```ts
{
  allowRuntimeExecution: false,
  sandboxOnly: true,
  blockedByDefault: true,
  requiresApproval: true,
  approvalMode: 'manual',
  runtimeEnabled: false,
  remoteExecutionEnabled: false,
}
```

Mesmo planos `ready_for_manual_apply` nao podem aplicar nesta fase.

## 9. Validation/Preflight

Validation bloqueia:

- ausencia de `snapshotHash`;
- ausencia de server/tenant/workspace;
- nomes duplicados;
- high/critical sem review humano;
- payload sensivel em draft;
- policy que tente abrir runtime execution;
- `canApply=true`;
- `canApplyAutomatically=true`.

Preflight retorna sempre:

- `canApply=false`;
- `canApplyAutomatically=false`;
- checks para snapshot, decision, operations, risk, policy, security e runtime block.

## 10. Audit Event Sanitizado

O audit event usa:

```text
mcp.remote.catalog_import_plan.created
```

Ele contem tenant, workspace, serverId, requestId, snapshotHash, planHash, status, counts, risk summary e operation types. Nao inclui schemas brutos, credentials, `secretRef`, baseUrl ou payload operacional sensivel.

## 11. Por Que Ainda Nao Aplica/Persiste No Catalogo

Aplicar o plano exige permissao, transacao, auditoria duravel, reconciliacao com estado atual do catalogo e estrategia de rollback. A 11E cria somente o artefato tecnico que permite revisar o que sera aplicado em uma fase futura.

## 12. Por Que Ainda Nao Executa Tools Remotas

Execucao remota continua fora do escopo porque depende de credenciais resolvidas, isolamento, limits, approvals por chamada, auditoria operacional e runtime autorizado. O plano 11E somente prepara catalog drafts; ele nao publica capabilities ao runtime.

## 13. Testes

`backend/tests/unit/mcp-remote-catalog-import-plan.test.ts` cobre:

- status `blocked`;
- status `pending_approval`;
- status `ready_for_manual_apply` sem apply;
- status `no_changes`;
- mapeamento de todas as proposed actions;
- operations sempre `canApply=false` e `canApplyAutomatically=false`;
- policy drafts fechadas;
- hash deterministico;
- audit event sem payload sensivel;
- catalog draft/metadata sanitizados;
- ausencia de rede, execucao de tool e persistencia;
- high/critical com preflight conservador;
- erro para duplicidade de `externalName`.

## 14. Rollback

Rollback da 11E:

1. Remover `mcp-remote-catalog-import-plan.service.ts`.
2. Remover os types 11E de `mcp-remote.types.ts`.
3. Remover export no `index.ts`.
4. Remover `backend/tests/unit/mcp-remote-catalog-import-plan.test.ts`.
5. Remover este documento e sua entrada no README.

Nao ha migration, dado persistido ou alteracao funcional de runtime para reverter.

## 15. Proximo Passo 11F

Recomendacao para 11F:

- persistir/importar o plano com permissao explicita;
- criar auditoria duravel;
- aplicar add/update/deprecate em transacao;
- bloquear runtime execution mesmo apos import, ate fase especifica de execution;
- validar estado atual do catalogo no momento do apply.

## 16. Preparacao Para Agno/AgentOS Futuro

A 11E preserva o Orchestra como control plane. Agno/AgentOS podera consumir somente catalogo governado ja aprovado e importado em fases futuras. Nenhum adapter Agno foi criado nesta fase.
