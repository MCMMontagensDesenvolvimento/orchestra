# Orchestra - Agno Como Executor LLM Real No Chat 16A

## 1. Objetivo

A Fase 16A completa a primeira etapa da integracao total do Agno ao Orquestra: o Chat persistente pode executar um `AgentRun` pelo provider de runtime `agno_http`, enviar uma `AssistantRuntimeSpecV1` governada a um runtime Agno-compatible e persistir no Chat a resposta textual devolvida pelo executor.

O fluxo habilitado e:

```txt
Chat
  -> backend Chat API
    -> ConversationMessage do usuario
      -> AgentRun
        -> RuntimeExecutionContext
          -> AssistantRuntimeSpecV1
            -> agno_http
              -> Agno + provider LLM real
                -> RuntimeExecuteResponseV1
                  -> AgentRun + mensagem assistant + observabilidade 15G
```

O frontend continua enviando somente `{ input }`. A selecao do historico, a policy de provider/model, os limites, a sanitizacao, a chamada server-to-server e a exposicao publica permanecem no backend Orquestra.

## 2. Resultado Implementado

- `agno_http` continua selecionado pelo runtime registry por `RUNTIME_PROVIDER=agno_http`.
- O adapter valida configuracao e health, monta o contrato V1 e chama `/execute` no endpoint configurado.
- O `AssistantRuntimeSpecV1` leva input atual, instrucoes, provider/model autorizados, policy fail-closed, contexto conversacional governado e summaries existentes de RAG/tools.
- O contexto enviado ao Agno contem somente `role` e `content`; identificadores e timestamps internos da persistencia nao atravessam a fronteira HTTP.
- A resposta contratual do Agno e normalizada para `RuntimeExecutionResult`.
- O output textual volta pelo callback interno do `AgentRun` e e persistido como `ConversationMessage` do assistant vinculada ao run.
- Provider, model, status, latencia, usage, chamada externa e fail-closed sao promovidos somente como metadata segura para a observabilidade existente.
- Runtime desabilitado, mal configurado, indisponivel, com timeout ou resposta invalida falha fechado, sem fallback silencioso.
- O runtime local e seu provider `local_deterministic` nao foram alterados.

O runtime HTTP minimo embutido em `backend/src/modules/runtime/agno-runtime-http.service.ts` permanece deterministico e nao chama provider externo. Ele e usado para contrato, smoke e desenvolvimento local. A execucao LLM real acontece quando `AGNO_RUNTIME_HTTP_BASE_URL` aponta para um runtime Agno externo que implemente o contrato V1 e esteja operacionalmente configurado com seu provider.

## 3. Arquitetura E Responsabilidades

### Frontend

- chama apenas `POST /api/v1/chat/conversations/:conversationId/messages`;
- envia somente `{ input }`;
- nao monta historico, prompt, provider, model ou credenciais;
- reutiliza a UI 15G para Runtime, Contexto conversacional, Provider LLM e Eventos.

### Backend Orquestra

- valida usuario, tenant, workspace, assistant, conversa e publication;
- persiste a mensagem atual antes da execucao;
- seleciona somente o historico anterior da conversa;
- aplica `CHAT_CONTEXT_*`, roles permitidas, sanitizacao, truncamento e exclusao da mensagem atual;
- resolve runtime pelo registry;
- aplica policy do assistant antes de escolher provider/model externo;
- constroi e valida `AssistantRuntimeSpecV1`;
- chama o Agno por server-to-server;
- valida e normaliza `RuntimeExecuteResponseV1`;
- persiste `AgentRun`, eventos quantitativos e a mensagem do assistant.

### Runtime Agno Externo

- recebe somente o spec governado;
- respeita input, contexto, instrucoes, model e policy recebidos;
- resolve credenciais do provider no proprio ambiente operacional;
- executa o provider LLM real;
- devolve resposta pelo contrato V1, sem headers, credenciais ou payload bruto do provider;
- falha de forma contratual quando provider/model nao estiver disponivel.

O Orquestra permanece como control plane. O Agno e o executor e nao recebe autoridade para buscar livremente historico, trocar policy, escolher tools nao autorizadas ou expor metadata sem allowlist.

## 4. Selecao Governada De Provider E Model

Para um provider externo ser enviado ao Agno, todas as condicoes devem ser verdadeiras:

1. o run nao esta em modo `sandbox`;
2. `allowExternalLlmProviders=true` na execution policy do assistant;
3. `defaultLlmProvider` esta presente em `allowedLlmProviders`;
4. o `modelProvider` da versao selecionada coincide com o provider autorizado;
5. a versao selecionada possui `modelName` nao vazio.

Quando as condicoes sao atendidas, o spec registra `assistant_policy_opt_in` e envia o provider/model autorizados. Se a policy e o modelo da versao divergirem, o adapter falha fechado antes da chamada HTTP com erro governado. Em sandbox ou sem opt-in externo, o spec seleciona `local_deterministic` com `deterministic-sandbox`.

Esta selecao nao envia segredo do provider. A policy e o nome logico de provider/model fazem parte do contrato; a credencial permanece no ambiente do runtime Agno real.

## 5. Contrato HTTP Esperado Com Agno

### Request

O backend chama:

```txt
POST {AGNO_RUNTIME_HTTP_BASE_URL}/execute
Content-Type: application/json
```

O body segue `RuntimeExecuteRequestV1`:

```json
{
  "specVersion": "orchestra.runtime.execute.v1",
  "assistantRuntimeSpec": {
    "specVersion": "orchestra.runtime.assistant.v1",
    "trace": {
      "traceId": "trace-operacional",
      "runId": "run-operacional",
      "requestId": "request-operacional"
    },
    "input": {
      "message": "mensagem atual"
    },
    "conversationContext": {
      "messages": [
        { "role": "user", "content": "mensagem anterior governada" },
        { "role": "assistant", "content": "resposta anterior governada" }
      ],
      "summary": {
        "enabled": true,
        "included": true,
        "messageCount": 2,
        "totalChars": 58,
        "truncated": false,
        "maxMessages": 12,
        "maxMessageChars": 1200,
        "maxTotalChars": 6000
      }
    },
    "model": {
      "provider": "openai",
      "model": "modelo-configurado-no-assistant"
    },
    "policy": {
      "executionMode": "sync",
      "streaming": false,
      "timeoutMs": 15000,
      "maxToolCalls": 0,
      "maxRagResults": 0,
      "maxContextChars": 6000,
      "failClosed": true
    }
  }
}
```

O exemplo e reduzido. O spec completo tambem inclui tenant/workspace/actor autorizados, assistant, instrucoes, observabilidade, limits e os campos `rag`/`tools`. Na 16A, RAG e tools reais nao sao requisito e permanecem desligados por default.

A alteracao de contrato da 16A minimiza cada item de `conversationContext.messages` para `{ role, content }`. Campos internos de persistencia nao fazem mais parte do schema HTTP e, por ser strict, uma mensagem com campos extras e rejeitada.

### Response

O Agno deve devolver `RuntimeExecuteResponseV1` com:

- `status` contratual;
- `traceId` e `runId` correspondentes;
- `output.text` para sucesso;
- `output.metadata` somente com valores seguros como provider, model, providerStatus, `externalProviderCalled`, `simulated`, `failedClosed` e contadores;
- `usage` quantitativo quando disponivel;
- eventos normalizados opcionais;
- erro normalizado para falha ou bloqueio.

O adapter calcula hash e preview limitado do output, promove somente campos allowlisted e nunca persiste o payload bruto retornado pelo provider.

## 6. Configuracao

### Baseline Local Preservado

```env
RUNTIME_PROVIDER=local
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
AGNO_RUNTIME_HTTP_ENABLED=false
```

Esse baseline usa o runtime local e nao chama Agno HTTP.

### Agno HTTP Para Homologacao

```env
RUNTIME_PROVIDER=agno_http
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
RUNTIME_REQUIRE_PRECHECK=true
AGNO_RUNTIME_HTTP_ENABLED=true
AGNO_RUNTIME_HTTP_BASE_URL=http://127.0.0.1:8091
AGNO_RUNTIME_HTTP_TIMEOUT_MS=15000
AGNO_RUNTIME_HTTP_SECURITY_KEY=
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
CHAT_CONTEXT_ENABLED=true
CHAT_CONTEXT_MAX_MESSAGES=12
CHAT_CONTEXT_MAX_MESSAGE_CHARS=1200
CHAT_CONTEXT_MAX_TOTAL_CHARS=6000
```

Usar `127.0.0.1:8091` com o runtime minimo valida apenas contrato/sandbox. Para LLM real, a base URL deve apontar ao runtime Agno real autorizado.

As variaveis `LLM_*` e `OPENAI_*` do backend continuam atendendo o caminho `RUNTIME_PROVIDER=local` com provider externo direto da trilha 15F. Elas nao sao copiadas ao request `agno_http`. No caminho 16A, a credencial do provider e configurada no ambiente seguro do Agno.

Nenhum valor sensivel deve ser versionado. A chave server-to-server, quando usada, segue somente no header HTTP e nao aparece no body, eventos ou metadata publica.

## 7. Observabilidade

A UI 15G continua sem tela nova. Os eventos e metadata normalizados permitem exibir:

- runtime provider `agno_http`;
- status do run;
- latencia do adapter/runtime;
- provider e model informados pelo Agno, com fallback para o provider/model solicitados no spec;
- contexto anexado, quantidade de mensagens, caracteres e truncamento;
- `externalProviderCalled` quando informado pelo Agno;
- usage quantitativo;
- erro governado e `failedClosed=true` nas falhas do adapter.

Nao sao expostos em eventos ou metadata publicos:

- historico bruto;
- `conversationContext.messages`;
- identificador interno ou timestamp interno das mensagens de contexto;
- prompt bruto ou instrucoes brutas;
- output bruto fora da mensagem funcional do Chat;
- payload bruto do provider/runtime;
- header de autenticacao, cookies, API keys, secrets, credentials ou tokens;
- stack trace ou base URL interna.

## 8. Homologacao Com Fake/Local

### Testes Automatizados

Os testes usam `fetch` fake/stub e nao dependem de internet, provider real ou segredo:

```bash
npm --prefix backend run test -- --run runtime-agno-http
npm --prefix backend run test -- --run agno
npm --prefix backend run test -- --run chat
```

Cobertura principal:

- spec com input atual separado do contexto;
- contexto HTTP contendo somente role/content;
- provider/model externo permitido por policy;
- resposta de LLM simulada pelo fake Agno;
- output voltando ao Chat e sendo persistido como mensagem do assistant;
- metadata/eventos somente quantitativos;
- erro, indisponibilidade, timeout, resposta invalida e policy block normalizados;
- `local_deterministic` preservado.

### Runtime Minimo Local

Em um terminal:

```bash
npm --prefix backend run agno:runtime
```

Em outro terminal, validar contrato:

```bash
scripts/smoke-agno-runtime-contract.sh
scripts/smoke-chat-contexto-15e.sh
```

Esse roteiro nao chama provider real. A resposta esperada e a resposta deterministica do runtime minimo.

## 9. Homologacao Manual Com Agno Real

Pre-condicoes:

1. runtime Agno real implementando `/health`, `/capabilities` e `/execute` pelo contrato V1;
2. provider e model configurados no ambiente seguro do Agno;
3. assistant publicado com `modelProvider` e `modelName` coerentes;
4. execution policy com opt-in explicito do mesmo provider;
5. autorizacao operacional para custo, cota e tratamento de dados;
6. backend apontando para a base URL do Agno e com `AGNO_RUNTIME_HTTP_ENABLED=true`.

Roteiro:

1. validar `/health` e `/capabilities` sem expor configuracao sensivel;
2. abrir uma conversa nova no Chat;
3. enviar a primeira mensagem e confirmar `agno_http`, provider/model, status completed e contexto com zero mensagens anteriores;
4. enviar a segunda mensagem e confirmar contexto anexado com contadores coerentes;
5. confirmar que a resposta real foi persistida como mensagem do assistant vinculada ao `AgentRun`;
6. conferir Runtime, Contexto conversacional, Provider LLM e Eventos na UI 15G;
7. validar ausencia de historico bruto, prompt, payload, credenciais e headers nas evidencias;
8. desabilitar temporariamente o runtime ou usar endpoint controladamente indisponivel para confirmar fail-closed e rollback para configuracao local.

Essa homologacao e manual e deliberada. Nenhum teste ou smoke da 16A faz chamada automatica a provider real.

## 10. Dentro E Fora Da 16A

Dentro:

- Chat -> AgentRun -> `agno_http` -> resposta LLM pelo contrato;
- selecao governada de provider/model;
- contexto conversacional minimizado no payload;
- normalizacao de sucesso, erro e timeout;
- persistencia da resposta no Chat;
- observabilidade segura reutilizando a 15G;
- testes com fake Agno HTTP.

Fora:

- RAG real executado pelo Agno;
- MCP/tools reais executados pelo Agno;
- streaming;
- agentes on-premise adicionais;
- runtime registry dinamico para adapters Agno/OpenCrow-like;
- discovery livre de provider/model pelo runtime;
- nova UI;
- homologacao automatica com provider real.

## 11. Criterios De Aceite

- Chat continua enviando somente `{ input }` ao backend.
- `RUNTIME_PROVIDER=agno_http` executa `AgentRun` contra fake runtime nos testes.
- `AssistantRuntimeSpecV1` inclui input, instrucoes, policy, provider/model e contexto governado.
- Input atual permanece fora do historico anterior.
- Mensagens de contexto no HTTP contem somente role/content.
- Resposta do Agno volta como mensagem do assistant vinculada ao run.
- Provider/model, latencia, status, contexto e chamada externa chegam a observabilidade existente.
- Erro, timeout, misconfiguration e resposta invalida falham fechado sem stack trace publico.
- Runtime local e provider `local_deterministic` continuam funcionando.
- Nenhum teste depende de provider real ou segredo.
- RAG/MCP/tools reais permanecem fora do escopo.
- Validacoes focadas, typecheck, scripts e greps de seguranca passam.

## 12. Riscos E Rollback

Riscos:

- runtime Agno real pode implementar parcialmente o contrato ou devolver provider/model divergentes;
- provider externo depende de credencial, cota, custo, latencia e disponibilidade no ambiente Agno;
- timeout pode ocorrer depois de o provider ter iniciado processamento, portanto nao se deve inferir ausencia de consumo em falha de rede;
- conteudo digitado pelo usuario pode conter dado sensivel mesmo apos sanitizacao basica;
- `output.text` e persistido funcionalmente como mensagem do Chat e deve seguir as mesmas regras de acesso da conversa;
- o contrato V1 foi endurecido para rejeitar identificadores/timestamps internos no contexto e runtimes antigos devem ser atualizados antes da ativacao.

Rollback operacional:

```env
RUNTIME_PROVIDER=local
AGNO_RUNTIME_HTTP_ENABLED=false
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
```

O rollback volta novos runs ao caminho local. Runs e mensagens ja persistidos permanecem como evidencia funcional/auditavel e nao devem ser apagados automaticamente.

