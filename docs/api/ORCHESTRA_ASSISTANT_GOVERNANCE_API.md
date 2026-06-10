# Orchestra Assistant Governance API

## Escopo

Contratos de approval workflow, execution policy e execution precheck para assistants. Todos os endpoints usam `/api/v1`, sessao via cookie HttpOnly, RBAC server-side e erros estruturados.

## Approval Requests

### Listar approvals

```http
GET /api/v1/assistants/:assistantId/approvals
```

Permissao de rota: `assistants.read`.

### Obter approval

```http
GET /api/v1/assistants/:assistantId/approvals/:approvalId
```

Permissao de rota: `assistants.read`.

### Criar approval

```http
POST /api/v1/assistants/:assistantId/approvals
```

Permissao de rota: `assistants.approval.request`.

Body:

```json
{
  "action": "publish",
  "assistantVersionId": "uuid-opcional",
  "publicationId": "uuid-opcional",
  "reason": "Motivo operacional",
  "metadata": {
    "source": "ui"
  }
}
```

Actions validas: `publish`, `rollback`, `restore`, `enable_execution`, `configure_sandbox`.

### Aprovar, rejeitar ou cancelar

```http
POST /api/v1/assistants/:assistantId/approvals/:approvalId/approve
POST /api/v1/assistants/:assistantId/approvals/:approvalId/reject
POST /api/v1/assistants/:assistantId/approvals/:approvalId/cancel
```

Permissoes de rota:

- approve: `assistants.approval.approve`
- reject: `assistants.approval.reject`
- cancel: `assistants.approval.cancel`

Body:

```json
{
  "decisionReason": "Motivo da decisao"
}
```

Approvals decididos nao podem ser decididos novamente. A API retorna `409 APPROVAL_ALREADY_DECIDED`.

## Publish com Approval

```http
POST /api/v1/assistants/:assistantId/publish
```

Body:

```json
{
  "versionId": "uuid-opcional",
  "approvalId": "uuid-opcional",
  "reason": "Motivo operacional"
}
```

Se `requiresApprovalToPublish=true`, `approvalId` e obrigatorio e deve apontar para approval `approved` da action `publish`. Sem approval, a API retorna `409 APPROVAL_REQUIRED` e audita `assistant_publish_blocked_by_approval`.

## Execution Policy

### Obter policy

```http
GET /api/v1/assistants/:assistantId/execution-policy
```

Permissao de rota: `assistants.read`.

### Atualizar policy

```http
PATCH /api/v1/assistants/:assistantId/execution-policy
```

Permissao de rota: `assistants.execution.configure`.

Body parcial:

```json
{
  "executionMode": "sandbox",
  "requiresApprovalToPublish": true,
  "sandboxEnabled": true,
  "sandboxRequiresAuth": true,
  "sandboxAllowedForRoles": ["admin_platform"],
  "sandboxBlocksExternalTools": true,
  "sandboxBlocksRealProviders": true,
  "sandboxLogsRequired": true,
  "sandboxCostLimitPlaceholder": 25,
  "allowDraftTesting": true,
  "allowPublishedExecution": false,
  "isExecutionEnabled": false
}
```

Regras:

- `sandboxBlocksExternalTools=false` e bloqueado nesta fase.
- `sandboxBlocksRealProviders=false` e bloqueado nesta fase.
- `sandboxLogsRequired=false` e bloqueado nesta fase.
- `executionMode=published` ou `allowPublishedExecution=true` exige publicacao ativa.
- `isExecutionEnabled=true` exige `assistants.execution.enable`.

## Execution Precheck

```http
POST /api/v1/assistants/:assistantId/execution-precheck
```

Permissao de rota: `assistants.read`.

Body:

```json
{
  "mode": "sandbox"
}
```

Response:

```json
{
  "canExecute": false,
  "mode": "published",
  "reasons": [
    {
      "code": "NO_ACTIVE_PUBLICATION",
      "message": "O assistente nao possui publicacao ativa."
    }
  ],
  "requestId": "req_xxx"
}
```

O endpoint nao chama IA e nao simula resposta de assistant.

## Erros Relevantes

- `403 FORBIDDEN`
- `404 ASSISTANT_NOT_FOUND`
- `404 ASSISTANT_APPROVAL_NOT_FOUND`
- `409 APPROVAL_REQUIRED`
- `409 APPROVAL_NOT_APPROVED`
- `409 APPROVAL_ALREADY_DECIDED`
- `422 VALIDATION_ERROR`
- `422 REAL_EXECUTION_NOT_AVAILABLE`
- `422 NO_ACTIVE_PUBLICATION`
