# Orchestra MCP Remoto - Catalog Schema Design 11H

## 1. Objetivo

A Fase 11H define o design tecnico da migration futura que permitira persistencia real, segura e governada do catalogo MCP remoto. Esta fase e exclusivamente documental: nao altera `backend/prisma/schema.prisma`, nao cria migration, nao modifica codigo backend e nao publica capacidade de runtime.

O design fecha os gaps confirmados na 11G e estabelece o contrato de dados que uma 11I podera implementar depois de revisao humana.

## 2. Relacao com 11A a 11G

- 11A definiu discovery e contrato para MCP remoto governado.
- 11B criou flags, readiness e client stub fail-closed.
- 11C criou discovery sanitizado, `specHash`, diff por `externalName` e policy fechada.
- 11D criou snapshot, review package, human review e approval gate.
- 11E criou `catalogDraft`, `policyDraft`, validation, preflight e `planHash`.
- 11F criou apply service com autorizacao explicita, idempotencia logica e repository/transaction boundary.
- 11G implementou esse boundary como adapter fail-closed porque o schema atual nao sustenta identidade, lifecycle e idempotencia remotos com garantias fortes.
- 11H desenha a estrutura que permitira substituir o erro `MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY` por persistencia transacional em fase posterior.

O Orchestra continua sendo o control plane e a fonte da verdade. Persistir um draft remoto nao significa publica-lo ou habilita-lo em runtime.

## 3. Estado atual do schema MCP

| Model atual | O que ja atende | O que nao atende ao import remoto | Alteracao futura recomendada |
| --- | --- | --- | --- |
| `McpServer` | tenant/workspace, tipo, status, trust/risk, auth indireta e soft delete | nao guarda identidade de snapshot/import; a FK simples por `id` nao prova sozinha o mesmo tenant/workspace da nova entry | manter funcionalmente; avaliar chave composta auxiliar para FK de escopo |
| `McpTool` | catalogo operacional, schemas, risk, approval, enablement, metadata e soft delete | nao separa `externalName` de display name; nao tem lifecycle remoto, hashes, provenance ou idempotencia | nao adicionar drafts remotos diretamente na 11I |
| `McpToolPolicy` | quatro guardrails efetivos: runtime fechado, sandbox, approval e bloqueio default | representa policy operacional de uma tool materializada, nao proposta de policy de um draft | manter; criar somente quando houver materializacao futura |
| `AssistantMcpBinding` | vincula assistant/server/tool e controla modo/enablement | qualquer criacao durante import confundiria persistencia com runtime publication | nao alterar na 11I e nunca criar durante import |
| `McpToolCall` | registra precheck/execucao sandbox e snapshots de policy | nao e ledger de import e nao deve receber eventos de catalog apply | nao alterar |
| `McpToolCallEvent` | trilha de eventos de tool call | nao representa lifecycle ou apply de catalogo | nao alterar |
| `AuditLog` | auditoria por tenant/workspace/actor/action/entity com metadata | nao oferece idempotencia transacional nem estado consultavel de apply | manter para auditoria; nao usar como ledger primario |
| `McpResource` | catalogo de resources por server e workspace | nao faz parte das operations 11E/11F atuais | nao alterar nesta sequencia |
| `McpPrompt` | catalogo de prompts por server e workspace | nao faz parte das operations 11E/11F atuais | nao alterar nesta sequencia |

O repository atual cria `McpTool` e `McpToolPolicy` juntos, o service aplica escopo do usuario, e o mapper REST devolve campos internos demais para servir como contrato de import. Esses componentes continuam intactos na 11H.

## 4. Gaps confirmados na 11G

1. Nao existe `externalName` duravel e unico por tenant/workspace/server.
2. Nao existe lifecycle explicito para `draft`, `blocked`, `approved_for_catalog`, `deprecated` e `archived`.
3. `isEnabled`, `deletedAt` e server status nao representam lifecycle de import.
4. Nao existem `specHash` e `catalogHash` persistidos.
5. Nao existe provenance de snapshot, plan, apply, importador ou aprovador.
6. Nao existe ledger com unique key para idempotencia de apply.
7. Nao ha garantia forte contra dois applies concorrentes criarem identidades equivalentes.
8. Usar `McpTool.metadata` como banco paralelo nao oferece constraints, integridade ou contrato estavel.
9. O mapper REST atual pode expor metadata interna e a referencia indireta de credencial do server.
10. `draft`, `deprecated`, `archived`, enablement operacional, runtime publication e assistant binding ainda podem ser confundidos se permanecerem no mesmo model.

## 5. Principios de design

- Fail-closed por default em schema, repository e policy.
- Isolamento tenant/workspace/server em toda lookup, unique key e mutation.
- `externalName` como identidade externa estavel; rename exige operacao governada, nao update casual.
- Lifecycle de catalogo explicito e separado de `isEnabled`, publication e binding.
- `specHash` e `catalogHash` SHA-256 deterministas sobre representacoes canonicas.
- Idempotencia reservada e finalizada dentro de boundary transacional.
- Concorrencia protegida por unique constraints, revision/optimistic locking e retry de serializacao.
- Auditoria sanitizada, mas `AuditLog` nao substitui ledger de negocio.
- Nenhuma credencial bruta, header de autenticacao ou URL com userinfo em entry, ledger ou audit.
- Nenhuma referencia indireta de credencial em DTO publico.
- Mapper publico baseado em allowlist; metadata interna nunca e repassada por reflexo.
- Catalog persistence, catalog approval, materializacao operacional e runtime publication sao gates diferentes.
- O schema nao depende de runtime interno, Agno/AgentOS ou runtime on-premise.

## 6. Opcoes de modelagem avaliadas

### Opcao A - Evoluir `McpTool` diretamente

Adicionar `externalName`, lifecycle, hashes e provenance em `McpTool`, reutilizando `McpToolPolicy`.

**Vantagens**

- Menor numero de tabelas.
- Menos joins para consultar tool operacional e origem remota.
- Adapter 11G poderia gravar diretamente no repository atual.

**Riscos e impacto**

- Drafts apareceriam no mesmo model consumido por CRUD, bindings e sandbox.
- Exige revisar imediatamente todos os repositories, mappers e filtros atuais.
- Aumenta o risco de um draft ser tratado como tool operacional por codigo legado.
- Mistura lifecycle de import com `isEnabled` e soft delete.
- Migration e backfill de tools locais ficam mais complexos.
- Acopla o adapter de import ao runtime catalog antes da publication gate.

**Avaliacao**: complexidade aparente baixa, risco operacional alto. Nao recomendada.

### Opcao B - Criar `McpRemoteCatalogEntry` complementar

Manter `McpTool` atual e criar uma tabela especifica para identidade, draft e provenance remotos, com link opcional futuro para `McpTool`.

**Vantagens**

- Separa draft remoto do catalogo operacional.
- Permite constraints e lifecycle proprios sem backfill de tools locais.
- Nao exige alterar o mapper publico atual para criar a tabela.
- Adapter 11G passa a operar em uma estrutura adequada.

**Riscos e impacto**

- Exige joins e reconciliacao quando houver materializacao.
- Sem um ledger separado, idempotencia e historico de apply ainda ficariam incompletos.
- Uma implementacao apressada poderia tratar a entry como publicada apenas por existir.

**Avaliacao**: boa base, mas insuficiente sozinha para idempotencia e publication boundary.

### Opcao C - Entry remota + apply ledger, com materializacao posterior

Criar `McpRemoteCatalogEntry` para o estado governado do import e `McpRemoteCatalogApplyLedger` para reserva/finalizacao idempotente. `McpTool` continua sendo catalogo operacional e so recebe materializacao em fase posterior, mediante gate explicito.

**Vantagens**

- Isola completamente import, lifecycle, idempotencia e runtime catalog.
- Evita backfill de tools locais na primeira migration.
- Oferece uma fonte consultavel para retries, concorrencia e reconciliacao.
- Permite ao adapter 11G tornar-se real sem tocar bindings ou runtime.
- Prepara qualquer runtime futuro sem codificar dependencia de um deles.

**Riscos e impacto**

- Duas tabelas e uma transacao mais elaborada.
- Exige definir claramente hashes, transitions e materializacao.
- Operation results em JSON precisam de allowlist, versionamento e limite de tamanho.
- Um ledger `started` abandonado precisa de regra de retomada manual; nao deve criar worker nesta fase.

**Avaliacao**: maior clareza de dominio e menor risco de enablement involuntario. Recomendada.

## 7. Decisao recomendada

Recomenda-se a **Opcao C: entry remota + apply ledger, com materializacao posterior**.

### Escopo proposto para 11I

- Criar os models `McpRemoteCatalogEntry` e `McpRemoteCatalogApplyLedger`.
- Criar status/constraints/indices e relacoes de tenant/workspace/server/actor.
- Adicionar chave de escopo auxiliar em `McpServer` somente se necessaria para FK composta.
- Gerar Prisma Client e testes de migration/schema.
- Manter as novas tabelas vazias; nenhum backfill automatico de `McpTool`.
- Nao alterar adapter, route, controller, binding ou runtime.

### Escopo proposto para 11J

- Trocar o adapter fail-closed por repository real sobre as novas tabelas.
- Implementar idempotencia, optimistic locking, transacao serializable e retries limitados.
- Manter materializacao em `McpTool` proibida.

### Escopo posterior

- API/admin interna e review permanecem em 11K/11L.
- Materializacao em `McpTool` e publication gate ficam para 11M ou fase posterior.
- Runtime continua fechado mesmo depois da materializacao, ate fase especifica.

## 8. Proposta de schema futuro

Os nomes abaixo sao design, nao Prisma aplicado. IDs de snapshot/plan/apply sao strings de dominio, nao necessariamente UUID.

### 8.1 `McpRemoteCatalogEntry`

| Campo | Tipo candidato | Regra |
| --- | --- | --- |
| `id` | UUID | primary key |
| `tenantId` | UUID | obrigatorio e imutavel |
| `workspaceId` | UUID | obrigatorio e imutavel |
| `mcpServerId` | UUID | obrigatorio; mesmo escopo da entry |
| `externalName` | varchar(128) | identidade externa exata, trim/NFC, controlada |
| `displayName` | varchar(160) | nome humano alteravel |
| `description` | varchar(1000), nullable | descricao sanitizada |
| `source` | text controlado | inicialmente `remote_discovery` |
| `lifecycleStatus` | text controlado | default `draft` |
| `riskLevel` | text controlado | low/medium/high/critical |
| `requiresApproval` | boolean | default true |
| `specHash` | char(64) | hash SHA-256 da spec remota canonica |
| `catalogHash` | char(64) | hash SHA-256 do catalogo/policy normalizados |
| `inputSchema` | JSONB, nullable | schema sanitizado e limitado |
| `outputSchema` | JSONB, nullable | schema sanitizado e limitado |
| `allowRuntimeExecution` | boolean | default false; CHECK false |
| `sandboxOnly` | boolean | default true; CHECK true |
| `blockedByDefault` | boolean | default true; CHECK true |
| `approvalMode` | text controlado | default `manual`; CHECK manual |
| `runtimeEnabled` | boolean | default false; CHECK false |
| `remoteExecutionEnabled` | boolean | default false; CHECK false |
| `snapshotId` | varchar(160) | snapshot de origem |
| `snapshotHash` | char(64) | hash do snapshot de origem |
| `lastPlanId` / `lastPlanHash` | string / char(64) | ultimo plano aplicado a entry |
| `lastApplyId` / `lastApplyHash` | string / char(64) | ultimo apply confirmado |
| `revision` | integer | default 1; optimistic locking |
| `importedByUserId` / `importedAt` | UUID / timestamp | provenance do primeiro import |
| `approvedByUserId` / `approvedAt` | UUID / timestamp, nullable | catalog approval, nao runtime approval |
| `deprecatedByUserId` / `deprecatedAt` | UUID / timestamp, nullable | soft lifecycle transition |
| `deprecationReasonHash` | char(64), nullable | hash, sem motivo bruto sensivel |
| `materializedMcpToolId` | UUID, nullable | link futuro; null na 11I/11J |
| `internalMetadata` | JSONB, nullable | allowlist versionada; nunca publica |
| `createdAt` / `updatedAt` | timestamp | timestamps tecnicos |
| `deletedAt` | timestamp, nullable | retencao/expurgo; nao define lifecycle |

O design nao recomenda persistir `catalogDraft` bruto. Seus campos normalizados vao para colunas e schemas dedicados; `catalogHash` comprova integridade. A policy draft fechada tambem vira colunas explicitas com CHECKs, evitando JSON permissivo.

### 8.2 `McpRemoteCatalogApplyLedger`

| Campo | Tipo candidato | Regra |
| --- | --- | --- |
| `id` | UUID | primary key interna |
| `tenantId` / `workspaceId` / `mcpServerId` | UUID | escopo obrigatorio |
| `planId` / `planHash` | string / char(64) | plano governado |
| `snapshotHash` | char(64) | snapshot aprovado |
| `applyId` / `applyHash` | string / char(64) | identidade e integridade do resultado |
| `idempotencyKey` | char(64) | unique dentro do escopo |
| `approvedByUserId` | UUID | actor humano |
| `approvalReasonHash` | char(64) | nao persistir motivo bruto |
| `status` | text controlado | `started`, `applied`, `partially_applied`, `failed`, `blocked`, `no_changes` |
| `summary` | JSONB | allowlist de contadores |
| `operationResults` | JSONB | resultados sanitizados, versionados e limitados |
| `schemaVersion` | integer | versao do payload JSON |
| `createdAt` / `completedAt` | timestamp | reserva e finalizacao |

O ledger e fonte de idempotencia e reconciliacao; `AuditLog` continua sendo trilha de auditoria. Payloads JSON nao podem conter drafts, schemas brutos, auth, URLs ou referencias de credencial.

### 8.3 Hashes canonicos

- `specHash`: hash da spec descoberta normalizada (`externalName`, description, input/output schema e atributos de risco derivados definidos pelo contrato 11C).
- `catalogHash`: hash da representacao normalizada persistida, incluindo identidade, campos de catalogo e policy fechada.
- Excluir timestamps, IDs de banco, actor IDs e metadata operacional dos hashes.
- Canonicalizar chaves JSON em ordem lexicografica, omitir `undefined`, preservar arrays e usar UTF-8.
- Validar formato hexadecimal de 64 caracteres no app e, se aprovado, por CHECK de banco.

## 9. Enums e status sugeridos

Para manter alinhamento com o schema atual, a primeira opcao e `String` com constantes TypeScript e CHECKs PostgreSQL. Prisma enum pode ser adotado se a equipe aceitar o custo de evolucao/rollback de enum nativo.

Lifecycle de entry:

- `draft`: import persistido, ainda nao aprovado para catalogo operacional.
- `blocked`: review/policy impede progresso.
- `approved_for_catalog`: aprovado para futura materializacao, ainda sem runtime.
- `active`: materializado no catalogo operacional; nao significa runtime enabled.
- `deprecated`: removido/revogado na origem ou por decisao humana; nunca hard delete automatico.
- `archived`: retido apenas para historico; identidade nao pode ser reutilizada silenciosamente.

Transicoes permitidas devem ser allowlist de dominio, por exemplo:

- `draft -> blocked | approved_for_catalog | archived`;
- `blocked -> draft | archived` apos nova review;
- `approved_for_catalog -> active | blocked | archived`;
- `active -> deprecated | archived`;
- `deprecated -> draft | archived` somente por nova discovery + approval;
- `archived` e terminal, salvo procedimento administrativo futuro explicito.

Separacoes obrigatorias:

- lifecycle pertence a `McpRemoteCatalogEntry`;
- enablement operacional pertence a `McpTool.isEnabled` depois da materializacao;
- runtime permission pertence a `McpToolPolicy.allowRuntimeExecution`;
- association pertence a `AssistantMcpBinding`;
- nenhuma dessas dimensoes deriva automaticamente de outra.

## 10. Constraints e indices

### Identidade e escopo

- UNIQUE `(tenant_id, workspace_id, server_id, external_name)` por toda a vida da entry.
- Nao usar `deletedAt` em partial unique: a identidade externa nao deve ser reutilizada apos archive.
- FK para tenant, workspace e server.
- Recomenda-se FK composta `(server_id, tenant_id, workspace_id)` para `McpServer(id, tenant_id, workspace_id)`, com unique auxiliar no server, se validada pela 11I.
- Toda query do adapter deve repetir tenant/workspace/server, mesmo com FK.

### Idempotencia e concorrencia

- UNIQUE `(tenant_id, workspace_id, server_id, idempotency_key)` no ledger.
- UNIQUE `(tenant_id, workspace_id, server_id, apply_id)`.
- Index de lookup por `(tenant_id, workspace_id, server_id, lifecycle_status)`.
- Index por `snapshot_hash`, `plan_hash`, `apply_hash` e timestamps do ledger.
- Index por `spec_hash` e `catalog_hash` para reconciliacao, sem assumir unicidade global.
- UNIQUE nullable em `materialized_mcp_tool_id` quando o campo passar a ser usado.
- CHECK `revision > 0`.
- CHECKs dos seis guardrails da policy proposta em valores fechados.

### Estrategia transacional

1. Inserir/reservar ledger pela idempotency key.
2. Em conflito, retornar resultado final existente ou estado `started` para reconciliacao manual.
3. Executar lookup sempre com escopo completo.
4. Atualizar entry com `WHERE id = ? AND revision = ?`, incrementando revision.
5. Usar isolation `Serializable` e retry limitado para conflitos serializaveis.
6. Finalizar ledger e criar audit event sanitizado.
7. Nao criar worker para ledger abandonado nesta sequencia; usar diagnostico/admin futuro.
## 11. Estrategia de backfill

A 11I deve criar tabelas novas vazias. Nao ha backfill obrigatorio.

- `McpTool` existente permanece catalogo local/operacional, sem inferir origem remota.
- Nao criar entries remote a partir de tools antigas apenas pelo server type.
- Nao marcar tools antigas como `local_existing` automaticamente se esse source nao tiver contrato aprovado.
- Uma fase futura pode oferecer import administrativo explicito para registrar provenance de item legado.
- O link `materializedMcpToolId` inicia null.
- A migration de 11I pode ser revertida removendo apenas estruturas novas enquanto nao houver dados de producao.
- Depois que entries existirem, rollback exige export/reconciliacao e nao deve simplesmente derrubar tabelas.

## 12. Mapper REST e contrato publico

Antes de qualquer API de import:

- revisar `mcp.mapper.ts` e remover a referencia indireta de credencial dos DTOs publicos;
- substituir repasse de `metadata` por DTO allowlist;
- nunca retornar `internalMetadata`, schemas de auditoria, `operationResults`, `catalogDraft` ou policy draft bruta;
- expor apenas status e campos necessarios ao papel/permission do caller;
- separar DTO administrativo interno de DTO publico atual;
- separar routes internas de import/review das routes operacionais MCP;
- aplicar redaction tambem em logs e erros.

A 11I nao cria routes; portanto as novas tabelas nao terao superficie HTTP. O hardening do mapper atual deve ser tratado antes de 11K e e criterio de revisao para autorizar qualquer endpoint de import.

## 13. Adapter real futuro

Na 11J, `McpRemoteCatalogImportApplyPersistenceRepository` podera manter a mesma interface e trocar o comportamento:

- `findByExternalName`: lookup scoped na entry, incluindo lifecycle relevante.
- `createToolDraft`: insert de entry `draft` com policy fechada e ledger reservado.
- `updateToolDraft`: update por identity + revision, preservando policy fechada.
- `deprecateToolDraft`: transition para `deprecated`, timestamps/actor e motivo hash; sem delete fisico.
- `recordAuditEvent`: continuar usando audit writer sanitizado existente.
- `findApplyByIdempotencyKey`: consultar ledger scoped e reconstruir resultado sanitizado.
- `saveApplyResult`: finalizar ledger na mesma unidade transacional do apply quando possivel.
- `withTransaction`: Prisma interactive transaction com isolation serializable e retry limitado.

O repository deve validar que server existe no mesmo tenant/workspace, que `externalName` nao mudou e que hashes correspondem ao payload canonico. Conflitos de revision devem retornar erro controlado, nunca last-write-wins silencioso.

## 14. Seguranca e secrets

- Entry e ledger nao possuem campo de credencial.
- Auth do server continua separado e indireto.
- Referencias indiretas de credencial nunca entram em DTO publico, hash, ledger, operation result ou audit metadata.
- Rejeitar URL com userinfo antes de discovery/import; nao copiar URL do server para entry.
- Nao persistir header de autenticacao, cookie, API key, token, password ou credential payload.
- Schemas JSON passam por sanitizacao de chaves, profundidade, serializacao e limite de bytes.
- `summary`, `operationResults` e `internalMetadata` usam allowlist e `schemaVersion`.
- Logs registram IDs/hashes/status, nao drafts ou payloads brutos.
- `approvalReasonHash` permite correlacao sem armazenar justificativa potencialmente sensivel; texto completo fica fora do ledger.

## 15. Runtime permanece bloqueado

A migration futura de persistencia:

- nao cria `AssistantMcpBinding`;
- nao cria `McpTool` automaticamente;
- nao altera `McpTool.isEnabled`;
- nao cria policy operacional permissiva;
- nao publica entry em runtime;
- nao executa tool;
- nao chama servidor MCP remoto;
- nao adiciona adapter Agno/AgentOS.

Mesmo `approved_for_catalog` e `active` nao autorizam runtime. Runtime exige materializacao, binding, policy e approval proprios em fases separadas.

## 16. Plano de testes da migration futura

- `prisma validate`, `prisma generate`, typecheck, lint, build e suite completa.
- Migration em banco vazio e banco com catalogo MCP existente.
- Rollback/downgrade ensaiado antes de dados de producao.
- Unique de external identity no mesmo escopo e permissao de mesmo nome em escopos distintos.
- FK/lookup impedindo cruzamento de tenant, workspace ou server.
- Idempotency key repetida retorna o mesmo resultado, sem segunda mutation.
- Dois applies concorrentes resultam em um vencedor e retry/erro controlado.
- Optimistic locking por revision impede lost update.
- Create/update/deprecate respeitam transition matrix e nunca hard delete.
- Hashes sao deterministas e mudam somente com campos canonicos.
- Guardrail CHECK impede policy aberta.
- JSON limits e sanitizacao rejeitam chaves/payloads sensiveis.
- Mapper/DTO nao expoe metadata interna, auth indireta ou drafts brutos.
- Audit event e ledger ficam sanitizados.
- Nenhum binding, runtime enablement, tool call ou chamada externa ocorre.

## 17. Plano incremental sugerido

- **11H**: design e criterios; nenhuma alteracao de schema.
- **11I**: migration/schema + Prisma types e testes estruturais; tabelas vazias.
- **11J**: repository real, idempotencia e transacao controlada; sem materializacao.
- **11K**: API administrativa interna governada, sem endpoint publico de runtime.
- **11L**: UI/admin de review/import com RBAC existente revisado.
- **11M**: materializacao/publication boundary separada e ainda fail-closed para runtime.
- **Agno/AgentOS**: fase propria posterior, consumindo contrato governado do Orchestra.

## 18. Riscos

- Modelar entry como runtime catalog por conveniencia e reintroduzir acoplamento.
- Migration sem composite scope permitir referencia inconsistente entre server e workspace.
- JSON interno virar banco paralelo ou escapar pelo mapper.
- Unique inadequada permitir duplicidade em concorrencia.
- Ledger `started` ficar pendente sem diagnostico de reconciliacao.
- Enum nativo dificultar rollback/evolucao de status.
- Hash canonico mudar entre versoes sem `schemaVersion`.
- Backfill inferir origem remota incorretamente.
- Materializacao futura habilitar tool/binding por default.
- Acoplamento precoce com Agno/AgentOS reduzir portabilidade on-premise.

## 19. Rollback

O rollback da 11H e remover este documento e a entrada correspondente do README. Nenhum dado, schema, migration, seed ou codigo foi alterado.

Para a futura 11I, o rollback seguro inicial e remover apenas tabelas/indices/constraints novos enquanto elas estiverem vazias. Depois de uso real, rollback exige export, reconciliacao e plano operacional aprovado.

## 20. Criterios para autorizar 11I

- Opcao C revisada e aprovada por backend, seguranca e dados.
- Campos, tamanhos, status, transition matrix e hashes canonicos aprovados.
- Estrategia de FK composta/isolamento validada com Prisma/PostgreSQL.
- Unique keys e indices de idempotencia/concorrencia aprovados.
- Decisao entre text + CHECK e Prisma enum registrada.
- Plano sem backfill automatico aceito.
- Mapper publico revisado e plano de hardening aceito.
- Limites e allowlists dos JSON internos definidos.
- Testes de concorrencia, rollback e tenant isolation especificados.
- Confirmacao de que 11I nao cria adapter real, endpoint, binding ou runtime enablement.
- Migration revisada manualmente antes de apply em qualquer ambiente.
