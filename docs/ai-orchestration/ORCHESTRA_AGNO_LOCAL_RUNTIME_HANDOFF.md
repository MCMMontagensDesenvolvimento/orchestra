# Orchestra Agno Local Runtime Handoff

Status: implementado na Fase 07B.

## Resumo

O Orchestra agora pode executar `AgentRun` contra um runtime HTTP local compativel com Agno quando `RUNTIME_PROVIDER=agno`, `AGNO_ENABLED=true` e `AGNO_EXECUTION_ENABLED=true`. O fluxo padrao continua usando `LocalDeterministicRuntimeAdapter`.

## Contrato Local

Paths configuraveis:

- `GET {AGNO_BASE_URL}{AGNO_HEALTH_PATH}`
- `GET {AGNO_BASE_URL}{AGNO_CAPABILITIES_PATH}`
- `POST {AGNO_BASE_URL}{AGNO_EXECUTE_PATH}`

O runtime deve responder JSON. Respostas parciais sao normalizadas, mas JSON invalido, timeout e status de execucao desconhecido viram falha controlada.

## Contexto Enviado

O payload inclui:

- assistant e versao;
- input hash/preview;
- policy snapshot;
- contexto RAG governado;
- descriptors MCP governados;
- metadata de contrato.

Nao ha embeddings, vector store, provider externo, MCP remoto ou chamada real de tools pelo Agno nesta fase.

## Mock Local

`scripts/agno-mock-runtime.mjs` implementa:

- `GET /health`;
- `GET /capabilities`;
- `POST /runs`.

O mock retorna resposta deterministica, eventos de modelo e usage zerado. Ele existe para validar contrato local, nao para representar um runtime produtivo.

## Proximos Passos

- Substituir o mock por runtime local real em ambiente controlado.
- Adicionar streaming apenas depois de contrato de eventos e cancelamento.
- Evoluir traces e correlacao sem expor payload bruto.
- Manter MCP externo e providers reais atras de controles separados.
