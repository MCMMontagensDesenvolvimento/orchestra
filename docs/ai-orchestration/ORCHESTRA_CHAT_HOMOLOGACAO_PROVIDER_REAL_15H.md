# Orchestra Chat - Homologacao Com Provider Real 15H

## 1. Objetivo

A Fase 15H formaliza a homologacao operacional ponta a ponta do fluxo:

```txt
Chat -> AgentRun -> runtime local -> provider LLM externo
```

O roteiro valida o contexto conversacional governado das Fases 15D/15F e a observabilidade da UI entregue na 15G. Esta fase nao cria feature produtiva, nao altera o contrato `{ input }` do frontend, nao altera runtime/provider e nao cria migration.

A execucao com provider real e manual e explicita porque exige identidade autenticada, policy de assistant publicada e cria mensagens persistentes na conversa escolhida. O smoke automatizavel faz apenas preflight, health e checklist; ele nunca envia mensagem nem chama provider externo.

## 2. Fronteiras E Pre-Condicoes

Pre-condicoes gerais:

- backend e banco saudaveis;
- frontend em modo real, nao mock;
- migrations existentes aplicadas;
- assistant publicado e com execucao `published` habilitada;
- usuario autorizado a abrir o Chat e consultar os detalhes do `AgentRun`;
- conversa descartavel ou ambiente de homologacao aprovado para persistir duas ou mais mensagens ficticias;
- `RUNTIME_PROVIDER=local`, pois a integracao da 15F com provider LLM externo esta no runtime local;
- `RUNTIME_ADAPTER_ENABLED=true`;
- contexto conversacional habilitado;
- nenhum segredo colocado em terminal compartilhado, documentacao, screenshot ou arquivo versionado.

Antes da rodada, registrar somente:

- ambiente e data/hora;
- commit/branch homologado;
- assistant e conversa por identificadores aprovados para evidencia interna;
- operador;
- cenario escolhido;
- valores nao secretos das flags;
- resultado do preflight.

Nao usar conversa de producao ou conteudo real de cliente para simular contexto/truncamento.

## 3. Variaveis De Ambiente

### 3.1 Baseline Local E Contexto

```env
RUNTIME_PROVIDER=local
RUNTIME_ADAPTER_ENABLED=true

CHAT_CONTEXT_ENABLED=true
CHAT_CONTEXT_MAX_MESSAGES=12
CHAT_CONTEXT_MAX_MESSAGE_CHARS=1200
CHAT_CONTEXT_MAX_TOTAL_CHARS=6000
```

Com a policy do assistant mantendo provider local, o runtime usa `local_deterministic` e nao exige credencial externa. `LLM_PROVIDERS_ENABLED` e `LLM_EXECUTION_ENABLED` podem continuar desligados nesse cenario porque o provider local deterministico permanece disponivel.

### 3.2 Provider OpenAI Real

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

OPENAI_ENABLED=true
OPENAI_EXECUTION_ENABLED=true
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_DEFAULT_MODEL=gpt-4o-mini
```

O valor de `OPENAI_API_KEY` deve ser injetado somente pelo mecanismo de segredos do ambiente. A linha vazia acima e intencional e nao representa uma credencial valida. Nao usar `echo`, `printenv`, `env`, dump de container ou modo shell trace para conferir a credencial.

O model deve ser um identificador permitido e disponivel na conta usada pela homologacao. O exemplo e apenas operacional e pode ser substituido sem alterar o runbook.

### 3.3 Policy Do Assistant

Para selecao do provider real, confirmar na policy persistida pela UI/API existente:

- modo de execucao `published`, nunca `sandbox`;
- `allowExternalLlmProviders = true`;
- `allowedLlmProviders` contem `openai`;
- `defaultLlmProvider = openai`;
- assistant publicado com publicacao ativa;
- execucao do assistant habilitada.

Em `sandbox`, o comportamento esperado e `local_deterministic` com motivo `sandbox_blocks_real_providers`, ainda que as envs externas estejam habilitadas.

## 4. Smoke Seguro E Preflight

O script da fase e:

```bash
scripts/smoke-chat-provider-real-15h.sh --dry-run
scripts/smoke-chat-provider-real-15h.sh --check
scripts/smoke-chat-provider-real-15h.sh --checklist
```

Comportamento:

- `--dry-run`: valida formato da URL, limites e gates no ambiente do processo, sem rede;
- `--check`: acrescenta `GET /health` no backend;
- `--checklist`: imprime somente o roteiro manual;
- valida presenca ou ausencia da credencial como booleano e nunca mostra seu valor;
- se a configuracao real estiver incompleta, marca o cenario como `SKIPPED`;
- se estiver completa, marca as gates como prontas, mas preserva a chamada real como passo manual;
- nao acessa endpoints autenticados;
- nao envia mensagens;
- nao cria conversa ou `AgentRun`;
- nao chama endpoint de teste LLM nem a API externa.

As envs avaliadas sao as do processo que executa o script. Se o backend roda em container, Kubernetes ou servico remoto, passar ao preflight apenas as flags nao secretas equivalentes e validar a configuracao efetiva pela UI de administracao/observabilidade. Nao copiar a credencial do backend para o shell somente para satisfazer o smoke; nesse caso a verificacao de presenca deve ser feita no secret manager e o cenario pode permanecer `SKIPPED` no script.

## 5. Validacao Do Modo Local/Fallback

O termo fallback neste roteiro significa selecao governada do provider local pela policy; nao significa fallback automatico depois de uma falha externa. O default seguro `RUNTIME_ALLOW_PROVIDER_FALLBACK=false` deve ser preservado.

1. Manter `RUNTIME_PROVIDER=local` e o adapter habilitado.
2. Manter a policy sem opt-in externo ou executar em `sandbox`.
3. Criar uma conversa descartavel pela UI.
4. Enviar uma mensagem ficticia curta.
5. Abrir `Detalhes tecnicos`.
6. Confirmar:
   - runtime provider `local`;
   - provider LLM `local_deterministic`/`Provider local`;
   - `externalProviderCalled=false`;
   - `simulated=true` quando exibido;
   - run concluido;
   - nenhum erro de provider externo.

Esse cenario prova que a homologacao nao torna o provider real obrigatorio e preserva o caminho deterministico.

## 6. Validacao Do Provider Externo Real

Executar somente em ambiente aprovado e com cota/custo conhecidos.

1. Executar o preflight sem expor a credencial.
2. Confirmar as quatro gates globais de LLM/OpenAI habilitadas.
3. Confirmar base URL e model sem dados de autenticacao embutidos.
4. Confirmar a policy do assistant descrita na secao 3.3.
5. Reiniciar/recarregar o backend apenas se a plataforma exigir para aplicar envs.
6. Abrir o Chat do assistant publicado.
7. Criar uma conversa descartavel e registrar que as mensagens serao persistidas.
8. Executar os testes de primeira e segunda mensagem abaixo.
9. Nao usar o endpoint isolado de test-generation como evidencia ponta a ponta; ele nao prova o fluxo do Chat nem o contexto da conversa.

Resultado esperado em uma execucao concluida:

- runtime `local`;
- provider LLM `openai`;
- motivo `assistant_policy_opt_in` ou rotulo governado equivalente;
- model esperado;
- `externalProviderCalled=true`;
- `failClosed` ausente/false;
- status concluido;
- latencia e hashes disponiveis quando aplicavel;
- resposta do assistant persistida e vinculada ao `AgentRun`.

## 7. Primeira Mensagem

Usar uma entrada ficticia curta, por exemplo:

```txt
Codigo ficticio: AZUL-7.
```

Na primeira resposta, confirmar:

- `source=chat-conversation`;
- run em modo `published` para o cenario real;
- contexto avaliado;
- contexto anexado `false` ou quantidade `0`;
- caracteres `0`;
- truncamento `false`;
- provider LLM conforme o cenario local ou real;
- evento `run.conversation_context_selected` com contadores, sem conteudo;
- nenhuma mensagem atual duplicada como historico anterior.

Guardar somente o `runId` e os campos quantitativos/operacionais autorizados.

## 8. Segunda Mensagem Com Contexto

Na mesma conversa, usar uma segunda entrada ficticia curta:

```txt
Qual foi o codigo ficticio?
```

Na segunda resposta, confirmar:

- novo `AgentRun` vinculado a mesma conversa;
- input atual permanece somente a segunda entrada;
- contexto anexado `true`;
- quantidade de mensagens maior que zero;
- caracteres maior que zero e menor ou igual ao limite total;
- truncamento coerente com os limites;
- provider LLM permanece o esperado;
- no cenario real, `externalProviderCalled=true`;
- evento de contexto mostra somente flags, contadores e limites;
- a resposta funcional pode demonstrar continuidade, mas nao copiar seu conteudo para evidencia tecnica compartilhada.

A quantidade pode incluir a mensagem do usuario e a resposta do assistant da rodada anterior. O valor exato depende das mensagens elegiveis e dos limites; a verificacao deve ser contra a conversa criada para a rodada, nao contra um numero global fixo.

## 9. Confirmacao Na UI 15G

Em `Detalhes tecnicos`, validar as secoes existentes.

### Runtime

- status, mode e source;
- runtime provider;
- trace/request/run IDs somente quando a politica de evidencia permitir;
- latencia e hashes;
- erro governado, sem stack.

### Contexto Conversacional

- contexto anexado;
- quantidade de mensagens;
- total de caracteres;
- truncado;
- limites de mensagens, por mensagem e total.

### Provider LLM

- `llmProvider`;
- model;
- `externalProviderCalled`;
- latencia;
- `providerStatus`;
- motivo de selecao/bloqueio;
- `simulated`;
- `failClosed`.

### Eventos

- carregar eventos sob demanda;
- localizar contexto avaliado, provider selecionado, geracao iniciada/concluida ou bloqueada e conclusao/falha do run;
- confirmar que textos de evento aparecem somente para tipos allowlisted;
- confirmar que metadata renderizada contem somente campos allowlisted.

Para provider desabilitado ou mal configurado, o esperado e erro governado, `externalProviderCalled=false` e `failClosed=true`. Para uma falha ocorrida depois do request externo, `externalProviderCalled` pode ser `true`; a evidencia deve diferenciar bloqueio antes da chamada de falha depois da chamada.

## 10. Validacao Segura No Banco

As consultas abaixo retornam apenas estado, flags, contadores, limites e identificadores operacionais. Substituir o valor local do `run_id` por um ID obtido na propria rodada e nao salvar o historico do terminal em evidencia publica.

```sql
\set run_id '00000000-0000-0000-0000-000000000000'

select
  id,
  status,
  mode,
  source,
  error_code,
  metadata#>>'{conversationContextSummary,included}' as context_included,
  metadata#>>'{conversationContextSummary,messageCount}' as context_message_count,
  metadata#>>'{conversationContextSummary,totalChars}' as context_total_chars,
  metadata#>>'{conversationContextSummary,truncated}' as context_truncated,
  metadata#>>'{runtime,provider}' as runtime_provider,
  metadata#>>'{runtime,adapterMetadata,llmProvider}' as llm_provider,
  metadata#>>'{runtime,adapterMetadata,llmModel}' as llm_model,
  metadata#>>'{runtime,adapterMetadata,externalProviderCalled}' as external_provider_called,
  metadata#>>'{runtime,adapterMetadata,llm,providerStatus}' as provider_status,
  metadata#>>'{runtime,adapterMetadata,llm,failedClosed}' as fail_closed
from agent_runs
where id = :'run_id'::uuid;
```

Eventos quantitativos:

```sql
select
  sequence,
  type,
  status,
  metadata#>>'{conversationContext,included}' as context_included,
  metadata#>>'{conversationContext,messageCount}' as context_message_count,
  metadata#>>'{conversationContext,totalChars}' as context_total_chars,
  metadata->>'llmProvider' as llm_provider,
  metadata->>'externalProviderCalled' as external_provider_called,
  metadata->>'providerStatus' as provider_status,
  metadata->>'failedClosed' as fail_closed,
  metadata->>'errorCode' as error_code
from agent_run_events
where agent_run_id = :'run_id'::uuid
order by sequence;
```

Checagem de chaves proibidas, retornando somente contagens:

```sql
select
  count(*) filter (
    where metadata::text ~* '"(messages|messageId|createdAt)"[[:space:]]*:'
  ) as context_internal_key_hits,
  count(*) filter (
    where metadata::text ~* '"(authorization|cookie|apiKey|secret|token|rawProvider|rawPrompt|rawResponse|prompt)"[[:space:]]*:'
  ) as sensitive_key_hits
from agent_run_events
where agent_run_id = :'run_id'::uuid;
```

As duas contagens devem ser zero. Nao usar `select *`, nao exportar `metadata` completo e nao consultar o conteudo de `conversation_messages` para produzir evidencia da 15H.

## 11. Validacao De Ausencia De Vazamentos

Inspecionar a UI, as respostas de `AgentRun`/eventos no DevTools e, se autorizado, as consultas quantitativas acima. Confirmar ausencia de:

- historico bruto;
- `conversationContext.messages`;
- `messageId` interno do contexto;
- `createdAt` interno das mensagens de contexto;
- `Authorization`;
- cookies;
- API key;
- `secret`;
- `token`;
- payload bruto de provider;
- prompt bruto;
- stack trace ou detalhe interno de conexao.

O texto publico da resposta atual do assistant e os timestamps publicos do `AgentRun`/eventos continuam permitidos pelo produto; eles nao devem ser confundidos com historico anexado ou timestamps internos das mensagens de contexto.

Regras para evidencias:

- preferir screenshot recortado das secoes quantitativas;
- ocultar IDs quando a evidencia sair do ambiente interno;
- nao salvar HAR completo;
- nao capturar aba de request headers;
- nao copiar env completo;
- nao habilitar shell trace;
- nao registrar request/response externo bruto.

## 12. Cenarios De Homologacao

### Cenario A - Provider Externo Desabilitado

Configuracao: OpenAI ou execucao global desligada e policy local.

Esperado: run concluido por `local_deterministic`, `externalProviderCalled=false`, contexto governado ainda avaliado/anexado conforme a rodada.

### Cenario B - Provider Externo Mal Configurado

Configuracao: `OPENAI_ENABLED=true`, policy seleciona OpenAI, mas model ou credencial ausente.

Esperado: status `misconfigured`, codigo governado como `OPENAI_PROVIDER_MISCONFIGURED`, `externalProviderCalled=false`, `failClosed=true`, sem request externo.

### Cenario C - Provider Habilitado E Permitido

Configuracao: gates globais completas, credencial no secret manager, assistant publicado e policy com opt-in.

Esperado: provider `openai`, motivo de policy, chamada externa confirmada, run concluido ou erro governado posterior a chamada.

### Cenario D - Segunda Mensagem Com Contexto

Executar duas mensagens ficticias na mesma conversa descartavel.

Esperado na segunda: contexto anexado, quantidade/caracteres positivos, input atual separado e nenhum conteudo historico nos detalhes/eventos.

### Cenario E - Truncamento

Em ambiente descartavel, reduzir temporariamente os limites antes de iniciar o backend:

```env
CHAT_CONTEXT_MAX_MESSAGES=2
CHAT_CONTEXT_MAX_MESSAGE_CHARS=24
CHAT_CONTEXT_MAX_TOTAL_CHARS=40
```

Criar uma conversa nova, avisar explicitamente que as mensagens serao persistidas e enviar mensagens ficticias suficientes para exceder ao menos um limite. Esperado: `truncated=true`, contadores dentro dos limites e nenhuma exposicao do trecho removido. Restaurar os valores homologados e reiniciar o backend depois da evidencia.

### Cenario F - Erro/Fail-Closed

Preferir um bloqueio anterior a chamada: policy aponta OpenAI e uma gate de execucao fica desligada, ou configuracao obrigatoria fica ausente.

Esperado: run bloqueado/falho com codigo governado, `externalProviderCalled=false`, `failClosed=true`, sem fallback automatico, sem stack e sem segredo. Falhas reais de rede/autenticacao so devem ser simuladas quando houver janela operacional aprovada; nesse caso a flag de chamada pode ser verdadeira.

## 13. Criterios De Aceite

A Fase 15H e aceita quando:

- preflight executa sem imprimir segredo;
- backend health responde com sucesso no modo `--check`;
- modo local conclui sem provider externo;
- provider mal configurado falha fechado antes da chamada;
- provider real e selecionado somente com gates e policy explicitas;
- primeira mensagem nao anexa historico anterior;
- segunda mensagem anexa contexto governado com contadores positivos;
- truncamento respeita os limites quando simulado;
- UI 15G exibe runtime, contexto, provider e eventos em secoes separadas;
- banco confirma os mesmos campos quantitativos;
- nenhuma evidencia contem campos proibidos ou payload bruto;
- frontend continua enviando somente `{ input }`;
- nenhum teste automatizado depende de credencial ou provider real;
- nenhuma mudanca produtiva, migration ou schema Prisma foi necessaria.

## 14. Checklist Final De Evidencias

- [ ] branch/commit e ambiente registrados;
- [ ] aprovacao de custo/janela para provider real registrada;
- [ ] health do backend aprovado;
- [ ] presenca da credencial confirmada sem mostrar valor;
- [ ] gates globais nao secretas registradas;
- [ ] policy publicada do assistant confirmada;
- [ ] conversa descartavel e persistencia de mensagens avisadas;
- [ ] primeira mensagem com contexto vazio registrada por contadores;
- [ ] segunda mensagem com contexto anexado registrada por contadores;
- [ ] runtime e provider LLM confirmados;
- [ ] `externalProviderCalled` coerente com o ponto da falha/sucesso;
- [ ] `providerStatus`, `failClosed` e erro governado confirmados quando aplicavel;
- [ ] truncamento validado ou marcado como nao executado;
- [ ] eventos allowlisted revisados;
- [ ] consultas SQL quantitativas revisadas;
- [ ] busca de chaves proibidas com zero ocorrencias inesperadas;
- [ ] screenshots sem headers, cookies, credenciais, prompt ou payload bruto;
- [ ] limites temporarios restaurados;
- [ ] resultado final aprovado/reprovado com justificativa curta.

## 15. Validacoes Tecnicas Da Entrega

```bash
bash -n scripts/smoke-chat-provider-real-15h.sh
bash -n scripts/smoke-chat-contexto-15e.sh
npm --prefix backend run typecheck
npm --prefix backend run test -- --run runtime-smoke-scripts
git diff --check
```

Greps de seguranca da fase:

```bash
grep -RInE "OPENAI_API_KEY=.*[^[:space:]]|sk-[A-Za-z0-9]|Authorization: Bearer|apiKey:|secret:|token:" docs/ai-orchestration scripts backend/tests/unit/runtime-smoke-scripts.test.ts || true
grep -RInE "conversationContext\.messages|messageId|createdAt" docs/ai-orchestration/ORCHESTRA_CHAT_HOMOLOGACAO_PROVIDER_REAL_15H.md scripts/smoke-chat-provider-real-15h.sh || true
```

As ocorrencias do segundo grep devem estar restritas a regras negativas e a consulta de contagem de chaves proibidas deste runbook. O primeiro grep nao deve revelar valor de credencial; a atribuicao vazia do exemplo e intencional.
