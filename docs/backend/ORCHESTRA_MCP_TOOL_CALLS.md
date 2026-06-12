# Orchestra MCP Tool Calls

Status: implementado na Fase 06D.

`McpToolCall` representa uma tentativa governada de executar uma tool MCP em sandbox. Ela nao substitui o modelo legado `ToolCall`; o novo modelo e especifico para MCP execution sandbox, policy snapshot e timeline.

## Campos Principais

- `assistantId`, `mcpServerId`, `mcpToolId` e `requestedByUserId`.
- `assistantVersionId` e `agentRunId` opcionais.
- `assistantMcpBindingId` quando a decisao foi baseada em binding especifico.
- `mode`, atualmente `sandbox`.
- `status`: `completed`, `blocked`, `approval_required`, `failed`, `cancelled`, `queued` ou `running`.
- `riskLevelSnapshot` e `approvalRequiredSnapshot`.
- `inputHash`, `inputPreview` e `outputPreview` limitados.
- `policySnapshot` com decisao, reasons e warnings sanitizados.

## Eventos

`McpToolCallEvent` registra a timeline:

- `precheck_started`
- `precheck_passed`
- `approval_required`
- `blocked`
- `execution_started`
- `execution_completed`
- `execution_failed`
- `cancelled`

Quando `agentRunId` e informado, eventos correspondentes tambem sao anexados a `AgentRunEvent` quando aplicavel.

## Sanitizacao

O backend nao persiste payload bruto completo em audit log. A tool call grava apenas preview truncado, hash e metadata sanitizada. Campos com secrets, tokens, passwords e authorization sao rejeitados pelo schema de entrada.

