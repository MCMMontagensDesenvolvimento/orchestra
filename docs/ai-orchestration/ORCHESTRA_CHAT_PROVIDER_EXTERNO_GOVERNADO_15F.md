# Orchestra Chat - Provider Externo Governado 15F

## Objetivo

A Fase 15F integra o contexto conversacional governado do Chat ao caminho de provider LLM externo usado pelo `AgentRun`, preservando o contrato publico do frontend e os limites de seguranca das Fases 15D/15E.

O frontend continua enviando somente:

```ts
{ input }
```

O historico anterior continua sendo recuperado, limitado, sanitizado e anexado apenas pelo backend.

## Fluxo Implementado

Fluxo local governado:

```txt
Chat frontend
  -> POST /api/v1/chat/conversations/:conversationId/messages { input }
  -> backend persiste mensagem atual
  -> backend busca mensagens anteriores da mesma conversa
  -> backend monta contexto conversacional governado
  -> AgentRun cria RuntimeExecutionContext
  -> runtime local seleciona LLM provider por policy do assistant
  -> provider externo recebe input atual separado do historico governado
```

No caminho `agno_http`, o `AssistantRuntimeSpecV1` continua recebendo `conversationContext` em campo separado. No caminho de provider LLM externo, o runtime local repassa o contexto por `conversationContext` no request interno de LLM, sem incluir `messageId` ou `createdAt`.

## Provider Externo

O provider OpenAI existente foi completado para transformar o contexto governado em mensagens anteriores do request externo:

- primeira mensagem: instrucoes/sistema governadas;
- mensagens intermediarias: historico anterior governado, apenas `{ role, content }`;
- ultima mensagem: `input` atual do usuario.

Isso preserva a separacao entre input atual e historico. O provider externo nao recebe IDs internos de mensagens, metadata bruta de conversa, payload bruto de eventos, cookies, headers de usuario ou segredos.

## Configuracao

As envs ja existentes continuam sendo usadas:

```env
RUNTIME_PROVIDER=local
RUNTIME_ADAPTER_ENABLED=true
CHAT_CONTEXT_ENABLED=true
CHAT_CONTEXT_MAX_MESSAGES=12
CHAT_CONTEXT_MAX_MESSAGE_CHARS=1200
CHAT_CONTEXT_MAX_TOTAL_CHARS=6000

LLM_PROVIDERS_ENABLED=true
LLM_EXECUTION_ENABLED=true
LLM_DEFAULT_PROVIDER=local_deterministic

OPENAI_ENABLED=false
OPENAI_EXECUTION_ENABLED=false
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_DEFAULT_MODEL=
```

Para usar OpenAI em ambiente controlado, a policy do assistant precisa permitir provider externo e o backend precisa ter configuracao operacional. Sem configuracao completa, o fluxo falha fechado com erro governado, sem chamada externa e sem expor segredo.

## Policy Do Assistant

O runtime local so seleciona OpenAI quando:

- o modo nao e `sandbox`;
- `allowExternalLlmProviders = true`;
- `defaultLlmProvider = openai`;
- `allowedLlmProviders` contem `openai`;
- a versao do assistant pode apontar `modelProvider = openai`.

Em `sandbox`, o runtime continua forçando `local_deterministic`.

## Observabilidade

Eventos e metadata publica continuam quantitativos:

- provider runtime selecionado;
- provider LLM selecionado;
- se provider externo foi chamado;
- quantidade de mensagens de contexto;
- total de caracteres;
- truncamento;
- hashes de input/output quando aplicavel;
- codigo de erro governado quando aplicavel.

Nao deve aparecer em evento publico:

- conteudo completo do historico;
- `messageId`;
- `createdAt` das mensagens de contexto;
- cookie;
- header `Authorization`;
- API key;
- payload bruto do provider;
- prompt bruto;
- output bruto completo.

## Testes Automatizados

Testes adicionados:

- `backend/tests/runtime/runtime-local-provider-context.test.ts`
  - prova que o runtime local repassa contexto governado ao fake provider externo;
  - prova que o request interno para LLM nao inclui `messageId` nem `createdAt`;
  - prova que eventos publicos ficam sem conteudo do historico.

- `backend/tests/unit/openai-llm-provider-context.test.ts`
  - prova que o provider OpenAI monta request externo com historico anterior separado do input atual;
  - prova que a metadata do resultado contem apenas resumo quantitativo;
  - prova que o request externo nao contem IDs internos de mensagens.

## Smoke

Nao foi criado smoke novo nesta fase. A integracao com provider externo real depende de credencial operacional e policy de assistant, entao a cobertura automatizada fica em testes com fake/stub. O smoke da 15E continua valido para o runtime HTTP minimo e nao exige segredo real.

## Criterios De Aceite

- Frontend permanece enviando apenas `{ input }`.
- Contexto conversacional permanece backend-only.
- Mensagem atual continua excluida do historico anexado.
- Roles permitidas continuam `user` e `assistant`.
- Limites `CHAT_CONTEXT_*` continuam aplicados antes do runtime/provider.
- Provider externo recebe contexto governado em teste.
- Runtime local deterministico continua funcionando sem provider externo configurado.
- Runtime HTTP minimo da 15E nao e alterado.
- Eventos publicos nao vazam conteudo do historico nem IDs internos de mensagem.
- Nenhum segredo real e versionado em codigo, teste ou documentacao.

## Homologacao Manual Recomendada

Para homologar com provider real em ambiente controlado:

1. configurar envs de OpenAI no backend sem versionar segredo;
2. configurar policy do assistant permitindo `openai`;
3. publicar ou testar o assistant em modo permitido pela policy;
4. iniciar uma conversa no Chat;
5. enviar uma primeira mensagem;
6. enviar uma segunda mensagem na mesma conversa;
7. validar em `agent_runs.metadata.runtime` os campos `conversationContext*`;
8. validar eventos sem conteudo bruto do historico;
9. confirmar que erros de provider retornam codigo governado sem stack trace ou segredo.
