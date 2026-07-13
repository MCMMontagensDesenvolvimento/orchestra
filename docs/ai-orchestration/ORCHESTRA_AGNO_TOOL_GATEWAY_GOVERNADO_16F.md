# Orchestra - Gateway Governado de Tool Execution pelo Agno 16F

## 1. Objetivo

A Fase 16F introduz o primeiro callback server-to-server para uma tool solicitada pelo runtime Agno. O Orchestra continua sendo a unica autoridade sobre run, tenant, workspace, assistant, spec, catalogo MCP, policy, risco, approval, argumentos e limites.

O caminho e opt-in, desligado por padrao e restrito a uma simulacao sandbox deterministica. Ele nao habilita MCP remoto, provider de tool externo, comando arbitrario ou approval humano.

## 2. Arquitetura

```text
Chat { input }
  -> AgentRun governado
  -> Orchestra constroi AssistantRuntimeSpecV1
  -> Agno recebe /execute
  -> Agno solicita POST /api/v1/runtime/agno/tool-calls
  -> Orchestra autentica e correlaciona o run ativo
  -> Orchestra revalida descriptor, catalogo, binding, policy e argumentos
  -> sandbox deterministico, sem MCP externo
  -> resultado minimo para o Agno
  -> resposta final do runtime volta ao AgentRun/Chat
```

Quando ha descriptors e o gateway esta habilitado, o `AgentRun` e criado com status `running` antes de `/execute`. O spec exato fica somente no registro em memoria durante essa chamada. Ao final, o mesmo run e finalizado transacionalmente com os eventos normalizados. Sem a flag, o ciclo anterior permanece inalterado.

## 3. Responsabilidades

O Orchestra:

- autentica o canal de callback;
- cria e delimita o registro ativo do run;
- seleciona descriptors no builder 16C;
- revalida run, identidade, catalogo MCP, binding e policies;
- valida schema, idempotencia, sequencia e limite;
- persiste `McpToolCall`, eventos e auditoria sanitizados;
- devolve apenas resultado funcional generico e contadores.

O Agno:

- usa somente os IDs e limites do spec recebido;
- preserva `runtimeTraceId`, `agentRunId`, `assistantId`, `toolCallId` e `sequence`;
- nao escolhe server, binding, credencial ou URL de MCP;
- nao eleva `maxToolCalls`;
- nao executa a tool por conta propria;
- trata resposta bloqueada como fail-closed.

O frontend continua enviando somente `{ input }` e nao participa deste endpoint.

## 4. Contrato de tool request

O endpoint aceita JSON strict:

```json
{
  "runtimeTraceId": "trace-id",
  "agentRunId": "run-id",
  "assistantId": "assistant-id",
  "toolCallId": "runtime-tool-call-id",
  "toolId": "tool-id-governado",
  "arguments": {
    "query": "valor de teste autorizado"
  },
  "sequence": 1
}
```

Campos desconhecidos sao rejeitados. IDs possuem limites, `sequence` deve ser inteiro positivo e o payload total nao pode exceder 32 KiB. `arguments` e um objeto JSON limitado e precisa validar contra o schema do descriptor e contra o schema atual da tool.

O contrato recusa chaves ou valores indicativos de credencial, autenticacao, header, URL interna, payload bruto, manifest, output bruto ou material equivalente. A tool e selecionada exclusivamente por `toolId`; nome e server recebidos do runtime nao sao aceitos.

Sucesso minimizado:

```json
{
  "toolCallId": "runtime-tool-call-id",
  "status": "succeeded",
  "result": {
    "content": "Governed sandbox tool execution completed."
  },
  "metadata": {
    "toolCallsExecuted": 1,
    "externalMcpCalled": false,
    "simulated": true,
    "failedClosed": false,
    "latencyMs": 1
  }
}
```

Bloqueios devolvem codigo e mensagem governados, `retryable=false`, contadores e uma `reason` allowlisted. Nunca devolvem argumentos, output bruto, schema, policy completa ou detalhe interno.

## 5. Autenticacao server-to-server

`POST /api/v1/runtime/agno/tool-calls` possui fronteira propria e nao usa cookie/RBAC do browser. Ele reutiliza a chave de transporte da 16D, `AGNO_RUNTIME_HTTP_SECURITY_KEY`, comparada em tempo constante no header de autorizacao do canal server-to-server.

Para o endpoint aceitar chamadas, a autenticacao obrigatoria da 16D e o gateway precisam estar habilitados. Chave ausente ou divergente retorna apenas HTTP 401 com `Runtime authentication failed.`. A chave, o header e seu valor nunca entram em body, spec, evento, auditoria ou DTO publico.

O `gatewayRef` do descriptor continua simbolico. Nenhuma URL interna e enviada no `AssistantRuntimeSpecV1`; a configuracao do callback e responsabilidade privada do deployment do Agno.

## 6. Validacao de run, spec, tool e policy

Cada request passa por estas barreiras:

1. a flag do gateway esta habilitada;
2. existe registro ativo em memoria para aquele `agentRunId`;
3. o run existe no banco no tenant/workspace fixados pelo spec;
4. o run esta `running` e em modo `sandbox` ou `published`;
5. trace, assistant, version e publication correlacionam com o spec/run;
6. o registro ativo foi criado exclusivamente pelo caminho `agno_http`;
7. `tools.enabled=true`, `tools.mode=gateway` e o `toolId` esta nos descriptors;
8. assistant, server, tool e binding ainda existem no mesmo escopo;
9. server e tool estao ativos, o server e `trusted` e o binding e `sandbox_only`;
10. policies continuam habilitando execucao, sandbox, bloqueios externos e logs;
11. descriptor, tool, policy e binding nao exigem approval;
12. descriptor e tool continuam `low` risk;
13. hash do schema atual coincide com o schema anexado ao spec;
14. os argumentos validam no subconjunto conservador de JSON Schema.

Qualquer divergencia bloqueia. Riscos `medium`, `high`, `critical`, approval, tool fora do spec, schema alterado, run finalizado e correlacao divergente nao chegam ao executor.

## 7. Idempotencia

A idempotencia usa `(agentRunId, toolCallId)` no registro ativo. O request e canonizado e hasheado:

- repeticao identica recebe a mesma resposta minimizada;
- reutilizacao do ID com request diferente e bloqueada;
- o ID interno de `McpToolCall` e deterministico por run/call;
- argumentos nao sao usados como chave publica nem persistidos em claro.

Nesta fase, cache, lock e spec ativo sao locais ao processo. Nao ha ledger distribuido nem constraint nova de banco. Por isso o caminho permitido continua somente sandbox deterministico; tool/MCP externo real permanece bloqueado.

## 8. Limites e concorrencia

`spec.policy.maxToolCalls` e construido pelo Orchestra e nunca lido do callback. Zero bloqueia. Cada sucesso incrementa o contador do registro ativo e `sequence` precisa ser exatamente o proximo numero.

Um lock por run serializa callbacks concorrentes antes das validacoes de idempotencia, sequencia e limite. Assim duas requests simultaneas nao ultrapassam `maxToolCalls`. O payload ainda e limitado pelo contrato a 32 KiB e pela flag interna, cujo intervalo aceito e de 1 a 32 KiB.

A rota aplica tambem um limite conservador de 60 requests por minuto e IP, alem do limite global de body do backend. Esse rate limit nao substitui `maxToolCalls`, que continua sendo a autoridade por run.

## 9. Execucao sandbox

A 16F nao abre transporte MCP. A execucao produz um resultado deterministico interno depois do precheck e registra um `McpToolCall` em modo `sandbox`, com:

- status concluido;
- snapshot de risco `low`;
- approval falso;
- `externalMcpAllowed=false`;
- `externalMcpCalled=false`;
- hash dos argumentos, sem preview;
- resultado funcional generico, sem output da tool.

Nao existe chamada de rede externa, shell, provider, manifest ou URL informada pelo Agno. `allowRuntimeExecution=false` da policy MCP continua compativel porque nenhuma tool real e executada; os gates de sandbox, risco, approval e egress permanecem obrigatorios.

## 10. Eventos e auditoria

O caminho persiste eventos de precheck e simulacao no `McpToolCall` e eventos do `AgentRun` para request, precheck, execucao, bloqueio e retorno do resultado. Auditorias distinguem `runtime_tool_gateway_executed` e `runtime_tool_gateway_blocked`.

Metadata e allowlist quantitativa: `toolCallsExecuted`, `externalMcpCalled`, `failedClosed`, `simulated`, `reason`, status e latencia quando aplicavel. O `AgentRun` inicial registra somente versao do spec e contadores de policy/descriptors.

## 11. Seguranca e redaction

Nao sao persistidos nem devolvidos:

- argumentos ou output em claro;
- descriptor ou schema completo;
- manifest/configuracao MCP;
- URL de server/gateway;
- headers, cookies ou credenciais;
- prompt, contexto ou resposta bruta de runtime/provider;
- stack trace ou exception message interna.

O request passa primeiro pela autenticacao e depois pelo schema strict. A resposta tambem e revalidada por schema antes de sair. `McpToolCall.inputHash` permite correlacao sem recuperar o argumento original; `inputPreview` e `outputPreview` ficam ausentes.

## 12. O que permanece fora

- MCP remoto ou tool externa real;
- tools `medium`, `high` ou `critical`;
- qualquer fluxo com approval;
- descoberta livre de tools pelo Agno;
- URL/credential recebida do runtime;
- idempotencia distribuida e registry persistido;
- fila, worker, retry automatico ou compensacao;
- streaming de tool calls;
- UI nova e mudanca do contrato do Chat;
- provider real, Agno real ou rede externa nos testes;
- migration de banco.

O runtime HTTP minimo nao ganhou callback de rede: os testes exercitam a fronteira do gateway com Agno/repositories simulados. Isso evita criar uma segunda configuracao privada de URL/secret no fake e mantém os smokes 16D/16E sem `/execute` ou tool real.

## 13. Testes

A suite cobre autenticacao ausente/divergente, request strict, material sensivel, payload grande, tool fora do spec, limite zero/excedido, sequencia, concorrencia, idempotencia, trace/assistant/run, schema alterado, riscos medium/high/critical, approval e gateway desligado.

O cenario positivo usa somente descriptor low, binding `sandbox_only`, server trusted e repositories fake. Ele verifica resposta minima, hash sem previews, eventos/auditoria sem argumentos/schema/URL/header/secret e ausencia de MCP externo. Testes de AgentRun verificam persistencia `running` antes de `/execute`, finalizacao do mesmo run e falha fechada de excecao inesperada.

As suites de runtime, Agno, MCP, AgentRun, Chat e smokes anteriores permanecem na matriz de regressao.

## 14. Homologacao local

O baseline continua desligado:

```env
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_MAX_PAYLOAD_BYTES=32768
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
```

Para um teste local deliberado, isolado e somente deterministico, e necessario tambem habilitar `agno_http`, autenticacao obrigatoria da 16D, descriptors 16C e definir `maxToolCalls=1`. A chave deve ser injetada fora do repositorio. O assistant/tool/binding precisam usar dados de teste, risk low, sem approval e sandbox.

Nao use o smoke 16E para esse cenario. O smoke 16E exige gateway falso e limite zero; ele continua validando apenas health/capabilities e nunca `/execute`.

## 15. Rollback

Desative o gateway e restaure o limite zero:

```env
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
```

Se o runtime Agno tambem precisar ser retirado, aplique o rollback 16E para `RUNTIME_PROVIDER=local` e `AGNO_RUNTIME_HTTP_ENABLED=false`. Reinicie os processos para eliminar registros ativos em memoria. Nao ha migration ou rollback de schema.

## 16. Riscos

- o registry e a idempotencia sao locais a uma instancia; o callback precisa chegar ao mesmo processo que iniciou `/execute`;
- reinicio/crash perde o spec ativo e bloqueia callbacks posteriores;
- crash do processo pode deixar um run `running` para reconciliacao operacional; excecoes em processo sao finalizadas fail-closed;
- nao ha ledger duravel de resposta idempotente nem coordenacao multi-instancia;
- o validador aceita apenas um subconjunto conservador de JSON Schema e bloqueia schemas fora dele;
- mudanca de catalogo/policy entre spec e callback pode bloquear uma chamada antes permitida;
- falha de auditoria secundaria nao expande permissao; eventos transacionais da tool continuam sendo a evidencia primaria;
- o resultado e intencionalmente generico e nao representa execucao funcional de uma tool real;
- habilitar flags sem afinidade de instancia ou isolamento de rede nao e configuracao suportada.

Esses riscos justificam o default desligado e a permanencia de qualquer execucao externa para uma fase posterior com persistencia distribuida, egress controlado e approvals completos.
