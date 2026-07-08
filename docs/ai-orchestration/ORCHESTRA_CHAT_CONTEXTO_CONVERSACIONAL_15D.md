# Orchestra Chat - Contexto Conversacional Governado 15D

## Objetivo

A Fase 15D adiciona contexto conversacional governado ao caminho `Chat -> AgentRun -> Runtime`. A partir de conversas e mensagens persistidas na 15C, o backend Orchestra passa a selecionar um recorte seguro do historico anterior da conversa e a envia-lo ao runtime como contexto separado da nova mensagem do usuario.

O frontend continua enviando somente a nova mensagem. A decisao de usar historico, os limites, a sanitizacao, o isolamento e os metadados de auditoria ficam no backend.

## Escopo Implementado

O backend agora monta contexto conversacional em `backend/src/modules/chat-conversations/chat-conversation-context.ts`.

O fluxo de `POST /api/v1/chat/conversations/:conversationId/messages`:

1. valida conversa por tenant, workspace, assistant e owner autenticado;
2. bloqueia conversa arquivada antes de criar qualquer mensagem nova;
3. persiste a nova `ConversationMessage` com `role = user`;
4. busca uma janela limitada de mensagens anteriores da mesma conversa, excluindo a mensagem atual;
5. monta o contexto governado com roles permitidos, limites e sanitizacao;
6. cria o `AgentRun` mantendo `input` como a nova mensagem do usuario;
7. passa o historico anterior apenas em opcao interna backend-only para o runtime;
8. registra metadados quantitativos seguros em `conversationContextSummary`;
9. persiste a mensagem do assistente vinculada ao `AgentRun`.

## O Que Nao Foi Implementado

- Memoria longa.
- Sumarizacao por IA.
- Embeddings de conversa.
- Busca semantica em historico de conversa.
- Streaming.
- Compartilhamento real de conversas.
- Exclusao fisica.
- Configuracao de quantidade de mensagens no frontend.
- Chamada direta do frontend para runtime, Agno, providers, MCP ou tools.

## Selecao Do Contexto

O contexto usa apenas mensagens persistidas da conversa atual e do escopo autenticado:

- `tenantId`
- `workspaceId`
- `assistantId`
- `conversationId`
- `ownerUserId`

A query do repository busca somente roles `user` e `assistant`, com `take = maxMessages + 1`, ordenacao decrescente por data para limitar a leitura, e exclusao explicita da mensagem atual por `excludeMessageId`.

O helper revalida o escopo, descarta roles fora de `user`/`assistant`, remove `system`, exige que mensagens `user` pertençam ao owner da conversa, ordena o recorte final em ordem cronologica e retorna somente:

- `messageId`
- `role`
- `content`
- `createdAt`

## Limites Aplicados

Defaults seguros no backend:

```env
CHAT_CONTEXT_ENABLED=true
CHAT_CONTEXT_MAX_MESSAGES=12
CHAT_CONTEXT_MAX_MESSAGE_CHARS=1200
CHAT_CONTEXT_MAX_TOTAL_CHARS=6000
```

Os valores sao lidos em `backend/src/config/env.ts` e documentados em `backend/.env.example`. O helper tambem aplica tetos internos para impedir valores efetivamente ilimitados:

- ate 50 mensagens;
- ate 4000 caracteres por mensagem;
- ate 20000 caracteres totais.

O contexto final usa a janela mais recente que cabe nos limites e preserva ordem cronologica no payload enviado ao runtime.

## Sanitizacao

A sanitizacao:

- normaliza espacos excessivos;
- trunca conteudo por mensagem;
- aplica limite total de caracteres;
- redige padroes obvios de segredo, como `Bearer ...`, `sk-...`, credenciais em URL e pares simples `apiKey/password/secret`;
- descarta `system`;
- descarta mensagens fora do escopo;
- nao inclui metadata bruta de mensagem;
- nao inclui eventos brutos;
- nao inclui payload bruto de `AgentRun`;
- nao inclui prompt interno ou system prompt.

## Entrada No Runtime

O `AgentRun.input` continua sendo apenas a nova mensagem do usuario.

O historico anterior entra separado:

- no `RuntimeExecutionContext`, como `conversationContext`;
- no contrato `AssistantRuntimeSpecV1`, como campo opcional `conversationContext`;
- no adapter `agno_http`, dentro do `RuntimeExecuteRequestV1`;
- no runtime HTTP minimo, que aceita o campo e devolve apenas metricas seguras.

O contrato valida:

- roles `user` e `assistant`;
- `createdAt` ISO datetime;
- tamanho maximo de cada mensagem;
- total de caracteres coerente com o summary;
- quantidade de mensagens coerente com o summary;
- ausencia de campos/valores sensiveis.

## Eventos E Auditoria

O backend registra apenas metadados quantitativos:

- se o contexto foi incluido;
- quantidade de mensagens;
- total de caracteres;
- se houve truncamento;
- limites aplicados.

O conteudo completo do contexto nao e registrado em eventos publicos. O evento `run.conversation_context_selected` no `AgentRun` e os eventos normalizados de runtime carregam apenas o resumo seguro.

## Frontend

O frontend nao monta historico e nao envia contexto. `chatService.sendMessage` segue chamando o endpoint de conversa com apenas:

```ts
{ input }
```

`ChatPage` passa apenas `conversationId` e `input` para a mutation. Nao ha chamada direta a runtime externo, `/execute`, Agno HTTP, provider, MCP ou tools.

## Persistencia Versus Contexto

Persistencia de conversa e o registro completo das mensagens em `Conversation` e `ConversationMessage`, protegido por tenant/workspace/assistant/owner e arquivamento logico.

Contexto enviado ao runtime e um recorte temporario, calculado no momento do envio, limitado e sanitizado. Nesta fase nao ha snapshot persistido do contexto completo; o `AgentRun` persiste apenas metadata segura de resumo.

## Como Validar

Validacoes principais:

```bash
npm --prefix backend run typecheck
npm --prefix backend run lint
npm --prefix backend run build
npm --prefix backend run test -- --run tests/unit/chat-conversation-context.test.ts
npm --prefix backend run test -- --run tests/api/chat-conversations.test.ts
npm --prefix backend run test -- --run tests/unit/runtime-contract.test.ts
npm --prefix backend run test -- --run tests/unit/runtime-assistant-spec-builder.test.ts
npm --prefix backend run test -- --run tests/runtime/runtime-agno-http-adapter.test.ts
npm --prefix backend run test -- --run tests/runtime/agno-runtime-http.test.ts
npm --prefix backend run test -- --run tests/api/agent-runs.test.ts
npm --prefix frontend run test
```

Checks de seguranca recomendados:

```bash
grep -RInE "AGNO_RUNTIME_HTTP|127.0.0.1:8091|localhost:8091|/execute" frontend/src || true
grep -RInE "conversationContext|contextMessages|history|messagesToRuntime|previousMessages|runtimeContext" frontend/src/pages/Chat frontend/src/services/chat.service.ts frontend/src/hooks | sed -n '1,260p'
grep -RInE "apiKey|secret|password|authorization|cookie|rawPayload|systemPrompt|fullMetadata|fullContext" backend/src/modules/chat-conversations backend/src/modules/agent-runs backend/src/modules/runtime frontend/src/pages/Chat frontend/src/services/chat.service.ts || true
```

## Riscos E Proximos Passos

Riscos remanescentes:

- conteudo historico pode conter dados sensiveis digitados pelo usuario; a fase reduz risco com limites, redacao basica e contrato fail-closed, mas nao implementa classificacao DLP;
- o contexto e recorte recente, sem sumarizacao semantica;
- conversas muito longas dependem de proximas fases para memoria/sumarizacao governada.

Proximos passos recomendados:

- avaliar politica por assistant para habilitar/desabilitar contexto;
- adicionar DLP/classificacao antes do runtime;
- desenhar memoria longa governada separada do historico bruto;
- estudar sumarizacao deterministica/auditavel, com snapshot seguro e rollback.
