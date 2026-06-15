# Orchestra Runtime Adapter API Contracts

Status: implementado na Fase 07A.

Base path: `/api/v1/runtime`.

Todos os endpoints exigem cookie HttpOnly valido e permissao `agent_runs.read`.

## GET /runtime/providers

Lista providers conhecidos pelo registry.

Resposta:

```json
{
  "data": [
    {
      "provider": "local",
      "current": true,
      "health": {
        "provider": "local",
        "status": "healthy",
        "message": "Local deterministic runtime adapter is available.",
        "checkedAt": "2026-06-12T00:00:00.000Z"
      },
      "capabilities": {
        "provider": "local",
        "supportsSandbox": true,
        "supportsExternalProviders": false
      }
    }
  ],
  "requestId": "req-id"
}
```

## GET /runtime/capabilities

Retorna capabilities do provider atual.

Campos principais:

- `provider`
- `status`
- `supportsTextGeneration`
- `supportsStreaming`
- `supportsRagContext`
- `supportsMcpTools`
- `supportsToolCalling`
- `supportsSandbox`
- `supportsExternalProviders`
- `supportsCitations`
- `supportsTraceEvents`
- limites de preview

## GET /runtime/health

Retorna health do provider atual.

Status possiveis:

- `healthy`
- `degraded`
- `disabled`
- `misconfigured`
- `unavailable`

## GET /runtime/config

Retorna apenas configuracao sanitizada:

```json
{
  "provider": "local",
  "adapterEnabled": true,
  "requestTimeoutMs": 30000,
  "requirePrecheck": true,
  "externalToolsAllowed": false,
  "agnoEnabled": false,
  "agnoConfigured": false,
  "agnoHealthcheckEnabled": false,
  "agnoBaseUrlConfigured": false
}
```

Este endpoint nunca retorna API keys, tokens, secrets ou URLs sensiveis completas.

## Erros

Erros seguem o padrao global:

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 NOT_FOUND` para rotas inexistentes
- `422 VALIDATION_ERROR` quando aplicavel
