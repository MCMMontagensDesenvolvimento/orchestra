# Orchestra - MCP/Tools Governados no Chat via Agno 16C

## 1. Objetivo

A Fase 16C conecta o catalogo MCP existente ao fluxo de Chat executado por `agno_http` sem transferir governanca para o Agno:

```text
Chat -> AgentRun -> selecao MCP/tools no Orchestra
     -> AssistantRuntimeSpecV1.tools -> agno_http
     -> resposta/eventos quantitativos -> mensagem assistant
```

O frontend continua enviando somente `{ "input": "..." }`. Ele nao escolhe tool, MCP server, argumentos, approval, provider, model, prompt, cabecalhos ou credenciais.

A entrega habilita descriptors governados e planejamento contratual. Ela nao abre execucao MCP externa real pelo Agno. O runtime minimo/fake aceita e valida descriptors, registra contadores e executa zero tools.

## 2. Decisao arquitetural

O Orchestra e o Control Plane. Ele permanece responsavel por catalogo MCP, bindings, RBAC/ABAC, policies, risk level, approval, precheck, limites, auditoria, quotas, `AgentRun`, observabilidade e selecao do runtime.

O Agno e o Runtime Executor. Ele recebe um `AssistantRuntimeSpecV1` ja governado, pode considerar apenas os descriptors presentes no contrato e devolve resposta, eventos e metadata segura. Ele nao faz discovery livre, nao consulta o catalogo diretamente e nao recebe configuracao bruta de server ou material sensivel.

## 3. Componentes reutilizados

A 16C nao cria catalogo, repository ou gateway paralelo. Ela reutiliza:

- `McpServer`, `McpTool`, `McpResource`, `McpPrompt`, `McpToolPolicy` e `AssistantMcpBinding`;
- `agentRunsRepository.getRuntimeContextSummary` para ler bindings no tenant/workspace/assistant;
- `RuntimeExecutionContext.mcp` como resumo interno;
- `runtime.assistant-spec.builder.ts` para minimizar descriptors;
- schemas strict de `runtime-contract.schema.ts`;
- `runtime.agno-http-adapter.ts` para a fronteira `/execute`;
- endpoints MCP existentes de precheck e tool call sandbox;
- timeline e detalhes tecnicos existentes no Chat/AgentRun.

Resources e prompts continuam no catalogo, mas nao sao anexados em `AssistantRuntimeSpecV1.tools` nesta fase.

## 4. Selecao governada no Orchestra

O contexto de runtime busca somente bindings com o mesmo tenant, workspace e assistant e com `isEnabled=true`. Para um descriptor ser candidato:

1. o binding precisa apontar para uma tool especifica;
2. o binding nao pode estar em modo `disabled`;
3. server precisa estar ativo e nao arquivado;
4. tool precisa estar habilitada e nao arquivada;
5. approval efetivo agrega exigencias do binding, da policy e da tool; override `false` nao neutraliza approval governado;
6. tools com approval efetivo ou risco `medium`, `high` ou `critical` nao entram em `allowedSandboxTools`;
7. essas tools ficam contabilizadas em `requiresApproval`, sem execucao automatica.

O builder reaplica a exclusao de approval e de qualquer risco diferente de `low` como defesa em profundidade. Na 16C somente tools `low` sem approval podem ser descritas; o fake ainda executa zero tools, e para homologacao o limite recomendado e `maxToolCalls=0`.

Uma tool policy com `allowRuntimeExecution=false` ou `blockedByDefault=true` continua sendo relevante no precheck do gateway. Anexar um descriptor nao e permissao para executar: e apenas a declaracao minimizada de uma capacidade catalogada.

## 5. Contrato `AssistantRuntimeSpecV1.tools`

Quando `AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false`, ou quando nenhum descriptor sobrevive a governanca e sanitizacao:

```json
{
  "tools": {
    "enabled": false,
    "mode": "none",
    "descriptors": []
  },
  "policy": {
    "maxToolCalls": 0
  }
}
```

Quando a flag esta ativa e existe tool autorizada:

```json
{
  "tools": {
    "enabled": true,
    "mode": "gateway",
    "descriptors": [
      {
        "toolId": "tool-id-governado",
        "name": "tool.name",
        "description": "Descricao curta",
        "riskLevel": "low",
        "approvalRequired": false,
        "inputSchema": {
          "type": "object",
          "properties": {}
        },
        "gatewayRef": {
          "type": "orchestra_tool_gateway",
          "action": "mcp.tool.execute"
        },
        "metadata": {
          "bindingId": "binding-id",
          "descriptorIndex": 1,
          "source": "orchestra_mcp_catalog"
        }
      }
    ]
  }
}
```

O schema exige:

- objeto strict em todos os niveis;
- `mode=gateway` com pelo menos um descriptor quando habilitado;
- `gatewayRef.type=orchestra_tool_gateway`;
- `gatewayRef.action=mcp.tool.execute`;
- metadata restrita a `bindingId`, `descriptorIndex` e `source`;
- no maximo 50 descriptors no contrato, com limite operacional menor por flag;
- descricao com no maximo 1.000 caracteres;
- schema JSON seguro e limitado;
- ausencia de campos e valores sensiveis.

## 6. Limites e sanitizacao

Flags da fronteira HTTP:

```text
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_DESCRIPTORS=8
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
AGNO_RUNTIME_HTTP_MAX_TOOL_SCHEMA_CHARS=6000
```

O builder limita quantidade, descricao e tamanho serializado do schema. Campos proibidos sao removidos; se o schema restante nao for um objeto seguro ou exceder o limite, o descriptor e descartado. Se nenhum descriptor seguro restar, tools voltam para `enabled=false`, `mode=none` e `maxToolCalls=0`.

Nao atravessam a fronteira:

- API keys, OAuth tokens, cookies, credentials ou secret refs;
- cabecalhos de autenticacao;
- base URL, endpoint ou URL interna de MCP;
- connection strings ou configuracao bruta de server;
- manifest bruto, payload bruto ou permissao interna completa;
- argumentos, resultado ou output bruto de tool.

## 7. Gateway governado

O catalogo ja possui:

- `POST /api/v1/assistants/:id/mcp/precheck`;
- `POST /api/v1/assistants/:id/mcp/tool-calls`;
- historico e eventos de tool call.

Esses endpoints aplicam scoping, binding, estado de server/tool, sandbox policy, risk level, approval e auditoria. A execucao atual e deterministica de sandbox e declara `externalMcpCall=false`.

Na 16C o `gatewayRef` e simbolico e allowlisted. O Agno nao recebe URL nem credencial para chamar esses endpoints. Nao existe callback interno autenticado `agno_http -> Orchestra gateway` nesta fase. Portanto:

- o runtime pode validar e planejar somente as tools anexadas;
- o fake bloqueia a execucao com evento quantitativo;
- nenhuma tool ou MCP real e chamado automaticamente;
- uma futura fase devera implementar callback autenticado, correlacao com `AgentRun`, precheck por chamada, approval, auditoria e resposta de tool minimizada.

## 8. Comportamento do runtime minimo/fake

O runtime minimo:

- anuncia suporte a descriptors de tools, nao a tool calling externo;
- valida o request pelo schema V1 strict;
- conta descriptors e approvals;
- respeita `maxToolCalls` executando sempre zero, portanto nunca excedendo o limite;
- emite `tool.descriptors.attached` apenas com contadores/flags;
- emite `tool.blocked` com `max_tool_calls_zero`, `approval_required` ou `fake_runtime_no_external_execution`;
- retorna `toolCallsExecuted=0` e `externalMcpCalled=false`;
- nao chama MCP, tool, provider, banco ou comando externo.

## 9. Chat e AgentRun

O Chat persiste a mensagem do usuario e chama `agentRunsService.createForAssistant` somente com o input e metadata de origem. O AgentRun monta o contexto MCP no backend. Quando `agno_http` esta ativo, o adapter inclui o spec completo em `/execute`.

A resposta textual valida do runtime retorna por callback interno do `AgentRun` e e persistida como mensagem `assistant` vinculada ao run. Descriptors, schemas, argumentos e outputs de tool nao sao copiados para a mensagem ou DTO publico.

O runtime `local` continua usando seu caminho anterior e nao inicia fluxo MCP automatico.

## 10. Observabilidade segura

A UI existente de Chat/AgentRun pode mostrar:

- `toolDescriptorCount`;
- `maxToolCalls`;
- `toolCallsExecuted`;
- `externalMcpCalled`;
- `approvalRequiredCount`;
- `requestSent` e `failClosed`;
- provider/model;
- contadores de RAG e contexto conversacional.

Eventos contratuais recebidos do runtime sao reallowlistados antes da persistencia. IDs de tool, nomes, schema hashes, descriptors, argumentos, resultados, payloads e stack traces nao entram na telemetria publica. O resumo MCP persistido no run contem somente contagens; IDs recentes de tool call permanecem no contexto interno e nao sao publicados.

## 11. Preservacao da 16B e do runtime local

O spec continua montando `conversationContext`, `rag` e `tools` de forma independente. A consulta RAG oficial da 16B permanece anterior ao runtime e continua fail-closed em erro inesperado. Os limites RAG e MCP sao aplicados separadamente.

`AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false` mantem o comportamento anterior do `agno_http`. `RUNTIME_PROVIDER=local` nao envia `AssistantRuntimeSpecV1` pela fronteira HTTP e nao executa MCP automaticamente.

## 12. Homologacao com fake runtime

Configuracao segura recomendada:

```text
RUNTIME_PROVIDER=agno_http
AGNO_RUNTIME_HTTP_ENABLED=true
AGNO_RUNTIME_HTTP_BASE_URL=http://127.0.0.1:8091
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=true
AGNO_RUNTIME_HTTP_MAX_TOOL_DESCRIPTORS=8
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
AGNO_RUNTIME_HTTP_MAX_TOOL_SCHEMA_CHARS=6000
```

Roteiro:

1. cadastrar server/tool e binding de baixo risco no catalogo local;
2. manter approval desabilitado para a tool de teste;
3. iniciar o runtime minimo local;
4. enviar uma mensagem no Chat;
5. confirmar mensagem assistant persistida;
6. confirmar `toolDescriptorCount>=1`, `maxToolCalls=0`, `toolCallsExecuted=0` e `externalMcpCalled=false`;
7. confirmar ausencia de descriptor, schema, argumento, output, URL interna e segredo no DTO/eventos.

Nenhuma dependencia externa e necessaria para este roteiro.

## 13. Homologacao manual com Agno real

Usar somente ambiente controlado e manter `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0` na 16C.

1. validar `/health` e `/capabilities` do runtime;
2. habilitar `agno_http` e a flag de tools no backend;
3. usar uma tool low risk, sem approval e com schema pequeno;
4. observar no runtime somente `AssistantRuntimeSpecV1.tools` minimizado;
5. confirmar que o runtime nao faz discovery e nao tenta conexao MCP direta;
6. confirmar que a resposta final volta ao Chat;
7. confirmar contadores seguros no AgentRun;
8. inspecionar logs/DTOs e provar ausencia de material sensivel.

Se o runtime real exigir URL, credencial, manifest bruto ou execucao direta, a homologacao deve falhar fechada; esse runtime ainda nao atende ao contrato 16C.

## 14. Fora da 16C

- execucao livre ou arbitraria de tools;
- discovery livre pelo Agno;
- callback de gateway para execucao real;
- MCP remoto real automatico;
- secrets ou configuracao de conexao no runtime spec;
- approval decidido pelo frontend ou pelo Agno;
- streaming;
- runtime registry dinamico;
- agentes on-premise adicionais;
- exposicao publica de args, output ou schema completo.

## 15. Riscos remanescentes

- um runtime Agno real pode interpretar descriptors de forma diferente; homologar com `maxToolCalls=0`;
- tool schemas grandes ou incomuns podem ser descartados pela sanitizacao;
- binding de server sem tool especifica nao e expandido automaticamente;
- execucao real exigira protocolo de callback autenticado e idempotente;
- a UI mostra contadores, nao diagnostico detalhado por tool, por decisao de privacidade.

## 16. Rollback

Rollback sem migration:

1. definir `AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false`;
2. manter `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0`;
3. se necessario, voltar `RUNTIME_PROVIDER=local`;
4. reiniciar o backend;
5. validar `tools.enabled=false`, `mode=none` e fluxo normal de Chat/RAG.

Nao ha migration, segredo novo, alteracao de catalogo ou dependencia externa criada pela 16C.
