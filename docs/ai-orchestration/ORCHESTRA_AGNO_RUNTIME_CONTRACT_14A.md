# Orchestra Agno Runtime Contract 14A

## 1. Resumo da 14A

A Fase 14A cria a fundacao contract-first para integrar o Orquestra a um runtime externo Agno-compatible em fases futuras. A entrega adiciona tipos TypeScript, schemas Zod strict, helpers puros e testes unitarios para a `AssistantRuntimeSpecV1`, request/response de execucao, eventos normalizados, erros normalizados, health e capabilities.

Esta fase nao executa Agno real, nao altera flags, nao muda defaults, nao cria endpoint novo de chat, nao altera frontend, nao cria migration e nao habilita runtime externo por padrao.

## 2. Objetivo do contrato

O objetivo e estabelecer um contrato versionado, seguro, validavel e JSON-serializable entre o control plane Orquestra e um executor externo. O contrato deve permitir que a Fase 14B implemente um servico runtime minimo sem decidir RBAC, sem receber secrets brutos e sem acessar RAG/MCP fora das policies do Orquestra.

Contrato principal:

```txt
AssistantRuntimeSpecV1
specVersion = orchestra.runtime.assistant.v1
```

Arquivos de codigo:

- `backend/src/modules/runtime/runtime-contract.schema.ts`
- `backend/src/modules/runtime/runtime-contract.types.ts`
- `backend/tests/unit/runtime-contract.test.ts`

## 3. O que a 14A implementa

- `AssistantRuntimeSpecV1` com trace, tenant, workspace, actor, assistant, input, model, policy, instructions, RAG, tools, observability, limits e metadata.
- `RuntimeExecuteRequestV1` com `orchestra.runtime.execute.v1`.
- `RuntimeExecuteResponseV1` com `orchestra.runtime.response.v1`.
- `RuntimeNormalizedEventV1`.
- `RuntimeNormalizedErrorV1`.
- `RuntimeHealthResponseV1`.
- `RuntimeCapabilitiesResponseV1`.
- Helpers puros `parse*` para validar payloads.
- Helper defensivo `sanitizeRuntimeContractMetadata`.
- Testes unitarios cobrindo versionamento, strictness, payload valido, campos perigosos, RAG, tools, response, errors e capabilities.

## 4. O que a 14A nao implementa

- Servico Agno real.
- Container Agno.
- Docker Compose Agno.
- Chamada produtiva ao Agno.
- Streaming real.
- Endpoint novo de chat.
- Frontend chat real.
- RAG dentro do Agno.
- MCP dentro do Agno.
- Tool execution gateway.
- LLM-as-judge.
- Scheduler, worker ou queue.
- Dashboard.
- Billing.
- Migration, seed ou schema Prisma.
- Alteracao funcional em auth, SSO, RAG, MCP, observabilidade ou AI Quality.

## 5. Fronteira Orquestra x Agno

O Orquestra continua sendo o control plane. Agno deve ser apenas executor.

Regras do contrato:

- frontend nunca chama Agno direto;
- Agno nunca decide RBAC;
- Agno nunca e fonte da verdade;
- Agno nunca recebe acesso irrestrito a ferramentas;
- Agno nunca recebe secrets brutos;
- Agno nunca escolhe tenant, workspace ou assistant;
- Agno nunca executa RAG/MCP fora das policies do Orquestra.

O Orquestra permanece responsavel por tenant, workspace, auth, RBAC, assistentes, providers, RAG, MCP, secrets, limites, observabilidade, auditoria, qualidade e governanca.

## 6. Assistant Runtime Spec v1

A spec e allowlist e estrita. Estrutura logica:

```txt
specVersion
trace
tenant
workspace
actor
assistant
input
model
policy
instructions
rag
tools
observability
limits
metadata
```

Invariantes relevantes:

- `specVersion` deve ser `orchestra.runtime.assistant.v1`;
- `policy.executionMode` deve ser `sync`;
- `policy.streaming` deve ser `false`;
- `policy.failClosed` deve ser `true`;
- `rag.mode` aceita apenas `none`, `resolved_context` ou `gateway`;
- `tools.mode` aceita apenas `none` ou `gateway`;
- `rag.mode=none` nao aceita sources;
- `tools.mode=none` nao aceita descriptors;
- quantidade de sources nao pode exceder `policy.maxRagResults`;
- quantidade de tool descriptors nao pode exceder `policy.maxToolCalls`.

## 7. Runtime execute request/response

Request futuro:

```txt
RuntimeExecuteRequestV1
specVersion = orchestra.runtime.execute.v1
assistantRuntimeSpec = AssistantRuntimeSpecV1
```

Response normalizada:

```txt
RuntimeExecuteResponseV1
specVersion = orchestra.runtime.response.v1
trace.traceId
trace.runId
status = succeeded | failed | blocked | cancelled
output
usage
events
error
```

`output.metadata`, `usage`, `events` e `error.details` tambem passam pelas regras de metadata segura. A response nao aceita payload bruto de provider, headers, secrets ou respostas cruas.

## 8. Eventos normalizados

Eventos permitidos em 14A:

```txt
run.started
model.requested
model.completed
rag.context.attached
tool.requested
tool.completed
tool.blocked
run.completed
run.failed
```

Cada evento possui:

- `eventId`;
- `traceId`;
- `runId`;
- `type`;
- `timestamp`;
- `status`;
- `message` opcional;
- `metadata` segura opcional.

Eventos nao podem carregar payload bruto, credenciais, headers ou resposta bruta de provider.

## 9. Erros normalizados

Codigos permitidos:

```txt
RUNTIME_UNAVAILABLE
RUNTIME_TIMEOUT
RUNTIME_BAD_REQUEST
RUNTIME_POLICY_BLOCKED
RUNTIME_TOOL_BLOCKED
RUNTIME_RAG_BLOCKED
RUNTIME_PROVIDER_FAILED
RUNTIME_INVALID_RESPONSE
RUNTIME_UNKNOWN_ERROR
```

Cada erro possui:

- `code`;
- `message`;
- `retryable`;
- `httpStatus` opcional;
- `details` seguros opcionais.

Codigos desconhecidos falham na validacao.

## 10. Health/capabilities

`RuntimeHealthResponseV1` declara:

- `provider = agno`;
- `protocolVersion = orchestra.runtime.assistant.v1`;
- `status`;
- `checkedAt`;
- `message` opcional;
- `details` seguros opcionais.

`RuntimeCapabilitiesResponseV1` declara:

- `provider = agno`;
- `protocolVersion = orchestra.runtime.assistant.v1`;
- `supportsStreaming`;
- `supportsTools`;
- `supportsRagContext`;
- `supportsFileInputs`;
- `maxInputChars` opcional;
- `maxToolCalls` opcional.

Capabilities com protocolo incompativel devem falhar.

## 11. Regras de seguranca

Os schemas usam `.strict()` em objetos contratuais e rejeitam campos desconhecidos. A validacao tambem varre payloads de forma recursiva para bloquear chaves e valores sensiveis.

Campos bloqueados no contrato:

```txt
apiKey
secret
token
password
credential
authorization
Authorization
cookie
headers
baseUrl
providerApiKey
secretRef
rawDocuments
rawPrompt
rawResponse
rawProviderResponse
```

Observacoes:

- `traceId`, `runId` e IDs internos sao permitidos.
- `maxTokens`, `inputTokens`, `outputTokens` e `totalTokens` sao permitidos porque nao representam credenciais.
- Metadata segura tem limite de profundidade, tamanho, chaves e itens.
- O helper de sanitizacao existe para preparar metadata, mas o payload final do runtime deve passar pelo schema allowlist.

## 12. Politica de RAG

RAG no contrato e governado pelo Orquestra.

Modos:

- `none`: nenhum contexto RAG enviado.
- `resolved_context`: Orquestra ja resolveu fontes e envia apenas excerpts autorizados.
- `gateway`: runtime podera solicitar RAG via gateway governado em fase futura.

`resolved_context` aceita apenas sources com IDs, titulo opcional, excerpt limitado, score opcional e metadata segura. Nao entram documento bruto inteiro, embeddings, credenciais, URLs internas sensiveis ou tokens de vector store.

Na 14A nao ha execucao nova de RAG; ha apenas modelagem e validacao do contrato.

## 13. Politica de MCP/tools

Tools no contrato sao governadas pelo Orquestra.

Modos:

- `none`: nenhuma ferramenta disponivel.
- `gateway`: runtime recebe descriptors seguros e so pode acionar ferramenta por gateway governado futuro.

Descriptors aceitam:

- `toolId`;
- `name`;
- `description` opcional;
- `riskLevel`;
- `approvalRequired`;
- `inputSchema` seguro opcional;
- `gatewayRef` com `type=orchestra_tool_gateway`.

Descriptors nao aceitam URL real de MCP remoto, headers, credenciais, secrets, command bruto sensivel ou base URL.

Na 14A nao ha MCP real novo, chamada remota ou tool execution gateway.

## 14. Como a 14B deve usar o contrato

A 14B deve implementar um servico HTTP minimo Agno-compatible que:

1. exponha health compativel com `RuntimeHealthResponseV1`;
2. exponha capabilities compativeis com `RuntimeCapabilitiesResponseV1`;
3. receba `RuntimeExecuteRequestV1`;
4. valide `AssistantRuntimeSpecV1` antes de executar qualquer logica;
5. retorne `RuntimeExecuteResponseV1`;
6. falhe fechado em payload invalido, protocolo incompativel ou policy bloqueada;
7. nao aceite secrets, headers de provider ou RAG/MCP fora do contrato.

O backend Orquestra deve continuar sendo o unico chamador do runtime. Frontend nao deve chamar Agno direto.

## 15. Criterios de aceite para 14B

- Runtime externo responde health/capabilities versionados.
- Runtime rejeita specVersion incompativel.
- Runtime rejeita campos perigosos.
- Runtime nao decide tenant/workspace/assistant/RBAC.
- Runtime nao recebe secrets brutos.
- Runtime retorna eventos normalizados.
- Runtime retorna erro normalizado em falha.
- Orquestra consegue executar smoke controlado sem habilitar Agno por padrao.
- Nenhuma ferramenta MCP executa fora do gateway governado.
- Nenhum contexto RAG e resolvido pelo runtime fora das policies do Orquestra.

## 16. Riscos remanescentes

- O adapter Agno existente ainda usa payload local historico; a 14B precisa decidir se adapta diretamente para `RuntimeExecuteRequestV1` ou cria camada de traducao controlada.
- Streaming segue fora do contrato de execucao 14A.
- Tool gateway ainda nao existe.
- RAG gateway ainda nao existe.
- Limites ainda precisam ser plugados ao caminho real de runtime.
- Observabilidade precisa registrar usage/eventos do runtime real.
- Secrets strategy precisa ser validada antes de qualquer provider externo real.
- LLM-as-judge continua fora do escopo ate runtime real estar estabilizado.
