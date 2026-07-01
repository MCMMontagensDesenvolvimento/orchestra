# Orchestra Agno Runtime HTTP Minimo 14B

## 1. Resumo da 14B

A Fase 14B adiciona um servico HTTP minimo Agno-compatible, local e controlado, que implementa o contrato definido na Fase 14A. O servico expoe health, capabilities e execute, valida payloads com os schemas Zod strict da 14A e retorna respostas/erros normalizados.

Esta fase ainda nao pluga o backend principal do Orquestra no runtime HTTP. A integracao do backend principal fica para a 14C.

## 2. O que foi implementado

- App Express isolado em `backend/src/modules/runtime/agno-runtime-http.app.ts`.
- Servico puro em `backend/src/modules/runtime/agno-runtime-http.service.ts`.
- Entrada local em `backend/src/modules/runtime/agno-runtime-http.server.ts`.
- Script npm `npm run agno:runtime`.
- Smoke local `scripts/smoke-agno-runtime-contract.sh`.
- Testes runtime/API em `backend/tests/runtime/agno-runtime-http.test.ts`.

O runtime minimo:

- valida `RuntimeExecuteRequestV1`;
- valida `RuntimeExecuteResponseV1`;
- valida `RuntimeHealthResponseV1`;
- valida `RuntimeCapabilitiesResponseV1`;
- gera eventos normalizados;
- gera erro normalizado;
- falha fechado em payload invalido ou policy bloqueada;
- produz output deterministico de sandbox.

## 3. O que nao foi implementado

- Integracao do backend principal chamando Agno real.
- Alteracao funcional em `runtime.agno-adapter.ts`.
- Frontend chat real.
- Streaming real.
- RAG real dentro do runtime.
- MCP real dentro do runtime.
- Tool execution gateway.
- Provider externo real.
- Chamada OpenAI, Azure, Anthropic ou equivalente.
- LLM-as-judge.
- Scheduler, worker, queue, dashboard ou billing.
- Migration, seed ou schema Prisma.
- Alteracao de RBAC, auth, SSO, observabilidade ou AI Quality.
- Mudanca de defaults para habilitar Agno por padrao.

## 4. Relacao com o contrato da 14A

A 14A definiu os contratos versionados:

- `AssistantRuntimeSpecV1`;
- `RuntimeExecuteRequestV1`;
- `RuntimeExecuteResponseV1`;
- `RuntimeNormalizedEventV1`;
- `RuntimeNormalizedErrorV1`;
- `RuntimeHealthResponseV1`;
- `RuntimeCapabilitiesResponseV1`.

A 14B consome esses contratos sem criar novo modelo de governanca. O Orquestra continua sendo o control plane; o runtime minimo e apenas executor sandbox.

## 5. Rotas

### `GET /health`

Retorna payload compativel com `RuntimeHealthResponseV1`.

Propriedades principais:

- `provider = agno`;
- `protocolVersion = orchestra.runtime.assistant.v1`;
- `status = healthy`;
- `checkedAt`;
- `message`;
- `details` seguros.

Nao retorna envs, headers, secrets, URLs internas ou configuracao sensivel.

### `GET /capabilities`

Retorna payload compativel com `RuntimeCapabilitiesResponseV1`.

Na 14B:

- `supportsStreaming = false`;
- `supportsTools = false`;
- `supportsRagContext = true`;
- `supportsFileInputs = false`;
- `maxInputChars = 16000`;
- `maxToolCalls = 0`.

`supportsRagContext=true` significa apenas que o runtime aceita contexto ja resolvido pelo Orquestra. Nao ha busca RAG dentro do runtime.

### `POST /execute`

Recebe `RuntimeExecuteRequestV1` e retorna `RuntimeExecuteResponseV1`.

Fluxo:

1. aceita apenas JSON;
2. limita payload JSON;
3. valida request pelo schema 14A;
4. bloqueia tools, pois capabilities declaram `supportsTools=false`;
5. aceita RAG `none`, `resolved_context` seguro ou `gateway` sem execucao;
6. gera eventos normalizados;
7. gera output deterministico sandbox;
8. valida response pelo schema 14A antes de enviar.

## 6. Exemplo de request seguro

```json
{
  "specVersion": "orchestra.runtime.execute.v1",
  "assistantRuntimeSpec": {
    "specVersion": "orchestra.runtime.assistant.v1",
    "trace": {
      "traceId": "trace-123",
      "runId": "run-123"
    },
    "tenant": {
      "id": "tenant-1"
    },
    "workspace": {
      "id": "workspace-1"
    },
    "actor": {
      "userId": "user-1"
    },
    "assistant": {
      "id": "assistant-1"
    },
    "input": {
      "message": "Use only governed context."
    },
    "model": {
      "provider": "local",
      "model": "deterministic-sandbox"
    },
    "policy": {
      "executionMode": "sync",
      "streaming": false,
      "timeoutMs": 15000,
      "maxToolCalls": 0,
      "maxRagResults": 2,
      "maxContextChars": 12000,
      "failClosed": true
    },
    "instructions": {},
    "rag": {
      "enabled": false,
      "mode": "none",
      "sources": []
    },
    "tools": {
      "enabled": false,
      "mode": "none",
      "descriptors": []
    },
    "observability": {
      "usageEventEnabled": true,
      "auditEnabled": true,
      "qualityEvaluationEnabled": false
    },
    "limits": {
      "enforce": true
    }
  }
}
```

## 7. Exemplo de response segura

```json
{
  "specVersion": "orchestra.runtime.response.v1",
  "trace": {
    "traceId": "trace-123",
    "runId": "run-123"
  },
  "status": "succeeded",
  "output": {
    "text": "Resposta sandbox do runtime Agno-compatible minimo. Nenhum provider externo foi chamado.",
    "format": "text",
    "metadata": {
      "mode": "sandbox",
      "inputChars": 26,
      "ragSourceCount": 0,
      "toolDescriptorCount": 0
    }
  },
  "usage": {
    "inputTokens": 0,
    "outputTokens": 0,
    "totalTokens": 0,
    "latencyMs": 1,
    "estimatedCostMinorUnits": "0",
    "costCurrency": "BRL"
  },
  "events": []
}
```

## 8. Tratamento de erros

Payload invalido retorna HTTP 400 com `RUNTIME_BAD_REQUEST`.

Policy bloqueada retorna HTTP 403 com `RUNTIME_POLICY_BLOCKED`. Na 14B, tools sao bloqueadas porque `supportsTools=false`.

Erro inesperado retorna HTTP 500 com `RUNTIME_UNKNOWN_ERROR`.

Erros nao retornam:

- stack trace;
- body bruto;
- headers;
- secrets;
- raw request;
- raw response.

## 9. Garantias de seguranca

O servico:

- aceita apenas `application/json` em `/execute`;
- usa limite de JSON;
- valida request e response pelo contrato 14A;
- nao loga body bruto;
- nao retorna env completo;
- nao retorna headers;
- nao retorna secrets;
- nao chama rede externa;
- nao chama banco;
- nao chama provider externo;
- nao executa RAG;
- nao executa MCP;
- retorna 404 seguro para rota desconhecida.

## 10. Como rodar localmente

```bash
cd backend
AGNO_RUNTIME_HTTP_HOST=127.0.0.1 \
AGNO_RUNTIME_HTTP_PORT=8091 \
npm run agno:runtime
```

Rotas locais:

- `http://127.0.0.1:8091/health`;
- `http://127.0.0.1:8091/capabilities`;
- `http://127.0.0.1:8091/execute`.

## 11. Como rodar smoke

```bash
bash scripts/smoke-agno-runtime-contract.sh
```

O smoke sobe o runtime minimo em porta local, chama `/health`, `/capabilities` e `/execute`, valida campos essenciais e encerra o processo.

O smoke nao depende de Docker, banco, backend principal ou provider externo.

## 12. Como a 14C deve consumir este servico

A 14C deve conectar o backend principal do Orquestra ao runtime HTTP minimo de forma governada:

1. montar `AssistantRuntimeSpecV1` no backend principal;
2. validar a spec antes de enviar;
3. chamar `/execute` somente a partir do backend;
4. preservar o frontend sem chamada direta ao runtime;
5. registrar eventos/usage no fluxo oficial;
6. manter RAG/MCP sob policies do Orquestra;
7. manter tools bloqueadas ate existir gateway governado;
8. tratar `RUNTIME_BAD_REQUEST`, `RUNTIME_POLICY_BLOCKED` e `RUNTIME_UNKNOWN_ERROR` de forma fail-closed.

## 13. Riscos remanescentes

- O backend principal ainda nao chama o runtime 14B.
- O adapter Agno existente ainda usa payload historico e precisa de traducao controlada na 14C.
- Streaming continua fora do escopo.
- Tool gateway ainda nao existe.
- RAG gateway ainda nao existe.
- Observabilidade do runtime real ainda precisa ser conectada ao fluxo oficial.
- Estrategia de secrets precisa ser validada antes de qualquer provider externo real.
- LLM-as-judge continua fora de escopo ate o runtime real estar estabilizado.
