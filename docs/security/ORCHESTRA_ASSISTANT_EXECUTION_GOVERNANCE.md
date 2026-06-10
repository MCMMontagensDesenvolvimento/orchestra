# Orchestra Assistant Execution Governance

## Objetivo

Definir controles de seguranca para approvals, execution policy e sandbox antes de existir runtime real de IA. O backend e a autoridade para permissoes, decisions e bloqueios.

## Principios

- Frontend apenas exibe a experiencia conforme permissoes recebidas.
- Backend valida permissao de rota e policy de dominio.
- Acoes sensiveis podem exigir approval aprovado.
- Sandbox futuro permanece bloqueado contra tools externas e providers reais nesta fase.
- Precheck informa aptidao operacional, mas nao executa assistant.

## Permissoes

Permissoes adicionadas:

- `assistants.approval.request`
- `assistants.approval.approve`
- `assistants.approval.reject`
- `assistants.approval.cancel`
- `assistants.execution.configure`
- `assistants.execution.sandbox`
- `assistants.execution.enable`
- `assistants.publications.read`
- `assistants.publications.manage`

Permissoes existentes de feedback e test results permanecem server-side.

## Approval Workflow

Approvals sao entidades persistidas e auditaveis. Cada request guarda tenant, workspace, assistant, requester, decision maker opcional, action, status, motivo e metadata sanitizada.

Estados finais nao podem voltar para `pending` pela API atual. Tentar decidir approval ja decidido retorna conflito.

## Sandbox Policy

Campos principais:

- `sandboxEnabled`
- `sandboxRequiresAuth`
- `sandboxAllowedForRoles`
- `sandboxBlocksExternalTools`
- `sandboxBlocksRealProviders`
- `sandboxLogsRequired`
- `sandboxCostLimitPlaceholder`

Nesta fase, policy que libera tools externas ou providers reais e rejeitada. Logs de sandbox sao obrigatorios para preservar rastreabilidade.

## Execution Policy

Campos principais:

- `executionMode`
- `requiresApprovalToPublish`
- `allowDraftTesting`
- `allowPublishedExecution`
- `isExecutionEnabled`

Execucao published exige publicacao ativa. Assistant arquivado nao pode executar. Habilitar execucao usa permissao dedicada.

## Auditoria

Eventos registrados:

- `assistant_approval_requested`
- `assistant_approval_approved`
- `assistant_approval_rejected`
- `assistant_approval_cancelled`
- `assistant_execution_policy_updated`
- `assistant_sandbox_policy_updated`
- `assistant_execution_blocked`
- `assistant_publish_blocked_by_approval`
- `permission_denied`

Metadata de auditoria nao deve conter prompts raw, instrucoes raw, tokens, secrets ou payloads extensos.

## Fora de Escopo

- SSO real.
- Runtime real de IA.
- Providers reais.
- RAG real.
- MCP real.
- Vector store real.
- Chat/SSE real.
- Workflow multi-etapas avancado.
