# Orchestra MCP Remoto Discovery Governado 11C

Status: implementado como base backend estrutural, atras de flags, sem execucao real de tools MCP.

## 1. Objetivo

A Fase 11C adiciona o fluxo backend-only de discovery remoto governado para MCP remoto. O objetivo e permitir que o Orchestra descubra descritores de tools de um servidor MCP remoto por meio de transporte injetavel, sanitize o resultado, calcule hash/diff e mantenha toda tool descoberta bloqueada por default.

O Orchestra continua sendo o control plane e fonte da verdade para tenant, workspace, catalogo, policies, readiness, auditoria e limites. A descoberta nao habilita capacidades no runtime.

## 2. O Que Foi Implementado

Foram adicionados:

- `mcp-remote-transport.ts`: contrato `McpRemoteDiscoveryTransport` e transporte default fail-closed.
- `mcp-remote-discovery.service.ts`: service `McpRemoteDiscoveryService` com `runGovernedDiscovery` e `discoverRemoteTools`.
- Types de discovery governado em `mcp-remote.types.ts`.
- Modo de readiness `purpose: 'discovery'`, preservando o comportamento padrao de readiness de execucao da 11B.
- Testes unitarios sem internet em `backend/tests/unit/mcp-remote-discovery.test.ts`.

## 3. O Que Continua Fora De Escopo

Nao foi implementado:

- execucao real de tools MCP;
- chamada HTTP/SSE/WebSocket/stdio real por default;
- worker, fila ou scheduler;
- persistencia automatica de tools descobertas como habilitadas;
- alteracao de frontend;
- alteracao de Auth/SSO;
- alteracao de RBAC;
- alteracao de RAG ou embeddings;
- alteracao de runtime/AgentRun;
- integracao Agno/AgentOS;
- Prisma schema ou migration.

## 4. Relacao Com 11A/11B

A 11A definiu o discovery tecnico e o contrato governado esperado para MCP remoto real.

A 11B criou a base fail-closed: types, flags, client stub e readiness estrutural.

A 11C usa essa base para introduzir discovery controlado, ainda sem transporte real por default e sem tool execution.

## 5. Fluxo De Discovery Governado

O fluxo em `McpRemoteDiscoveryService`:

1. recebe tenant, workspace, servidor governado, policy, status de credencial configurada, usuario e requestId;
2. roda readiness com `purpose: 'discovery'`;
3. bloqueia antes do transporte se qualquer gate local falhar;
4. chama apenas o transporte injetado quando readiness esta `ready`;
5. sanitiza tools retornadas;
6. calcula `specHash` por tool e hash global do snapshot;
7. calcula diff contra tools existentes por `externalName`;
8. retorna resultado normalizado sem habilitar tool no runtime.

## 6. Feature Flags Envolvidas

Flags usadas:

```env
MCP_REMOTE_ENABLED=false
MCP_REMOTE_DISCOVERY_ENABLED=false
MCP_REMOTE_EXECUTION_ENABLED=false
MCP_REMOTE_DEFAULT_TIMEOUT_MS=5000
```

Para discovery, `MCP_REMOTE_ENABLED=true` e `MCP_REMOTE_DISCOVERY_ENABLED=true` sao obrigatorios.

`MCP_REMOTE_EXECUTION_ENABLED=false` nao bloqueia discovery governado. O resultado continua marcando `executionBlocked=true` e toda tool descoberta recebe policy default bloqueada.

## 7. Readiness Antes Do Discovery

Discovery so prossegue quando:

- MCP remoto esta habilitado;
- discovery remoto esta habilitado;
- servidor esta ativo;
- `baseUrl` esta presente;
- credenciais backend estao configuradas quando o tipo de auth exige;
- policy nao bloqueia explicitamente discovery controlado.

O modo padrao da readiness continua sendo o da 11B, voltado para execucao. O modo `purpose: 'discovery'` existe para permitir descoberta sem abrir execucao de runtime.

## 8. Transport Injetavel

`McpRemoteDiscoveryTransport` define somente:

```ts
discoverTools(input): Promise<{ protocolVersion?: string; tools: Tool[]; warnings?: Warning[] }>
```

A implementacao default `FailClosedMcpRemoteDiscoveryTransport` retorna erro controlado e nao faz rede. Testes usam transporte mockado.

## 9. Sanitizacao E Seguranca

O service:

- remove campos sensiveis em schemas e metadata;
- rejeita tool sem `externalName` valido;
- limita tamanho de nomes, descriptions, protocolVersion e schemas;
- limita profundidade e tamanho de arrays em schemas;
- omite branches nao serializaveis;
- normaliza warnings de transporte;
- nao retorna referencia interna de credencial;
- nao persiste payload remoto;
- nao registra payload sensivel.

## 10. Default Policy Das Tools Descobertas

Toda tool descoberta retorna:

```ts
defaultPolicy: {
  allowRuntimeExecution: false,
  sandboxOnly: true,
  blockedByDefault: true,
}
```

Riscos `medium`, `high` e `critical` retornam `requiresApproval=true`. Na duvida, o risco minimo inferido e `medium`.

## 11. Risco Inferido

Heuristicas:

- `critical`: padroes destrutivos, financeiros, administrativos ou relacionados a credenciais;
- `high`: padroes de escrita, criacao, envio ou aprovacao;
- `medium`: leitura/busca/listagem com acesso amplo ou schema generico;
- `low`: consultas informativas simples e estritamente read-only.

## 12. Diff De Tools

O diff compara por `externalName`:

- `added`: descoberta que nao existia;
- `removed`: existente que nao voltou no discovery;
- `changed`: mesmo `externalName` com `specHash` diferente.

O hash e calculado com serializacao deterministica do payload sanitizado.

## 13. Testes

`backend/tests/unit/mcp-remote-discovery.test.ts` cobre:

- bloqueio quando MCP remoto esta disabled;
- bloqueio quando discovery esta disabled;
- bloqueio quando readiness nao esta `ready`;
- discovery mockado com normalizacao de resultado;
- ausencia de material sensivel no output;
- policy default bloqueada;
- diff de adicionadas/alteradas/removidas;
- timeout propagado ao transporte;
- nenhuma execucao de tool e nenhuma chamada de rede em teste.

## 14. Rollback

Rollback da 11C:

1. Remover `mcp-remote-discovery.service.ts`.
2. Remover `mcp-remote-transport.ts`.
3. Remover os types de discovery 11C e `purpose` de readiness, se ainda nao consumidos por outra fase.
4. Remover `backend/tests/unit/mcp-remote-discovery.test.ts`.
5. Remover este documento e a entrada no README.

Nao ha migration, dados persistidos ou alteracao funcional de runtime para reverter.

## 15. Proximo Passo 11D

Recomendacao para 11D:

- definir handshake real por transporte autorizado;
- resolver credenciais apenas em backend/provider governado;
- adicionar auditoria de snapshots de discovery, se necessario;
- exigir aprovacao humana antes de habilitar qualquer tool remota;
- manter execucao remota real em fase separada.

## 16. Preparacao Para Agno/AgentOS Futuro

A 11C prepara contratos independentes de runtime. Agno/AgentOS podera consumir discovery governado no futuro, mas nao foi implementado nesta fase.

O ponto de integracao futuro deve continuar partindo do Orchestra como control plane: policy, readiness, diff, aprovacao e limites ficam no Orchestra antes de qualquer runtime receber capabilities.
