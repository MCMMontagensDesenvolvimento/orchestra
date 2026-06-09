# Orquestra — Inventário de Entidades do Frontend

> Inventário das entidades atualmente representadas no protótipo frontend (Lovable).
> Base: `src/types/index.ts`, `src/types/chat.ts`, `src/data/mockData.ts`, `src/services/*`, `src/hooks/queries/*`, `src/pages/*`.
>
> **Escopo:** apenas mapeamento; nenhum código foi alterado.
> **Convenção do nível de prontidão (0–5):**
> - 0 — apenas conceito, sem type/mock/UI
> - 1 — type existe, sem UI
> - 2 — type + mock, UI mínima
> - 3 — type + mock + UI de listagem/detalhe + hook/service
> - 4 — fluxo completo de leitura + ações visuais principais
> - 5 — pronto para integração 1:1 com API real (apenas trocar mock por HTTP)

---

## 1. Entidades principais de produto

### 1.1 Assistant
- **UI:** lista, detalhe, wizard de criação/edição (12 etapas), seleção no Chat.
- **Arquivos:** `pages/Assistants/AssistantsPage.tsx`, `AssistantDetailPage.tsx`, `AssistantWizardPage.tsx`; `pages/Chat/ChatPage.tsx`.
- **Mock:** `mockAssistants`.
- **Type:** `Assistant` (`src/types/index.ts`).
- **Service/Hook:** `assistantsService.list/get`; `useAssistants`, `useAssistant`.
- **Ações visuais:** listar, filtrar, ver detalhes, abrir wizard, navegar para chat.
- **Ações ausentes:** salvar/publicar/arquivar de fato, duplicar, exportar, rollback de versão, comparar versões.
- **Prontidão:** 4
- **Recomendações backend:** CRUD completo, versionamento, publish/archive, RBAC por workspace, soft delete, auditoria de mudanças.

### 1.2 AssistantVersion
- **UI:** aba “Versões” em `AssistantDetailPage`.
- **Mock:** `mockAssistantVersions`. **Type:** `AssistantVersion`. **Service/Hook:** `assistantsService.versions`, `useAssistantVersions`.
- **Ações visuais:** listar versões e changelog.
- **Ações ausentes:** criar versão, promover, rollback, diff entre versões.
- **Prontidão:** 3
- **Recomendações:** imutabilidade por versão, hash do prompt compilado, autor + timestamp confiável.

### 1.3 AssistantFeedback
- **UI:** aba “Feedback” em `AssistantDetailPage`; também emitido no Chat via `FeedbackBar`.
- **Mock:** `mockAssistantFeedbacks`. **Type:** `AssistantFeedback`. **Service/Hook:** `assistantsService.feedback`, `useAssistantFeedback`.
- **Ações visuais:** listar feedbacks, registrar 👍/👎 com razão estruturada (apenas local).
- **Ações ausentes:** persistir feedback, agregação por versão/modelo, exportação.
- **Prontidão:** 3
- **Recomendações:** vincular a `conversation_id` + `message_id` + `assistant_version_id`.

### 1.4 AssistantTestResult
- **UI:** aba “Testes” em `AssistantDetailPage`.
- **Mock:** `mockTestResults`. **Type:** `AssistantTestResult`. **Service/Hook:** `assistantsService.testResults`, `useAssistantTestResults`.
- **Ações visuais:** listar execuções de teste com latência/tokens.
- **Ações ausentes:** disparar teste real, suíte de regressão, baseline.
- **Prontidão:** 2
- **Recomendações:** runner desacoplado, armazenar prompt/resposta/golden answers.

### 1.5 AssistantWizardFormData
- **UI:** wizard de criação/edição (12 etapas).
- **Type:** `AssistantWizardFormData`. **Mock/Service:** não persistido.
- **Ações visuais:** preencher formulário e navegar etapas.
- **Ações ausentes:** salvar rascunho, validar, submeter, retomar.
- **Prontidão:** 2
- **Recomendações:** endpoint de draft autosave, schema validation server-side.

---

## 2. Entidades de IA / runtime

### 2.1 Conversation
- **UI:** painel lateral do Chat.
- **Arquivo:** `pages/Chat/ChatPage.tsx`.
- **Mock:** `mockConversations`. **Type:** `Conversation`. **Service/Hook:** `chatService.conversations`, `useConversations`.
- **Ações visuais:** listar, selecionar, exibir título/último resumo.
- **Ações ausentes:** criar, renomear, excluir, arquivar, buscar.
- **Prontidão:** 3
- **Recomendações:** pertencimento a user+assistant+workspace, paginação, retenção.

### 2.2 ConversationMessage
- **UI:** thread principal do Chat.
- **Mock:** `mockMessages`. **Type:** `ConversationMessage`. **Service/Hook:** `chatService.messages`, `useMessages`.
- **Ações visuais:** renderizar mensagens user/assistant, modelo usado, fontes, tools, feedback local.
- **Ações ausentes:** envio real, streaming real, regenerar, editar, parar geração.
- **Prontidão:** 3
- **Recomendações:** modelo append-only, eventos por chunk, idempotência por `client_message_id`.

### 2.3 ChatRunState
- **UI:** `ChatRunStateIndicator` no Chat; menu “Cenário” simula transições.
- **Type:** `ChatRunState` (`src/types/chat.ts`).
- **Mock:** transições disparadas localmente.
- **Ações visuais:** indicar `thinking | streaming | retrieving_sources | executing_tool | fallback | failed | completed`.
- **Ações ausentes:** ligação a eventos reais de runtime/SSE/WebSocket.
- **Prontidão:** 2
- **Recomendações:** stream de eventos tipados (`status_events`) por mensagem.

### 2.4 MockToolCall (visual de tool call)
- **UI:** `ToolCallCard` dentro de mensagens do Chat.
- **Type:** `MockToolCall`, `ToolCallStatus`.
- **Mock:** embutido na ChatPage. **Service/Hook:** não há.
- **Ações visuais:** expandir input/output, status, sanitização de chaves sensíveis.
- **Ações ausentes:** aprovação humana, retry, cancelar, ver logs reais.
- **Prontidão:** 2
- **Recomendações:** mapear 1:1 com `ToolExecutionLog` no backend.

### 2.5 MockRagSource (citação visual)
- **UI:** `SourceCitation`, `RAGSourcesList` no Chat.
- **Type:** `MockRagSource`. **Mock:** embutido. **Service/Hook:** não há.
- **Ações visuais:** ver título, score, trecho, link para documento.
- **Ações ausentes:** abrir documento real, deep-link para chunk, relevância real.
- **Prontidão:** 2
- **Recomendações:** referenciar `document_id` + `chunk_id` + `embedding_model`.

### 2.6 ChatError
- **UI:** `ChatErrorState` no Chat.
- **Type:** `ChatError`, `ChatErrorKind`. **Mock:** simulado via menu “Cenário”.
- **Ações visuais:** mensagem amigável por tipo de erro.
- **Ações ausentes:** retry, reportar, telemetria.
- **Prontidão:** 2
- **Recomendações:** taxonomia de erros estável compartilhada com backend.

### 2.7 MessageFeedback
- **UI:** `FeedbackBar` por mensagem.
- **Type:** `MessageFeedback`, `FeedbackReason`.
- **Mock:** estado local. **Service/Hook:** não há (compartilha com `AssistantFeedback`).
- **Ações visuais:** thumbs + razão estruturada + comentário.
- **Ações ausentes:** envio persistente.
- **Prontidão:** 2
- **Recomendações:** unificar com `AssistantFeedback`.

### 2.8 Fallback (badge)
- **UI:** `FallbackBadge` em mensagens.
- **Type:** sinalizado via `ChatRunState='fallback'` + metadado da mensagem.
- **Ações ausentes:** política de fallback configurável, motivo da troca.
- **Prontidão:** 2
- **Recomendações:** persistir `model_used`, `fallback_from`, `fallback_reason`.

---

## 3. Entidades de RAG / Knowledge

### 3.1 KnowledgeBase
- **UI:** lista e detalhe.
- **Arquivos:** `pages/Knowledge/KnowledgePage.tsx`, `KnowledgeDetailPage.tsx`.
- **Mock:** `mockKnowledgeBases`. **Type:** `KnowledgeBase`. **Service/Hook:** `knowledgeService.list/get`, `useKnowledgeBases`, `useKnowledgeBase`.
- **Ações visuais:** listar, filtrar, ver detalhes, ver classificação/retenção/embedding.
- **Ações ausentes:** criar/editar, conectar fonte, reindexar, excluir, mudar embedding.
- **Prontidão:** 3
- **Recomendações:** pipeline de ingestão assíncrono, versionamento de embedding, política de retenção real.

### 3.2 KnowledgeDocument
- **UI:** lista de documentos em `KnowledgeDetailPage`.
- **Mock:** `mockDocuments`. **Type:** `KnowledgeDocument`. **Service/Hook:** `knowledgeService.documents`, `useDocuments`.
- **Ações visuais:** listar com status de ingestão, chunks, versão.
- **Ações ausentes:** upload real, reprocessar, baixar, excluir, ver chunks.
- **Prontidão:** 3
- **Recomendações:** storage versionado, status machine (`pending→processing→completed/failed`), checksum.

### 3.3 Chunk (conceitual)
- **UI:** referenciado apenas como contagem (`totalChunks`, `chunks`).
- **Type/Mock/Service:** não modelado individualmente.
- **Prontidão:** 0
- **Recomendações:** entidade explícita no backend (`id`, `document_id`, `position`, `text`, `embedding`, `metadata`).

### 3.4 Connector / DataSource (conceitual)
- **UI:** apenas enum `ConnectorType` exibido nas KBs.
- **Type:** `ConnectorType`. **Mock/Service:** não há.
- **Prontidão:** 1
- **Recomendações:** entidade `connector` com credenciais em vault, agenda de sync.

### 3.5 EmbeddingModel (conceitual)
- **UI:** string em `KnowledgeBase.embeddingModel`.
- **Prontidão:** 0
- **Recomendações:** catálogo versionado de modelos, custo, dimensão.

### 3.6 DataClassification / RetentionPeriod
- **UI:** exibidos em KBs.
- **Type:** unions em `types/index.ts`.
- **Prontidão:** 1
- **Recomendações:** política central de classificação e retenção aplicada server-side.

---

## 4. Entidades de MCP / tools

### 4.1 McpServer
- **UI:** lista e detalhe.
- **Arquivos:** `pages/MCP/McpHubPage.tsx`, `McpDetailPage.tsx`.
- **Mock:** `mockMcpServers`. **Type:** `McpServer`. **Service/Hook:** `mcpService.servers/get`, `useMcpServers`, `useMcpServer`.
- **Ações visuais:** listar, filtrar por status/risco, ver detalhes.
- **Ações ausentes:** registrar/editar servidor, testar conexão, rotacionar credencial, desabilitar.
- **Prontidão:** 3
- **Recomendações:** segredos em vault, healthcheck, versionamento de spec MCP.

### 4.2 McpTool
- **UI:** aba de tools em `McpDetailPage`.
- **Mock:** `mockMcpTools`. **Type:** `McpTool`. **Service/Hook:** `mcpService.tools`, `useMcpTools`.
- **Ações visuais:** listar tools com risco e contagem de execuções.
- **Ações ausentes:** habilitar/desabilitar, política de aprovação, executar/test.
- **Prontidão:** 3
- **Recomendações:** schema JSON validado, política de risco aplicada server-side.

### 4.3 McpResource
- **UI:** aba de recursos em `McpDetailPage`.
- **Mock:** `mockMcpResources`. **Type:** `McpResource`. **Service/Hook:** `mcpService.resources`, `useMcpResources`.
- **Ações visuais:** listar URI + mime.
- **Ações ausentes:** preview, permissões.
- **Prontidão:** 2

### 4.4 McpPrompt
- **UI:** aba de prompts em `McpDetailPage`.
- **Mock:** `mockMcpPrompts`. **Type:** `McpPrompt`. **Service/Hook:** `mcpService.prompts`, `useMcpPrompts`.
- **Ações visuais:** listar prompts e argumentos.
- **Ações ausentes:** instanciar prompt, vincular a assistente.
- **Prontidão:** 2

### 4.5 McpBinding
- **UI:** aba de bindings em `McpDetailPage` (servidor ↔ assistente).
- **Mock:** `mockMcpBindings`. **Type:** `McpBinding`. **Service/Hook:** `mcpService.bindings`, `useMcpBindings`.
- **Ações visuais:** listar vínculos com política de aprovação.
- **Ações ausentes:** criar/editar binding, escopo granular por tool/resource.
- **Prontidão:** 3
- **Recomendações:** modelo many-to-many com escopos e política de aprovação versionada.

### 4.6 ToolExecutionLog
- **UI:** aba de execuções em `McpDetailPage`.
- **Mock:** `mockToolExecutions`. **Type:** `ToolExecutionLog`. **Service/Hook:** `mcpService.executions`, `useToolExecutions`.
- **Ações visuais:** listar execuções com status/duração.
- **Ações ausentes:** aprovar/rejeitar pendente, ver payload completo, retry.
- **Prontidão:** 3
- **Recomendações:** append-only, redaction obrigatória, correlação com `message_id`.

---

## 5. Entidades administrativas / estruturantes

### 5.1 User
- **UI:** listagem em `pages/Admin/AdminPage.tsx`; também referenciado no topbar (mock).
- **Mock:** `mockUsers`. **Type:** `User`. **Service/Hook:** `adminService.users`, `useUsers`.
- **Ações visuais:** listar usuários e último login.
- **Ações ausentes:** convidar, desativar, redefinir senha, MFA, atribuir role/workspace.
- **Prontidão:** 3
- **Recomendações:** integração com IdP (SSO/OIDC), provisionamento SCIM opcional.

### 5.2 Role / Permission (conceitual)
- **UI:** `pages/Admin/AdminPage.tsx` (aba Roles) e `components/auth/PermissionGate.tsx`.
- **Type:** string em `User.role`. **Mock:** apenas rótulos. **Service/Hook:** não há.
- **Ações visuais:** exibir roles; gate de permissão simbólico.
- **Ações ausentes:** CRUD de roles, matriz de permissões, escopo por workspace.
- **Prontidão:** 1
- **Recomendações:** RBAC explícito (tabela `roles`, `permissions`, `role_permissions`, `user_roles`), avaliação server-side.

### 5.3 Workspace / Tenant (conceitual)
- **UI:** mencionado em `adminService.workspaces` (placeholder).
- **Mock:** stub `[{ id, name }]`. **Type:** ainda não tipado em `types/index.ts`. **Service/Hook:** `adminService.workspaces`, `useWorkspaces`.
- **Ações visuais:** nenhuma além do stub.
- **Ações ausentes:** seletor de workspace, isolamento multi-tenant na UI.
- **Prontidão:** 1
- **Recomendações:** tenant obrigatório em toda entidade, RLS por `workspace_id`.

### 5.4 Settings (workspace/perfil)
- **UI:** `/app/admin/settings`, `/app/settings`, `/app/profile` via `SettingsLayout`.
- **Mock/Type/Service:** não modelado.
- **Ações visuais:** páginas placeholder.
- **Prontidão:** 1
- **Recomendações:** configurações por workspace (modelos default, políticas de aprovação, retenção, branding).

### 5.5 Session / Auth (conceitual)
- **UI:** `LoginPage`, `ProtectedRoute`.
- **Type/Mock/Service:** simbólicos, sem token real.
- **Prontidão:** 1
- **Recomendações:** OIDC + refresh, sessão httpOnly, logout server-side, audit de login.

---

## 6. Entidades de auditoria / analytics

### 6.1 AuditLog
- **UI:** `pages/Audit/AuditPage.tsx`.
- **Mock:** `mockAuditLogs`. **Type:** `AuditLog` + `AuditEventType` + `RiskLevel`. **Service/Hook:** `auditService.logs`, `useAuditLogs`.
- **Ações visuais:** listar eventos com risco e ator.
- **Ações ausentes:** filtros avançados, exportação, retenção, busca textual.
- **Prontidão:** 3
- **Recomendações:** append-only, hash encadeado opcional, particionamento por tempo, exportação CSV/SIEM.

### 6.2 AnalyticsData
- **UI:** `pages/Analytics/AnalyticsPage.tsx`.
- **Mock:** `mockAnalytics`. **Type:** `AnalyticsData`. **Service/Hook:** `analyticsService.overview`, `useAnalytics`.
- **Ações visuais:** gráficos de conversas, custo, tool calls, latência.
- **Ações ausentes:** filtros por período/assistente/modelo, drill-down, export.
- **Prontidão:** 3
- **Recomendações:** pipeline de agregação (ETL/materialized views), métricas por assistant/version/model.

### 6.3 KpiData / DashboardSummary
- **UI:** `pages/Dashboard/DashboardPage.tsx`.
- **Type:** `KpiData`. **Mock:** `mockDashboardSummary` (KPIs + atividade). **Service/Hook:** `dashboardService.summary`, `useDashboardSummary`.
- **Ações visuais:** KPIs e atividade recente.
- **Ações ausentes:** customização, drill-down, alertas.
- **Prontidão:** 3
- **Recomendações:** endpoint consolidado server-side com cache curto.

---

## 7. Entidades apenas conceituais ou mockadas

Estas existem só como referência visual ou enum, sem modelagem própria de dados no frontend.

| Entidade | Onde aparece | Status | Recomendação |
|---|---|---|---|
| **Model / FallbackModel** | strings em `Assistant.model`, `Assistant.fallbackModel`, `ConversationMessage.model`, `AssistantTestResult.model` | conceitual | Catálogo `models` (provider, custo, contexto, capabilities). |
| **Provider de IA** | implícito no nome do modelo | inexistente | Entidade `provider` com credenciais em vault. |
| **Approval / ApprovalRequest** | enum `approval_requested`/`approval_granted` em `AuditEventType`; `McpBinding.approvalPolicy`; `ToolExecutionLog.status='pending_approval'` | conceitual | Entidade `approval` (request, approver, decision, motivo, TTL). |
| **Policy / Guardrail** | textos livres no wizard (`rules`, `restrictions`, `criticalInstructions`, `escalationPolicy`) | conceitual | Modelar policies estruturadas (PII, escopo, tópicos proibidos). |
| **EscalationPolicy** | campo string no wizard/assistant | conceitual | Entidade própria com canal, SLA e gatilhos. |
| **Environment** | `Assistant.environment` (string) | conceitual | Enum versionado (`dev`/`staging`/`prod`) com promoção controlada. |
| **PromptCompiled** | aba “Prompt” em `AssistantDetailPage` (montagem visual) | apenas UI | Snapshot persistido por versão (hash, partes, tokens). |
| **Notification / Alert** | toasts via `sonner`/`use-toast` | apenas UI | Centro de notificações + eventos server-side. |
| **Breadcrumb / Navigation** | `Breadcrumbs`, `AppSidebar` | apenas UI | N/A — não é entidade de domínio. |
| **Error Pages (403/404/500)** | `pages/Errors/*` | apenas UI | N/A. |
| **Chunk** | citado em contagens; modelado no item 3.3 | conceitual | Ver 3.3. |
| **Citation/Source persistida** | hoje só `MockRagSource`; modelado no item 2.5 | conceitual | Ver 2.5. |

---

## Resumo por prontidão

| Prontidão | Entidades |
|---|---|
| **4** | Assistant |
| **3** | AssistantVersion, AssistantFeedback, Conversation, ConversationMessage, KnowledgeBase, KnowledgeDocument, McpServer, McpTool, McpBinding, ToolExecutionLog, User, AuditLog, AnalyticsData, KpiData/DashboardSummary |
| **2** | AssistantTestResult, AssistantWizardFormData, ChatRunState, MockToolCall, MockRagSource, ChatError, MessageFeedback, Fallback, McpResource, McpPrompt |
| **1** | Connector/DataSource, DataClassification/Retention, Role/Permission, Workspace, Settings, Session/Auth |
| **0** | Chunk, EmbeddingModel, Provider, Approval, Policy/Guardrail (e demais conceituais da seção 7) |

---

## Recomendações gerais para backend / API / banco

1. **Multi-tenant primeiro:** `workspace_id` (ou `tenant_id`) obrigatório em toda tabela de domínio + RLS.
2. **Auth real antes de desligar mocks:** OIDC/SSO, sessão httpOnly, RBAC server-side com tabela dedicada de roles.
3. **Versionamento explícito** de Assistant, Prompt compilado, EmbeddingModel e spec MCP — imutável por versão.
4. **Eventos append-only** para `AuditLog`, `ToolExecutionLog`, `ConversationMessage` e feedback.
5. **Pipeline assíncrono** para ingestão de Knowledge (status machine + reprocessamento).
6. **Catálogos centrais** para Models, Providers, Connectors, Policies — referenciados por ID, não por string livre.
7. **Streaming/SSE** para Chat (run state, deltas, tool events, sources).
8. **Política de aprovação** como entidade real, conectada a McpBinding e ToolExecutionLog.
9. **Observabilidade desde o dia 1:** correlação `request_id`/`conversation_id`/`message_id` em logs, métricas e traces.
10. **Migração service-por-service:** trocar mock por HTTP em cada `*.service.ts` sem alterar páginas/hook signatures — a UI já está preparada para isso.

---

**Local sugerido após exportação:**

```
docs/engineering/ORQUESTRA_INVENTARIO_ENTIDADES_FRONTEND.md
```
