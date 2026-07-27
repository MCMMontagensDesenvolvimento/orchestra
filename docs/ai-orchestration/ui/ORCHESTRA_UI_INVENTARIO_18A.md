# Orchestra — Inventário Estático da UI — Fase 18A

## 1. Origem e método

Inventário produzido por análise estática do baseline `f7c0ed6`, sem abrir navegador,
subir container, chamar API, rede, MCP ou provider. Fontes principais:

- `frontend/src/App.tsx`;
- `frontend/src/layouts`;
- `frontend/src/components/shared`;
- `frontend/src/components/auth`;
- `frontend/src/pages`;
- `frontend/src/hooks/queries`;
- `frontend/src/services`;
- `frontend/src/services/api/endpoints.ts`;
- `frontend/src/lib/env.ts`.

“Detectado” significa presente no código; não significa homologado em runtime. Todos os
itens da matriz JSON permanecem `not-tested`.

## 2. Arquitetura de navegação e layouts

| Elemento | Arquivo | Função detectada | Observação |
|---|---|---|---|
| Router principal | `frontend/src/App.tsx` | rotas públicas, protegidas, legadas e erros | React Router + lazy loading |
| `AuthLayout` | `layouts/AuthLayout.tsx` | agrupador do login | usa `Outlet` |
| `AppLayout` | `layouts/AppLayout.tsx` | agrupador de `/app/*` | AppShell ainda é renderizado por página |
| `DashboardLayout` | `layouts/DashboardLayout.tsx` | dashboard/analytics | agrupador |
| `ChatLayout` | `layouts/ChatLayout.tsx` | rotas de Chat | agrupador |
| `SettingsLayout` | `layouts/SettingsLayout.tsx` | admin/settings/profile | agrupador |
| `EmptyLayout` | `layouts/EmptyLayout.tsx` | 403/404/500 | sem shell autenticado |
| `AppShell` | `components/shared/AppShell.tsx` | sidebar, topbar, drawer mobile e main | estado de collapse é local a cada página |
| `AppSidebar` | `components/shared/AppSidebar.tsx` | menu primário e collapse | desktop + variante expandida no drawer |
| `AppTopbar` | `components/shared/AppTopbar.tsx` | busca, tenant, notificações, usuário/logout | busca/notificação sem ação funcional detectada |
| `ProtectedRoute` | `components/auth/ProtectedRoute.tsx` | sessão para toda área `/app/*` | bypass somente em mock local permitido |
| `QueryState` | `components/shared/QueryState.tsx` | loading, error, forbidden, empty e retry | 403 reconhecido por status da API |
| `PermissionGate` | `components/auth/PermissionGate.tsx` | boundary visual declarativo | não há uso detectado nas páginas; default permite |

## 3. Rotas detectadas

### 3.1 Canônicas e públicas

| Path | Tipo | Página/comportamento | Proteção |
|---|---|---|---|
| `/` | redirect | `/login` | pública |
| `/login` | tela | `LoginPage` | pública |
| `/app` | redirect | `/app/dashboard` | sessão |
| `/app/dashboard` | tela | `DashboardPage` | sessão |
| `/app/analytics` | tela | `AnalyticsPage` | sessão; API sugere `audit.read` |
| `/app/assistants` | tela | `AssistantsPage` | sessão + ações por permission strings |
| `/app/assistants/new` | tela/form | `AssistantWizardPage` | sessão; create não é guardado visualmente |
| `/app/assistants/:id` | tela | `AssistantDetailPage` | sessão + ações por permission strings |
| `/app/assistants/:id/edit` | tela/form | `AssistantWizardPage` | sessão; link depende de `assistants.update` |
| `/app/knowledge` | tela | `KnowledgePage` | sessão |
| `/app/knowledge/:id` | tela | `KnowledgeDetailPage` | sessão |
| `/app/mcp` | tela | `McpHubPage` | sessão |
| `/app/mcp/:id` | tela | `McpDetailPage` | sessão |
| `/app/chat` | tela | catálogo de assistants publicados | sessão |
| `/app/chat/:assistantId` | tela | Chat persistente do assistant | sessão |
| `/app/audit` | tela | `AuditPage` | sessão; contrato sugere `audit.read` |
| `/app/admin` | redirect | `/app/admin/users` | sessão |
| `/app/admin/users` | tela | `AdminPage`, usuários | sessão; sem guarda de role visual |
| `/app/admin/roles` | tela | `AdminPage`, roles/permissões | sessão; sem guarda de role visual |
| `/app/admin/settings` | tela | `AdminPage`, catálogo LLM/workspaces | sessão; sem guarda de role visual |
| `/app/settings` | tela reutilizada | `AdminPage`, catálogo LLM/workspaces | sessão |
| `/app/profile` | tela reutilizada | `AdminPage`, branch de usuários | sessão |
| `/403` | erro | `Forbidden` | pública |
| `/404` | erro | `NotFoundPage` | pública |
| `/500` | erro | `ServerError` | pública |
| `*` | fallback | `NotFoundPage` | pública |

### 3.2 Redirects legados

Cada path abaixo usa `LegacyRedirect` para preservar sufixo/query sob `/app`:

- `/dashboard/*`;
- `/assistants/*`;
- `/knowledge/*`;
- `/mcp/*`;
- `/chat/*`;
- `/analytics/*`;
- `/audit/*`;
- `/admin/*`;
- `/settings/*`;
- `/profile/*`.

Links internos antigos ainda aparecem em páginas de Assistants e Chat. O redirect
evita quebra aparente, mas a URL final deve ser registrada na homologação.

## 4. Menus e navegação

### 4.1 Sidebar principal

| Label | Destino |
|---|---|
| Dashboard | `/app/dashboard` |
| Assistants | `/app/assistants` |
| Knowledge Hub | `/app/knowledge` |
| MCP Hub | `/app/mcp` |
| Chat | `/app/chat` |
| Analytics | `/app/analytics` |
| Auditoria | `/app/audit` |
| Admin | `/app/admin/users` |

A sidebar oferece collapse desktop e drawer mobile. Não há filtragem de itens por
perfil detectável.

### 4.2 Topbar

- abrir menu mobile;
- busca global (campo visual, sem submit/handler detectado);
- tenant atual;
- notificações (botão visual, sem painel detectado);
- usuário atual;
- clique no “Menu do usuário” executa logout diretamente e navega a `/login`;
- `Ctrl K` é exibido como hint, sem listener detectado.

### 4.3 Navegações secundárias

| Área | Itens |
|---|---|
| Admin | Usuários, Roles, Configurações |
| Assistant detail | Overview, Configuração, Governança, Execuções, Conhecimento, Ferramentas, Prompt Compilado, Testes, Analytics, Auditoria |
| Knowledge detail | Documentos, Data Sources, Assistentes, Configuração, Atividade |
| MCP detail | Tools, Resources, Prompts, Bindings, Logs, Configuração |
| MCP edit modal | Geral, Conexão, Segurança, Tools, Bindings |

## 5. Inventário de telas e ações

| Tela | Leitura/estados | Ações detectadas | Limite estático |
|---|---|---|---|
| Login | SSO config, pending/error | login dev, mostrar senha, Microsoft SSO, “esqueceu senha” visual | password não é enviado no dev-login; SSO depende de config |
| Dashboard | KPIs, recentes, loading/error/empty | retry de queries | modo real compõe três APIs; summary própria não é usada |
| Assistants | busca, filtros, ordenação, cards/table | criar, ver, editar, duplicar visual, testar, publicar, despublicar, arquivar, restaurar | algumas ações dependem de permissões; duplicar usa toast local |
| Assistant wizard | 12 etapas e revisão | anterior/próximo, selecionar KB/tools, salvar rascunho, publicar | create/update real; seleção não prova binding pós-save |
| Assistant detail | 10 abas, loading/not-found/error | lifecycle, approval, policy, precheck, runs, RAG, bindings, sandbox, feedback, testes, prompt | várias ações mutáveis; externas devem permanecer bloqueadas |
| Knowledge Hub | busca, filtros, cards/table, estados | criar, editar, duplicar, reindexar visual, arquivar, visualizar | reindexar global apenas toast |
| Knowledge detail | KPIs/readiness, 5 abas, preview | documento, ingestão local, embeddings, policy, data source, archive | embeddings reais proibidos; connectors só catálogo |
| MCP Hub | KPIs, busca/filtros, cards/table | registrar, editar, status, duplicar, arquivar, detalhe | criar servidor é proibido na 18A |
| MCP detail | 6 abas e catálogos | readiness/discovery remoto, catalogar tool, approval policy | chamadas remotas e cadastro proibidos na 18A |
| Chat catálogo | assistants publicados, estados | selecionar assistant | somente leitura |
| Chat assistant | conversas/mensagens/run details | nova, selecionar, refresh, arquivar, enviar, reenviar, carregar eventos | envio/AgentRun proibido na 18A |
| Analytics | KPIs, filtros, paginação, drawer | buscar, limpar, filtrar, selecionar run, anterior/próxima | leitura; detalhe allowlisted |
| Audit | KPIs e logs | botão Filtros visual | filtro sem handler detectado |
| Admin users | lista/empty/error | convidar visual, busca visual | sem mutation/filtro detectado |
| Admin roles | roles e permissões | retry | somente leitura |
| Admin settings | catálogo LLM e workspaces | atualizar | somente leitura sanitizada |
| Settings | reutiliza Admin settings | atualizar | não é tela dedicada |
| Profile | reutiliza Admin users | convidar/busca visuais | não é tela dedicada |
| 403/404/500 | mensagem e navegação de retorno | voltar | páginas públicas |

## 6. Formulários detectados

| Formulário | Campos/controles principais | Submit/resultado |
|---|---|---|
| Login | email, password visual, Microsoft SSO | `POST /auth/dev-login` ou redirect SSO |
| Wizard Assistant | identidade, objetivo, persona, tom, regras, modelos, KBs, MCP tools, formato, exemplos, limites | create/update + possível publish |
| Knowledge Base | nome, descrição, classificação, conector, embedding ref, retenção, chunk size/overlap | create/update |
| Documento | arquivo TXT/MD/CSV ou nome + texto manual | cadastro/upload local |
| Data Source | nome, tipo, URI/referência | catálogo sem executar conector |
| Policy Knowledge/RAG | switches de retrieval, citações, aprovação externa | patch de policy |
| Servidor MCP | nome, descrição, URL, auth, risco, secretRef lógico, versão, owner | create/update; proibido na 18A |
| Tool MCP | nome, risco, descrição, input/output schema, approval | catálogo; proibido na 18A |
| Approval Assistant | ação, versão, motivo | cria approval |
| Rollback Assistant | versão e motivo | rollback |
| Feedback Assistant | avaliação e comentário | cria feedback |
| Teste manual Assistant | input, esperado, saída, status, score, notas | cria resultado de teste |
| Binding Knowledge | base e prioridade/defaults | cria vínculo |
| Binding MCP | tool e policy/defaults | cria vínculo; proibido na 18A |
| Execution policy | modo, response scope e switches | patches imediatos |
| AgentRun | modo e entrada | cria run; proibido na 18A |
| RAG local search | consulta | request local; não usar provider externo |
| MCP sandbox | tool e JSON/text input | precheck/run sandbox; não executar na 18A |
| Chat message | texto | envia mensagem/cria AgentRun; proibido na 18A |
| Analytics filters | input summary + oito selects | lista/paginação |

## 7. CRUDs e maturidade visual

| Área | Create | Read | Update | Archive/Delete | Restore | Status 18A |
|---|---|---|---|---|---|---|
| Assistants | wizard | lista/detalhe | wizard/policies | archive | restore | parcial, governado por permissões |
| Knowledge Bases | modal | lista/detalhe | modal/policy | archive | serviço existe, ação visual não destacada | parcial |
| Documents | upload/manual | lista/preview/chunks | reprocess/embeddings | archive | não detectado na UI | parcial |
| Data Sources | modal | lista | serviço de detail existe | serviço de archive existe, ação visual não detectada | não detectado | catálogo parcial |
| MCP Servers | modal | lista/detalhe | modal/status | archive | serviço existe | proibido para execução 18A |
| MCP Tools | modal | lista/detalhe | approval/policy | serviço existe | não detectado | proibido para execução 18A |
| Conversations | nova | lista/detalhe/messages | envio acrescenta mensagens | archive | não detectado | envio proibido 18A |
| Users/Roles/Permissions/Workspaces | não exposto | sim | não exposto | não exposto | não exposto | leitura parcial |
| Audit/Analytics/LLM catalog | não aplicável | sim | refresh/filtros locais | não aplicável | não aplicável | leitura |

“Archive” é usado no lugar de delete em domínios principais.

## 8. Botões e ações por superfície

### Globais

- abrir/fechar sidebar;
- colapsar/expandir sidebar;
- navegar por menu;
- busca global visual;
- notificações visual;
- logout direto pelo menu do usuário;
- retry em estados de consulta.

### Assistants

- criar, editar, visualizar, duplicar, testar;
- publicar, despublicar, rollback, arquivar, restaurar;
- filtrar, ordenar, alternar card/table;
- criar/decidir/cancelar approval;
- configurar execution policy e response scope;
- executar precheck;
- simular/cancelar run;
- readiness/busca RAG;
- vincular/remover Knowledge e MCP;
- precheck/run sandbox MCP;
- registrar feedback e resultado manual;
- recompilar, copiar, exportar e editar seção do prompt.

### Knowledge

- criar/editar/duplicar/arquivar base;
- re-indexar (toast local);
- registrar/arquivar documento;
- solicitar ingestão local;
- solicitar embeddings de documento/base;
- atualizar policy/readiness;
- recarregar chunks/source references;
- catalogar data source.

### MCP

- registrar/editar/ativar/desativar/duplicar/arquivar server;
- abrir detalhe;
- testar readiness seguro e consultar catálogo read-only remoto;
- buscar/catalogar tool;
- alterar requirement de approval;
- navegar para Assistant vinculado.

As ações de mutação MCP e qualquer ação remota são inventariadas, mas proibidas na
execução 18A.

### Chat

- escolher/trocar Assistant;
- nova/selecionar/atualizar/arquivar conversa;
- enviar/reenviar mensagem;
- expandir detalhes técnicos;
- carregar eventos do AgentRun.

Na 18A, apenas catálogo, seleção/troca e render da tela são seguros; envio/reenvio são
proibidos.

### Analytics, Audit e Admin

- aplicar/limpar filtros, paginar e abrir drawer de run;
- botão visual de filtro em Audit;
- tabs Admin;
- convidar/buscar usuários visualmente;
- atualizar catálogo LLM/workspaces.

## 9. Chamadas de API usadas pelo frontend

Base configurável: `VITE_API_BASE_URL`, default relativo `/api/v1`.

### Auth e administração

| Método | Path | Consumidor |
|---|---|---|
| GET | `/auth/sso/config` | Login |
| GET | `/auth/me` | proteção/shell |
| POST | `/auth/dev-login` | Login local |
| POST | `/auth/logout` | topbar |
| GET | `/users` | Admin users |
| GET | `/roles` | Admin roles |
| GET | `/permissions` | Admin roles |
| GET | `/workspaces` | Admin settings |
| GET | `/settings` | hook disponível; sem uso de página confirmado |
| GET | `/llm/providers` | catálogo LLM/Assistant |
| GET | `/llm/config` | catálogo LLM/Assistant |

### Assistants e execução

| Método | Path/padrão | Uso |
|---|---|---|
| GET/POST | `/assistants` | list/create |
| GET/PATCH | `/assistants/:id` | detail/update |
| POST | `/assistants/:id/archive` | archive |
| POST | `/assistants/:id/restore` | restore |
| GET/POST | `/assistants/:id/versions` | versions/version snapshot |
| POST | `/assistants/:id/publish` | publish |
| POST | `/assistants/:id/unpublish` | unpublish |
| POST | `/assistants/:id/rollback` | rollback |
| GET | `/assistants/:id/publications` | history |
| GET | `/assistants/:id/publications/active` | Chat |
| GET/POST | `/assistants/:id/approvals` | list/request |
| POST | `/assistants/:id/approvals/:approvalId/{approve,reject,cancel}` | decisões |
| GET/PATCH | `/assistants/:id/execution-policy` | policy |
| POST | `/assistants/:id/execution-precheck` | precheck |
| GET/POST | `/assistants/:id/feedback` | feedback |
| GET/POST | `/assistants/:id/test-results` | manual tests |
| GET/POST | `/assistants/:id/runs` | runs |
| GET | `/agent-runs` | list disponível |
| GET | `/agent-runs/:runId` | detail |
| GET | `/agent-runs/:runId/events` | eventos |
| POST | `/agent-runs/:runId/cancel` | cancelamento |

### Knowledge/RAG

| Método | Path/padrão | Uso |
|---|---|---|
| GET/POST | `/knowledge-bases` | list/create |
| GET/PATCH | `/knowledge-bases/:id` | detail/update |
| POST | `/knowledge-bases/:id/archive` | archive |
| GET | `/knowledge-bases/:id/readiness` | readiness |
| PATCH | `/knowledge-bases/:id/policy` | policy |
| GET/POST | `/knowledge-bases/:id/documents` | list/manual document |
| POST | `/knowledge-bases/:id/documents/upload` | upload |
| GET | `/knowledge-bases/:id/chunks` | chunks |
| POST | `/knowledge-bases/:id/request-embeddings` | embeddings da base |
| POST | `/knowledge-documents/:id/archive` | archive document |
| GET | `/knowledge-documents/:id/ingestion` | jobs |
| POST | `/knowledge-documents/:id/request-ingestion` | ingestão |
| POST | `/knowledge-documents/:id/request-embeddings` | embeddings |
| GET | `/knowledge-documents/:id/chunks` | chunks |
| GET | `/knowledge-documents/:id/source-references` | sources |
| GET/POST | `/knowledge-bases/:id/data-sources` | catalog |
| GET/POST | `/assistants/:id/knowledge-bindings` | bindings |
| PATCH/DELETE | `/assistants/:id/knowledge-bindings/:bindingId` | binding |
| GET | `/assistants/:id/rag/readiness` | assistant readiness |
| POST | `/assistants/:id/rag-local-search` | local search |
| POST | `/assistants/:id/rag/query` | query oficial |
| GET | `/assistants/:id/rag/queries` | history |
| GET | `/rag/queries/:queryId` e `/sources` | detail/sources |

### MCP

| Método | Path/padrão | Uso |
|---|---|---|
| GET/POST | `/mcp/servers` | list/create |
| GET/PATCH | `/mcp/servers/:id` | detail/update |
| POST | `/mcp/servers/:id/archive` | archive |
| POST | `/mcp/servers/:id/restore` | restore |
| GET | `/mcp/servers/:id/remote-readiness` | remoto; proibido 18A |
| GET | `/mcp/servers/:id/remote-discovery` | remoto; proibido 18A |
| GET/POST | `/mcp/servers/:id/tools` | list/create |
| PATCH | `/mcp/tools/:toolId` | policy/update |
| POST | `/mcp/tools/:toolId/archive` | archive |
| GET | `/mcp/servers/:id/resources` | resources |
| GET | `/mcp/servers/:id/prompts` | prompts |
| GET/POST | `/assistants/:id/mcp-bindings` | bindings |
| PATCH/DELETE | `/assistants/:id/mcp-bindings/:bindingId` | binding |
| POST | `/assistants/:id/mcp/precheck` | precheck |
| GET/POST | `/assistants/:id/mcp/tool-calls` | tool calls |
| GET | `/mcp/tool-calls/:id` e `/events` | detail/timeline |

### Chat, auditoria e analytics

| Método | Path/padrão | Uso |
|---|---|---|
| GET/POST | `/assistants/:id/conversations` | list/create |
| GET | `/chat/conversations/:id` | detail |
| POST | `/chat/conversations/:id/archive` | archive |
| POST | `/chat/conversations/:id/messages` | send/AgentRun; proibido 18A |
| GET | `/audit-logs` | Audit/Dashboard |
| GET | `/ai-observability/runtime-runs` | Analytics list |
| GET | `/ai-observability/runtime-runs/:id` | drawer detail |
| GET | `/ai-observability/runtime-summary` | KPIs |
| GET | `/runtime/providers` | Assistant runtime panel |
| GET | `/runtime/capabilities` | Assistant runtime panel |
| GET | `/runtime/health` | Assistant runtime panel |
| GET | `/runtime/config` | Assistant runtime panel |

O registry `endpoints.ts` contém rotas adicionais não necessariamente acionadas por uma
tela atual; a tabela prioriza chamadas confirmadas em services/hooks.

## 10. Autenticação e autorização

- toda rota `/app/*` está dentro de `ProtectedRoute`;
- em modo real, loading de `/auth/me` bloqueia render; erro/ausência redireciona ao
  login preservando `state.from`;
- mock só bypassa a guarda quando explicitamente habilitado em ambiente local/test;
- API client usa cookie (`withCredentials=true`);
- `QueryState` diferencia 403;
- permissões de lifecycle/feedback/test/policy/run são verificadas pontualmente em
  Assistants;
- não há filtro de menu por role;
- não há guarda de rota específica para Admin, MCP ou Knowledge no frontend;
- `PermissionGate` é declarativo/mock e não aparece usado nas páginas analisadas;
- autorização real deve continuar no backend; a UI não é boundary de segurança.

## 11. Estados esperados por área

| Área | Loading | Empty | Error/403 | Success |
|---|---|---|---|---|
| Login | SSO/session pending | SSO ausente/disabled | erro sanitizado | redirect dashboard/origem |
| Dashboard | skeletons encadeados | listas/KPIs zero | retry por API | KPIs/listas |
| Lists | `ListLoading` | CTA contextual | retry/403 | cards/table |
| Detail | spinner/query | entidade não encontrada | retry | tabs/KPIs |
| Mutations | botão disabled/spinner | n/a | toast destrutivo | toast + refetch |
| Chat | skeleton/send pending | sem publicação/conversa/mensagens | retry/blocked | conversa |
| Analytics | skeleton + summary warning | nenhum run | retry/403 | tabela/drawer |
| Admin | skeleton | coleção vazia | retry/403 | listas/catálogo |

## 12. Lacunas não inferíveis ou não confirmáveis estaticamente

- dados e permissões efetivos de cada usuário local;
- containers, health e seed atuais;
- comportamento real de cookies, SSO e expiração de sessão no navegador;
- ordem/latência real de requests e race conditions;
- compatibilidade por navegador e dispositivo;
- foco, leitor de tela, contraste calculado e navegação completa por teclado;
- respostas 400/401/403/404/409/422/500 reais de cada formulário;
- persistência depois de reload para todas as mutations;
- consistência transacional e auditoria no banco;
- segurança efetiva de Admin sem teste com perfis;
- se links legados causam flicker ou perda de estado;
- comportamento de busca global, notificações, “esqueceu a senha”, convite, filtro de
  Audit e re-indexação, pois não há handler funcional detectado;
- diferença esperada entre `/app/settings`, `/app/profile` e Admin;
- readiness de providers, embeddings e MCP, deliberadamente não executados;
- Chat/AgentRun, deliberadamente não executado;
- qualquer conclusão sobre produção, deliberadamente fora de escopo.

Essas lacunas devem virar `NOT_RUN`, `BLOCKED` ou dúvida de regra na execução manual,
nunca suposição de PASS.
