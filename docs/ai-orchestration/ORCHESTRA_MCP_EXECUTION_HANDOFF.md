# Orchestra MCP Execution Handoff

Status: implementado na Fase 06D.

Este handoff descreve como o control plane prepara futura execucao MCP real sem acoplar o backend a runtime externo nesta fase.

## Contrato Disponivel

- Assistant escolhe tool via binding MCP.
- Backend executa precheck governado.
- Backend persiste `McpToolCall` e `McpToolCallEvent`.
- `agentRunId` pode correlacionar a tool call com um AgentRun existente.
- `traceId` e `requestId` ficam disponiveis para correlacao futura.
- Output atual e sintetico e local.

## Futuro Runtime

Um executor real deve consumir um contrato equivalente:

1. Receber IDs e policy snapshot.
2. Revalidar permissoes ou aceitar decisao assinada pelo backend.
3. Executar tool em ambiente isolado.
4. Retornar eventos, status, output preview e erros sanitizados.
5. Nunca retornar secrets ao frontend.

## Limites Atuais

- Nao ha chamada MCP externa.
- Nao ha provider de modelo.
- Nao ha raciocinio de agent.
- Nao ha streaming.
- Nao ha secrets manager.

O valor desta fase e estabilizar governanca, auditoria, historico e UI antes da conexao com runtime.

