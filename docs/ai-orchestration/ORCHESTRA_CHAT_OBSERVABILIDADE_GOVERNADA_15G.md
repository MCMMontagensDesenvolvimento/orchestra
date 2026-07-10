# Orchestra Chat - Observabilidade Governada 15G

## Objetivo

A Fase 15G adiciona observabilidade governada ao fluxo `Chat -> AgentRun -> runtime -> provider`, permitindo inspecionar uma execucao do Chat sem expor conteudo sensivel do historico conversacional ou payload bruto de provider.

A entrega usa a tela existente do Chat e os endpoints existentes de `AgentRun`/eventos. Nao foi criado endpoint novo, nao houve migration Prisma e o contrato publico do envio de mensagem permanece:

```ts
{ input }
```

O frontend nao monta historico, nao envia `conversationContext`, nao envia IDs internos de mensagens e nao chama runtime/provider diretamente.

## Onde A Observabilidade Aparece

Na tela de Chat, cada resposta do assistente vinculada a um `AgentRun` continua exibindo `Detalhes tecnicos`. Dentro desse bloco, a Fase 15G separa a leitura em secoes:

- `Runtime`
- `Contexto conversacional`
- `Provider LLM`
- `Eventos`

A secao de eventos continua carregada sob demanda pela API existente de eventos do `AgentRun`.

## Campos Visiveis

Campos de runtime:

- `runId`
- `traceId`
- `requestId`
- `status`
- `mode`
- `source`
- `runtime provider`
- `protocolVersion`
- `specVersion`
- `inputHash`, quando disponivel
- `outputHash`, quando disponivel
- `errorCode`, quando disponivel
- `latencyMs`
- `externalProviderCalled`
- `externalMcpCalled`
- `toolCallsExecuted`
- `ragSourceCount`
- `ragContextChars`

Campos de contexto conversacional:

- contexto anexado: `true`/`false`
- quantidade de mensagens
- total de caracteres
- truncado: `true`/`false`
- limite de mensagens
- limite de caracteres por mensagem
- limite total de caracteres

Campos de provider LLM:

- `llmProvider`
- `model`
- `externalProviderCalled`
- `latencyMs`
- `providerStatus`
- motivo governado de selecao/bloqueio
- `simulated`
- `failClosed`

Eventos publicos podem exibir somente metadata allowlisted equivalente, incluindo o evento `run.conversation_context_selected` com os mesmos contadores governados.

## Campos Proibidos

A UI/trace nao deve exibir:

- conteudo bruto do historico conversacional;
- `conversationContext.messages`;
- `messageId` interno das mensagens de contexto;
- `createdAt` interno das mensagens de contexto;
- prompt bruto completo;
- output bruto completo alem do texto publico ja permitido pelo produto;
- payload bruto de provider;
- headers;
- `Authorization`;
- cookies;
- API key;
- `OPENAI_API_KEY`;
- `secret`;
- `token`;
- stacks ou detalhes internos de conexao.

Timestamps publicos de eventos do `AgentRun` continuam permitidos, pois nao sao `createdAt` interno das mensagens de contexto.

## Relacao Com 15D, 15E E 15F

- 15D: definiu que o backend seleciona, limita e sanitiza o historico anterior, persistindo apenas resumo quantitativo no `AgentRun`.
- 15E: documentou a homologacao local do fluxo `Chat -> AgentRun -> agno_http` com contexto governado.
- 15F: conectou o contexto governado ao provider LLM externo sem enviar IDs internos ou timestamps de mensagens ao provider.
- 15G: torna os metadados quantitativos visiveis na UI existente, sem mudar o fluxo de envio nem expor o conteudo do contexto.

## Homologacao Visual

1. Abrir um assistente publicado no Chat.
2. Criar ou selecionar uma conversa.
3. Enviar uma primeira mensagem.
4. Abrir `Detalhes tecnicos` na resposta do assistente.
5. Confirmar que `Contexto conversacional` aparece como avaliado, com `contexto anexado=false` ou `mensagens=0`.
6. Enviar uma segunda mensagem na mesma conversa.
7. Abrir `Detalhes tecnicos` da nova resposta.
8. Confirmar que `Contexto conversacional` mostra `contexto anexado=true`, quantidade de mensagens, caracteres e truncamento.
9. Confirmar em `Provider LLM` se o provider externo foi chamado ou bloqueado por policy.
10. Carregar eventos e confirmar que `run.conversation_context_selected` mostra apenas contadores.
11. Procurar visualmente por trechos da primeira mensagem dentro dos detalhes/eventos; eles nao devem aparecer como historico bruto.

## Criterios De Aceite

- Branch de fase limpa antes e depois das alteracoes intencionais.
- `frontend/src/services/chat.service.ts` continua enviando somente `{ input }`.
- A tela de Chat mostra runtime, contexto conversacional e provider LLM em secoes separadas.
- A UI mostra apenas contadores e flags de contexto.
- A UI nao mostra `conversationContext.messages`, `messageId`, `createdAt` de mensagens de contexto ou payload bruto de provider.
- O endpoint existente de eventos e suficiente; nenhum endpoint novo foi criado.
- Runtime local, `agno_http` e provider externo permanecem compativeis.
- Testes focados de helper/renderizacao passam.
- `git diff --check` passa.

## Validacoes Recomendadas

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test -- --run
bash -n scripts/smoke-chat-contexto-15e.sh
git diff --check
```

Greps de seguranca recomendados:

```bash
grep -RInE "conversationContext\.messages|messageId|createdAt" frontend/src/pages/Chat frontend/src/components/assistants frontend/src/lib/agent-run-llm-metadata.ts
grep -RInE "Authorization|apiKey|OPENAI_API_KEY|cookie|secret|token|rawProvider|rawPrompt|rawResponse" frontend/src/pages/Chat frontend/src/components/assistants frontend/src/lib/agent-run-llm-metadata.ts
grep -RIn "post<ApiEnvelope<SendChatMessageResponse>>(endpoints.chat.send(conversationId), { input })" frontend/src/services/chat.service.ts
```
