# Orchestra Phase 05C - Approval e Execution Governance

## Objetivo

A Fase 05C aprofunda a governanca de assistants antes de qualquer runtime real de IA. O backend permanece como control plane: decide permissoes, registra approvals, guarda policies de execucao futura, executa prechecks e audita bloqueios.

Nao ha chamada a LLM, RAG, MCP, vector store, providers externos ou SSO real nesta fase.

## Backend

Foram adicionadas duas entidades principais:

- `AssistantApprovalRequest`: workflow simples e auditavel para acoes sensiveis.
- `AssistantExecutionPolicy`: policy por assistant para modos futuros de execucao e sandbox.

Novos endpoints em `/api/v1/assistants/:id`:

- `GET /approvals`
- `GET /approvals/:approvalId`
- `POST /approvals`
- `POST /approvals/:approvalId/approve`
- `POST /approvals/:approvalId/reject`
- `POST /approvals/:approvalId/cancel`
- `GET /execution-policy`
- `PATCH /execution-policy`
- `POST /execution-precheck`

## Workflow de Approval

Actions suportadas:

- `publish`
- `rollback`
- `restore`
- `enable_execution`
- `configure_sandbox`

Status suportados:

- `pending`
- `approved`
- `rejected`
- `cancelled`
- `expired`

O fluxo implementado e intencionalmente simples:

1. Um usuario solicita approval.
2. Um usuario com permissao decide approval.
3. Uma acao sensivel pode usar `approvalId` quando a policy exigir.

Publicacao direta segue permitida por padrao. Quando `requiresApprovalToPublish=true`, `POST /publish` exige approval aprovado e retorna `409 APPROVAL_REQUIRED` quando ausente.

## Execution Governance

Modos registrados:

- `draft_test`
- `sandbox`
- `published`
- `blocked`
- `archived`

`POST /execution-precheck` nao executa assistant. Ele retorna `canExecute`, `mode`, `reasons` e `requestId`.

Principais bloqueios:

- assistant arquivado nao executa.
- modo `published` exige assistant publicado, publicacao ativa, `allowPublishedExecution=true` e `isExecutionEnabled=true`.
- sandbox deve bloquear tools externas e providers reais nesta fase.
- sandbox deve exigir logs.

## Auditoria

Eventos novos:

- `assistant_approval_requested`
- `assistant_approval_approved`
- `assistant_approval_rejected`
- `assistant_approval_cancelled`
- `assistant_execution_policy_updated`
- `assistant_sandbox_policy_updated`
- `assistant_execution_blocked`
- `assistant_publish_blocked_by_approval`

Metadata de approval e audit e sanitizada para evitar prompts, instrucoes, tokens, secrets e payloads extensos.

## Validacao Local

O teste focado de governanca cobre approvals, decisions, publish bloqueado por approval, execution policy e execution precheck.

O smoke local foi atualizado para:

- configurar policy exigindo approval para publish;
- solicitar approval de publish;
- aprovar approval;
- publicar com `approvalId`;
- habilitar execution policy published;
- executar prechecks de sandbox e published;
- validar auditoria e erros estruturados.

## Limites

Nao foram implementados:

- runtime real de IA;
- chat/SSE real;
- RAG real;
- MCP real;
- provider real;
- SSO real;
- workflow multi-etapas avancado.
