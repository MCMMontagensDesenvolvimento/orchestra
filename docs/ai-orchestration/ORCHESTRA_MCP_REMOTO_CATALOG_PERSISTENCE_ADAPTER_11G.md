# Orchestra MCP Remoto - Catalog Persistence Adapter 11G

## 1. Objetivo

A Fase 11G faz o discovery tecnico do catalogo MCP existente e conecta a porta de apply criada na 11F somente ate o limite seguro permitido pelo schema atual. O resultado e um adapter backend-only fail-closed: ele implementa os contratos de repository/transaction, grava apenas auditoria sanitizada pelo mecanismo existente e recusa mutacoes de catalogo com o codigo controlado `MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY`.

Nao foi criado endpoint, migration, alteracao de Prisma schema, chamada de rede, execucao de tool ou habilitacao de runtime.

## 2. Relacao com 11A a 11F

- 11A definiu discovery e contrato para MCP remoto governado.
- 11B criou flags, readiness e client stub fail-closed.
- 11C criou discovery remoto sanitizado, hash, diff e policy fechada.
- 11D criou review package, snapshot, approval gate e audit event.
- 11E transformou review em plano de importacao com operations draft.
- 11F criou apply service com autorizacao explicita e boundary de repository/transaction.
- 11G implementa esse boundary como adapter fail-closed depois de verificar o catalogo real.

O Orchestra permanece control plane e fonte da verdade.

## 3. Discovery do catalogo MCP atual

### 3.1 Models Prisma

| Model | Capacidade relevante | Limite para 11G |
| --- | --- | --- |
| `McpServer` | `tenantId`, `workspaceId`, tipo, URL, status, trust/risk, auth type, referencia indireta de credencial, metadata e soft delete | nao identifica uma importacao/snapshot remoto |
| `McpTool` | tenant/workspace/server, `name`, input/output schema, risk, approval, `isEnabled`, metadata e soft delete | nao possui `externalName`, lifecycle draft/deprecated, hash do spec/catalogo ou unicidade por nome externo |
| `McpToolPolicy` | `allowRuntimeExecution`, `sandboxOnly`, `requiresApproval`, `blockedByDefault` | suporta a policy efetiva fechada, mas nao resolve identidade/lifecycle do draft |
| `AssistantMcpBinding` | vinculo opcional de tool, modo e enablement | nao deve ser criado para imports 11G |
| `McpToolCall` / `McpToolCallEvent` | registro de sandbox/tool call | fora do fluxo de persistencia 11G |
| `AuditLog` | tenant/workspace/actor/action/entity/metadata | compativel com auditoria sanitizada do apply |

`McpResource` e `McpPrompt` existem, mas o plano 11E/11F desta fase trata somente tools.

### 3.2 Campos e mapeamento

- Tenant/workspace/server: existem como colunas obrigatorias em `McpTool` e `McpToolPolicy`.
- Nome: existe apenas `McpTool.name`; nao ha separacao duravel entre `externalName` e `displayName`.
- Schemas: `inputSchema` e `outputSchema` existem como JSON.
- Status: server possui status; tool possui apenas `isEnabled` e `deletedAt`. Nao ha status `draft` ou `deprecated`.
- Policy/approval/runtime: os quatro guardrails fechados existem em `McpToolPolicy`; tool tambem possui `requiresApproval` e `isEnabled`.
- Auth: server possui tipo de auth e referencia indireta; a 11G nao le, aceita, persiste ou retorna credenciais.
- Hash/proveniencia: nao existem colunas para `specHash`, `catalogHash`, snapshot de origem, plan/apply idempotency key ou imported-by.
- Unicidade: nao existe unique key para tenant/workspace/server/`externalName`.

### 3.3 Repositories, services, REST e permissions

- `mcp.repository.ts` manipula servers, tools, policies, resources, prompts, bindings e tool calls via Prisma.
- `mcp.service.ts` aplica escopo do usuario, auditoria e precheck/sandbox local.
- `mcp.mapper.ts` mapeia as entidades do catalogo para os contratos REST existentes.
- `mcp.routes.ts` expoe CRUD governado atual com permissions como `mcp.read`, `mcp.create`, `mcp.update`, `mcp.tools.read`, `mcp.tools.manage` e `mcp.policies.manage`.
- `backend/prisma/seed.ts` ja cadastra essas permissions.
- Nenhuma rota/controller/service publico foi adicionado pela 11G.
- `audit.service.ts` e `AuditLog` formam um mecanismo compativel de auditoria.

## 4. Decisao

Foi escolhida a **Opcao B - adapter fail-closed**.

Persistir `externalName`, lifecycle, hashes, snapshot e idempotencia somente em `McpTool.metadata` nao e seguro:

1. nao ha constraint de unicidade para impedir tools duplicadas em concorrencia;
2. `name` nao pode representar simultaneamente identidade externa estavel e nome de exibicao;
3. `isEnabled=false` nao distingue draft, deprecated, blocked e archived;
4. metadata nao oferece integridade referencial nem busca/idempotencia garantida;
5. o mapper REST atual devolve metadata, portanto colocar o draft completo ali ampliaria a superficie publica;
6. deprecate poderia ser confundido com o archive existente.

Forcar esse encaixe criaria estado ambiguo. Nenhuma mutacao foi conectada ao Prisma.

## 5. Adapter e mapeamento de operations

O adapter `McpRemoteCatalogImportApplyPersistenceRepository` implementa `McpRemoteCatalogImportApplyRepository` e `McpRemoteCatalogImportApplyTransaction`.

| Operation | Comportamento 11G |
| --- | --- |
| `findByExternalName` | retorna `null`; identidade duravel ainda nao existe |
| `create_tool_draft` | erro controlado persistence-not-ready |
| `update_tool_draft` | erro controlado persistence-not-ready |
| `deprecate_tool_draft` | erro controlado persistence-not-ready; nao faz delete fisico |
| `noop` | tratado pelo apply service sem mutacao |
| `blocked` | tratado pelo apply service como bloqueado |
| `withTransaction` | fornece o boundary ao apply service, mas as mutacoes permanecem fechadas |

O apply service 11F captura o erro da operacao e retorna status `failed` de forma controlada, sempre com `runtimeEnabled=false` e `remoteExecutionEnabled=false`.

## 6. Seguranca e credenciais

- O adapter nao recebe nem consulta configuracao de auth do server.
- Nenhuma credencial bruta, header de autorizacao, URL com userinfo, password, API key ou token e persistido.
- O audit writer usa allowlist estrutural e remove chaves sensiveis recursivamente.
- Valores com formato de bearer, chave conhecida ou URL com credencial embutida sao redigidos.
- A referencia indireta de credencial do server nao integra o payload do adapter nem o audit event.
- Catalog draft e policy draft nao sao armazenados em metadata como atalho.

## 7. Runtime permanece bloqueado

A 11G nao cria binding, nao muda `McpTool.isEnabled`, nao altera server status e nao cria/update policy. Os invariantes continuam:

- `allowRuntimeExecution=false`;
- `sandboxOnly=true`;
- `blockedByDefault=true`;
- `requiresApproval=true`;
- `runtimeEnabled=false`;
- `remoteExecutionEnabled=false`.

Nenhuma tool remota foi habilitada.

## 8. Auditoria e persistencia

A unica escrita permitida pelo adapter e o audit event sanitizado no `AuditLog` existente. O actor e o aprovador do apply; tenant, workspace e server sao preservados. Um audit writer injetavel permite unit tests sem banco.

Nao existe escrita em `McpTool`, `McpToolPolicy`, bindings ou tabelas de tool call. Tambem nao ha persistencia do resultado de idempotencia nesta fase.

## 9. Testes

Os testes unitarios cobrem:

- construcao do adapter fail-closed;
- transaction boundary sem mutacao real;
- lookup retornando `null`;
- erro controlado em create/update/deprecate;
- auditoria sanitizada;
- integracao com apply service retornando `failed`;
- runtime e remote execution falsos;
- ausencia de fetch, executor externo e banco real.

## 10. Gaps para 11H

Uma fase com migration revisada deve considerar:

1. coluna `externalName` em `McpTool`;
2. unique key por tenant/workspace/server/`externalName`;
3. lifecycle explicito com estados pelo menos `draft`, `blocked`, `active` e `deprecated`;
4. `specHash` e `catalogHash` duraveis;
5. snapshot id/hash, source e imported-by/imported-at;
6. idempotency ledger para plan/apply, ou estrutura equivalente com unique key;
7. estrategia de concorrencia/retry transacional;
8. contrato publico que nao exponha campos internos de governanca ou referencias de credencial;
9. rollback/reconciliation model para create/update/deprecate.

Somente depois desses invariantes o adapter pode trocar o erro controlado por operacoes Prisma reais.

## 11. Rollback

O rollback tecnico e remover:

- `mcp-remote-catalog-import-apply.repository.ts`;
- seu export em `remote/index.ts`;
- o teste unitario 11G;
- este documento e a entrada 11G do README.

Nao ha rollback de dados, pois nenhuma tool/policy foi persistida e nenhuma migration foi criada. Audit logs eventualmente gerados sao historicos operacionais e nao habilitam runtime.

## 12. Proximo passo 11H

A 11H deve propor e revisar o schema/migration minimo para identidade remota, lifecycle, hashes e idempotencia. A migration deve ser separada desta fase, com backfill seguro, constraints, mapper publico revisado e testes de concorrencia/transacao antes de ativar persistencia real.

## 13. Preparacao para Agno/AgentOS futuro

O boundary continua independente do runtime. Um adapter real futuro podera abastecer runtime interno, Agno/AgentOS ou runtime on-premise sem mudar o contrato de apply. A selecao/publicacao para runtime deve permanecer em fase propria e posterior; catalog persistence nao equivale a runtime enablement.
