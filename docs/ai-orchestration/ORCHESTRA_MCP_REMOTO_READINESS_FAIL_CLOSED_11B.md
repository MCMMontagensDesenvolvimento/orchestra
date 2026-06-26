# Orchestra MCP Remoto Readiness Fail-Closed 11B

Status: implementado como base backend estrutural, sem chamada externa real.

## 1. Objetivo

A Fase 11B cria a base tecnica backend para MCP remoto real governado em modo fail-closed. O objetivo e preparar contratos, configuracao, client stub e readiness estrutural antes de qualquer discovery ou execucao remota real.

O Orchestra continua sendo o control plane e fonte da verdade para tenant, workspace, catalogo, policies, bindings, readiness, auditoria e limites. Runtimes futuros, incluindo Agno/AgentOS ou runtime on-premise, devem consumir apenas especificacoes governadas.

## 2. O Que Foi Implementado

Foram adicionados arquivos backend-only em `backend/src/modules/mcp/remote`:

- `mcp-remote.types.ts`: contratos para readiness, checks, server governado, discovery, execution spec/result, policy decision e limites.
- `mcp-remote.config.ts`: leitura das flags MCP remoto a partir de `env`.
- `mcp-remote.client.ts`: client stub que nao faz transporte real e falha com erros controlados.
- `mcp-remote-readiness.service.ts`: service estrutural de readiness fail-closed.
- `index.ts`: export da subcamada remota.

Tambem foram adicionadas flags default fail-closed em:

- `backend/src/config/env.ts`
- `backend/.env.example`

Testes unitarios sem internet foram adicionados em:

- `backend/tests/unit/mcp-remote-readiness.test.ts`

## 3. O Que Continua Fora De Escopo

Nao foi implementado:

- chamada HTTP, SSE, stdio, WebSocket ou outro transporte MCP remoto;
- discovery real;
- execucao real de tool MCP;
- worker, fila ou scheduler;
- resolucao real de secrets;
- alteracao de frontend;
- alteracao de Auth/SSO;
- alteracao de RBAC;
- alteracao de RAG ou embeddings;
- alteracao de runtime/AgentRun;
- integracao Agno/AgentOS;
- Prisma schema ou migration.

## 4. Feature Flags

Flags backend-only adicionadas:

```env
MCP_REMOTE_ENABLED=false
MCP_REMOTE_EXECUTION_ENABLED=false
MCP_REMOTE_DISCOVERY_ENABLED=false
MCP_REMOTE_DEFAULT_TIMEOUT_MS=5000
```

Defaults:

- MCP remoto desabilitado.
- Discovery remoto desabilitado.
- Execucao remota desabilitada.
- Readiness retorna `failClosed=true` salvo quando todos os gates estruturais forem explicitamente passados em teste/config controlada.

## 5. Contratos / Types Criados

Contratos principais:

- `McpRemoteFeatureConfig`
- `McpRemoteOperationalLimits`
- `GovernedMcpRemoteServer`
- `GovernedMcpRemotePolicy`
- `GovernedMcpPolicyDecision`
- `McpRemoteReadiness`
- `McpRemoteReadinessCheck`
- `McpToolDiscoveryRequest`
- `McpToolDiscoveryResult`
- `GovernedMcpToolExecutionSpec`
- `GovernedMcpToolExecutionResult`
- `McpRemoteClientOptions`

Status de readiness:

- `disabled`
- `ready`
- `misconfigured`
- `blocked`
- `auth_required`
- `execution_disabled`
- `discovery_disabled`

Checks de readiness:

- `feature_flag`
- `server_status`
- `transport`
- `auth`
- `policy`
- `discovery`
- `execution`

## 6. Readiness Fail-Closed

`McpRemoteReadinessService` avalia gates locais e nao chama rede.

Ordem dos bloqueios:

1. `MCP_REMOTE_ENABLED=false` retorna `disabled`.
2. Server ausente retorna `misconfigured`.
3. Server disabled/archived/deleted retorna `blocked`.
4. Server sem `baseUrl` quando exigido retorna `misconfigured`.
5. Auth que exige credencial sem `credentialsConfigured` retorna `auth_required`.
6. `MCP_REMOTE_EXECUTION_ENABLED=false` retorna `execution_disabled`.
7. `MCP_REMOTE_DISCOVERY_ENABLED=false` retorna `discovery_disabled`.
8. Policy sem `allowRuntimeExecution=true`, com `sandboxOnly=true` ou `blockedByDefault=true` retorna `execution_disabled`.

Somente com todos os gates aprovados a readiness estrutural retorna `ready` e `failClosed=false`. Mesmo nesse caso, nenhuma chamada remota e feita na 11B.

## 7. Client Stub

`McpRemoteClient` expoe:

- `checkHealth`
- `discoverTools`
- `executeTool`

Comportamento:

- se MCP remoto esta desabilitado, retorna erro `MCP_REMOTE_DISABLED`;
- se discovery esta desabilitado, retorna erro `MCP_REMOTE_DISCOVERY_DISABLED`;
- se execution esta desabilitado, retorna erro `MCP_REMOTE_EXECUTION_DISABLED`;
- quando as flags estao habilitadas, retorna `MCP_REMOTE_NOT_IMPLEMENTED`;
- nao usa `fetch`, `axios`, `http`, `https`, WebSocket ou outro transporte;
- nao aceita chaves de options com formato de credential bruto.

## 8. Seguranca / Secrets

Controles aplicados:

- Config default fail-closed.
- Client options aceitam apenas status de credential, nunca valor bruto.
- Readiness retorna `credentialsConfigured`, `authType`, `reason` e checks.
- Readiness nao retorna `secretRef` bruto.
- Nenhum secret real foi adicionado.
- Nenhum logger foi adicionado.
- Nenhum payload remoto e enviado ou persistido.

Gap ja conhecido da 11A:

- O contrato publico atual do catalogo MCP ainda possui `secretRef`. Antes de execucao remota real, a API publica deve evoluir para campos sanitizados como `credentialsConfigured` e `credentialStatus`, sem revelar referencia interna sensivel.

## 9. Relacao Com Runtime Atual

Esta fase nao altera `RuntimeExecutionContext`, `LocalDeterministicRuntimeAdapter`, `AgnoRuntimeAdapter` ou `AgentRun`.

O runtime atual continua recebendo apenas resumo MCP sandbox governado:

- tools sandbox permitidas;
- tools bloqueadas;
- tools que exigem approval;
- ultimos tool call ids.

Nao ha tool calling remoto autonomo. A subcamada `mcp/remote` fica pronta para ser consumida em subfases futuras, preservando o desacoplamento entre control plane e runtime.

## 10. Preparacao Para Agno / AgentOS Futuro

Agno/AgentOS continua fora do escopo desta fase.

A preparacao feita e conceitual e contratual:

- contracts de execution spec/result sao independentes do runtime atual;
- readiness e policies continuam no Orchestra;
- client stub falha fechado ate haver adapter autorizado;
- futura integracao Agno deve consumir specs governadas, nao descobrir ou executar tools fora do catalogo oficial;
- secrets continuam backend-only ou em runtime on-premise autorizado.

## 11. Testes

`backend/tests/unit/mcp-remote-readiness.test.ts` cobre:

- defaults fail-closed;
- readiness disabled por default;
- execution disabled por default;
- server sem `baseUrl` como `misconfigured`;
- server archived como `blocked`;
- auth credentialed sem credential configurada como `auth_required`;
- discovery disabled;
- policy blocked by default;
- readiness estrutural ready apenas quando todos os gates passam;
- client stub sem chamada de rede;
- erros controlados do client;
- rejeicao de option com formato de credential bruto;
- readiness sem `secretRef` bruto.

## 12. Rollback

Rollback da 11B:

1. Remover `backend/src/modules/mcp/remote`.
2. Remover exports em `backend/src/modules/mcp/index.ts`.
3. Remover flags `MCP_REMOTE_*` de `backend/src/config/env.ts` e `backend/.env.example`.
4. Remover `backend/tests/unit/mcp-remote-readiness.test.ts`.
5. Remover este documento e sua entrada no README.

Nao ha migration, dados persistidos ou mudanca funcional de API para reverter.

## 13. Proximo Passo 11C

Recomendacao para 11C:

- manter flags default desabilitadas;
- implementar discovery remoto governado atras de feature flag;
- adicionar health/handshake com timeout e client injetavel;
- resolver credentials por provider backend-only;
- persistir ou registrar snapshot/spec hash apenas se necessario;
- gerar diff de tools e exigir aprovacao antes de habilitar novas capabilities;
- auditar readiness/discovery sem expor secrets;
- continuar sem execucao remota real ate a subfase seguinte.
