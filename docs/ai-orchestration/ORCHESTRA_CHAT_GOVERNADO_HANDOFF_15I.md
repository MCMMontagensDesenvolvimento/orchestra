# Orchestra Chat Governado - Handoff Tecnico 15I

## 1. Objetivo

A Fase 15I consolida a trilha de Chat/AgentRun governado entregue entre as Fases 15C e 15H e serve como handoff tecnico para as proximas frentes. Este documento registra o estado final verificavel, a arquitetura vigente, as evidencias operacionais, as garantias de seguranca, os limites atuais e os criterios de aceite da consolidacao.

Esta fase e exclusivamente documental. Ela nao cria feature produtiva, nao altera contratos de runtime, frontend, backend produtivo ou schema Prisma e nao muda defaults operacionais. O objetivo e deixar explicito tanto o que ja esta pronto quanto o trabalho ainda necessario para uma integracao total com Agno.

## 2. Linha Do Tempo Das Fases 15C A 15H

### 15C - Conversas Persistentes

- Commit principal: `efd09f0 feat(chat): add persistent conversations`.
- Merge na `main`: `85e768c Merge branch 'fase-15c-conversas-persistentes-chat'`.
- Escopo entregue: conversas privadas e persistentes por usuario, mensagens persistidas, arquivamento logico, endpoints de conversa, Chat frontend conectado ao backend e resposta do assistant vinculada ao `AgentRun`.
- Arquivos relevantes:
  - `docs/ai-orchestration/ORCHESTRA_CHAT_CONVERSAS_PERSISTENTES_15C.md`;
  - `backend/src/modules/chat-conversations/`;
  - `backend/prisma/schema.prisma` e migration da fase;
  - `backend/tests/api/chat-conversations.test.ts`;
  - `frontend/src/pages/Chat/ChatPage.tsx`;
  - `frontend/src/services/chat.service.ts`;
  - `frontend/src/hooks/queries/useChatConversations.ts`.

### 15D - Contexto Conversacional Governado

- Commit principal: `3638558 feat(chat): add governed conversation context`.
- Merge na `main`: `a3e8449 Merge branch 'fase-15d-contexto-conversacional-governado'`.
- Escopo entregue: selecao de historico anterior exclusivamente pelo backend, isolamento da mensagem atual, limites `CHAT_CONTEXT_*`, sanitizacao, roles permitidas `user`/`assistant`, propagacao em `RuntimeExecutionContext` e resumos quantitativos seguros.
- Arquivos relevantes:
  - `docs/ai-orchestration/ORCHESTRA_CHAT_CONTEXTO_CONVERSACIONAL_15D.md`;
  - `backend/src/modules/chat-conversations/chat-conversation-context.ts`;
  - `backend/src/modules/chat-conversations/chat-conversations.service.ts`;
  - `backend/src/modules/runtime/runtime.context.ts`;
  - `backend/src/modules/runtime/runtime.assistant-spec.builder.ts`;
  - `backend/src/modules/runtime/runtime.agno-http-adapter.ts`;
  - `backend/tests/unit/chat-conversation-context.test.ts`;
  - testes de contrato, builder e adapters de runtime.

### 15E - Homologacao Local Do Contexto

- Commit principal: `188a18a docs(chat): add governed context homologation runbook`.
- Merge na `main`: `1de61fb Merge branch 'fase-15e-homologacao-chat-contexto-governado'`.
- Escopo entregue: runbook de homologacao funcional local, smoke do contexto, roteiro para primeira e segunda mensagens, consultas SQL seguras, evidencias de `conversationContextSummary` e eventos `runtime_context_*`.
- Arquivos relevantes:
  - `docs/ai-orchestration/ORCHESTRA_CHAT_HOMOLOGACAO_CONTEXTO_15E.md`;
  - `scripts/smoke-chat-contexto-15e.sh`;
  - `backend/tests/unit/runtime-smoke-scripts.test.ts`.

### 15F - Provider Externo Governado

- Commit principal: `62274d1 feat(chat): add governed external provider context`.
- Merge na `main`: `b7a97ce Merge branch 'fase-15f-provider-externo-governado'`.
- Escopo entregue: contexto conversacional governado repassado ao provider LLM externo selecionado pela policy do assistant, com system message, historico anterior e input atual em ordem controlada; caminho local deterministico e fallback governado preservados.
- Arquivos relevantes:
  - `docs/ai-orchestration/ORCHESTRA_CHAT_PROVIDER_EXTERNO_GOVERNADO_15F.md`;
  - `backend/src/modules/llm/llm.types.ts`;
  - `backend/src/modules/llm/providers/openai-llm-provider.ts`;
  - `backend/src/modules/llm/providers/local-llm-provider.ts`;
  - `backend/src/modules/runtime/runtime.local-adapter.ts`;
  - `backend/tests/unit/openai-llm-provider-context.test.ts`;
  - `backend/tests/runtime/runtime-local-provider-context.test.ts`.

### 15G - Observabilidade Governada

- Commit principal: `a194efe feat(chat): add governed runtime observability`.
- Merge na `main`: `63c9c2b Merge branch 'fase-15g-observabilidade-chat-runtime'`.
- Escopo entregue: UI existente do Chat/AgentRun com secoes de Runtime, Contexto conversacional, Provider LLM e Eventos, usando somente allowlist, flags, codigos e contadores seguros.
- Arquivos relevantes:
  - `docs/ai-orchestration/ORCHESTRA_CHAT_OBSERVABILIDADE_GOVERNADA_15G.md`;
  - `frontend/src/lib/agent-run-llm-metadata.ts`;
  - `frontend/src/pages/Chat/ChatPage.tsx`;
  - `frontend/src/test/agent-run-llm-metadata.test.ts`;
  - `frontend/src/test/real-mode-pages.test.tsx`;
  - `backend/tests/api/runtime.test.ts`.

### 15H - Homologacao Operacional Com Provider Real

- Commit principal: `3a096a9 docs(chat): add real provider homologation runbook`.
- Merge na `main`: `ef6dfbc Merge branch 'fase-15h-homologacao-provider-real'`.
- Escopo entregue: runbook operacional do fluxo ate provider externo real, preflight seguro, modos `--check`, `--dry-run` e `--checklist`, roteiro manual e criterios de evidencia sem chamada automatica ao provider nem envio automatico de mensagem.
- Arquivos relevantes:
  - `docs/ai-orchestration/ORCHESTRA_CHAT_HOMOLOGACAO_PROVIDER_REAL_15H.md`;
  - `scripts/smoke-chat-provider-real-15h.sh`;
  - `backend/tests/unit/runtime-smoke-scripts.test.ts`.

## 3. Arquitetura Final Da Trilha 15

O fluxo consolidado e:

```txt
Chat frontend
  -> backend Chat API
    -> ConversationMessage
      -> AgentRun
        -> RuntimeExecutionContext
          -> runtime adapter
            -> LLM provider ou runtime HTTP
              -> eventos/metadata do AgentRun
                -> observabilidade allowlisted na UI
```

Responsabilidades e fronteiras:

1. O frontend chama somente a API do Orquestra. Ele nao monta historico, prompt ou contexto e envia somente `{ input }` no body da mensagem.
2. O backend valida tenant, workspace, assistant, owner da conversa e estado de arquivamento.
3. O backend persiste a mensagem atual do usuario como `ConversationMessage`.
4. O backend recupera somente mensagens anteriores da mesma conversa e do mesmo escopo autenticado, excluindo explicitamente a mensagem atual.
5. O backend aplica roles permitidas, limites de quantidade e caracteres, sanitizacao e truncamento para montar o contexto governado.
6. O novo `AgentRun` mantem a mensagem atual em `input`; o historico anterior segue separado no `RuntimeExecutionContext`.
7. O runtime adapter recebe contexto ja selecionado e governado. Conforme a configuracao, o caminho pode permanecer local, chamar um provider LLM externo permitido ou usar o runtime HTTP Agno-compatible.
8. A mensagem do assistant e persistida e vinculada ao `AgentRun`.
9. Eventos e metadata publicos registram somente estado, flags, codigos e contadores. A UI reaplica uma allowlist antes de apresentar Runtime, Contexto conversacional, Provider LLM e Eventos.

O Orquestra permanece como control plane de identidade, escopo, persistencia, selecao de contexto, policy, limites, auditoria e exposicao publica. Nenhum runtime externo recebe autoridade para reconstruir livremente o historico da conversa.

## 4. Estado Real Do Chat Hoje

- O Chat ja e real e persistente: conversas e mensagens ficam registradas com isolamento por tenant, workspace, assistant e owner.
- O Chat ja cria um `AgentRun` governado pelo backend para cada mensagem enviada e vincula a resposta persistida a esse run.
- O Chat ja monta contexto conversacional governado a partir do historico anterior, com exclusao do input atual, sanitizacao e limites.
- O Chat ja tem observabilidade segura na UI, baseada em flags, contadores, status e campos allowlisted.
- O Chat pode usar provider externo real quando variaveis de ambiente, policy do assistant, segredo operacional, cota e autorizacao de custo permitirem.
- O caminho local deterministico continua disponivel como baseline seguro.
- O caminho Agno HTTP ja existe e foi homologado minimamente no MVP tecnico, mas ainda nao representa integracao total com todos os recursos do Agno.

Assim, o estado atual nao e um mock de tela: existe persistencia, execucao de `AgentRun`, contexto governado, caminhos reais de runtime/provider e observabilidade. Ao mesmo tempo, a escolha e a abrangencia do executor continuam dependentes da configuracao e das fronteiras descritas abaixo.

## 5. O Que Ainda Nao Significa "Agno Totalmente Integrado"

- Agno ainda nao e o executor unico e final de todas as conversas.
- Nem toda execucao de LLM real passa pelo Agno; o caminho de provider externo do runtime local tambem existe.
- RAG real no Chat executado via Agno ainda precisa de fase propria, com retrieval, autorizacao, citations e limites homologados ponta a ponta.
- MCP e tools reais via Agno ainda precisam de fase propria, com gateway governado, allowlist, autorizacao, auditoria e limites de chamadas.
- Agentes on-premise semelhantes ao Agno ou OpenCrow ainda precisam de runtime registry e adapters com contrato, readiness e comportamento fail-closed.
- A homologacao de provider real dentro do Agno ainda precisa ser executada e documentada.
- A observabilidade cross-runtime ainda pode evoluir para correlacao uniforme, quotas, custos, latencia, erros e auditoria entre executores.

A integracao total exige que essas capacidades sejam implementadas e homologadas sem transferir para o runtime externo as decisoes de identidade, RBAC, escopo, policy e exposicao publica que pertencem ao Orquestra.

## 6. Seguranca E Governanca Preservadas

As seguintes garantias devem permanecer invariantes:

- nao expor historico bruto em eventos ou metadata publicos;
- nao expor `conversationContext.messages`;
- nao expor `messageId` interno das mensagens usadas como contexto;
- nao expor `createdAt` interno das mensagens usadas como contexto;
- nao expor API key, header `Authorization`, cookies, secrets, credentials ou tokens;
- nao expor payload bruto de provider ou runtime;
- nao expor prompt bruto, system prompt interno ou resposta bruta em metadata tecnica;
- manter eventos e metadata quantitativos, com flags, contadores, codigos seguros e limites aplicados;
- manter allowlist explicita na UI, mesmo quando o backend ja devolve metadata sanitizada;
- falhar fechado diante de provider, runtime, policy ou configuracao externa invalida, sem fallback silencioso nao autorizado.

As mensagens completas permanecem na persistencia funcional da conversa, dentro do escopo autenticado. Isso nao autoriza sua copia para eventos, logs, evidencias, metadata publica ou screenshots de homologacao.

## 7. Scripts E Runbooks Existentes

- `scripts/smoke-chat-contexto-15e.sh`: smoke local do caminho de contexto conversacional governado e do runtime HTTP minimo.
- `scripts/smoke-chat-provider-real-15h.sh`: preflight seguro da homologacao com provider real, com `--check`, `--dry-run` e `--checklist`, sem chamada automatica ao provider.
- `docs/ai-orchestration/ORCHESTRA_CHAT_CONTEXTO_CONVERSACIONAL_15D.md`: contrato funcional, selecao, limites, sanitizacao e propagacao do contexto.
- `docs/ai-orchestration/ORCHESTRA_CHAT_HOMOLOGACAO_CONTEXTO_15E.md`: roteiro funcional local, primeira/segunda mensagens, consultas e evidencias quantitativas.
- `docs/ai-orchestration/ORCHESTRA_CHAT_PROVIDER_EXTERNO_GOVERNADO_15F.md`: integracao do contexto governado ao provider externo e comportamento por policy.
- `docs/ai-orchestration/ORCHESTRA_CHAT_OBSERVABILIDADE_GOVERNADA_15G.md`: campos visiveis, allowlist da UI, campos proibidos e homologacao visual.
- `docs/ai-orchestration/ORCHESTRA_CHAT_HOMOLOGACAO_PROVIDER_REAL_15H.md`: roteiro operacional ponta a ponta, pre-condicoes, cenarios, validacao segura e checklist de evidencias.

Esses artefatos sao complementares: o smoke 15E valida o baseline local e o contrato de contexto; o smoke 15H valida prontidao e configuracao sem consumir provider; os runbooks orientam a homologacao manual quando banco, backend, frontend, runtime e autorizacoes operacionais estiverem disponiveis.

## 8. Validacoes Tecnicas Consolidadas

Conjunto recomendado para validar a trilha completa:

```bash
npm --prefix backend run typecheck
npm --prefix frontend run typecheck
npm --prefix backend run test -- --run chat
npm --prefix backend run test -- --run runtime
npm --prefix backend run test -- --run runtime-smoke-scripts
npm --prefix frontend run test -- --run real-mode-pages
npm --prefix frontend run test -- --run agent-run-llm-metadata
bash -n scripts/smoke-chat-contexto-15e.sh
bash -n scripts/smoke-chat-provider-real-15h.sh
scripts/smoke-chat-provider-real-15h.sh --dry-run
git diff --check
```

Evidencias esperadas:

- typecheck de backend e frontend sem erro;
- suites focadas de Chat, runtime, smoke scripts e observabilidade da UI aprovadas;
- scripts 15E e 15H sintaticamente validos;
- `--dry-run` do smoke 15H sem chamada externa e sem envio de mensagem;
- primeira mensagem sem historico anterior selecionado;
- segunda mensagem com resumo quantitativo coerente e input atual fora do historico;
- `AgentRun` e mensagem do assistant vinculados;
- UI exibindo somente Runtime, Contexto conversacional, Provider LLM e Eventos allowlisted;
- diff documental sem erro de whitespace.

Para uma mudanca exclusivamente documental na 15I, a validacao minima de entrega e:

```bash
git status --short
git diff --check
bash -n scripts/smoke-chat-contexto-15e.sh
bash -n scripts/smoke-chat-provider-real-15h.sh
npm --prefix backend run typecheck
```

A suite completa permanece recomendada para alteracoes futuras de runtime, provider, Chat API ou UI, mas nao e requisito para esta consolidacao documental.

## 9. Riscos E Pendencias

- Provider real depende de segredo provisionado fora do repositorio, policy explicita, autorizacao de custo, cota e disponibilidade externa.
- O Agno HTTP minimo foi validado como fronteira de runtime, mas nao equivale a full agent orchestration.
- RAG, MCP e tools reais precisam de fases proprias, contratos governados e homologacao operacional especifica.
- Evidencias, logs, screenshots e consultas de homologacao nao podem conter historico bruto ou dados sensiveis digitados pelo usuario.
- Configuracao incorreta deve falhar fechado; um fallback so pode ocorrer quando estiver explicitamente permitido pela policy.
- O smoke 15H e um preflight seguro e nao substitui a homologacao manual real, que exige decisao humana antes de qualquer consumo do provider.
- O contexto recente e limitado e sanitizado, mas nao implementa memoria longa, sumarizacao governada ou classificacao DLP completa.
- Dependencias externas introduzem riscos de latencia, indisponibilidade, rate limit e variacao de custo que ainda precisam de observabilidade cross-runtime consolidada.

## 10. Recomendacao Para A Fase 16

### Fase 16A - Agno Como Executor LLM Real Ponta A Ponta No Chat

Conectar e homologar o provider real dentro do runtime Agno, mantendo backend-only, contrato versionado, policy explicita, timeout, erro normalizado, fail-closed e caminho local de rollback.

### Fase 16B - RAG Governado Via Agno No Chat

Integrar retrieval autorizado, contexto resolvido, citations, limites e evidencias quantitativas ao fluxo real de conversa executado pelo Agno.

### Fase 16C - MCP/Tools Governados Via Agno No Chat

Implementar gateway de execucao, allowlist, autorizacao por tool, limites de chamadas, idempotencia quando aplicavel e auditoria sanitizada, sem descoberta ou execucao livre pelo runtime.

### Fase 16D - Runtime Registry Para Agentes On-Premise E Adapters Agno/OpenCrow-Like

Generalizar discovery, readiness, capabilities e selecao de executores por adapters versionados, preservando scoping e defaults fail-closed.

### Fase 16E - Observabilidade, Quotas E Auditoria Cross-Runtime

Uniformizar correlacao, usage, custo, latencia, status, error codes, quotas e trilha auditavel entre runtime local, providers externos, Agno e futuros executores on-premise.

### Fase 16F - Homologacao Operacional Agno Full-Stack

Executar runbook ponta a ponta com Chat persistente, contexto, provider real no Agno, RAG, MCP/tools, observabilidade, cenarios de falha, rollback e evidencias sem conteudo sensivel.

Cada subfase deve ter feature flag ou policy explicita, testes focados, criterios de rollback e evidencia segura. A progressao recomendada e sequencial: primeiro consolidar o executor LLM real, depois adicionar RAG e tools e, por fim, ampliar runtimes e observabilidade.

## 11. Criterios De Aceite Da 15I

- Documento `ORCHESTRA_CHAT_GOVERNADO_HANDOFF_15I.md` criado.
- `docs/ai-orchestration/README.md` atualizado com resumo e referencia para a Fase 15I.
- Nenhuma feature produtiva nova criada.
- Nenhum runtime, frontend, backend produtivo ou schema Prisma alterado.
- Linha do tempo 15C-15H rastreavel por commits, merges e artefatos relevantes.
- Arquitetura e estado real do Chat documentados sem sugerir que Agno ja esta totalmente integrado.
- Limites, riscos, garantias de seguranca, evidencias e proximos passos registrados.
- Validacoes documentais e tecnicas minimas da entrega aprovadas.
- Nenhum segredo real ou conteudo bruto de conversa incluido no handoff.

