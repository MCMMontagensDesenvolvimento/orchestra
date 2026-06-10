# Orchestra - Inventario De Entidades Do Frontend

> Status: inventario tecnico preservado para orientar arquitetura, APIs e modelo de dados.
> Base: `src/types/index.ts`, `src/types/chat.ts`, `src/data/mockData.ts`, `src/services/*`, `src/hooks/queries/*`, `src/pages/*`.
>
> **Escopo:** apenas mapeamento; nenhum cֳ³digo foi alterado.
> **Convenֳ§ֳ£o do nֳ­vel de prontidֳ£o (0ג€“5):**
> - 0 ג€” apenas conceito, sem type/mock/UI
> - 1 ג€” type existe, sem UI
> - 2 ג€” type + mock, UI mֳ­nima
> - 3 ג€” type + mock + UI de listagem/detalhe + hook/service
> - 4 ג€” fluxo completo de leitura + aֳ§ֳµes visuais principais
> - 5 ג€” pronto para integraֳ§ֳ£o 1:1 com API real (apenas trocar mock por HTTP)

---

## 1. Entidades principais de produto

### 1.1 Assistant
- **UI:** lista, detalhe, wizard de criaֳ§ֳ£o/ediֳ§ֳ£o (12 etapas), seleֳ§ֳ£o no Chat.
- **Arquivos:** `pages/Assistants/AssistantsPage.tsx`, `AssistantDetailPage.tsx`, `AssistantWizardPage.tsx`; `pages/Chat/ChatPage.tsx`.
- **Mock:** `mockAssistants`.
- **Type:** `Assistant` (`src/types/index.ts`).
- **Service/Hook:** `assistantsService.list/get`; `useAssistants`, `useAssistant`.
- **Aֳ§ֳµes visuais:** listar, filtrar, ver detalhes, abrir wizard, navegar para chat.
- **Aֳ§ֳµes ausentes:** salvar/publicar/arquivar de fato, duplicar, exportar, rollback de versֳ£o, comparar versֳµes.
- **Prontidֳ£o:** 4
- **Recomendaֳ§ֳµes backend:** CRUD completo, versionamento, publish/archive, RBAC por workspace, soft delete, auditoria de mudanֳ§as.

### 1.2 AssistantVersion
- **UI:** aba ג€Versֳµesג€ em `AssistantDetailPage`.
- **Mock:** `mockAssistantVersions`. **Type:** `AssistantVersion`. **Service/Hook:** `assistantsService.versions`, `useAssistantVersions`.
- **Aֳ§ֳµes visuais:** listar versֳµes e changelog.
- **Aֳ§ֳµes ausentes:** criar versֳ£o, promover, rollback, diff entre versֳµes.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** imutabilidade por versֳ£o, hash do prompt compilado, autor + timestamp confiֳ¡vel.

### 1.3 AssistantFeedback
- **UI:** aba ג€Feedbackג€ em `AssistantDetailPage`; tambֳ©m emitido no Chat via `FeedbackBar`.
- **Mock:** `mockAssistantFeedbacks`. **Type:** `AssistantFeedback`. **Service/Hook:** `assistantsService.feedback`, `useAssistantFeedback`.
- **Aֳ§ֳµes visuais:** listar feedbacks, registrar נ‘/נ‘ com razֳ£o estruturada (apenas local).
- **Aֳ§ֳµes ausentes:** persistir feedback, agregaֳ§ֳ£o por versֳ£o/modelo, exportaֳ§ֳ£o.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** vincular a `conversation_id` + `message_id` + `assistant_version_id`.

### 1.4 AssistantTestResult
- **UI:** aba ג€Testesג€ em `AssistantDetailPage`.
- **Mock:** `mockTestResults`. **Type:** `AssistantTestResult`. **Service/Hook:** `assistantsService.testResults`, `useAssistantTestResults`.
- **Aֳ§ֳµes visuais:** listar execuֳ§ֳµes de teste com latֳ×ncia/tokens.
- **Aֳ§ֳµes ausentes:** disparar teste real, suֳ­te de regressֳ£o, baseline.
- **Prontidֳ£o:** 2
- **Recomendaֳ§ֳµes:** runner desacoplado, armazenar prompt/resposta/golden answers.

### 1.5 AssistantWizardFormData
- **UI:** wizard de criaֳ§ֳ£o/ediֳ§ֳ£o (12 etapas).
- **Type:** `AssistantWizardFormData`. **Mock/Service:** nֳ£o persistido.
- **Aֳ§ֳµes visuais:** preencher formulֳ¡rio e navegar etapas.
- **Aֳ§ֳµes ausentes:** salvar rascunho, validar, submeter, retomar.
- **Prontidֳ£o:** 2
- **Recomendaֳ§ֳµes:** endpoint de draft autosave, schema validation server-side.

---

## 2. Entidades de IA / runtime

### 2.1 Conversation
- **UI:** painel lateral do Chat.
- **Arquivo:** `pages/Chat/ChatPage.tsx`.
- **Mock:** `mockConversations`. **Type:** `Conversation`. **Service/Hook:** `chatService.conversations`, `useConversations`.
- **Aֳ§ֳµes visuais:** listar, selecionar, exibir tֳ­tulo/ֳ÷ltimo resumo.
- **Aֳ§ֳµes ausentes:** criar, renomear, excluir, arquivar, buscar.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** pertencimento a user+assistant+workspace, paginaֳ§ֳ£o, retenֳ§ֳ£o.

### 2.2 ConversationMessage
- **UI:** thread principal do Chat.
- **Mock:** `mockMessages`. **Type:** `ConversationMessage`. **Service/Hook:** `chatService.messages`, `useMessages`.
- **Aֳ§ֳµes visuais:** renderizar mensagens user/assistant, modelo usado, fontes, tools, feedback local.
- **Aֳ§ֳµes ausentes:** envio real, streaming real, regenerar, editar, parar geraֳ§ֳ£o.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** modelo append-only, eventos por chunk, idempotֳ×ncia por `client_message_id`.

### 2.3 ChatRunState
- **UI:** `ChatRunStateIndicator` no Chat; menu ג€Cenֳ¡rioג€ simula transiֳ§ֳµes.
- **Type:** `ChatRunState` (`src/types/chat.ts`).
- **Mock:** transiֳ§ֳµes disparadas localmente.
- **Aֳ§ֳµes visuais:** indicar `thinking | streaming | retrieving_sources | executing_tool | fallback | failed | completed`.
- **Aֳ§ֳµes ausentes:** ligaֳ§ֳ£o a eventos reais de runtime/SSE/WebSocket.
- **Prontidֳ£o:** 2
- **Recomendaֳ§ֳµes:** stream de eventos tipados (`status_events`) por mensagem.

### 2.4 MockToolCall (visual de tool call)
- **UI:** `ToolCallCard` dentro de mensagens do Chat.
- **Type:** `MockToolCall`, `ToolCallStatus`.
- **Mock:** embutido na ChatPage. **Service/Hook:** nֳ£o hֳ¡.
- **Aֳ§ֳµes visuais:** expandir input/output, status, sanitizaֳ§ֳ£o de chaves sensֳ­veis.
- **Aֳ§ֳµes ausentes:** aprovaֳ§ֳ£o humana, retry, cancelar, ver logs reais.
- **Prontidֳ£o:** 2
- **Recomendaֳ§ֳµes:** mapear 1:1 com `ToolExecutionLog` no backend.

### 2.5 MockRagSource (citaֳ§ֳ£o visual)
- **UI:** `SourceCitation`, `RAGSourcesList` no Chat.
- **Type:** `MockRagSource`. **Mock:** embutido. **Service/Hook:** nֳ£o hֳ¡.
- **Aֳ§ֳµes visuais:** ver tֳ­tulo, score, trecho, link para documento.
- **Aֳ§ֳµes ausentes:** abrir documento real, deep-link para chunk, relevֳ¢ncia real.
- **Prontidֳ£o:** 2
- **Recomendaֳ§ֳµes:** referenciar `document_id` + `chunk_id` + `embedding_model`.

### 2.6 ChatError
- **UI:** `ChatErrorState` no Chat.
- **Type:** `ChatError`, `ChatErrorKind`. **Mock:** simulado via menu ג€Cenֳ¡rioג€.
- **Aֳ§ֳµes visuais:** mensagem amigֳ¡vel por tipo de erro.
- **Aֳ§ֳµes ausentes:** retry, reportar, telemetria.
- **Prontidֳ£o:** 2
- **Recomendaֳ§ֳµes:** taxonomia de erros estֳ¡vel compartilhada com backend.

### 2.7 MessageFeedback
- **UI:** `FeedbackBar` por mensagem.
- **Type:** `MessageFeedback`, `FeedbackReason`.
- **Mock:** estado local. **Service/Hook:** nֳ£o hֳ¡ (compartilha com `AssistantFeedback`).
- **Aֳ§ֳµes visuais:** thumbs + razֳ£o estruturada + comentֳ¡rio.
- **Aֳ§ֳµes ausentes:** envio persistente.
- **Prontidֳ£o:** 2
- **Recomendaֳ§ֳµes:** unificar com `AssistantFeedback`.

### 2.8 Fallback (badge)
- **UI:** `FallbackBadge` em mensagens.
- **Type:** sinalizado via `ChatRunState='fallback'` + metadado da mensagem.
- **Aֳ§ֳµes ausentes:** polֳ­tica de fallback configurֳ¡vel, motivo da troca.
- **Prontidֳ£o:** 2
- **Recomendaֳ§ֳµes:** persistir `model_used`, `fallback_from`, `fallback_reason`.

---

## 3. Entidades de RAG / Knowledge

### 3.1 KnowledgeBase
- **UI:** lista e detalhe.
- **Arquivos:** `pages/Knowledge/KnowledgePage.tsx`, `KnowledgeDetailPage.tsx`.
- **Mock:** `mockKnowledgeBases`. **Type:** `KnowledgeBase`. **Service/Hook:** `knowledgeService.list/get`, `useKnowledgeBases`, `useKnowledgeBase`.
- **Aֳ§ֳµes visuais:** listar, filtrar, ver detalhes, ver classificaֳ§ֳ£o/retenֳ§ֳ£o/embedding.
- **Aֳ§ֳµes ausentes:** criar/editar, conectar fonte, reindexar, excluir, mudar embedding.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** pipeline de ingestֳ£o assֳ­ncrono, versionamento de embedding, polֳ­tica de retenֳ§ֳ£o real.

### 3.2 KnowledgeDocument
- **UI:** lista de documentos em `KnowledgeDetailPage`.
- **Mock:** `mockDocuments`. **Type:** `KnowledgeDocument`. **Service/Hook:** `knowledgeService.documents`, `useDocuments`.
- **Aֳ§ֳµes visuais:** listar com status de ingestֳ£o, chunks, versֳ£o.
- **Aֳ§ֳµes ausentes:** upload real, reprocessar, baixar, excluir, ver chunks.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** storage versionado, status machine (`pendingג†’processingג†’completed/failed`), checksum.

### 3.3 Chunk (conceitual)
- **UI:** referenciado apenas como contagem (`totalChunks`, `chunks`).
- **Type/Mock/Service:** nֳ£o modelado individualmente.
- **Prontidֳ£o:** 0
- **Recomendaֳ§ֳµes:** entidade explֳ­cita no backend (`id`, `document_id`, `position`, `text`, `embedding`, `metadata`).

### 3.4 Connector / DataSource (conceitual)
- **UI:** apenas enum `ConnectorType` exibido nas KBs.
- **Type:** `ConnectorType`. **Mock/Service:** nֳ£o hֳ¡.
- **Prontidֳ£o:** 1
- **Recomendaֳ§ֳµes:** entidade `connector` com credenciais em vault, agenda de sync.

### 3.5 EmbeddingModel (conceitual)
- **UI:** string em `KnowledgeBase.embeddingModel`.
- **Prontidֳ£o:** 0
- **Recomendaֳ§ֳµes:** catֳ¡logo versionado de modelos, custo, dimensֳ£o.

### 3.6 DataClassification / RetentionPeriod
- **UI:** exibidos em KBs.
- **Type:** unions em `types/index.ts`.
- **Prontidֳ£o:** 1
- **Recomendaֳ§ֳµes:** polֳ­tica central de classificaֳ§ֳ£o e retenֳ§ֳ£o aplicada server-side.

---

## 4. Entidades de MCP / tools

### 4.1 McpServer
- **UI:** lista e detalhe.
- **Arquivos:** `pages/MCP/McpHubPage.tsx`, `McpDetailPage.tsx`.
- **Mock:** `mockMcpServers`. **Type:** `McpServer`. **Service/Hook:** `mcpService.servers/get`, `useMcpServers`, `useMcpServer`.
- **Aֳ§ֳµes visuais:** listar, filtrar por status/risco, ver detalhes.
- **Aֳ§ֳµes ausentes:** registrar/editar servidor, testar conexֳ£o, rotacionar credencial, desabilitar.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** segredos em vault, healthcheck, versionamento de spec MCP.

### 4.2 McpTool
- **UI:** aba de tools em `McpDetailPage`.
- **Mock:** `mockMcpTools`. **Type:** `McpTool`. **Service/Hook:** `mcpService.tools`, `useMcpTools`.
- **Aֳ§ֳµes visuais:** listar tools com risco e contagem de execuֳ§ֳµes.
- **Aֳ§ֳµes ausentes:** habilitar/desabilitar, polֳ­tica de aprovaֳ§ֳ£o, executar/test.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** schema JSON validado, polֳ­tica de risco aplicada server-side.

### 4.3 McpResource
- **UI:** aba de recursos em `McpDetailPage`.
- **Mock:** `mockMcpResources`. **Type:** `McpResource`. **Service/Hook:** `mcpService.resources`, `useMcpResources`.
- **Aֳ§ֳµes visuais:** listar URI + mime.
- **Aֳ§ֳµes ausentes:** preview, permissֳµes.
- **Prontidֳ£o:** 2

### 4.4 McpPrompt
- **UI:** aba de prompts em `McpDetailPage`.
- **Mock:** `mockMcpPrompts`. **Type:** `McpPrompt`. **Service/Hook:** `mcpService.prompts`, `useMcpPrompts`.
- **Aֳ§ֳµes visuais:** listar prompts e argumentos.
- **Aֳ§ֳµes ausentes:** instanciar prompt, vincular a assistente.
- **Prontidֳ£o:** 2

### 4.5 McpBinding
- **UI:** aba de bindings em `McpDetailPage` (servidor ג†” assistente).
- **Mock:** `mockMcpBindings`. **Type:** `McpBinding`. **Service/Hook:** `mcpService.bindings`, `useMcpBindings`.
- **Aֳ§ֳµes visuais:** listar vֳ­nculos com polֳ­tica de aprovaֳ§ֳ£o.
- **Aֳ§ֳµes ausentes:** criar/editar binding, escopo granular por tool/resource.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** modelo many-to-many com escopos e polֳ­tica de aprovaֳ§ֳ£o versionada.

### 4.6 ToolExecutionLog
- **UI:** aba de execuֳ§ֳµes em `McpDetailPage`.
- **Mock:** `mockToolExecutions`. **Type:** `ToolExecutionLog`. **Service/Hook:** `mcpService.executions`, `useToolExecutions`.
- **Aֳ§ֳµes visuais:** listar execuֳ§ֳµes com status/duraֳ§ֳ£o.
- **Aֳ§ֳµes ausentes:** aprovar/rejeitar pendente, ver payload completo, retry.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** append-only, redaction obrigatֳ³ria, correlaֳ§ֳ£o com `message_id`.

---

## 5. Entidades administrativas / estruturantes

### 5.1 User
- **UI:** listagem em `pages/Admin/AdminPage.tsx`; tambֳ©m referenciado no topbar (mock).
- **Mock:** `mockUsers`. **Type:** `User`. **Service/Hook:** `adminService.users`, `useUsers`.
- **Aֳ§ֳµes visuais:** listar usuֳ¡rios e ֳ÷ltimo login.
- **Aֳ§ֳµes ausentes:** convidar, desativar, redefinir senha, MFA, atribuir role/workspace.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** integraֳ§ֳ£o com IdP (SSO/OIDC), provisionamento SCIM opcional.

### 5.2 Role / Permission (conceitual)
- **UI:** `pages/Admin/AdminPage.tsx` (aba Roles) e `components/auth/PermissionGate.tsx`.
- **Type:** string em `User.role`. **Mock:** apenas rֳ³tulos. **Service/Hook:** nֳ£o hֳ¡.
- **Aֳ§ֳµes visuais:** exibir roles; gate de permissֳ£o simbֳ³lico.
- **Aֳ§ֳµes ausentes:** CRUD de roles, matriz de permissֳµes, escopo por workspace.
- **Prontidֳ£o:** 1
- **Recomendaֳ§ֳµes:** RBAC explֳ­cito (tabela `roles`, `permissions`, `role_permissions`, `user_roles`), avaliaֳ§ֳ£o server-side.

### 5.3 Workspace / Tenant (conceitual)
- **UI:** mencionado em `adminService.workspaces` (placeholder).
- **Mock:** stub `[{ id, name }]`. **Type:** ainda nֳ£o tipado em `types/index.ts`. **Service/Hook:** `adminService.workspaces`, `useWorkspaces`.
- **Aֳ§ֳµes visuais:** nenhuma alֳ©m do stub.
- **Aֳ§ֳµes ausentes:** seletor de workspace, isolamento multi-tenant na UI.
- **Prontidֳ£o:** 1
- **Recomendaֳ§ֳµes:** tenant obrigatֳ³rio em toda entidade, RLS por `workspace_id`.

### 5.4 Settings (workspace/perfil)
- **UI:** `/app/admin/settings`, `/app/settings`, `/app/profile` via `SettingsLayout`.
- **Mock/Type/Service:** nֳ£o modelado.
- **Aֳ§ֳµes visuais:** pֳ¡ginas placeholder.
- **Prontidֳ£o:** 1
- **Recomendaֳ§ֳµes:** configuraֳ§ֳµes por workspace (modelos default, polֳ­ticas de aprovaֳ§ֳ£o, retenֳ§ֳ£o, branding).

### 5.5 Session / Auth (conceitual)
- **UI:** `LoginPage`, `ProtectedRoute`.
- **Type/Mock/Service:** simbֳ³licos, sem token real.
- **Prontidֳ£o:** 1
- **Recomendaֳ§ֳµes:** OIDC + refresh, sessֳ£o httpOnly, logout server-side, audit de login.

---

## 6. Entidades de auditoria / analytics

### 6.1 AuditLog
- **UI:** `pages/Audit/AuditPage.tsx`.
- **Mock:** `mockAuditLogs`. **Type:** `AuditLog` + `AuditEventType` + `RiskLevel`. **Service/Hook:** `auditService.logs`, `useAuditLogs`.
- **Aֳ§ֳµes visuais:** listar eventos com risco e ator.
- **Aֳ§ֳµes ausentes:** filtros avanֳ§ados, exportaֳ§ֳ£o, retenֳ§ֳ£o, busca textual.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** append-only, hash encadeado opcional, particionamento por tempo, exportaֳ§ֳ£o CSV/SIEM.

### 6.2 AnalyticsData
- **UI:** `pages/Analytics/AnalyticsPage.tsx`.
- **Mock:** `mockAnalytics`. **Type:** `AnalyticsData`. **Service/Hook:** `analyticsService.overview`, `useAnalytics`.
- **Aֳ§ֳµes visuais:** grֳ¡ficos de conversas, custo, tool calls, latֳ×ncia.
- **Aֳ§ֳµes ausentes:** filtros por perֳ­odo/assistente/modelo, drill-down, export.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** pipeline de agregaֳ§ֳ£o (ETL/materialized views), mֳ©tricas por assistant/version/model.

### 6.3 KpiData / DashboardSummary
- **UI:** `pages/Dashboard/DashboardPage.tsx`.
- **Type:** `KpiData`. **Mock:** `mockDashboardSummary` (KPIs + atividade). **Service/Hook:** `dashboardService.summary`, `useDashboardSummary`.
- **Aֳ§ֳµes visuais:** KPIs e atividade recente.
- **Aֳ§ֳµes ausentes:** customizaֳ§ֳ£o, drill-down, alertas.
- **Prontidֳ£o:** 3
- **Recomendaֳ§ֳµes:** endpoint consolidado server-side com cache curto.

---

## 7. Entidades apenas conceituais ou mockadas

Estas existem sֳ³ como referֳ×ncia visual ou enum, sem modelagem prֳ³pria de dados no frontend.

| Entidade | Onde aparece | Status | Recomendaֳ§ֳ£o |
|---|---|---|---|
| **Model / FallbackModel** | strings em `Assistant.model`, `Assistant.fallbackModel`, `ConversationMessage.model`, `AssistantTestResult.model` | conceitual | Catֳ¡logo `models` (provider, custo, contexto, capabilities). |
| **Provider de IA** | implֳ­cito no nome do modelo | inexistente | Entidade `provider` com credenciais em vault. |
| **Approval / ApprovalRequest** | enum `approval_requested`/`approval_granted` em `AuditEventType`; `McpBinding.approvalPolicy`; `ToolExecutionLog.status='pending_approval'` | conceitual | Entidade `approval` (request, approver, decision, motivo, TTL). |
| **Policy / Guardrail** | textos livres no wizard (`rules`, `restrictions`, `criticalInstructions`, `escalationPolicy`) | conceitual | Modelar policies estruturadas (PII, escopo, tֳ³picos proibidos). |
| **EscalationPolicy** | campo string no wizard/assistant | conceitual | Entidade prֳ³pria com canal, SLA e gatilhos. |
| **Environment** | `Assistant.environment` (string) | conceitual | Enum versionado (`dev`/`staging`/`prod`) com promoֳ§ֳ£o controlada. |
| **PromptCompiled** | aba ג€Promptג€ em `AssistantDetailPage` (montagem visual) | apenas UI | Snapshot persistido por versֳ£o (hash, partes, tokens). |
| **Notification / Alert** | toasts via `sonner`/`use-toast` | apenas UI | Centro de notificaֳ§ֳµes + eventos server-side. |
| **Breadcrumb / Navigation** | `Breadcrumbs`, `AppSidebar` | apenas UI | N/A ג€” nֳ£o ֳ© entidade de domֳ­nio. |
| **Error Pages (403/404/500)** | `pages/Errors/*` | apenas UI | N/A. |
| **Chunk** | citado em contagens; modelado no item 3.3 | conceitual | Ver 3.3. |
| **Citation/Source persistida** | hoje sֳ³ `MockRagSource`; modelado no item 2.5 | conceitual | Ver 2.5. |

---

## Resumo por prontidֳ£o

| Prontidֳ£o | Entidades |
|---|---|
| **4** | Assistant |
| **3** | AssistantVersion, AssistantFeedback, Conversation, ConversationMessage, KnowledgeBase, KnowledgeDocument, McpServer, McpTool, McpBinding, ToolExecutionLog, User, AuditLog, AnalyticsData, KpiData/DashboardSummary |
| **2** | AssistantTestResult, AssistantWizardFormData, ChatRunState, MockToolCall, MockRagSource, ChatError, MessageFeedback, Fallback, McpResource, McpPrompt |
| **1** | Connector/DataSource, DataClassification/Retention, Role/Permission, Workspace, Settings, Session/Auth |
| **0** | Chunk, EmbeddingModel, Provider, Approval, Policy/Guardrail (e demais conceituais da seֳ§ֳ£o 7) |

---

## Recomendaֳ§ֳµes gerais para backend / API / banco

1. **Multi-tenant primeiro:** `workspace_id` (ou `tenant_id`) obrigatֳ³rio em toda tabela de domֳ­nio + RLS.
2. **Auth real antes de desligar mocks:** OIDC/SSO, sessֳ£o httpOnly, RBAC server-side com tabela dedicada de roles.
3. **Versionamento explֳ­cito** de Assistant, Prompt compilado, EmbeddingModel e spec MCP ג€” imutֳ¡vel por versֳ£o.
4. **Eventos append-only** para `AuditLog`, `ToolExecutionLog`, `ConversationMessage` e feedback.
5. **Pipeline assֳ­ncrono** para ingestֳ£o de Knowledge (status machine + reprocessamento).
6. **Catֳ¡logos centrais** para Models, Providers, Connectors, Policies ג€” referenciados por ID, nֳ£o por string livre.
7. **Streaming/SSE** para Chat (run state, deltas, tool events, sources).
8. **Polֳ­tica de aprovaֳ§ֳ£o** como entidade real, conectada a McpBinding e ToolExecutionLog.
9. **Observabilidade desde o dia 1:** correlaֳ§ֳ£o `request_id`/`conversation_id`/`message_id` em logs, mֳ©tricas e traces.
10. **Migraֳ§ֳ£o service-por-service:** trocar mock por HTTP em cada `*.service.ts` sem alterar pֳ¡ginas/hook signatures ג€” a UI jֳ¡ estֳ¡ preparada para isso.

---

**Local sugerido apֳ³s exportaֳ§ֳ£o:**

```
docs/engineering/ORCHESTRA_INVENTARIO_ENTIDADES_FRONTEND.md
```
