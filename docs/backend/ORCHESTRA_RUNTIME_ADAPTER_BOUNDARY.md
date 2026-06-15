# Orchestra Runtime Adapter Boundary

Status: implementado na Fase 07A.

## Objetivo

A Fase 07A cria o boundary oficial de runtime do Orchestra. O backend continua sendo o control plane e a autoridade de autenticacao, RBAC, workspace, policy, auditoria e persistencia. O runtime passa a ser acessado por contrato de adapter, sem acoplar `AgentRun` a uma implementacao especifica.

## Componentes

- `RuntimeAdapter`: contrato comum para health, capabilities e execucao.
- `RuntimeAdapterRegistry`: resolve o provider configurado.
- `LocalDeterministicRuntimeAdapter`: padrao seguro para desenvolvimento e smoke local.
- `AgnoRuntimeAdapter`: stub de readiness, desabilitado por padrao.
- `RuntimeExecutionContext`: contexto governado enviado ao adapter.
- `RuntimeNormalizedEvent`: eventos normalizados que viram `AgentRunEvent`.

## Fluxo De Execucao

1. API cria `AgentRun`.
2. Backend valida auth, permissao, workspace e policy.
3. Precheck de execucao decide se pode seguir.
4. Backend monta `RuntimeExecutionContext`.
5. Registry resolve o adapter.
6. Adapter executa localmente por padrao.
7. Eventos normalizados sao persistidos em `agent_run_events`.
8. Audit logs registram resolucao, inicio, conclusao, falha ou bloqueio.

## Contexto Governado

O contexto contem:

- IDs de tenant, workspace, user, assistant e run.
- `requestId` e `traceId`.
- provider selecionado.
- resumo de assistant e versao.
- policy snapshot sanitizado.
- resumo RAG governado.
- resumo MCP sandbox governado.
- input hash e preview limitado.
- metadata sanitizada.

O contexto nao inclui secrets, tokens, API keys, payload bruto extenso, conteudo completo de documentos ou chamadas externas.

## Banco De Dados

Esta fase nao exigiu nova migration. `AgentRun.metadata` guarda snapshot runtime sanitizado, e `AgentRunEvent` guarda eventos normalizados do adapter.

## Limites

- Nao ha Agno real obrigatorio.
- Nao ha LLM real.
- Nao ha provider externo.
- Nao ha MCP remoto.
- Nao ha streaming final.
