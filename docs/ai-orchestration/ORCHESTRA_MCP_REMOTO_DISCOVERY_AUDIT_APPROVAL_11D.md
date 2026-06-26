# Orchestra MCP Remoto Discovery Audit Approval 11D

Status: implementado como base backend estrutural, sem import automatico de tools e sem execucao remota.

## 1. Objetivo

A Fase 11D transforma o resultado sanitizado do discovery MCP remoto em um pacote governado de revisao. O pacote contem snapshot/hash deterministico, resumo de risco, diff, proposed actions, approval gate e audit event sanitizado.

O objetivo e criar uma etapa explicita entre descobrir tools remotas e qualquer futura importacao no catalogo operacional. Nenhuma capability remota e publicada ao runtime nesta fase.

## 2. Relacao Com 11A/11B/11C

A 11A documentou o contrato esperado para MCP remoto real governado.

A 11B criou flags, readiness e client stub fail-closed.

A 11C criou discovery governado com transporte injetavel, sanitizacao, `specHash`, diff e default policy bloqueada.

A 11D consome o output da 11C e cria um review package auditavel antes de qualquer acao de catalogo.

## 3. O Que Foi Implementado

Foram adicionados:

- types de approval, proposed action, human review, apply plan, audit event e review package em `mcp-remote.types.ts`;
- `mcp-remote-discovery-approval.service.ts`;
- export no index da subcamada remota;
- testes unitarios em `backend/tests/unit/mcp-remote-discovery-approval.test.ts`.

O service principal e `McpRemoteDiscoveryApprovalService`, com `createReviewPackage`.

## 4. O Que Continua Fora De Escopo

Nao foi implementado:

- import automatico de tools descobertas;
- habilitacao automatica de policy de execucao;
- envio de capabilities remotas ao runtime;
- execucao real de tools MCP;
- transporte remoto real novo;
- worker, fila ou scheduler;
- persistencia duravel do snapshot;
- alteracao de frontend;
- alteracao de Auth/SSO;
- alteracao de RBAC;
- alteracao de RAG ou embeddings;
- alteracao de runtime/AgentRun;
- integracao Agno/AgentOS;
- Prisma schema ou migration.

## 5. Fluxo Review Package

O fluxo:

1. recebe `McpRemoteDiscoveryOutput` da 11C;
2. recebe contexto de tenant, workspace, usuario e requestId;
3. calcula summary, risk summary e diff;
4. gera proposed actions para add/update/remove/keep/block;
5. avalia o approval gate;
6. cria human review requirement;
7. cria apply plan bloqueado;
8. calcula snapshot hash deterministico;
9. gera audit event sanitizado.

## 6. Snapshot/Hash

O `snapshotHash` e SHA-256 de um payload deterministico com:

- serverId;
- tenant/workspace;
- usuario/requestId;
- discoveredAt;
- discoverySpecHash;
- summary;
- risk summary;
- diff;
- proposed actions;
- decision;
- sanitized metadata.

O `snapshotId` e derivado do hash: `mcp_remote_discovery_<hash-prefix>`.

## 7. Audit Event Sanitizado

O audit event usa o tipo:

```text
mcp.remote.discovery.review_package_created
```

Ele contem tenant, workspace, serverId, requestId, counts, diff, risk summary, decision e snapshotHash. Ele nao inclui payload bruto de schemas, warnings, credenciais, referencias internas ou URLs.

## 8. Approval Gate

Decisoes possiveis:

- `blocked`;
- `pending_human_review`;
- `approved_for_future_import`;
- `rejected`;
- `no_changes`.

Regras implementadas:

- discovery `blocked` ou `failed` retorna `blocked`;
- sem mudancas retorna `no_changes`;
- tools `high` ou `critical` exigem review humano;
- tools `changed` ou `removed` exigem review humano;
- warnings exigem review humano;
- adicionadas `low` ou `medium` ficam em `pending_human_review` por default;
- `approved_for_future_import` so ocorre quando a policy permite explicitamente auto-review low/medium e `blockedByDefault=false`.

Mesmo com `approved_for_future_import`, nada e aplicado no catalogo nesta fase.

## 9. Proposed Actions

Actions possiveis:

- `propose_add`;
- `propose_update`;
- `propose_remove`;
- `keep_existing`;
- `blocked`.

Toda action retorna `canApplyAutomatically=false`. Quando ha tool descoberta, a default policy continua:

```ts
{
  allowRuntimeExecution: false,
  sandboxOnly: true,
  blockedByDefault: true,
}
```

## 10. Seguranca/Secrets

Controles:

- audit event nao inclui `baseUrl`, `secretRef`, token, password, api key ou credential;
- metadata e sanitizada por chave e valor;
- warnings entram como contagem/codigos sanitizados, nao como payload operacional;
- nenhuma chamada de rede e feita;
- nenhum logger foi adicionado;
- nenhum secret real foi adicionado.

## 11. Por Que Ainda Nao Importa Tools Para Catalogo

Discovery remoto pode revelar capacidades novas, alteradas ou removidas. A 11D apenas cria o pacote de decisao para revisao humana ou futura automacao governada. Importar no catalogo exige persistencia, autorizacao e reconciliacao operacional, previstos para fase posterior.

## 12. Por Que Ainda Nao Executa Tools Remotas

Execucao remota exige credenciais resolvidas em runtime autorizado, limites, auditoria operacional, approvals por chamada e isolamento. A 11D nao abre esse caminho; ela apenas prepara a etapa de governanca antes de catalogo/runtime.

## 13. Testes

`backend/tests/unit/mcp-remote-discovery-approval.test.ts` cobre:

- discovery `blocked`;
- discovery `failed`;
- sem mudancas;
- adicionadas low/medium;
- policy explicita para future import;
- high/critical exigindo review;
- changed/removed exigindo review;
- proposed actions;
- hash deterministico;
- audit event sem payload sensivel;
- `canApplyAutomatically=false`;
- ausencia de rede e execucao de tool.

## 14. Rollback

Rollback da 11D:

1. Remover `mcp-remote-discovery-approval.service.ts`.
2. Remover os types 11D de `mcp-remote.types.ts`.
3. Remover export no `index.ts`.
4. Remover `backend/tests/unit/mcp-remote-discovery-approval.test.ts`.
5. Remover este documento e sua entrada no README.

Nao ha migration, dado persistido ou alteracao funcional de runtime para reverter.

## 15. Proximo Passo 11E

Recomendacao para 11E:

- criar plano de import controlado para catalogo operacional;
- persistir snapshots/review packages se necessario;
- exigir permissao/approval antes de aplicar add/update/remove;
- manter runtime execution bloqueado ate fase especifica.

## 16. Preparacao Para Agno/AgentOS Futuro

A 11D preserva o Orchestra como control plane. Agno/AgentOS podera consumir apenas catalogo e specs governadas no futuro, depois que discovery, review e import forem aprovados. Nenhum adapter Agno foi criado nesta fase.
