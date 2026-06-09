# Orquestra — Especificação Funcional

> Documento corporativo de especificação funcional do projeto Orquestra.  
> Preparado para uso interno na MCM.

---

## 1. Objetivo

Detalhar o comportamento funcional do Orquestra, transformando os requisitos do sistema em fluxos claros, validáveis e rastreáveis.

Este documento define como cada funcionalidade deve se comportar na prática, quais estados possui, quais dados utiliza, quais validações executa, quais permissões exige, quais telas são afetadas, quais APIs candidatas serão necessárias, quais impactos existem em backend, banco, infraestrutura, motion, IA, auditoria e testes.

---

## 2. Sumário executivo

O Orquestra será uma plataforma corporativa de assistentes de IA para criação, configuração, publicação, execução, compartilhamento, governança, auditoria e monitoramento de assistentes no contexto da MCM.

A especificação funcional parte dos requisitos já consolidados e detalha os principais fluxos do MVP:

- login corporativo;
- gestão de usuários, perfis e permissões;
- tenants e workspaces;
- criação e gestão de assistentes;
- wizard de configuração;
- edição e versionamento;
- teste, publicação e aprovação;
- compartilhamento;
- chat com IA;
- RAG e fontes;
- MCP/tools;
- runtime Agno;
- feedback;
- conversas;
- analytics, custos e evals;
- auditoria.

O documento não fecha contratos finais de API nem schema final de banco. Ele registra APIs e entidades candidatas para aprofundamento nos documentos técnicos específicos.

---

## 3. Functional Specification Blueprint

```yaml
functional_specification_blueprint:
  project_name: "Orquestra"
  organization: "MCM"
  execution_mode: "Projeto existente no Lovable, ainda não exportado para ambiente Docker/WSL"
  current_stage: "Documentação inicial e especificação funcional"
  main_goal: "Transformar o protótipo visual em MVP funcional, governável e operável"
  functionalities_total: 18
  critical_flows:
    - "Autenticação corporativa"
    - "Criação de assistente"
    - "Publicação e aprovação"
    - "Compartilhamento"
    - "Chat com IA"
    - "RAG com fontes"
    - "MCP/tool calling"
    - "Execução via Agno runtime"
    - "Auditoria"
  structural_entities_required:
    - "tenants"
    - "users"
    - "roles"
    - "permissions"
    - "workspaces"
    - "workspace_members"
    - "assistants"
    - "assistant_versions"
    - "assistant_shares"
    - "knowledge_bases"
    - "documents"
    - "mcp_servers"
    - "mcp_tools"
    - "conversations"
    - "messages"
    - "feedbacks"
    - "audit_logs"
    - "provider_usage_costs"
    - "eval_runs"
    - "runtime_deployments"
  frontend_outputs:
    - "Rotas autenticadas"
    - "Guards de permissão"
    - "Wizard de assistentes"
    - "Chat workspace"
    - "Knowledge Hub"
    - "MCP Hub"
    - "Analytics"
    - "Audit Logs"
    - "Admin"
  backend_outputs:
    - "Auth"
    - "RBAC"
    - "Tenants"
    - "Workspaces"
    - "Assistants"
    - "Knowledge"
    - "MCP"
    - "Chat"
    - "Runtime orchestration"
    - "Audit"
    - "Costs"
  ai_orchestration_outputs:
    - "AgentSpec"
    - "Agno runtime"
    - "RAG"
    - "MCP/tools"
    - "Streaming"
    - "Fallback"
    - "Feedback"
    - "Evals"
  decisions_required:
    - "Definir workspaces piloto."
    - "Definir vector store."
    - "Detalhar AgentSpec."
    - "Definir primeiros MCP servers/tools."
    - "Definir ambiente de homologação."
```

---

## 4. Mapa geral de funcionalidades

| ID | Funcionalidade | Descrição | Prioridade | Fase | Maturidade |
|---|---|---|---|---|---|
| FUNC-001 | Autenticação corporativa | Microsoft SSO, sessão, logout e acesso inicial. | Must | MVP | Nível 4 |
| FUNC-002 | Gestão de usuários, perfis e permissões | Administração de usuários, perfis, permissões e bloqueios de acesso. | Must | MVP | Nível 4 |
| FUNC-003 | Gestão de tenants e workspaces | Tenant inicial MCM, workspaces por área e membros. | Must | MVP | Nível 4 |
| FUNC-004 | Listagem e catálogo de assistentes | Listar assistentes visíveis por permissão, status e compartilhamento. | Must | MVP | Nível 4 |
| FUNC-005 | Criação de assistente via wizard | Criar assistente com nome, objetivo, persona, regras, modelo, RAG e tools. | Must | MVP | Nível 4 |
| FUNC-006 | Edição e versionamento de assistente | Editar configurações e gerar versões rastreáveis. | Must | MVP | Nível 4 |
| FUNC-007 | Teste de assistente | Testar assistente antes da publicação. | Must | MVP | Nível 4 |
| FUNC-008 | Publicação, aprovação e arquivamento | Publicar, solicitar aprovação ampla, arquivar e restaurar versões. | Must | MVP | Nível 4 |
| FUNC-009 | Compartilhamento de assistentes | Compartilhar por usuário, workspace ou organização com uso/edição separados. | Must | MVP | Nível 4 |
| FUNC-010 | Chat com assistente | Conversar com assistentes publicados, com streaming, fontes, tools e histórico. | Must | MVP | Nível 4 |
| FUNC-011 | Feedback de resposta | Avaliar respostas com positivo/negativo e comentário opcional. | Must | MVP | Nível 4 |
| FUNC-012 | Histórico e visualização de conversas | Usuário, owner e admin visualizam conversas conforme regras. | Must | MVP | Nível 4 |
| FUNC-013 | Knowledge Hub e bases de conhecimento | Criar bases, enviar documentos, indexar e controlar restrições. | Must | MVP | Nível 4 |
| FUNC-014 | MCP Hub e governança de tools | Cadastrar MCP servers, aprovar tools, vincular a assistentes e auditar execução. | Must | MVP | Nível 4 |
| FUNC-015 | Runtime Agno e AgentSpec | Gerar especificação versionada e executar agentes no runtime. | Must | MVP | Nível 4 |
| FUNC-016 | Analytics, custos e evals iniciais | Exibir custos, uso, feedbacks e avaliações iniciais. | Should | MVP | Nível 3 |
| FUNC-017 | Auditoria e logs operacionais | Registrar e consultar eventos críticos da plataforma. | Must | MVP | Nível 4 |
| FUNC-018 | Configurações globais da plataforma | Gerenciar providers, parâmetros, limites e configurações operacionais. | Should | MVP | Nível 3 |

---

## 5. Matriz Funcionalidade → Fluxo → Estado → API → Entidade → Teste

> As APIs e entidades abaixo são candidatas funcionais. Contratos finais e schemas finais devem ser detalhados nos documentos técnicos específicos.

| Funcionalidade | Fluxo | Tela/Rota | Estados | API candidata | Entidade | Permissão | Teste |
|---|---|---|---|---|---|---|---|
| FUNC-001 | Login e sessão | Login | loading, error, success | auth/session | users | auth.login | TST-FUNC-001 |
| FUNC-002 | Gerenciar usuários | Admin | loading, empty, error, forbidden | users/roles | users, roles | users.manage | TST-FUNC-002 |
| FUNC-003 | Gerenciar workspaces | Admin/Settings | loading, empty, success | workspaces | workspaces, members | workspace.manage | TST-FUNC-003 |
| FUNC-004 | Listar assistentes | Assistants | loading, empty, forbidden | assistants | assistants, shares | assistant.view | TST-FUNC-004 |
| FUNC-005 | Criar assistente | Assistant Wizard | draft, validation_error, success | assistants | assistants | assistant.create | TST-FUNC-005 |
| FUNC-006 | Editar/versionar | Assistant Detail/Edit | loading, conflict, success | assistant versions | assistant_versions | assistant.edit | TST-FUNC-006 |
| FUNC-007 | Testar | Assistant Test | thinking, streaming, error | assistant test | runtime_deployments | assistant.test | TST-FUNC-007 |
| FUNC-008 | Publicar/aprovar | Assistant Detail | pending, approved, rejected | publishing | publication_requests | assistant.publish | TST-FUNC-008 |
| FUNC-009 | Compartilhar | Share Dialog | validation, success, forbidden | assistant shares | assistant_shares | assistant.share | TST-FUNC-009 |
| FUNC-010 | Conversar | Chat Workspace | thinking, streaming, tool_call, fallback | chat stream | conversations, messages | assistant.use | TST-FUNC-010 |
| FUNC-013 | Upload/indexação | Knowledge Hub | uploading, indexing, error | knowledge documents | documents, chunks | kb.upload | TST-FUNC-013 |
| FUNC-014 | MCP/tools | MCP Hub | pending_approval, approved, error | mcp tools | mcp_servers, mcp_tools | mcp.manage | TST-FUNC-014 |
| FUNC-015 | Sincronizar runtime | Runtime Status | syncing, synced, failed | runtime sync | runtime_deployments | runtime.sync | TST-FUNC-015 |
| FUNC-017 | Auditoria | Audit Logs | loading, filtered, empty | audit logs | audit_logs | audit.read | TST-FUNC-017 |

---

## 6. Padrões funcionais globais

### 6.1 Estados de interface obrigatórios

Toda funcionalidade relevante deve prever:

- loading;
- skeleton quando aplicável;
- empty state;
- error state;
- success state;
- disabled state;
- forbidden;
- not found;
- validation error;
- server error.

Funcionalidades com IA também devem prever:

- thinking;
- streaming;
- retrieving sources;
- executing tool;
- fallback;
- runtime error;
- provider error;
- answer feedback.

### 6.2 Autoridade de permissões

O frontend pode ocultar menus, botões e ações, mas a autorização final deve ser validada pelo backend.

Toda funcionalidade crítica deve possuir:

- permissão de visualização;
- permissão de execução;
- comportamento sem permissão;
- validação server-side;
- evento de auditoria quando aplicável.

### 6.3 Mensagens ao usuário

Usuário não deve visualizar erro técnico cru, stack trace ou tela em branco.

| Código | Mensagem sugerida |
|---|---|
| AUTH_INVALID | Não foi possível autenticar com a conta corporativa. Tente novamente ou acione o administrador. |
| FORBIDDEN | Você não tem permissão para executar esta ação. |
| ASSISTANT_CREATED | Assistente criado como rascunho. |
| ASSISTANT_PUBLISHED | Assistente publicado com sucesso. |
| ASSISTANT_PENDING_APPROVAL | Solicitação enviada para aprovação administrativa. |
| ASSISTANT_ARCHIVED | Assistente arquivado com sucesso. |
| SHARE_CREATED | Compartilhamento atualizado com sucesso. |
| RAG_RESTRICTED | Este assistente usa uma base restrita. O acesso depende de autorização. |
| TOOL_HIGH_RISK | Esta ferramenta exige aprovação administrativa antes de ser usada. |
| CHAT_PROVIDER_FAILED | Não foi possível concluir a resposta agora. O sistema tentará usar uma alternativa quando disponível. |
| UPLOAD_STARTED | Documento recebido. A indexação será iniciada. |
| UPLOAD_FAILED | Não foi possível processar o documento. Verifique o arquivo e tente novamente. |
| RUNTIME_SYNC_FAILED | Não foi possível sincronizar o assistente com o runtime. |

---

## 7. FUNC-001 — Autenticação corporativa

### Objetivo

Permitir que usuários acessem o Orquestra usando conta corporativa Microsoft, com sessão segura e carregamento de permissões.

### Atores

- Usuário autenticável.
- Administrador da Plataforma.
- Microsoft Entra ID.
- Backend Orquestra.

### Fluxo principal

1. Usuário acessa o Orquestra.
2. Sistema verifica se há sessão ativa.
3. Caso não exista sessão, exibe tela de login.
4. Usuário seleciona entrada com Microsoft.
5. Backend inicia fluxo de autenticação.
6. Microsoft valida credenciais corporativas.
7. Backend cria sessão segura.
8. Frontend consulta usuário atual, tenant, workspaces e permissões.
9. Usuário é direcionado ao painel inicial.

### Fluxos alternativos

- Usuário já possui sessão válida: sistema direciona para painel.
- Usuário autenticado não possui perfil ativo: sistema exibe acesso pendente ou bloqueado.
- Usuário pertence a domínio não autorizado: sistema bloqueia login.

### Exceções

| Condição | Comportamento |
|---|---|
| Falha no SSO | Exibir mensagem amigável e permitir nova tentativa |
| Sessão expirada | Redirecionar para login |
| Usuário sem permissão | Exibir tela de acesso negado |
| Backend indisponível | Exibir mensagem de indisponibilidade temporária |

### Dados

- user;
- roles;
- permissions;
- tenant;
- workspaces;
- session.

### APIs candidatas

- iniciar login;
- callback de autenticação;
- consultar usuário atual;
- logout.

### Critérios de aceite

- Usuário válido autentica com Microsoft.
- Usuário inválido não acessa a plataforma.
- Sessão expirada redireciona para login.
- Permissões são carregadas após login.
- Logout encerra sessão.

---

## 8. FUNC-002 — Gestão de usuários, perfis e permissões

### Objetivo

Permitir que o Administrador da Plataforma gerencie usuários, perfis e permissões operacionais.

### Atores

- Administrador da Plataforma.
- Backend Orquestra.

### Fluxo principal

1. Administrador acessa área administrativa.
2. Sistema lista usuários do tenant.
3. Administrador filtra ou busca usuário.
4. Administrador visualiza detalhes.
5. Administrador altera status, perfil ou vínculo de workspace.
6. Sistema valida permissão.
7. Sistema salva alteração.
8. Sistema registra auditoria.
9. Interface atualiza listagem.

### Fluxos alternativos

- Usuário não encontrado: exibir estado vazio.
- Usuário já possui perfil: permitir substituição ou múltiplos vínculos conforme regra.
- Usuário desativado: bloquear acesso futuro.

### Exceções

| Condição | Comportamento |
|---|---|
| Admin tenta remover o próprio último acesso administrativo | Bloquear ação |
| Usuário sem permissão acessa admin | Exibir 403 |
| Conflito de atualização | Solicitar recarregamento |

### Permissões

- users.read;
- users.update;
- roles.assign;
- workspace.manage.

### Critérios de aceite

- Apenas admin acessa gestão de usuários.
- Alterações de perfil geram auditoria.
- Usuário desativado não consegue acessar a plataforma.
- Permissões refletem no frontend e no backend.

---

## 9. FUNC-003 — Gestão de tenants e workspaces

### Objetivo

Permitir estruturação organizacional por tenant e workspaces.

### Regras

- MCM é o tenant inicial.
- Todo usuário pertence a um tenant.
- Todo workspace pertence a um tenant.
- Usuário pode participar de mais de um workspace.
- Assistentes podem ter workspace principal.
- Compartilhamento pode atingir usuário, workspace ou organização.

### Fluxo principal

1. Admin acessa configurações organizacionais.
2. Sistema lista workspaces existentes.
3. Admin cria ou edita workspace.
4. Admin associa usuários.
5. Sistema salva vínculos.
6. Sistema registra auditoria.

### Critérios de aceite

- Workspace só existe dentro de tenant.
- Usuário pode estar em múltiplos workspaces.
- Assistentes respeitam tenant.
- Compartilhamentos não cruzam tenant.

---

## 10. FUNC-004 — Listagem e catálogo de assistentes

### Objetivo

Exibir ao usuário os assistentes disponíveis conforme perfil, permissões, compartilhamentos e status.

### Fluxo principal

1. Usuário acessa listagem de assistentes.
2. Sistema consulta assistentes visíveis ao usuário.
3. Sistema exibe cards/tabela com nome, status, owner, workspace e permissões.
4. Usuário filtra por status, workspace ou tipo.
5. Usuário abre detalhe ou inicia chat conforme permissão.

### Estados

- loading;
- empty;
- error;
- forbidden;
- success.

### Regras

- Usuário consumidor só vê assistentes publicados e compartilhados.
- Owner vê assistentes próprios.
- Admin vê todos os assistentes do tenant.
- Editor vê assistentes em que recebeu permissão.

### Critérios de aceite

- Usuário sem compartilhamento não vê assistente privado.
- Assistente arquivado não aparece para uso comum.
- Filtros não vazam dados restritos.

---

## 11. FUNC-005 — Criação de assistente via wizard

### Objetivo

Permitir que usuários autorizados criem assistentes de IA de forma guiada.

### Atores

- Administrador da Plataforma.
- Criador/Owner de Assistente.

### Fluxo principal

1. Usuário seleciona criar assistente.
2. Sistema inicia rascunho.
3. Usuário informa nome e objetivo.
4. Usuário define persona, tom e regras.
5. Usuário configura restrições e exemplos.
6. Usuário seleciona provider/modelo permitido.
7. Usuário vincula bases de conhecimento autorizadas.
8. Usuário seleciona tools aprovadas.
9. Usuário revisa configuração.
10. Sistema salva rascunho.
11. Sistema gera versão inicial.
12. Sistema registra auditoria.

### Validações

- Nome obrigatório.
- Objetivo obrigatório.
- Provider/modelo obrigatório.
- Recursos selecionados precisam estar liberados para o usuário.
- Tool de alto risco não aprovada não pode ser selecionada.
- Base restrita não pode ser usada sem autorização.

### Estados

- draft;
- saving;
- validation_error;
- forbidden_resource;
- saved;
- error.

### Critérios de aceite

- Assistente nasce com tenant e owner.
- Assistente nasce como rascunho.
- Recursos não autorizados não aparecem ou são bloqueados.
- Rascunho pode ser salvo sem publicação.
- Auditoria registra criação.

---

## 12. FUNC-006 — Edição e versionamento de assistente

### Objetivo

Permitir alteração controlada de assistentes com rastreabilidade e versionamento.

### Fluxo principal

1. Usuário abre assistente.
2. Sistema valida permissão de edição.
3. Usuário altera campos permitidos.
4. Sistema valida recursos selecionados.
5. Usuário salva alterações.
6. Se assistente estava publicado, sistema cria nova versão.
7. Sistema registra auditoria.
8. Interface exibe versão atualizada.

### Regras

- Editor só altera assistente se autorizado.
- Editor não pode remover ou alterar recurso restrito ao qual não possui acesso.
- Alteração em assistente publicado gera nova versão.
- Owner e admin podem restaurar versões.

### Critérios de aceite

- Histórico de versões é preservado.
- Alterações críticas geram auditoria.
- Usuário sem permissão não edita.
- Conflitos de edição são tratados.

---

## 13. FUNC-007 — Teste de assistente

### Objetivo

Permitir testar o comportamento do assistente antes de publicação.

### Fluxo principal

1. Usuário com permissão acessa teste.
2. Sistema monta configuração do assistente.
3. Sistema gera ou sincroniza especificação temporária.
4. Usuário envia mensagem de teste.
5. Runtime processa resposta.
6. Sistema exibe resposta, fontes e tools, quando aplicável.
7. Usuário aprova, ajusta ou retorna ao wizard.

### Estados de IA

- thinking;
- streaming;
- retrieving_sources;
- executing_tool;
- fallback;
- runtime_error.

### Critérios de aceite

- Assistente pode ser testado antes de publicação.
- Erros de provider/runtime são tratados.
- Resposta com RAG mostra fontes.
- Tool call é exibida e auditável.

---

## 14. FUNC-008 — Publicação, aprovação e arquivamento

### Objetivo

Controlar o ciclo de vida de assistentes.

### Status

- draft;
- pending_approval;
- published;
- archived.

### Fluxo de publicação simples

1. Owner solicita publicação.
2. Sistema valida se assistente foi testado.
3. Sistema valida RAG, tools e permissões.
4. Se escopo for privado ou workspace sem risco, publica.
5. Sistema registra versão publicada.
6. Sistema registra auditoria.

### Fluxo de publicação ampla

1. Owner solicita publicação para toda a organização.
2. Sistema cria solicitação pendente.
3. Admin revisa configuração.
4. Admin aprova ou rejeita.
5. Sistema publica ou devolve com justificativa.
6. Sistema registra auditoria.

### Arquivamento

- Owner ou admin pode arquivar assistente.
- Assistente arquivado não fica disponível para chat comum.
- Dados e histórico permanecem para auditoria.

### Critérios de aceite

- Publicação ampla exige admin.
- Assistente com RAG restrito exige validação.
- Tool de alto risco exige aprovação.
- Arquivamento não exclui histórico.

---

## 15. FUNC-009 — Compartilhamento de assistentes

### Objetivo

Permitir compartilhamento flexível e seguro de assistentes.

### Tipos de destino

- usuário;
- workspace;
- organização.

### Tipos de permissão

- uso;
- edição;
- gestão/dono, quando aplicável.

### Fluxo principal

1. Owner abre configuração de compartilhamento.
2. Sistema lista destinos disponíveis.
3. Owner escolhe usuário, workspace ou organização.
4. Owner define permissão de uso ou edição.
5. Sistema valida restrições de RAG e tools.
6. Sistema salva compartilhamento.
7. Sistema registra auditoria.

### Regras

- Compartilhamento não pode burlar RAG restrito.
- Publicação para organização exige admin.
- Usuário de outro workspace pode receber acesso específico, desde que esteja no mesmo tenant.
- Uso e edição são permissões separadas.

### Critérios de aceite

- Usuário compartilhado consegue usar assistente.
- Usuário sem share não acessa.
- Editor autorizado edita, mas não amplia permissões indevidas.
- Compartilhamento gera auditoria.

---

## 16. FUNC-010 — Chat com assistente

### Objetivo

Permitir conversa com assistentes publicados e autorizados, usando LLM real, RAG, tools e runtime.

### Fluxo principal

1. Usuário acessa Chat Workspace.
2. Sistema lista assistentes disponíveis para uso.
3. Usuário seleciona assistente.
4. Usuário envia mensagem.
5. Backend valida permissão.
6. Backend registra mensagem.
7. Backend aciona runtime Agno com AgentSpec.
8. Runtime executa LLM/RAG/tools conforme configuração.
9. Frontend exibe resposta em streaming.
10. Sistema exibe fontes e tools quando aplicável.
11. Sistema registra custos e auditoria.
12. Usuário pode enviar feedback.

### Fluxos alternativos

- Sem fonte RAG: resposta informa ausência de fonte quando aplicável.
- Provider falha: sistema tenta fallback se configurado.
- Tool falha: sistema informa falha controlada.
- Runtime indisponível: sistema exibe erro amigável.

### Estados visíveis

- thinking;
- streaming;
- retrieving sources;
- executing tool;
- fallback;
- error;
- completed.

### Critérios de aceite

- Usuário sem permissão não conversa.
- Chat usa provider real.
- Resposta é armazenada.
- Fontes aparecem quando RAG é usado.
- Tool calls são auditáveis.
- Custo é registrado quando disponível.

---

## 17. FUNC-011 — Feedback de resposta

### Objetivo

Permitir avaliação simples das respostas de IA.

### Fluxo principal

1. Usuário recebe resposta.
2. Usuário seleciona positivo ou negativo.
3. Usuário opcionalmente adiciona comentário.
4. Sistema salva feedback vinculado à mensagem.
5. Sistema atualiza métricas agregadas.

### Regras

- Usuário só avalia respostas de conversas próprias.
- Admin visualiza todos os feedbacks.
- Owner visualiza feedbacks dos próprios assistentes.
- Feedback não altera automaticamente a resposta.

### Critérios de aceite

- Feedback é salvo.
- Comentário é opcional.
- Métrica agregada é atualizada.
- Permissões de visualização são respeitadas.

---

## 18. FUNC-012 — Histórico e visualização de conversas

### Objetivo

Permitir consulta de conversas conforme política de acesso.

### Regras de acesso

- Admin vê todas as conversas.
- Owner vê conversas dos assistentes que criou e suas próprias conversas.
- Editor vê suas próprias conversas e conversas de assistente apenas com permissão explícita.
- Usuário consumidor vê apenas suas próprias conversas.

### Fluxo principal

1. Usuário acessa histórico.
2. Sistema aplica filtro de permissão.
3. Sistema lista conversas permitidas.
4. Usuário abre conversa.
5. Sistema exibe mensagens, fontes, tool calls e feedbacks conforme autorização.

### Critérios de aceite

- Usuário não vê conversas indevidas.
- Conversas são retidas por 360 dias.
- Admin possui visão auditável.
- Owner possui visão dos assistentes próprios.

---

## 19. FUNC-013 — Knowledge Hub e bases de conhecimento

### Objetivo

Permitir gestão de bases de conhecimento para uso em RAG.

### Fluxo principal

1. Usuário autorizado acessa Knowledge Hub.
2. Sistema lista bases disponíveis.
3. Usuário cria ou seleciona base.
4. Usuário envia documento.
5. Sistema valida tipo e tamanho.
6. Sistema inicia ingestão.
7. Sistema processa chunks e embeddings.
8. Sistema atualiza status.
9. Base fica disponível para assistentes autorizados.

### Estados

- empty;
- uploading;
- validating;
- indexing;
- indexed;
- failed;
- restricted.

### Regras

- Bases podem ser restritas.
- RAG restrito não pode ser acessado indiretamente.
- Documentos sensíveis exigem controle de acesso.
- Reprocessamento/reindexação exige permissão administrativa ou regra específica.

### Critérios de aceite

- Documento enviado passa por validação.
- Status de indexação é visível.
- Base restrita respeita acesso.
- Assistente só usa base autorizada.

---

## 20. FUNC-014 — MCP Hub e governança de tools

### Objetivo

Permitir gestão de servidores MCP, tools, risco e vinculação a assistentes.

### Fluxo principal

1. Admin acessa MCP Hub.
2. Admin cadastra servidor MCP.
3. Sistema descobre ou registra tools.
4. Admin classifica risco.
5. Admin aprova ou rejeita tool.
6. Owner/Editor autorizado vincula tool aprovada ao assistente.
7. Durante o chat, runtime executa tool quando necessário.
8. Sistema registra execução em logs.

### Regras

- Apenas admin gerencia servidores MCP.
- Tool de alto risco exige aprovação.
- Tool não aprovada não pode ser vinculada.
- Toda execução relevante deve ser auditada.
- Credenciais não aparecem em tela nem logs.

### Critérios de aceite

- Tool aprovada pode ser vinculada.
- Tool rejeitada não pode ser usada.
- Execução de tool gera log.
- Falha de tool é tratada no chat.

---

## 21. FUNC-015 — Runtime Agno e AgentSpec

### Objetivo

Permitir que o Orquestra controle a configuração do agente e o Agno execute a lógica de IA.

### Fluxo principal

1. Assistente é criado ou atualizado.
2. Backend gera AgentSpec versionado.
3. Backend valida configuração.
4. Backend sincroniza com runtime Agno.
5. Runtime registra versão ativa.
6. Chat aciona runtime com contexto e mensagem.
7. Runtime executa LLM, RAG e tools.
8. Runtime retorna eventos/resposta.
9. Backend registra execução, custo e auditoria.

### Estados

- spec_pending;
- syncing;
- synced;
- sync_failed;
- running;
- failed.

### Critérios de aceite

- AgentSpec é versionado.
- Runtime executa assistente com base na versão correta.
- Falha de sincronização é visível.
- Execução gera eventos de auditoria.
- Fallback é aplicado quando configurado.

---

## 22. FUNC-016 — Analytics, custos e evals iniciais

### Objetivo

Permitir acompanhamento inicial de uso, custo, feedback e qualidade.

### Fluxo principal

1. Admin acessa analytics.
2. Sistema exibe visão global.
3. Owner acessa visão dos próprios assistentes.
4. Sistema exibe uso, custo, feedbacks e evals.
5. Usuário filtra por período, assistente ou workspace.

### Métricas iniciais

- total de conversas;
- mensagens;
- uso por assistente;
- feedback positivo/negativo;
- custo por assistente;
- falhas de provider;
- fallback usado;
- tool calls;
- execuções de eval.

### Critérios de aceite

- Admin vê visão global.
- Owner vê assistentes próprios.
- Custo é associado ao assistente.
- Métricas não expõem conteúdo indevido.

---

## 23. FUNC-017 — Auditoria e logs operacionais

### Objetivo

Registrar e consultar eventos críticos da plataforma.

### Eventos mínimos

- login;
- logout;
- falha de login;
- criação/edição/publicação/arquivamento de assistente;
- criação de versão;
- compartilhamento;
- upload/reindexação de documento;
- cadastro/aprovação/execução de tool;
- conversa criada;
- mensagem enviada;
- resposta gerada;
- feedback registrado;
- runtime sync;
- provider falhou;
- fallback usado;
- acesso negado;
- acesso a recurso sensível.

### Fluxo principal

1. Ação crítica ocorre.
2. Backend gera evento.
3. Sistema salva audit log.
4. Admin acessa tela de auditoria.
5. Admin filtra por tipo, ator, recurso ou período.
6. Admin visualiza detalhes.

### Critérios de aceite

- Eventos críticos são registrados.
- Logs são filtráveis.
- Logs não expõem secrets.
- Apenas perfil autorizado acessa auditoria.

---

## 24. FUNC-018 — Configurações globais da plataforma

### Objetivo

Permitir parametrização administrativa da plataforma.

### Escopo inicial

- providers habilitados;
- modelos disponíveis;
- parâmetros padrão;
- limites operacionais iniciais;
- políticas de tool risk;
- configurações de retenção;
- parâmetros de runtime.

### Critérios de aceite

- Apenas admin acessa configurações globais.
- Alterações sensíveis geram auditoria.
- Secrets não são exibidos em texto claro.
- Configuração inválida não é salva.

---

## 25. Impactos funcionais por camada

### 25.1 Frontend

- rotas autenticadas;
- tela de login;
- admin;
- listagem de assistentes;
- wizard;
- detalhe/edição;
- chat;
- Knowledge Hub;
- MCP Hub;
- analytics;
- audit logs;
- permission gates;
- services/hooks para API;
- estados de IA;
- estados de upload/indexação;
- feedbacks e mensagens amigáveis.

### 25.2 Backend

- autenticação;
- sessão;
- autorização;
- RBAC;
- tenants;
- workspaces;
- users;
- assistants;
- versions;
- shares;
- approvals;
- knowledge bases;
- documents;
- ingestion;
- mcp servers/tools;
- runtime integration;
- conversations/messages;
- feedback;
- audit logs;
- costs;
- evals.

### 25.3 Banco de dados

- entidades estruturantes;
- relacionamentos;
- auditoria;
- retenção;
- classificação de dados;
- logs;
- conversas;
- custos;
- versões;
- runtime deployments.

### 25.4 Infraestrutura

- frontend;
- backend;
- PostgreSQL;
- runtime Agno;
- fila para jobs assíncronos;
- storage para documentos;
- variáveis por camada;
- healthchecks;
- logs;
- homologação;
- deploy futuro.

### 25.5 IA

- AgentSpec;
- Agno runtime;
- OpenAI;
- Anthropic;
- model routing;
- fallback;
- RAG;
- MCP/tools;
- evals;
- feedback;
- cost tracking;
- auditoria.

---

## 26. Critérios funcionais gerais de aceite

O MVP será funcionalmente validável quando:

- usuário autenticar via Microsoft SSO;
- permissões impedirem acesso indevido;
- admin gerenciar usuários e permissões básicas;
- owner criar assistente pelo wizard;
- assistente puder ser testado antes da publicação;
- publicação ampla exigir aprovação;
- compartilhamento diferenciar uso e edição;
- usuário autorizado conversar com assistente publicado;
- chat responder com LLM real;
- RAG exibir fontes;
- MCP/tool calling executar tool aprovada;
- runtime Agno executar com AgentSpec versionado;
- conversas forem armazenadas por 360 dias;
- feedback for registrado;
- custo por assistente for acompanhado;
- auditoria registrar ações críticas;
- erros de provider, runtime, RAG e tools forem tratados de forma amigável.

---

## 27. Cenários de teste esperados

| ID | Cenário | Tipo |
|---|---|---|
| TST-FUNC-001 | Login Microsoft válido e inválido | Integração/manual |
| TST-FUNC-002 | Usuário sem permissão tentando acessar admin | Integração |
| TST-FUNC-003 | Usuário associado a múltiplos workspaces | Integração |
| TST-FUNC-004 | Listagem respeita assistentes privados/compartilhados | Integração |
| TST-FUNC-005 | Criação de assistente com validação de campos | Integração/E2E |
| TST-FUNC-006 | Edição de assistente publicado gera versão | Integração |
| TST-FUNC-007 | Teste de assistente com resposta real | Integração/manual |
| TST-FUNC-008 | Publicação ampla exige aprovação | Integração |
| TST-FUNC-009 | Compartilhamento com usuário de outro workspace | Integração |
| TST-FUNC-010 | Chat com streaming, fontes e feedback | E2E/manual |
| TST-FUNC-011 | RAG restrito bloqueia acesso indireto | Segurança/integração |
| TST-FUNC-012 | Tool de alto risco não aprovada não executa | Segurança/integração |
| TST-FUNC-013 | Upload e indexação de documento | Integração |
| TST-FUNC-014 | Runtime Agno indisponível gera erro amigável | Integração |
| TST-FUNC-015 | Fallback model é usado quando provider falha | Integração |
| TST-FUNC-016 | Auditoria registra eventos críticos | Integração |
| TST-FUNC-017 | Cost tracking associa uso ao assistente | Integração |
| TST-FUNC-018 | Editor não vê conversa de terceiros sem permissão | Segurança/integração |

---

## 28. Pendências funcionais controladas

| Pendência | Impacto | Próximo encaminhamento |
|---|---|---|
| Definir workspaces piloto | Afeta usuários, permissões e compartilhamento | Discovery operacional com MCM |
| Definir vector store | Afeta RAG, banco e infraestrutura | Arquitetura e orquestração de IA |
| Detalhar AgentSpec | Afeta backend, runtime e versionamento | Arquitetura e orquestração de IA |
| Definir primeiros MCP servers/tools | Afeta escopo funcional do MCP Hub | Integrações e IA |
| Definir ambiente de homologação | Afeta validação real do MVP | Infraestrutura |
| Definir critérios mínimos de evals | Afeta qualidade de IA | Orquestração de IA e qualidade |
| Definir limites iniciais de uso/custo | Afeta governança e analytics | Métricas e governança |

---

## 29. Handoff para próximos documentos

### 29.1 Design system

Aprofundar:

- wizard;
- chat;
- feedbacks;
- estados de IA;
- tabelas;
- forms;
- modais;
- empty/error/loading states;
- padrões de acessibilidade;
- motion funcional.

### 29.2 Arquitetura de software

Aprofundar:

- boundaries;
- módulos;
- backend;
- runtime;
- AgentSpec;
- RAG;
- MCP;
- filas;
- eventos;
- observabilidade.

### 29.3 Backend

Aprofundar:

- auth;
- RBAC;
- tenants/workspaces;
- assistentes;
- versionamento;
- shares;
- publicação;
- RAG;
- MCP;
- chat;
- runtime;
- auditoria;
- custos;
- evals.

### 29.4 Frontend

Aprofundar:

- rotas;
- guards;
- hooks;
- services;
- schemas;
- components;
- states;
- forms;
- chat streaming;
- upload/indexação;
- permission gates;
- tratamento de erros.

### 29.5 APIs e contratos

Aprofundar:

- endpoints;
- requests;
- responses;
- erros;
- autorização;
- paginação;
- filtros;
- streaming;
- contratos de runtime.

### 29.6 Banco de dados

Aprofundar:

- entidades;
- relacionamentos;
- constraints;
- índices;
- retenção;
- auditoria;
- seeds;
- vector store.

### 29.7 Segurança e compliance

Aprofundar:

- SSO;
- sessão;
- RBAC;
- tenant isolation;
- RAG restrito;
- tools de alto risco;
- secrets;
- conversas;
- auditoria;
- prompt injection;
- tool abuse.

### 29.8 Orquestração de IA

Aprofundar:

- Agno;
- AgentSpec;
- providers;
- model routing;
- fallback;
- RAG;
- MCP/tools;
- evals;
- cost tracking;
- observabilidade de IA.

---

## 30. Maturidade funcional

Classificação atual:

```txt
Nível 4 — Funcionalidades críticas possuem fluxos, estados, permissões, dados, APIs candidatas, entidades candidatas e testes esperados.
```

Para atingir nível 5, ainda é necessário:

- validar funcionalmente com stakeholders;
- detalhar contratos de API;
- detalhar schema de banco;
- validar arquitetura do runtime;
- definir vector store;
- confirmar ambiente de homologação;
- fechar MCP/tools iniciais.

---

## 31. Próximos passos

1. Revisar este documento com produto, engenharia, segurança e stakeholders.
2. Atualizar registro de decisões se houver alteração de escopo.
3. Iniciar o documento de Design System.
4. Iniciar ou atualizar a Arquitetura de Software.
5. Detalhar Backend, Frontend, APIs e Banco.
6. Preparar documento específico de Orquestração de IA.
7. Validar pendências de workspaces, vector store, AgentSpec, MCP/tools e homologação.

---

## 32. Conclusão

A especificação funcional do Orquestra demonstra que o MVP exige coordenação entre produto, frontend, backend, banco, segurança, infraestrutura, IA, RAG, MCP, runtime e governança.

O projeto pode avançar para detalhamento visual, arquitetural e técnico, mantendo controle sobre as decisões pendentes e evitando que o protótipo visual seja tratado como funcionalidade já implementada.
