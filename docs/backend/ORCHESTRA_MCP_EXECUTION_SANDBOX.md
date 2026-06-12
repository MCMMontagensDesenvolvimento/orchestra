# Orchestra MCP Execution Sandbox

Status: implementado na Fase 06D.

Este documento descreve o sandbox controlado de execucao MCP do Orchestra. O backend e a autoridade para permissao, policy, auditoria e persistencia. A execucao implementada nesta fase e local, deterministica e simulada.

## Escopo

- Precheck por assistant e tool MCP.
- Validacao de assistant, tool, server, binding, workspace, execution policy e risk level.
- Persistencia de `McpToolCall` e `McpToolCallEvent`.
- Execucao sandbox local sem chamada HTTP para MCP server.
- Respostas `completed`, `blocked` e `approval_required`.
- Vinculo opcional com `AgentRun` quando `agentRunId` e informado.
- Audit logs sanitizados para precheck, criacao, conclusao, bloqueio e approval required.

## Fora Do Escopo

- Execucao MCP externa real.
- Discovery MCP real.
- Runtime de agent real.
- Provider de modelo real.
- Tool calling produtivo.
- Webhooks externos.
- Secrets manager ou OAuth real para MCP.

## Fluxo

1. Cliente chama `POST /api/v1/assistants/:assistantId/mcp/precheck`.
2. Backend valida escopo, binding e policies.
3. Cliente pode chamar `POST /api/v1/assistants/:assistantId/mcp/tool-calls`.
4. Backend persiste a tool call com input preview limitado e hash.
5. Backend cria eventos da tool call.
6. Se permitido, gera output sintetico.
7. Se bloqueado ou exigir approval, persiste a decisao sem executar nada externo.

## Resultado Sandbox

O output e uma mensagem sintetica como:

```txt
Sandbox execution completed for tool "smoke.low_lookup". No external MCP server was called.
```

O objetivo e validar contratos, governanca e UI antes de integrar um runtime executor real.

