# Orchestra Runtime Adapter API Contracts

Status: implementado na Fase 07A e evoluido na Fase 07B.

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
  "defaultTimeoutMs": 15000,
  "requestTimeoutMs": 15000,
  "requirePrecheck": true,
  "allowProviderFallback": false,
  "externalToolsAllowed": false,
  "agnoEnabled": false,
  "agnoConfigured": false,
  "agnoExecutionEnabled": false,
  "agnoHealthcheckEnabled": false,
  "agnoBaseUrlConfigured": false,
  "agnoApiKeyConfigured": false,
  "agnoRequireSandbox": true,
  "agnoAllowExternalTools": false,
  "agnoAllowRemoteMcp": false,
  "agnoSendRagContext": true,
  "agnoSendMcpToolDescriptors": true,
  "agnoMaxInputPreviewChars": 500,
  "agnoMaxOutputPreviewChars": 800
}
```

Este endpoint nunca retorna API keys, tokens, secrets ou URLs sensiveis completas.

## Contrato HTTP Agno-Compatible

Quando `RUNTIME_PROVIDER=agno`, `AGNO_ENABLED=true` e `AGNO_EXECUTION_ENABLED=true`, o backend pode chamar um runtime local configurado por ambiente:

- `GET {AGNO_BASE_URL}{AGNO_HEALTH_PATH}`
- `GET {AGNO_BASE_URL}{AGNO_CAPABILITIES_PATH}`
- `POST {AGNO_BASE_URL}{AGNO_EXECUTE_PATH}`

O payload de execute contem ids tecnicos, input hash/preview, preview de instrucoes, policy snapshot, RAG citations/excerpts e descriptors MCP. Nao inclui secrets, tokens, credenciais MCP ou payload bruto extenso.

Eventos normalizados persistidos podem incluir:

- `agno.health_checked`
- `agno.request_started`
- `agno.request_completed`
- `agno.request_failed`
- `runtime.model_started`
- `runtime.model_completed`
- `runtime.run_completed`
- `runtime.run_failed`

## Erros

Erros seguem o padrao global:

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 NOT_FOUND` para rotas inexistentes
- `422 VALIDATION_ERROR` quando aplicavel
