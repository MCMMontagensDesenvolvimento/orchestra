# Orchestra LLM Provider API Contracts

Status: consolidado no fechamento da Sprint 11 (Fase 07E-F).

Base path: `/api/v1/llm`.

Todos os endpoints exigem sessao autenticada.

## Permissoes

- `llm.providers.read`: leitura de providers, health e capabilities.
- `llm.config.read`: leitura de configuracao sanitizada.
- `llm.providers.test`: teste controlado de geracao local ou provider externo
  explicitamente habilitado.

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

O teste local e o smoke padrao nao exigem credencial OpenAI. Quando OpenAI estiver
desabilitado ou incompleto, a resposta deve permanecer fail-closed e indicar
`externalProviderCalled=false`.

Chamada OpenAI real e opcional e somente pode ocorrer em ambiente controlado com
config global, execution flag e policy do assistant em opt-in. O frontend nao consome
provider externo diretamente.

## AgentRun e Metadata LLM

AgentRuns podem retornar metadata sanitizada em `metadata.runtime.adapterMetadata`:

- `llmProvider`;
- `llmModel`;
- `llmLatencyMs`;
- `externalProviderCalled`;
- `llmSelectionReason`;
- `llm` com status e contagens numericas de uso quando disponiveis.

Eventos relevantes incluem `llm.provider_selected`, `llm.generation_started`,
`llm.generation_completed`, `llm.generation_failed` e `llm.generation_blocked`.
Bloqueio antes da requisicao externa deve registrar `externalProviderCalled=false`.
Prompt bruto, output bruto, headers, request body, response body e secrets nao fazem
parte do contrato de exibicao.
