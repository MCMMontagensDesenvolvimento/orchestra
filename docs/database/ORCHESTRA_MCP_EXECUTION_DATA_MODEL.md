# Orchestra MCP Execution Data Model

Status: implementado na Fase 06D.

A migration `20260612100000_phase06d_mcp_execution_sandbox` adiciona as tabelas `mcp_tool_calls` e `mcp_tool_call_events`.

## mcp_tool_calls

Armazena a tentativa governada de executar uma tool MCP em sandbox.

Principais relacoes:

- `tenant_id` -> `tenants`
- `workspace_id` -> `workspaces`
- `assistant_id` -> `assistants`
- `assistant_version_id` -> `assistant_versions`
- `agent_run_id` -> `agent_runs`
- `mcp_server_id` -> `mcp_servers`
- `mcp_tool_id` -> `mcp_tools`
- `assistant_mcp_binding_id` -> `assistant_mcp_bindings`
- `requested_by_user_id` -> `users`

Indices cobrem tenant, workspace, assistant, agent run, server, tool, status, mode, risk, request id, trace id e data de criacao.

## mcp_tool_call_events

Armazena eventos ordenaveis por `created_at` para a timeline da tool call.

Principais relacoes:

- `tool_call_id` -> `mcp_tool_calls`
- `agent_run_id` -> `agent_runs`
- `tenant_id` e `workspace_id` para escopo e filtragem.

## Limites

- Input e output completos nao sao armazenados.
- `input_preview` e `output_preview` sao campos textuais limitados pela camada de servico.
- `policy_snapshot` registra decisao e reasons sem payload sensivel.

