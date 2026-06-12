# Orchestra MCP Execution API Contracts

Status: implementado na Fase 06D.

Base path: `/api/v1`.

## Precheck

```http
POST /assistants/:assistantId/mcp/precheck
```

Body:

```json
{
  "mcpToolId": "uuid",
  "agentRunId": "uuid opcional",
  "mode": "sandbox",
  "input": {
    "query": "teste"
  }
}
```

Resposta permitida:

```json
{
  "data": {
    "canExecute": true,
    "status": "allowed",
    "mode": "sandbox",
    "reasons": [],
    "warnings": [],
    "policy": {
      "requiresApproval": false,
      "riskLevel": "low",
      "bindingMode": "sandbox_only",
      "sandboxOnly": true,
      "allowRuntimeExecution": false,
      "blockedByDefault": true
    }
  }
}
```

Resposta bloqueada ou com approval:

```json
{
  "data": {
    "canExecute": false,
    "status": "approval_required",
    "mode": "sandbox",
    "reasons": ["tool_requires_approval"],
    "warnings": [],
    "policy": {
      "requiresApproval": true,
      "riskLevel": "high"
    }
  }
}
```

## Executar Sandbox

```http
POST /assistants/:assistantId/mcp/tool-calls
```

Retorna `201` com `McpToolCall`, eventos e previews sanitizados. Nenhuma chamada MCP externa e feita.

## Historico

```http
GET /assistants/:assistantId/mcp/tool-calls
GET /mcp/tool-calls
GET /mcp/tool-calls/:toolCallId
GET /mcp/tool-calls/:toolCallId/events
```

Listagens usam `data`, `pagination` e `requestId`.

## Erros

- `404 ASSISTANT_NOT_FOUND`
- `404 MCP_TOOL_NOT_FOUND`
- `404 MCP_TOOL_CALL_NOT_FOUND`
- `404 AGENT_RUN_NOT_FOUND`
- `422 VALIDATION_ERROR`
- `403 FORBIDDEN`

