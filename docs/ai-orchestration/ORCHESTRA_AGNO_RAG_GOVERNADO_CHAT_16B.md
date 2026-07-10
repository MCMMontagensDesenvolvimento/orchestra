# Orchestra - RAG Governado no Chat via Agno 16B

## 1. Objetivo

A Fase 16B conecta a consulta RAG oficial do Orchestra ao fluxo de Chat executado por `agno_http`:

```txt
Chat -> AgentRun -> Orchestra RAG governado -> AssistantRuntimeSpecV1.rag -> agno_http -> LLM com contexto RAG
```

O Orchestra continua sendo o control plane. O Agno recebe somente contexto ja selecionado, autorizado, minimizado e validado. O Agno nao escolhe knowledge bases, documentos, fontes ou chunks e nao faz retrieval livre.

O frontend continua enviando somente:

```json
{ "input": "pergunta atual" }
```

Historico, contexto RAG, provider/model, prompt, credenciais e configuracao operacional continuam fora do payload publico do frontend.

## 2. Arquitetura e responsabilidades

### Orchestra - Control Plane

O Orchestra permanece responsavel por:

- validar usuario, tenant, workspace, conversa, assistant, versao e publicacao;
- aplicar RBAC/ABAC, execution policy, precheck e approvals;
- selecionar os knowledge bindings habilitados do assistant;
- executar `knowledgeService.queryRag` com a pergunta atual;
- aplicar readiness, policies de knowledge, retrieval semantico e fallback lexical oficial;
- persistir `RagQuery` e resultados governados;
- limitar, sanitizar e validar `AssistantRuntimeSpecV1.rag`;
- chamar o runtime autorizado e normalizar sua resposta;
- persistir `AgentRun`, mensagem do assistant, usage, auditoria e observabilidade.

### Agno - Runtime Executor

O runtime Agno deve:

- receber e validar `AssistantRuntimeSpecV1`;
- usar somente `rag.sources` recebidas como contexto da execucao;
- chamar o provider/model autorizados no spec;
- devolver output, usage, provider/model e metadata segura pelo contrato V1;
- nunca consultar livremente banco, vector store, storage ou knowledge base do Orchestra.

Credenciais operacionais do provider ficam no ambiente seguro do runtime real. Elas nao atravessam o contrato do Orchestra.

## 3. Fluxo ponta a ponta

1. O frontend envia somente a mensagem atual ao endpoint do Chat.
2. O backend persiste a mensagem `user`.
3. O Chat cria um `AgentRun` em modo `published` e passa a mensagem como `input`.
4. O `AgentRun` executa o precheck governado.
5. Se o provider atual for `agno_http` e `AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=true`, o Orchestra normaliza a pergunta atual para no maximo 500 caracteres e chama `knowledgeService.queryRag`.
6. A consulta oficial aplica scoping dos bindings, readiness, retrieval semantico e fallback local conforme a policy existente.
7. O resultado governado e convertido em `RuntimeResolvedRagContext`; URI de fonte e metadata arbitraria nao sao copiadas.
8. `buildRuntimeExecutionContext` usa esse resultado, em vez de referencias recentes genericas do binding.
9. `buildAssistantRuntimeSpecV1` aplica os limites finais e monta `rag.mode=resolved_context`.
10. O adapter valida o schema strict e envia o request a `/execute`.
11. O Agno real usa os excerpts recebidos como contexto para a chamada LLM autorizada.
12. A resposta contratual volta ao `AgentRun`; o output textual e persistido como mensagem `assistant` ligada ao run.

O runtime local nao executa esse novo retrieval automatico. Mesmo com a flag RAG HTTP ligada, `RUNTIME_PROVIDER=local` preserva o caminho local existente.

## 4. Resolucao RAG no Orchestra

A 16B reutiliza o pipeline oficial existente; nao cria repository, vector search ou arquitetura paralela.

`knowledgeService.queryRag` continua responsavel por:

- localizar o assistant no tenant/workspace autorizado;
- considerar apenas knowledge bindings habilitados e com retrieval permitido;
- verificar readiness de documentos, chunks, fontes e embeddings;
- tentar retrieval semantico quando pronto;
- usar o fallback lexical oficial quando permitido;
- limitar resultados entre 1 e 20;
- persistir a `RagQuery`, ranking, score, excerpt e citation label;
- auditar request, resultado, bloqueio ou falha sem persistir payload bruto em metadata publica.

Para o runtime, o limite pedido ao retrieval e o menor valor entre `AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES` e 20. O builder reaplica limites de quantidade e caracteres antes da fronteira HTTP.

Resultados `no_results` ou `blocked` nao reutilizam fontes antigas. O `RuntimeExecutionContext` recebe lista vazia e o spec permanece com RAG desabilitado.

## 5. Contrato `AssistantRuntimeSpecV1.rag`

Quando existem resultados seguros:

```json
{
  "rag": {
    "enabled": true,
    "mode": "resolved_context",
    "sources": [
      {
        "sourceId": "source-reference-id",
        "documentId": "document-id",
        "chunkId": "chunk-id",
        "title": "Titulo governado",
        "excerpt": "Trecho limitado ja resolvido pelo Orchestra.",
        "score": 0.82,
        "metadata": {
          "citationLabel": "[1]",
          "sourceIndex": 1
        }
      }
    ]
  }
}
```

O contrato e strict. Campos extras, estados incoerentes e payload sensivel fazem a validacao falhar antes da chamada HTTP.

Quando RAG nao esta pronto, nao encontra resultado ou nao deixa fonte segura:

```json
{
  "rag": {
    "enabled": false,
    "mode": "none",
    "sources": []
  }
}
```

## 6. Limites e sanitizacao

O builder aplica:

- quantidade maxima de fontes;
- tamanho maximo de cada excerpt;
- tamanho total maximo dos excerpts;
- IDs somente quando passam pela validacao segura;
- title e citation label limitados;
- score somente quando finito e valido;
- metadata criada por allowlist: `citationLabel` e `sourceIndex`.

Nao sao copiados para o contexto resolvido ou para eventos publicos:

- URI interna da fonte;
- metadata arbitraria do resultado;
- documento inteiro ou payload bruto de documento;
- embeddings ou query vetorial;
- configuracao de data source ou connection string;
- headers, cookies, tokens, secrets ou credenciais;
- prompt, historico ou resposta bruta de provider/runtime;
- stack trace.

Uma fonte com conteudo identificado como inseguro e descartada. Se nenhuma fonte segura restar, o spec volta para `rag.mode=none`.

## 7. Falhas e degradacao governada

O comportamento segue o pipeline oficial:

- `completed`: fontes governadas seguem para o builder;
- `no_results`: execucao continua sem RAG, sem reaproveitar fonte antiga;
- `blocked` por readiness/policy: execucao continua com `rag=none`; o bloqueio do retrieval fica auditado pelo Orchestra;
- excecao inesperada no retrieval: o `AgentRun` falha fechado com `RUNTIME_RAG_RETRIEVAL_FAILED`, `requestSent=false` e `failedClosed=true`; health e execute do Agno nao sao chamados;
- spec invalido ou fonte final insegura: o adapter falha fechado antes de `/execute`;
- runtime indisponivel, timeout ou resposta invalida: permanecem as regras fail-closed do `agno_http`, sem fallback silencioso.

Mensagens internas do erro de retrieval, stack e configuracao operacional nao sao promovidas ao `AgentRun` publico.

## 8. Flags e configuracao

Baseline seguro:

```env
RUNTIME_PROVIDER=local
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
AGNO_RUNTIME_HTTP_ENABLED=false
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
```

Homologacao 16B:

```env
RUNTIME_PROVIDER=agno_http
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
RUNTIME_REQUIRE_PRECHECK=true
AGNO_RUNTIME_HTTP_ENABLED=true
AGNO_RUNTIME_HTTP_BASE_URL=http://127.0.0.1:8091
AGNO_RUNTIME_HTTP_TIMEOUT_MS=15000
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=true
AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES=5
AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS=1200
AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS=6000
```

A chave server-to-server, quando configurada, segue somente no header da chamada e nao entra no body, eventos ou metadata publica. Nenhum segredo deve ser versionado.

## 9. Observabilidade

A UI 15G foi reutilizada. Os detalhes tecnicos do run podem exibir somente valores seguros:

- `ragMode`;
- `ragSourceCount`;
- `ragContextChars`;
- `maxRagResults`;
- status e provider do runtime;
- provider/model do LLM;
- `externalProviderCalled`;
- `requestSent` e `failedClosed` em falhas.

O evento `runtime.rag_context_attached` registra modo, contagem, caracteres e limite. IDs de fontes e excerpts nao fazem mais parte da metadata publica desse evento.

Auditoria interna registra o status do retrieval e a contagem resolvida, sem excerpt, documento bruto ou mensagem interna de erro.

## 10. Runtime minimo e fake

O runtime minimo continua sendo apenas contrato/dev/smoke:

- aceita `rag.enabled=true` e `mode=resolved_context`;
- valida o request pelo schema strict;
- conta fontes e caracteres;
- devolve `ragMode`, `ragSourceCount`, `ragContextChars` e `maxRagResults`;
- emite evento quantitativo `rag.context.attached`;
- nao faz retrieval;
- nao chama provider real;
- nao devolve excerpts completos na resposta.

Testes usam `fetch` fake e `knowledgeService.queryRag` mockado. Nenhum teste depende de internet, provider real ou runtime Agno real.

## 11. Homologacao com fake runtime

Pre-condicoes:

1. assistant com binding de knowledge habilitado;
2. documentos ingeridos, chunks ativos e readiness pronto;
3. flags 16B habilitadas;
4. runtime HTTP minimo iniciado localmente.

Executar:

```bash
npm --prefix backend run agno:runtime
npm --prefix backend run test -- --run agent-runs
npm --prefix backend run test -- --run runtime-agno-http
npm --prefix backend run test -- --run chat
```

Validar que o request fake contem `resolved_context`, que a resposta publica contem somente contadores e que a mensagem `assistant` permanece ligada ao `AgentRun`.

## 12. Homologacao manual com Agno real

1. Configurar um runtime Agno externo compativel com os contratos V1.
2. Configurar credenciais do LLM apenas no ambiente seguro desse runtime.
3. Habilitar provider/model externo na policy e na versao publicada do assistant.
4. Habilitar `agno_http` e RAG 16B no backend Orchestra.
5. Criar ou selecionar uma conversa do assistant publicado.
6. Enviar uma pergunta cujo conteudo exista nas bases vinculadas.
7. Inspecionar, no runtime Agno, que apenas as fontes do spec foram usadas.
8. Confirmar no Chat que a resposta foi persistida como mensagem `assistant`.
9. Confirmar na UI 15G modo, contagens, provider/model, chamada externa e status.
10. Repetir com pergunta sem resultado, RAG nao pronto e runtime indisponivel.

Nao registrar body completo do request/response durante a homologacao. Evidencias operacionais devem usar hashes, IDs permitidos, contadores e status.

## 13. Citacoes e evidencias

O retrieval oficial continua persistindo `RagQueryResult`, citation label, documento, chunk, score e excerpt governado. O spec leva `citationLabel` e `sourceIndex` para o runtime.

O contrato atual de resposta do runtime nao possui um campo estruturado de citations que seja propagado ate a metadata da mensagem do Chat. Portanto, a exibicao de citacoes clicaveis na UI fica fora da 16B. Um passo futuro deve criar contrato strict e DTO publico especifico, sem reutilizar metadata arbitraria do provider.

## 14. O que fica fora da 16B

- MCP/tools reais;
- streaming;
- runtime registry dinamico;
- agentes on-premise;
- Agno fazendo retrieval livre;
- acesso do Agno ao banco, vector store ou storage do Orchestra;
- selecao de knowledge base pelo frontend ou pelo runtime;
- citations estruturadas/clicaveis na mensagem do Chat;
- retry/circuit breaker novo;
- migration ou schema Prisma novo;
- provider real em testes automatizados.

## 15. Riscos

- Excerpts autorizados ainda podem conter informacao de negocio; scoping, policy e limites precisam ser homologados por tenant.
- Retrieval semantico pode depender da readiness de embeddings e usar fallback lexical conforme configuracao existente.
- `no_results` permite resposta sem RAG; o runtime real deve ser instruido a nao inventar evidencia ausente.
- O runtime Agno real precisa incorporar `rag.sources` ao contexto do LLM corretamente; o fake valida contrato e contadores, nao qualidade de resposta.
- A falta de citations estruturadas limita a verificacao visual da fonte no Chat.
- Nao ha retry/circuit breaker adicional no client HTTP.

## 16. Rollback

Rollback sem alteracao de banco:

1. definir `AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false` para manter `agno_http` sem RAG;
2. se necessario, definir `RUNTIME_PROVIDER=local`;
3. manter `RUNTIME_ALLOW_PROVIDER_FALLBACK=false` para evitar troca silenciosa;
4. reiniciar o backend e validar health/capabilities;
5. executar os testes de runtime local e Chat;
6. confirmar que novos specs usam `rag.enabled=false` e `mode=none`.

Nao ha migration ou dado que exija rollback destrutivo. As `RagQuery` persistidas continuam como trilha de auditoria do Orchestra.

## 17. Validacoes recomendadas

```bash
git diff --check
npm --prefix backend run typecheck
npm --prefix backend run test -- --run runtime
npm --prefix backend run test -- --run chat
npm --prefix backend run test -- --run rag
npm --prefix backend run test -- --run agno
npm --prefix backend run test -- --run runtime-agno-http
npm --prefix frontend run typecheck
npm --prefix frontend run test -- --run real-mode-pages
npm --prefix frontend run test -- --run agent-run-llm-metadata
bash -n scripts/smoke-chat-contexto-15e.sh
bash -n scripts/smoke-chat-provider-real-15h.sh
```
