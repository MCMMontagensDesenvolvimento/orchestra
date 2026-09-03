# Orchestra — MCP Execution Approval one-shot (Fase 18F.2E.1A)

Status: implementado em código e migration versionada, sem aplicar migration, alterar HML,
habilitar flags ou executar MCP remoto.

## Objetivo e fronteira

`McpExecutionApproval` é uma autorização humana específica para uma única tool MCP,
uma versão publicada de um Assistant e exatamente um `AgentRun`. Ela não habilita
server, tool, binding, policy, runtime ou egress. O grant só tem efeito quando todos os
demais gates continuam válidos.

O fluxo permanece:

```text
Agno -> Orchestra Tool Gateway -> McpRemoteClient -> MCP remoto
```

Não existe conexão direta Agno -> MCP. `AGNO_ALLOW_REMOTE_MCP` continua `false` e não é
autoridade neste fluxo.

## Threat model

Os riscos tratados nesta fase são replay de approval em outro run, troca de Assistant,
versão, tool ou binding, aprovação expirada, descriptor forjado com
`approvalRequired=false`, corrida entre dois runs, dupla chamada remota, alteração de
governança depois da solicitação e vazamento de argumentos, segredos ou identidade do
aprovador para o runtime.

As defesas são scoping por tenant/workspace, resolução backend-only de versão/server/
binding, binding exato por tool, TTL fixo, claim e consumo com `updateMany` condicionado,
índice único por run, revalidação persistida no gateway e auditoria sem payload bruto.
Qualquer divergência falha fechado antes do transporte remoto.

## Estados

| Estado | Significado | Transições permitidas |
| --- | --- | --- |
| `pending` | solicitação ainda não decidida | `approved`, `rejected`, `cancelled` |
| `approved` | decisão humana concedida, TTL de 10 minutos iniciado | `claimed`, `cancelled`, `expired` |
| `claimed` | reservado atomicamente a um único `AgentRun` | `consumed`, `expired` |
| `rejected` | decisão humana negativa | terminal |
| `cancelled` | revogado antes do claim | terminal |
| `expired` | TTL encerrado antes do consumo | terminal |
| `consumed` | primeira tentativa remota autorizada | terminal |

O TTL começa em `approvedAt`; `expiresAt = approvedAt + 10 minutos`. Expiração é
materializada de forma lazy nas leituras, no claim e na revalidação do gateway, sempre
com evento `mcp_execution_approval_expired` quando a transição é efetivada.

## Request e decisão

As rotas são:

```text
GET  /api/v1/assistants/:id/mcp/execution-approvals
POST /api/v1/assistants/:id/mcp/execution-approvals
POST /api/v1/assistants/:id/mcp/execution-approvals/:approvalId/approve
POST /api/v1/assistants/:id/mcp/execution-approvals/:approvalId/reject
POST /api/v1/assistants/:id/mcp/execution-approvals/:approvalId/cancel
```

O request aceita estritamente `mcpToolId` e `reason` opcional. O backend resolve o
binding exato, o server e a versão da publicação ativa. A tool precisa estar não
removida, ser `low`, declarar `metadata.readOnly=true`, pertencer a server remoto e
continuar com `tool.requiresApproval=true` ou
`binding.requiresApprovalOverride=true`.

As permissões próprias são `mcp.execution_approvals.read`, `.request`, `.approve`,
`.reject` e `.cancel`. Admin pode decidir; creator/editor podem solicitar e cancelar;
consumer/auditor recebem somente leitura, coerente com os papéis atuais. Nenhuma
permissão `assistants.approval.*` concede autoridade sobre execução de tool.

## Relação com AssistantApprovalRequest

`AssistantApprovalRequest` continua governando publicação, rollback, restore e
configuração de execução. Ele não é consultado nem reutilizado para MCP. O novo domínio
tem estados, TTL, escopo e semântica one-shot próprios.

## Claim pelo AgentRun

`createAgentRunSchema` aceita somente `mcpExecutionApprovalId` opcional; `mcpToolId`
separado é rejeitado. Depois do precheck estrutural de um run `published`, o backend
gera o `runId` e tenta o claim condicionado a tenant, workspace, Assistant, versão,
server, tool, binding, status `approved`, TTL vigente e ausência de claim anterior.

O índice único de `claimedByAgentRunId` e o `updateMany` com `count === 1` impedem corrida
e reutilização. Falha produz um `AgentRun` `blocked` com
`MCP_EXECUTION_APPROVAL_INVALID`. Sandbox nunca faz claim nem recebe tool remota por
possuir um approval.

`claimedByAgentRunId` é UUID de correlação, sem FK nesta fase, porque o claim antecede a
persistência final do run. O vínculo lógico é revalidado no gateway.

## Runtime context e Tool Gateway

O contexto interno distingue `requiresApprovalByPolicy` de
`approvalSatisfiedForRun`. Uma tool com approval só entra no conjunto executável se o
grant claimed pertencer ao run atual e todos os gates de risco, READ-ONLY, binding,
server e policy continuarem válidos.

O spec do Agno permanece mínimo: usa `approvalRequired=false` depois da resolução no
control plane, mas não carrega approval ID, identidade do aprovador ou dados do grant.
Esse boolean não é autoridade. O Tool Gateway consulta novamente o
`McpExecutionApproval` claimed pelo `agentRunId` e pelo escopo completo.

Imediatamente antes de `McpRemoteClient.executeTool`, o gateway troca atomicamente
`claimed -> consumed`. Se nenhuma linha for afetada, retorna `approval_required`, mantém
`externalMcpCalled=false` e não toca o transporte. Falha posterior de transporte não
restaura o grant. Depois de persistir `McpToolCall`, o UUID é correlacionado em
`consumedByToolCallId` em best effort, deliberadamente sem FK nesta fase.

## Auditoria

São registrados os eventos:

- `mcp_execution_approval_requested`;
- `mcp_execution_approval_approved`;
- `mcp_execution_approval_rejected`;
- `mcp_execution_approval_cancelled`;
- `mcp_execution_approval_claimed`;
- `mcp_execution_approval_consumed`;
- `mcp_execution_approval_expired`.

Metadata de auditoria contém somente IDs de correlação e escopo. Argumentos completos,
payloads, headers, secrets e respostas remotas não são registrados.

## Rollout RBAC idempotente (18F.2E.1A.1)

O rollout autorizado em HML recebe as cinco permissões
`mcp.execution_approvals.*` por uma data migration versionada e idempotente, executada
pelo fluxo normal de `prisma migrate deploy`. A migration usa `ON CONFLICT DO NOTHING`,
cria somente permissions ausentes e associa apenas roles já existentes chamadas
`admin_platform`, `creator_owner`, `editor`, `consumer` e `auditor`, em qualquer tenant.
Ela não cria roles, não remove grants extras e não altera tenants, workspaces, usuários
ou configuração de execução.

`seed-mcm` não participa desse rollout. A migration RBAC é environment-agnostic e não
contém identidade ou tenant específico. Nesta implementação local ela foi apenas
versionada e testada: nenhuma migration ou seed foi executada em HML.

## Gates que continuam fechados

Esta fase não altera envs ou defaults. Permanecem fechados:

```text
MCP_REMOTE_EXECUTION_ENABLED=false
RUNTIME_ALLOW_EXTERNAL_TOOLS=false
AGNO_ALLOW_REMOTE_MCP=false
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false
```

Também permanecem obrigatórios `MCP_REMOTE_READONLY_ENABLED`, bloqueio de write tools,
detecção de operação perigosa, risk `low`, schemas válidos, policy runtime, egress,
`secretRef` e `maxToolCalls`. A migration não foi executada e nenhuma tool real foi
chamada.

## Rollback

Antes de aplicar a migration, rollback é remover os arquivos desta fase. Depois de uma
aplicação futura autorizada, primeiro fechar gateway/execution, aguardar o TTL de todos
os grants, confirmar ausência de runs ativos e só então executar uma migration de
rollback aprovada que remova a tabela e o enum. Nunca reclassificar approvals consumed,
expired, rejected ou cancelled como approved.
