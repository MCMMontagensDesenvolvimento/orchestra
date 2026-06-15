# Orchestra LLM Provider API Contracts

Status: implementado na Fase 07C.

Base path: `/api/v1/llm`.

Todos os endpoints exigem sessao autenticada.

## Permissoes

- `llm.providers.read`: leitura de providers, health e capabilities.
- `llm.config.read`: leitura de configuracao sanitizada.
- `llm.providers.test`: teste controlado de geracao local.

## Endpoints

### GET `/providers`

Lista providers LLM suportados.

Resposta: `200`.

```json
{
  "data": [
    {
      "provider": "local_deterministic",
      "current": true,
      "health": { "status": "healthy" },
      "capabilities": { "supportsChatCompletion": "simulated" }
    }
  ],
  "requestId": "req_..."
}
```

### GET `/providers/:provider`

Retorna provider, health e capabilities de um provider especifico.

Providers validos:

- `local_deterministic`
- `agno_local`
- `openai`
- `azure_openai`
- `anthropic`

Provider invalido retorna `422 VALIDATION_ERROR`.

### GET `/providers/:provider/health`

Retorna status sanitizado: `healthy`, `disabled`, `misconfigured`, `configured_but_execution_disabled` ou `unavailable`.

### GET `/providers/:provider/capabilities`

Retorna capabilities sanitizadas e flags booleanas de configuracao.

### GET `/config`

Retorna configuracao segura, sem secrets e sem endpoints sensiveis.

### POST `/test-generation`

Executa geracao controlada.

Request:

```json
{
  "provider": "local_deterministic",
  "input": "Texto curto de teste"
}
```

Respostas:

- `200`: geracao local concluida.
- `409`: provider externo bloqueado/fail-closed.
- `422`: payload invalido.

O input e limitado a 500 caracteres nesta fase.
