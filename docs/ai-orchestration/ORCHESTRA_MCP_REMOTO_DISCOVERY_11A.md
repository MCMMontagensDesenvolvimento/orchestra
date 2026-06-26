# Orchestra MCP Remoto Discovery 11A

Status: discovery tecnico e contrato proposto para Sprint 14 / Fase 11A.

Esta subfase nao altera comportamento funcional. O objetivo e registrar o estado atual de MCP no Orchestra, identificar gaps para MCP remoto real governado e definir o contrato minimo para as proximas subfases.

## 1. Resumo Executivo

O Orchestra ja possui uma base MCP relevante no backend:

- catalogo governado de MCP servers, tools, resources e prompts;
- policies por server/tool com `allowRuntimeExecution=false`, `sandboxOnly=true` e `blockedByDefault=true`;
- bindings entre assistants e MCP servers/tools;
- precheck de execucao sandbox;
- persistencia de `McpToolCall` e `McpToolCallEvent`;
- auditoria sanitizada;
- runtime context que envia somente descritores/resumos MCP, sem tool calling autonomo.

Ainda nao existe MCP remoto real. O codigo atual nao abre conexao com MCP server, nao faz healthcheck remoto, nao descobre tools por transporte MCP e nao executa tools externas. A decisao correta para 11A e preservar o comportamento atual e documentar um contrato fail-closed para 11B/11C.

O Orchestra deve continuar sendo o control plane: tenant, workspace, RBAC, catalogo oficial, policies, bindings, audit, limits, readiness e secrets backend-only. Runtimes futuros, incluindo Agno/AgentOS ou runtime on-premise, devem receber apenas uma especificacao governada e sanitizada, nunca secrets brutos.

## 2. Estado Atual MCP No Codigo

### Backend

Modulo principal:

- `backend/src/modules/mcp/mcp.routes.ts`
- `backend/src/modules/mcp/mcp.controller.ts`
- `backend/src/modules/mcp/mcp.service.ts`
- `backend/src/modules/mcp/mcp.repository.ts`
- `backend/src/modules/mcp/mcp.schema.ts`
- `backend/src/modules/mcp/mcp.mapper.ts`
- `backend/src/modules/mcp/index.ts`

O modulo MCP esta registrado em `backend/src/app/routes.ts` sob `/api/v1/mcp`. As rotas de bindings e sandbox por assistant sao registradas junto das rotas de assistants via `registerAssistantMcpBindingRoutes`.

O fluxo atual e todo backend-first:

1. rotas exigem `requireAuth`;
2. rotas exigem permissoes granulares;
3. schemas Zod validam payloads e bloqueiam chaves sensiveis em JSON/templates/input;
4. services validam tenant/workspace, estado de assistant/server/tool/binding e policy;
5. repository acessa Prisma sempre escopando tenant/workspace;
6. mapper retorna DTOs para API;
7. audit log registra acoes com metadata sanitizada.

### Prisma

Modelos MCP atuais:

- `McpServer`
- `McpTool`
- `McpResource`
- `McpPrompt`
- `AssistantMcpBinding`
- `McpToolPolicy`
- `McpToolCall`
- `McpToolCallEvent`

Migrations relevantes:

- `backend/prisma/migrations/20260611160000_phase06_knowledge_mcp_catalog/migration.sql`
- `backend/prisma/migrations/20260612100000_phase06d_mcp_execution_sandbox/migration.sql`

### Runtime

Arquivos relevantes:

- `backend/src/modules/runtime/runtime.types.ts`
- `backend/src/modules/runtime/runtime.context.ts`
- `backend/src/modules/runtime/runtime.local-adapter.ts`
- `backend/src/modules/runtime/runtime.agno-adapter.ts`
- `backend/src/modules/runtime/runtime.config.ts`
- `backend/src/modules/agent-runs/agent-runs.repository.ts`
- `backend/src/modules/agent-runs/agent-runs.service.ts`

O runtime recebe `RuntimeMcpSummary`, nao credenciais nem payloads completos. O Agno adapter pode anexar descritores MCP governados quando `AGNO_SEND_MCP_TOOL_DESCRIPTORS=true`, mas `toolCallingEnabled=false` e `remoteMcpAllowed=false`.

### Frontend

Arquivos relacionados, sem alteracao nesta fase:

- `frontend/src/services/mcp.service.ts`
- `frontend/src/hooks/queries/useMcp.ts`
- `frontend/src/pages/MCP/McpHubPage.tsx`
- `frontend/src/pages/MCP/McpDetailPage.tsx`
- `frontend/src/pages/Assistants/AssistantDetailPage.tsx`
- `frontend/src/data/mockData.ts`

O frontend consome catalogo, bindings, precheck sandbox e historico de tool calls. Tambem possui mocks e placeholders de health/sync/credenciais.

### Testes

Arquivos relevantes:

- `backend/tests/api/knowledge-mcp-catalog.test.ts`
- `backend/tests/runtime/agno-adapter.test.ts`
- `backend/tests/api/runtime.test.ts`
- `frontend/src/test/real-api-services.test.ts`

A cobertura backend valida catalogo MCP, bindings, precheck sandbox, tool calls sandbox, historico/eventos, erros estruturados, bloqueios por policy e sanitizacao basica.

### Docs Existentes

Documentos ja existentes:

- `docs/backend/ORCHESTRA_KNOWLEDGE_MCP_CATALOG.md`
- `docs/backend/ORCHESTRA_MCP_EXECUTION_SANDBOX.md`
- `docs/backend/ORCHESTRA_MCP_TOOL_CALLS.md`
- `docs/api/ORCHESTRA_KNOWLEDGE_MCP_CATALOG_API.md`
- `docs/api/ORCHESTRA_MCP_EXECUTION_API_CONTRACTS.md`
- `docs/security/ORCHESTRA_MCP_EXECUTION_SECURITY.md`
- `docs/ai-orchestration/ORCHESTRA_MCP_EXECUTION_HANDOFF.md`
- `docs/ai-orchestration/ORCHESTRA_RUNTIME_ADAPTER_HANDOFF.md`

## 3. Arquivos, Tabelas, Rotas, Services E Testes Encontrados

### Tabelas / Modelos

`McpServer` representa o registro oficial do servidor MCP no control plane:

- `tenantId`, `workspaceId`;
- `name`, `description`;
- `serverType`;
- `baseUrl`;
- `status`;
- `trustLevel`;
- `riskLevel`;
- `authType`;
- `secretRef`;
- `metadata`;
- relacionamentos com tools, resources, prompts, bindings, policies e tool calls.

`McpTool` representa uma tool catalogada:

- `tenantId`, `workspaceId`, `mcpServerId`;
- `name`, `description`;
- `inputSchema`, `outputSchema`;
- `riskLevel`, `requiresApproval`, `isEnabled`;
- `metadata`;
- soft archive via `deletedAt`.

`McpResource` e `McpPrompt` representam catalogo estrutural, nao discovery remoto real.

`AssistantMcpBinding` liga assistant a server ou tool:

- `assistantId`;
- `mcpServerId`;
- `mcpToolId` opcional;
- `isEnabled`;
- `mode`: `disabled`, `sandbox_only`, `enabled_placeholder`;
- `requiresApprovalOverride`.

`McpToolPolicy` define defaults fail-closed:

- `allowRuntimeExecution=false`;
- `sandboxOnly=true`;
- `requiresApproval`;
- `blockedByDefault=true`.

`McpToolCall` e `McpToolCallEvent` registram tentativas sandbox:

- ids de tenant/workspace/assistant/server/tool/binding/user;
- `mode=sandbox`;
- `status`;
- snapshots de risco/aprovacao/policy;
- `requestId`, `traceId`;
- `inputHash`, `inputPreview`, `outputPreview`;
- erro e eventos.

### Rotas MCP

Catalogo:

- `GET /api/v1/mcp/servers`
- `POST /api/v1/mcp/servers`
- `GET /api/v1/mcp/servers/:id`
- `PATCH /api/v1/mcp/servers/:id`
- `POST /api/v1/mcp/servers/:id/archive`
- `POST /api/v1/mcp/servers/:id/restore`
- `GET /api/v1/mcp/servers/:id/tools`
- `POST /api/v1/mcp/servers/:id/tools`
- `PATCH /api/v1/mcp/tools/:toolId`
- `POST /api/v1/mcp/tools/:toolId/archive`
- `GET /api/v1/mcp/servers/:id/resources`
- `POST /api/v1/mcp/servers/:id/resources`
- `GET /api/v1/mcp/servers/:id/prompts`
- `POST /api/v1/mcp/servers/:id/prompts`

Bindings:

- `GET /api/v1/assistants/:id/mcp-bindings`
- `POST /api/v1/assistants/:id/mcp-bindings`
- `PATCH /api/v1/assistants/:id/mcp-bindings/:bindingId`
- `DELETE /api/v1/assistants/:id/mcp-bindings/:bindingId`

Sandbox:

- `POST /api/v1/assistants/:id/mcp/precheck`
- `POST /api/v1/assistants/:id/mcp/tool-calls`
- `GET /api/v1/assistants/:id/mcp/tool-calls`
- `GET /api/v1/mcp/tool-calls`
- `GET /api/v1/mcp/tool-calls/:toolCallId`
- `GET /api/v1/mcp/tool-calls/:toolCallId/events`

### Permissoes MCP

Seeds incluem:

- `mcp.read`
- `mcp.manage`
- `mcp.create`
- `mcp.update`
- `mcp.archive`
- `mcp.restore`
- `mcp.bind`
- `mcp.tools.read`
- `mcp.tools.manage`
- `mcp.policies.manage`
- `execution.precheck`
- `execution.run_sandbox`

Nem todas aparecem em todas as roles; as rotas usam permissoes granulares. Para MCP remoto real, a autorizacao deve continuar em backend e deve separar discovery, readiness e execution real de permissoes de catalogo.

### Services / Responsabilidades

`mcp.service.ts` concentra:

- workspace scope;
- criacao/atualizacao/archive/restore de server;
- criacao/atualizacao/archive de tool;
- criacao de resources/prompts;
- bindings assistant-MCP;
- precheck sandbox;
- criacao de tool call sandbox;
- historico/eventos;
- auditoria.

`mcp.repository.ts` concentra:

- queries Prisma escopadas por tenant/workspace;
- includes de server/tool/binding/policies;
- criacao atomica de `McpToolCall` + `McpToolCallEvent`;
- anexacao opcional de eventos em `AgentRunEvent`.

`runtime.context.ts` transforma bindings MCP em resumo governado:

- `allowedSandboxTools`;
- `blockedTools`;
- `requiresApproval`;
- `lastToolCallIds`.

## 4. Fluxo Atual

### Catalogo

1. Usuario autenticado chama rota MCP.
2. RBAC valida permissao.
3. Schema Zod valida payload e rejeita JSON com chaves sensiveis.
4. Service resolve ou valida workspace.
5. Repository persiste ou lista dados.
6. Audit log registra acao.
7. Mapper retorna DTO com dados de catalogo e policy.

### Binding

1. Usuario cria binding em `/assistants/:id/mcp-bindings`.
2. Backend valida assistant e MCP server no mesmo tenant/workspace.
3. Backend valida server ativo e tool habilitada.
4. Override que remove approval de tool high/critical e bloqueado.
5. Binding e criado ou reativado.
6. Audit log registra.

### Precheck Sandbox

1. Usuario chama `/assistants/:id/mcp/precheck`.
2. Backend busca assistant, tool, policy de execucao e bindings.
3. Backend valida workspace, status do assistant/server/tool, binding e policy.
4. Backend calcula `allowed`, `blocked` ou `approval_required`.
5. Audit log registra `mcp_execution_precheck_allowed` ou `mcp_execution_precheck_blocked`.
6. Nenhuma chamada MCP externa e feita.

### Tool Call Sandbox

1. Usuario chama `/assistants/:id/mcp/tool-calls`.
2. Backend executa o mesmo precheck.
3. Backend grava `McpToolCall` e `McpToolCallEvent`.
4. Se bloqueado ou approval required, persiste decisao e nao executa nada externo.
5. Se permitido, gera output sintetico local.
6. Quando ha `agentRunId`, eventos tambem podem ser anexados a `AgentRunEvent`.

### Runtime

O runtime atual recebe somente resumo MCP governado. Local adapter e Agno adapter nao executam tools MCP externas. O Agno adapter monta `mcpContext.tools` como descritores e mantem `toolCallingEnabled=false`.

## 5. Gaps Para MCP Remoto Real

### Transporte

Nao ha cliente MCP remoto. Falta decidir e implementar transportes suportados:

- streamable HTTP;
- SSE quando necessario;
- stdio apenas em runtime controlado/on-premise, nao a partir do frontend;
- negociacao de protocolo/version.

### Autenticacao

`authType` e `secretRef` existem, mas nao ha resolucao real de credenciais, OAuth, mTLS, refresh ou rotacao. O contrato deve aceitar apenas referencias backend-only.

### Secret Handling

Existe `secretRef`, mas nao ha secrets manager integrado. A API hoje pode retornar `secretRef` ao frontend via mapper/service frontend. Para MCP remoto real, o frontend deve receber no maximo flags como `credentialsConfigured`, `credentialKind` e `lastRotatedAt`, nunca o valor nem o identificador interno completo do secret.

### Health / Readiness

Nao ha readiness remoto MCP. O que existe hoje e status de catalogo + precheck sandbox por assistant/tool. Faltam:

- healthcheck de servidor;
- handshake de protocolo;
- verificacao de auth;
- discovery status;
- version/spec hash;
- validade de allowlist;
- fail-closed explicito por server/tool.

### Tool Discovery

Tools sao cadastradas manualmente. Nao ha descoberta remota, diff de spec, approval de novas tools nem versionamento de schema.

### Allowlist / Denylist

Existe binding e policy estrutural, mas nao ha allowlist/denylist formal por nome de tool, metodo, schema, risco, workspace ou runtime. O comportamento atual e bloqueado por default via policy.

### Execucao

Nao ha execucao real. A tool call sandbox cria output deterministico local. Faltam:

- client remoto;
- payload builder;
- validacao de input contra schema real;
- timeout;
- cancelamento;
- retry seguro;
- rate limit;
- normalizacao de erros;
- sanitizacao de output;
- persistencia de request/response metadata segura;
- streaming/eventos remotos.

### Timeout / Rate Limit

Nao ha limite MCP remoto porque nao ha chamada remota. O contrato deve exigir timeout por server/tool, max input/output bytes, max duration, max concurrency e rate limit por tenant/workspace/assistant/tool.

### Audit

Audit atual cobre catalogo, binding, precheck e sandbox call. Falta ampliar para:

- health/readiness remoto;
- discovery iniciado/concluido/falhado;
- diff de tools;
- approval de spec;
- execucao real iniciada/concluida/falhada/cancelada;
- credencial resolvida sem revelar segredo;
- policy decision final.

### Tenant / Workspace Isolation

O escopo atual e bom: tenant/workspace esta em models e queries. Para remoto real, a resolucao de secret, cache de discovery, rate limit e runtime execution tambem precisam usar tenant/workspace como chave primaria de isolamento.

### Rollback / Fail-Closed

O padrao atual ja falha fechado. A execucao remota deve ser opt-in por server/tool/binding/runtime e retornar bloqueio controlado se qualquer dependencia estiver ausente.

## 6. Contrato Proposto Para MCP Server Remoto

O contrato de server remoto deve ser interno ao backend e consumivel por diferentes runtimes sem acoplamento.

### Entidade Governada

Campos minimos:

```ts
type GovernedMcpServer = {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  serverType: 'remote' | 'local' | 'internal' | 'external';
  baseUrl: string;
  status: 'active' | 'disabled' | 'archived';
  trustLevel: 'trusted' | 'restricted' | 'experimental';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  authType: 'none' | 'api_key' | 'bearer' | 'oauth' | 'mTLS' | 'other';
  credentialRef?: string;
  protocol: {
    version?: string;
    transport: 'http' | 'sse' | 'stdio';
    healthPath?: string;
    discoveryMethod: 'mcp_tools_list' | 'static_catalog';
  };
  networkPolicy: {
    allowedHosts: string[];
    deniedHosts: string[];
    requireTls: boolean;
    allowPrivateNetwork: boolean;
  };
  limits: {
    timeoutMs: number;
    maxInputBytes: number;
    maxOutputBytes: number;
    maxConcurrency: number;
    rateLimitPerMinute: number;
  };
  readiness: McpRemoteReadiness;
  policy: GovernedMcpPolicy;
};
```

### Readiness

```ts
type McpRemoteReadiness = {
  status: 'ready' | 'disabled' | 'misconfigured' | 'unhealthy' | 'auth_failed' | 'discovery_required' | 'blocked';
  failClosed: boolean;
  checkedAt?: string;
  reason: string;
  checks: Array<{
    name: 'catalog' | 'network' | 'auth' | 'health' | 'protocol' | 'discovery' | 'policy';
    status: 'pass' | 'fail' | 'skipped';
    message?: string;
  }>;
};
```

### Regras

- `status !== active` implica `failClosed=true`.
- `readiness.status !== ready` implica `failClosed=true`.
- `credentialRef` nunca sai do backend como secret bruto.
- `baseUrl` deve ser validada contra network policy.
- URLs privadas, loopback ou metadata endpoints devem ser bloqueados por default para servers remotos multi-tenant, salvo modo on-premise controlado.
- Runtimes recebem server/tool descriptors governados, nao credenciais.

## 7. Contrato Proposto Para Tool Discovery

Discovery deve ser uma acao governada e auditavel, nao um sync automatico livre.

### Request Interna

```ts
type McpToolDiscoveryRequest = {
  tenantId: string;
  workspaceId: string;
  serverId: string;
  requestedByUserId: string;
  requestId: string;
  mode: 'dry_run' | 'apply_after_approval';
  timeoutMs: number;
};
```

### Response Interna

```ts
type McpToolDiscoveryResult = {
  serverId: string;
  status: 'completed' | 'failed' | 'blocked';
  protocolVersion?: string;
  discoveredAt: string;
  specHash: string;
  tools: Array<{
    externalName: string;
    displayName: string;
    description?: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
    inferredRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    requiresApproval: boolean;
    defaultPolicy: {
      allowRuntimeExecution: false;
      sandboxOnly: true;
      blockedByDefault: true;
    };
  }>;
  diff: {
    added: string[];
    changed: string[];
    removed: string[];
  };
  warnings: Array<{ code: string; message: string }>;
};
```

### Regras

- Discovery real deve ser backend-only.
- Resultado novo ou alterado deve ficar pendente de aprovacao antes de habilitar runtime execution.
- Tool removida remotamente deve ficar disabled/blocked localmente, nao deletada em cascata automaticamente.
- Schemas devem ser limitados em tamanho e sanitizados.
- Nome externo da tool deve ser separado de nome exibido.
- Cada discovery deve gerar audit log e, futuramente, uma tabela de snapshot/spec hash.

## 8. Contrato Proposto Para Tool Execution

Execucao real deve passar por uma especificacao governada criada pelo Orchestra.

### Spec Governada Entregue Ao Runtime / Client

```ts
type GovernedMcpToolExecutionSpec = {
  executionId: string;
  tenantId: string;
  workspaceId: string;
  assistantId: string;
  assistantVersionId?: string | null;
  agentRunId?: string | null;
  mcpServerId: string;
  mcpToolId: string;
  assistantMcpBindingId: string;
  requestedByUserId: string;
  mode: 'remote_controlled';
  requestId: string;
  traceId: string;
  tool: {
    externalName: string;
    displayName: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    requiresApproval: boolean;
  };
  policyDecision: {
    status: 'allowed';
    decidedAt: string;
    reasons: string[];
    allowRuntimeExecution: true;
    approvalSatisfied: boolean;
    sandboxRequired: boolean;
  };
  limits: {
    timeoutMs: number;
    maxInputBytes: number;
    maxOutputBytes: number;
  };
  input: {
    hash: string;
    preview?: string;
    value: unknown;
  };
};
```

### Resultado Normalizado

```ts
type GovernedMcpToolExecutionResult = {
  executionId: string;
  status: 'completed' | 'failed' | 'blocked' | 'cancelled' | 'timeout';
  outputPreview?: string;
  outputHash?: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
  events: Array<{
    type: string;
    status?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }>;
  sanitizedMetadata?: Record<string, unknown>;
};
```

### Regras

- Precheck deve ser reexecutado imediatamente antes da chamada remota.
- Execucao real so deve ocorrer se server, tool, binding, readiness, approval e policy estiverem `allowed`.
- Tool high/critical exige approval satisfeita.
- Input deve validar contra schema e limite de tamanho.
- Output deve ser truncado/sanitizado antes de persistir ou retornar ao frontend.
- Secrets devem ser resolvidos somente dentro de `McpRemoteClient` ou equivalente backend-only.
- Runtime externo recebe credencial apenas se for o executor autorizado e isolado; o frontend nunca recebe.

## 9. Seguranca E Secrets

Controles atuais:

- `mcp.schema.ts` rejeita chaves sensiveis em JSON de catalogo, templates e input de sandbox.
- `mcp.service.ts` sanitiza audit metadata.
- `McpToolCall` persiste `inputHash` e `inputPreview`, nao payload bruto completo.
- runtime context nao inclui secrets.
- Agno adapter sanitiza metadata e envia `toolCallingEnabled=false`.

Gaps:

- `secretRef` e aceito em `McpServer` e mapeado para API. Embora nao seja secret bruto, pode revelar detalhes internos de vault. Para 11B, trocar a resposta publica por flags sanitizadas.
- Nao ha secrets manager/vault integrado para MCP.
- Nao ha rotacao, expiracao, escopo por workspace nem envelope encryption documentados no modelo atual.

Contrato recomendado:

- `credentialRef` deve ser opaco e backend-only.
- Frontend deve receber apenas `credentialsConfigured`, `credentialStatus`, `authType` e timestamps sanitizados.
- Audit deve registrar `credentialResolved=true/false`, nunca valores.
- Logs, errors e eventos devem passar por sanitizacao com denylist de `secret`, `token`, `password`, `apiKey`, `authorization`, `cookie`, `privateKey` e variantes.

## 10. Auditoria

Eventos atuais:

- `mcp_server_created`
- `mcp_server_updated`
- `mcp_server_archived`
- `mcp_server_restored`
- `mcp_tool_created`
- `mcp_tool_updated`
- `mcp_tool_archived`
- `mcp_policy_updated`
- `mcp_resource_created`
- `mcp_prompt_created`
- `mcp_binding_created`
- `mcp_binding_updated`
- `mcp_binding_removed`
- `mcp_execution_precheck_allowed`
- `mcp_execution_precheck_blocked`
- `mcp_tool_call_created`
- `mcp_tool_call_completed`
- `mcp_tool_call_blocked`
- `mcp_tool_call_approval_required`
- `permission_denied`

Eventos recomendados para 11B/11C:

- `mcp_remote_readiness_checked`
- `mcp_remote_discovery_started`
- `mcp_remote_discovery_completed`
- `mcp_remote_discovery_failed`
- `mcp_remote_tool_spec_changed`
- `mcp_remote_execution_started`
- `mcp_remote_execution_completed`
- `mcp_remote_execution_failed`
- `mcp_remote_execution_timeout`
- `mcp_remote_execution_cancelled`
- `mcp_remote_credentials_resolved`
- `mcp_remote_credentials_missing`

Cada evento deve incluir tenant, workspace, actor, requestId, traceId, serverId/toolId quando aplicavel, policy decision e metadata sanitizada.

## 11. Tenant / Workspace Isolation

O isolamento atual e consistente:

- models MCP carregam `tenantId` e `workspaceId`;
- repositories filtram por tenant/workspaces da sessao;
- bindings exigem mesmo workspace entre assistant e MCP server;
- tool calls guardam tenant/workspace/assistant/server/tool/binding/user;
- runtime context summary busca apenas por tenant/workspace/assistant.

Para MCP remoto real, o mesmo principio deve valer para:

- cache de readiness;
- cache/snapshot de discovery;
- resolucao de secrets;
- rate limit;
- filas ou workers;
- runtime execution;
- auditoria;
- metricas.

Nenhum runtime deve inferir permissao a partir de dados recebidos. Ele deve consumir uma decisao governada do Orchestra e, quando possivel, revalidar ids/policies.

## 12. Fail-Closed / Readiness

O comportamento atual ja e fail-closed:

- servers disabled/archived bloqueiam binding/execucao;
- tools disabled/archived bloqueiam execucao;
- binding ausente/desabilitado bloqueia execucao;
- policy de assistant precisa permitir sandbox e logs;
- `allowRuntimeExecution` permanece false;
- high/critical exige approval;
- Agno/local runtime nao executa tool MCP real.

Readiness MCP remoto recomendado:

1. `catalog`: server cadastrado, ativo, nao arquivado.
2. `policy`: runtime execution explicitamente habilitada para server/tool.
3. `binding`: assistant-tool permitido e approval satisfeito.
4. `network`: destino aprovado por network policy.
5. `auth`: credencial configurada e valida.
6. `health`: servidor responde health/handshake.
7. `discovery`: spec atual conhecida e aprovada.
8. `limits`: timeout/rate limit/concurrency disponiveis.

Qualquer falha deve retornar `blocked` ou `misconfigured`, nunca tentar execucao remota por fallback implicito.

## 13. Relacao Com Runtime Atual

O runtime atual deve continuar desacoplado:

- `RuntimeExecutionContext.mcp` contem resumo e descriptors permitidos em sandbox;
- `LocalDeterministicRuntimeAdapter` usa o resumo para eventos/output deterministico;
- `AgnoRuntimeAdapter` envia descriptors governados, mas `toolCallingEnabled=false`;
- `AgnoRuntimeAdapter` marca `remoteMcpAllowed=false` no policy snapshot;
- tool calls reais continuam fora do runtime atual.

Para 11B/11C, criar services de MCP remoto antes de plugar runtime:

- `McpServerRegistry`;
- `McpRemoteClient`;
- `McpToolDiscoveryService`;
- `McpToolExecutionService`;
- `McpPolicyService`;
- `McpAuditService`.

O runtime deve receber uma `GovernedMcpToolExecutionSpec` ja validada, nao montar policies por conta propria.

## 14. Preparacao Para Agno / AgentOS Futuro

Agno/AgentOS deve entrar como runtime/adapter plugavel, nao como fonte da verdade de MCP.

Preparacao recomendada:

- manter catalogo e policies no Orchestra;
- expor para Agno somente descriptors governados;
- manter `remoteMcpAllowed=false` ate 11C;
- quando habilitar, enviar specs assinadas ou verificaveis, com ids e policy snapshot;
- evitar que Agno descubra ou execute tools fora do catalogo oficial;
- exigir que callbacks/eventos retornem `executionId`, `requestId` e `traceId`;
- manter secrets no backend ou em runtime on-premise autorizado, nunca no frontend;
- registrar todos os resultados no `McpToolCall`/eventos do Orchestra.

Fluxo futuro esperado:

```txt
Frontend
  -> Orchestra Backend
  -> MCP policy/precheck/readiness
  -> GovernedMcpToolExecutionSpec
  -> Runtime interno, Agno ou on-premise adapter
  -> McpRemoteClient autorizado
  -> Resultado normalizado
  -> McpToolCall + AuditLog + AgentRunEvent
```

## 15. Plano Incremental 11B / 11C / 11D

### 11B: Contratos Backend E Readiness Fail-Closed

- Criar types/interfaces backend para server remoto, readiness, discovery e execution spec.
- Criar `McpRemoteClient` stub fail-closed sem chamada externa real.
- Criar `McpRemoteReadinessService` estrutural.
- Adicionar testes unitarios sem internet.
- Nao alterar frontend.
- Nao criar secrets reais.
- Nao habilitar execucao remota.

### 11C: Discovery Remoto Governado

- Implementar discovery real atras de feature flag backend-only.
- Resolver credenciais via secret manager ou provider stub seguro.
- Executar handshake/health com timeout.
- Persistir snapshot/spec hash se necessario.
- Gerar diff e exigir aprovacao antes de atualizar tools.
- Auditar discovery.
- Manter execucao remota bloqueada.

### 11D: Execucao Remota Controlada

- Implementar execucao remota opt-in por server/tool/binding.
- Exigir readiness `ready`, approval e policy explicita.
- Adicionar timeouts, rate limits, output sanitization e cancelamento.
- Persistir `McpToolCall` com modo remoto controlado.
- Integrar runtime interno primeiro; Agno/AgentOS depois via adapter.
- Manter rollback simples por feature flag e policy.

## 16. Criterios De Aceite Da 11A

- Discovery MCP atual concluido.
- Tabelas/modelos MCP atuais mapeados.
- Endpoints MCP atuais mapeados.
- Permissoes MCP atuais mapeadas.
- Mock mode e frontend relacionado identificados.
- Bindings assistant-MCP documentados.
- Readiness atual descrita como precheck/status sandbox, sem readiness remoto real.
- Confirmado que nao ha execucao MCP externa real.
- Gaps para remoto real documentados.
- Contrato minimo de MCP server remoto proposto.
- Contrato minimo de tool discovery proposto.
- Contrato minimo de tool execution proposto.
- Auditoria, allowlist/denylist, tenant/workspace e fail-closed descritos.
- Preparacao para Agno/AgentOS documentada.
- README de `docs/ai-orchestration` atualizado.
- Nenhuma feature funcional nova.
- Nenhum segredo real adicionado.
- Nenhum frontend, Auth/SSO, RAG, embeddings, Prisma ou runtime alterado.

## 17. Riscos E Rollback

### Riscos

- Expor `secretRef` completo ao frontend pode revelar detalhe operacional de vault futuro.
- Habilitar execucao remota antes de readiness/discovery/policy formal pode abrir tool abuse.
- Permitir discovery automatico sem aprovacao pode incluir tools perigosas no catalogo.
- Acoplar MCP diretamente ao Agno dificultaria runtime interno/on-premise.
- Falta de rate limit/timeout pode causar consumo indevido ou indisponibilidade.
- Falta de network policy pode permitir SSRF ou acesso indevido a redes internas.
- Persistir output bruto pode vazar dados sensiveis.

### Rollback

Para 11A, rollback e apenas documental: reverter este documento e a entrada no README.

Para 11B/11C/11D, cada incremento deve ter feature flag e falhar fechado:

- desabilitar remote readiness/discovery/execution por env/policy;
- manter `allowRuntimeExecution=false` por default;
- retornar `blocked`/`misconfigured` sem chamar rede;
- preservar catalogo e sandbox existentes;
- nao remover dados historicos de `McpToolCall`.

## Respostas Diretas Aos Pontos Do Discovery

1. Tabelas/modelos MCP existentes: `McpServer`, `McpTool`, `McpResource`, `McpPrompt`, `AssistantMcpBinding`, `McpToolPolicy`, `McpToolCall`, `McpToolCallEvent`.
2. Endpoints MCP existentes: catalogo `/mcp/servers`, tools/resources/prompts, bindings em `/assistants/:id/mcp-bindings`, precheck/tool-calls sandbox e historico/eventos.
3. Permissoes MCP existentes: `mcp.*`, `mcp.tools.*`, `mcp.policies.manage`, alem de `execution.precheck` e `execution.run_sandbox`.
4. Mock mode: frontend usa `VITE_USE_MOCKS` em `frontend/src/services/mcp.service.ts`; backend tests usam mocks de repository/service; sandbox backend e deterministico, mas e funcionalmente real no banco.
5. Binding assistant-MCP: existe via `AssistantMcpBinding`, com binding por server e opcionalmente por tool.
6. Readiness MCP hoje: nao ha readiness remoto; ha status de server/tool/binding/policy e precheck sandbox por assistant/tool.
7. Execucao real de tool hoje: nao. Ha execucao sandbox local deterministica e persistida, sem chamada MCP externa.
8. Secrets/config sensivel: hoje existe `McpServer.secretRef` como referencia. Nao ha secrets manager MCP real. Futuro deve usar vault/backend-only.
9. Frontend recebe algo sensivel hoje: nao recebe secret bruto, mas recebe `secretRef`; isto deve ser tratado como gap e substituido por flags sanitizadas antes de MCP remoto real.
10. O que precisa mudar: transporte, auth, secrets manager, readiness, discovery, allowlist/denylist, execution service, timeouts, rate limits, audit ampliada e isolation para caches/workers.
11. Contrato minimo de server remoto: `GovernedMcpServer` com protocolo, network policy, limits, readiness e policy.
12. Contrato minimo de discovery: request backend-only, result com spec hash, tools normalizadas, diff, warnings e audit.
13. Contrato minimo de execution: `GovernedMcpToolExecutionSpec` + result normalizado, com policy decision e limits.
14. Auditoria: registrar readiness, discovery, spec change, execution lifecycle, credential status e policy decision.
15. Allowlist/denylist: aplicar por server/tool/workspace/runtime/network/schema/risk antes de readiness e antes de execution.
16. Caminho para Agno: Agno consome specs/descriptors governados; Orchestra permanece control plane e fonte da verdade; secrets ficam backend-only.
