# Orchestra MCP Execution Security

Status: implementado na Fase 06D.

O sandbox MCP e governado pelo backend. O frontend nunca decide permissao final.

## Controles

- Rotas protegidas por sessao HttpOnly.
- `execution.precheck` para precheck.
- `execution.run_sandbox` para executar sandbox.
- `mcp.tools.read` para historico e eventos.
- Tenant e workspace sao validados por queries escopadas.
- Assistant, server, tool e binding devem pertencer ao mesmo escopo.
- Servers desabilitados ou arquivados bloqueiam execucao.
- Tools desabilitadas ou arquivadas bloqueiam execucao.
- Bindings ausentes ou desabilitados bloqueiam execucao.
- Tools high ou critical resultam em `approval_required`.
- Execution policy precisa permitir sandbox e logs.

## Dados Sensiveis

Schemas rejeitam chaves como secret, token, password, api key e authorization em input de sandbox. Audit logs recebem apenas IDs, status, reasons, risk level, mode, duration e metadados sanitizados.

## Risco Residual

O sandbox valida governanca e contratos, mas ainda nao executa MCP real. A futura integracao com runtime deve manter os mesmos controles e adicionar isolamento de processo, rede, secrets e observabilidade de producao.

