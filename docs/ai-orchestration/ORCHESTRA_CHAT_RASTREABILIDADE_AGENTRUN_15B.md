# Orchestra Chat Rastreabilidade AgentRun 15B

## Resumo

A Fase 15B melhora a experiencia do Chat real criado na 15A para homologacao, suporte e operacao inicial.

O frontend permanece limitado ao backend Orchestra. A tela nao chama runtime externo, Agno, LLM provider, MCP ou tools diretamente.

## Fluxo

```txt
Frontend
  -> Backend Orchestra API
    -> AgentRun
      -> runtime provider governado pelo backend
```

## Endpoints usados pelo frontend

```txt
GET  /api/v1/assistants/:id
GET  /api/v1/assistants/:id/publications/active
POST /api/v1/assistants/:id/runs
GET  /api/v1/assistants/:id/runs
GET  /api/v1/agent-runs/:runId/events
```

O envio de mensagem continua usando:

```json
{
  "mode": "published",
  "input": "mensagem do usuario",
  "source": "frontend-chat",
  "metadata": {
    "origin": "chat-ui",
    "assistantId": "...",
    "route": "/app/chat/:assistantId"
  }
}
```

## Implementado

- Cabecalho com nome do assistente, status, modelo, versao e estado de publicacao.
- Area vazia inicial orientada para homologacao.
- Estado de envio explicito enquanto o backend cria o `AgentRun`.
- Bolhas de usuario e assistente com tratamento visual por estado.
- Resposta textual segura priorizando `metadata.runtime.outputPreview` e campos publicos equivalentes.
- Fallback seguro em `completed` sem texto claro, com `runId` e `requestId`.
- Tratamento separado para `completed`, `blocked`, `failed`, `queued`, `prechecking`, `running` e `cancelled`.
- Bloqueios de policy exibidos como bloqueio governado, com codigo, mensagem e `precheckSnapshot.reasons`.
- Falhas exibidas com mensagem segura e `requestId` quando disponivel.
- Reenvio manual em casos de erro ou bloqueio, sem retry automatico.
- Historico basico com os ultimos runs do assistente.
- Painel tecnico expansivel por resposta.
- Eventos do run carregados sob demanda.

## Painel tecnico seguro

O painel tecnico mostra apenas campos operacionais seguros:

- runId;
- traceId;
- requestId;
- status;
- mode;
- source;
- runtime provider;
- protocolVersion;
- specVersion;
- latencyMs;
- externalProviderCalled;
- externalMcpCalled;
- toolCallsExecuted;
- ragSourceCount;
- ragContextChars.

Eventos carregados sob demanda mostram:

- sequence;
- type;
- status;
- message truncada;
- metadata segura allowlisted, como provider, llmProvider, model, latency, tokens e flags booleanas.

Metadata bruta, headers, secrets, baseUrl, prompt bruto, response bruta e payload tecnico sensivel nao sao renderizados.

## Historico basico

O historico usa `GET /api/v1/assistants/:id/runs` por meio do service/hook existente. Ele exibe status, data, modo, source e resumo de input.

A fase nao reconstrui conversas persistentes nem abre threads historicas completas.

## Fora de escopo

- streaming;
- historico conversacional persistente avancado;
- backend novo;
- alteracao de contrato backend;
- alteracao de schema Prisma, migrations ou seed;
- alteracao de auth, SSO ou RBAC;
- chamada direta ao runtime Agno ou `/execute`;
- chamada direta a OpenAI, Azure, Anthropic, MCP ou tools.

## Testes

Cobertura frontend ajustada para:

- chat real renderiza assistente publicado;
- placeholder de prototipo nao aparece;
- envio usa `mode: "published"` e `source: "frontend-chat"`;
- `completed` exibe resposta textual;
- `completed` sem texto exibe fallback seguro;
- `blocked` exibe bloqueio de policy e motivos de precheck;
- `failed` exibe erro seguro e `requestId`;
- painel tecnico exibe runId, requestId, traceId e provider;
- eventos sao carregados sob demanda;
- historico basico exibe runs do assistente;
- services usam endpoints backend Orchestra para runs e eventos.

## Validacoes executadas

Registrar no fechamento da fase:

```bash
git diff --check
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test
grep -RInE "AGNO_RUNTIME_HTTP|127.0.0.1:8091|localhost:8091|/execute" frontend/src || true
grep -RInE "fetch\\(|axios\\.|apiClient\\." frontend/src/pages/Chat frontend/src/hooks frontend/src/services | sed -n '1,260p'
```

## Limitacoes

- A resposta completa do assistant depende do campo publico exposto pelo backend; quando nao ha texto claro, a UI mostra fallback.
- Eventos exibem apenas subset seguro de metadata.
- Historico mostra runs, nao conversas persistidas.
- Runs em estado `queued`, `prechecking` ou `running` sao exibidos como estado recebido, sem polling/streaming nesta fase.
