# Orchestra MCP/Tools Governados no Agno Runtime 14F

## 1. Resumo

A Fase 14F permite que o backend do Orquestra envie ao provider `agno_http` somente descriptors de tools MCP ja autorizados e resumidos pelo control plane. O contrato existente usa `tools.mode=gateway` para essa fronteira governada.

Os defaults permanecem seguros: `RUNTIME_PROVIDER=local`, `AGNO_RUNTIME_HTTP_ENABLED=false`, `AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false` e `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0`.

## 2. Implementado

- Flags backend-only para habilitar descriptors e definir limites.
- Extensao do `buildAssistantRuntimeSpecV1` para transformar contexto MCP autorizado em `tools.descriptors`.
- Allowlist estrita, limites de quantidade, description e `inputSchema`.
- Metadata minima sanitizada e validacao final pelo schema 14A.
- Eventos seguros com contadores, IDs e hashes de schemas.
- Runtime HTTP minimo capaz de aceitar descriptors sem executar MCP externo.
- Testes do contrato, builder, adapter, runtime minimo e endpoint real de `AgentRun`.

## 3. Nao implementado

Nao foram adicionados frontend, streaming, descoberta livre de tools, selecao de MCP server pelo Agno, MCP remoto direto, credentials MCP, provider externo real, tool execution externa, scheduler, worker, queue, dashboard, billing, migration, seed ou alteracao de schema Prisma.

## 4. Relacao com 14A a 14E

- 14A definiu os contratos V1 strict. A 14F reutiliza `tools.mode=gateway`.
- 14B criou o runtime HTTP minimo, agora capaz de reconhecer descriptors seguros.
- 14C criou client, adapter e builder do `AssistantRuntimeSpecV1`.
- 14D conectou o endpoint real de `AgentRun` ao `agno_http`.
- 14E anexou contexto RAG previamente resolvido.
- 14F usa as mesmas fronteiras para tools previamente autorizadas, sem transferir governanca ao runtime.

## 5. Origem e montagem dos descriptors

O Orquestra continua responsavel por auth, RBAC, tenant, workspace, assistant, bindings MCP, status de servidor/tool, risco, approval e precheck. O `RuntimeExecutionContext` exclui binding desabilitado, servidor inativo, tool desabilitada, approval pendente e riscos bloqueados. O builder nao consulta MCP nem descobre tools.

Com a flag desligada:

```txt
tools.enabled=false
tools.mode=none
tools.descriptors=[]
policy.maxToolCalls=0
```

Com a flag ligada e descriptor seguro:

```txt
tools.enabled=true
tools.mode=gateway
tools.descriptors=[...]
policy.maxToolCalls=<limite explicito>
```

## 6. Campos enviados

Cada descriptor pode conter somente:

```txt
toolId
name
description
inputSchema
riskLevel
approvalRequired
gatewayRef
metadata.bindingId
metadata.descriptorIndex
metadata.executionMode
metadata.source
```

O `gatewayRef` identifica uma fronteira logica governada pelo Orquestra. Ele nao contem URL, servidor MCP ou credencial.

## 7. Flags e limites

```txt
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_DESCRIPTORS=8
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
AGNO_RUNTIME_HTTP_MAX_TOOL_SCHEMA_CHARS=6000
```

O builder limita descriptors ao teto contratual de 50, description a 1000 caracteres, `inputSchema` ao limite configurado e ao teto contratual de 8000 caracteres, metadata a campos minimos e `maxToolCalls` ao intervalo 0..50. Schema acima do limite remove o descriptor. Se nenhum descriptor seguro permanecer, o modo volta para `none`.

## 8. Sanitizacao

O builder reconstrui descriptors por allowlist e aplica `sanitizeRuntimeContractMetadata`. Nao sao propagados `Authorization`, headers, cookies, credentials, `apiKey`, token, secret, `providerApiKey`, `secretRef`, `baseUrl`, endpoint, connection string, `rawToolManifest`, `rawMcpServerConfig`, `rawPrompt`, `rawResponse` ou `rawProviderResponse`.

## 9. Fail-closed

A montagem falha fechada quando a flag esta desligada, nao ha tool autorizada, todos os descriptors sao removidos, a spec final nao passa em `parseAssistantRuntimeSpecV1`, o adapter esta desabilitado ou o runtime responde fora do contrato.

Com `maxToolCalls=0`, descriptors podem ser enviados como contexto governado, mas nenhuma execucao e autorizada.

## 10. Eventos e metadata

O adapter emite `runtime.mcp_tools_attached` com `toolMode`, `toolDescriptorCount`, `maxToolCalls`, `toolIds` e `descriptorSchemaHashes`. O runtime emite `tool.descriptors.attached` e, quando `maxToolCalls=0`, `tool.blocked` com `reason=max_tool_calls_zero`.

Schemas completos, argumentos brutos, manifests, URLs internas, headers e credentials nao entram nesses eventos ou na resposta publica.

## 11. Seguranca e fronteira MCP

O Agno nao escolhe MCP servers, nao recebe configuracao de servidor, nao descobre tools e nao acessa MCP remoto diretamente. Nenhuma secret MCP ou `AGNO_RUNTIME_HTTP_SECURITY_KEY` entra na spec. A security key permanece restrita ao header server-to-server do client HTTP.

## 12. Runtime HTTP minimo

O runtime valida o request V1, registra a anexacao e responde deterministicamente. Ele nao possui MCP client, provider externo ou executor de tools. Mesmo com `maxToolCalls>0`, esta subfase nao executa tools. Uma execucao futura devera voltar ao gateway governado do Orquestra.

## 13. Modelo dinamico

Tools nao dependem de modelo especifico. O modelo continua vindo do contexto e da policy autorizada do assistant. Nao existe hardcode de `gpt-4o-mini` no fluxo de runtime/tools/MCP.

## 14. Como testar

```bash
cd backend
npm run typecheck
npm run lint
MICROSOFT_SSO_ENABLED=false MICROSOFT_CLIENT_ID= MICROSOFT_CLIENT_SECRET= MICROSOFT_TENANT_ID= MICROSOFT_REDIRECT_URI= MICROSOFT_POST_LOGOUT_REDIRECT_URI= MICROSOFT_ALLOWED_DOMAINS= MICROSOFT_ALLOWED_TENANT_IDS= npm run test -- --run
npm run build
npx prisma validate
npx prisma generate
npx prisma migrate status
```

Nao foi criado smoke com banco real. A cobertura de API usa setup mockado e transporte HTTP injetavel, sem internet ou Docker.

## 15. Handoff para 14G

A 14G pode definir o protocolo de solicitacao de tool call entre runtime e gateway, com tool allowlisted, argumentos validados, reavaliacao de RBAC/policy/approval, idempotencia, auditoria, timeout e quota. Credentials devem permanecer no Orquestra.

## 16. Riscos remanescentes

- O runtime minimo nao representa um executor Agno produtivo.
- Nao ha smoke com banco real.
- `inputSchema` pode conter texto de negocio permitido; a mitigacao e allowlist, limite e ausencia de manifests.
- Ainda nao existe protocolo produtivo de tool call de volta ao gateway.
- Retry e circuit breaker do client HTTP permanecem fora do escopo.
