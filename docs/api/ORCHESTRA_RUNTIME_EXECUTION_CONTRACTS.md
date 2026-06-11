# Orchestra Runtime Execution Contracts

Status: implementado na Fase 05E para runtime boundary fake.

Este documento descreve os contratos HTTP para criar, consultar e cancelar `AgentRun`.

## Convencoes

- Prefixo: `/api/v1`.
- Autenticacao: cookie HttpOnly.
- Formato: REST + JSON.
- Erros: `status`, `code`, `message`, `fieldErrors` quando aplicavel e `requestId`.
- Listagens: `data`, `pagination`, `requestId`.
- Criacao de run bloqueado retorna `201`, pois o registro auditavel foi criado.

## POST /assistants/:assistantId/runs

Cria um run para um assistant.

Permissoes:

- `agent_runs.create`
- `execution.precheck`
- `execution.run_sandbox` quando `mode=sandbox`
- `execution.run_published` quando `mode=published`

Body:

```json
{
  "mode": "sandbox",
  "input": "Entrada controlada para execucao.",
  "source": "assistant_detail",
  "metadata": {
    "uiContext": "assistant_detail_runs"
  }
}
```

Campos:

- `mode`: `draft_test`, `sandbox`, `published`, `blocked` ou `archived`.
- `input`: string obrigatoria, ate 2000 caracteres.
- `source`: string opcional, default `api`.
- `metadata`: objeto opcional, sanitizado no backend.

Resposta `201`:

```json
{
  "data": {
    "id": "run-id",
    "assistantId": "assistant-id",
    "status": "completed",
    "mode": "sandbox",
    "source": "assistant_detail",
    "inputSummary": "Entrada controlada para execucao.",
    "requestId": "req-id",
    "traceId": "trace-id",
    "precheckSnapshot": {
      "canExecute": true,
      "mode": "sandbox",
      "reasons": [],
      "requestId": "req-id"
    },
    "events": []
  },
  "requestId": "req-id"
}
```

Run bloqueado tambem retorna `201`, com:

- `status=blocked`
- `blockedAt`
- `errorCode`
- `errorMessage`
- `precheckSnapshot.canExecute=false`
- eventos `run.precheck_failed` e `run.blocked`

Erros comuns:

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 ASSISTANT_NOT_FOUND`
- `422 VALIDATION_ERROR`

## GET /assistants/:assistantId/runs

Lista runs de um assistant.

Permissao:

- `agent_runs.read`

Query:

- `page`
- `perPage`
- `sortBy`: `createdAt`, `updatedAt`, `status`, `mode`
- `sortDirection`: `asc`, `desc`
- `status`
- `mode`

Resposta `200`:

```json
{
  "data": [
    {
      "id": "run-id",
      "status": "completed",
      "mode": "sandbox",
      "traceId": "trace-id",
      "events": []
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 1,
    "totalPages": 1
  },
  "requestId": "req-id"
}
```

## GET /agent-runs

Lista runs no escopo dos workspaces do usuario.

Permissao:

- `agent_runs.read`

Filtros:

- `assistantId`
- `status`
- `mode`
- paginacao e ordenacao padrao.

## GET /agent-runs/:runId

Retorna detalhe de um run.

Permissao:

- `agent_runs.read`

Erros comuns:

- `404 AGENT_RUN_NOT_FOUND`

## GET /agent-runs/:runId/events

Retorna eventos ordenados por `sequence`.

Permissao:

- `agent_runs.read`

Evento:

```json
{
  "id": "event-id",
  "agentRunId": "run-id",
  "type": "run.started",
  "sequence": 4,
  "status": "running",
  "message": "Fronteira de runtime acionada em modo controlado.",
  "metadata": {
    "traceId": "trace-id"
  },
  "createdAt": "2026-06-11T00:00:00.000Z"
}
```

## POST /agent-runs/:runId/cancel

Cancela runs em status:

- `queued`
- `prechecking`
- `running`

Permissao:

- `agent_runs.cancel`

Resposta `200`:

```json
{
  "data": {
    "id": "run-id",
    "status": "cancelled",
    "cancelledAt": "2026-06-11T00:00:00.000Z"
  },
  "requestId": "req-id"
}
```

Erros comuns:

- `404 AGENT_RUN_NOT_FOUND`
- `409 RUN_NOT_CANCELLABLE`

## Streaming Futuro

SSE permanece reservado para fase futura. A Fase 05E persiste eventos em banco e expoe leitura REST, preparando a semantica de timeline sem abrir canal streaming.
