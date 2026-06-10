# Orquestra — Requisitos do Sistema

> Documento corporativo de requisitos do sistema Orquestra.  
> Preparado para uso interno na MCM.

---

## 1. Objetivo

Consolidar os requisitos funcionais, não funcionais, de experiência, dados, permissões, regras de negócio, integrações, operação, infraestrutura, motion e IA do Orquestra.

Este documento define o que o sistema deve fazer, como deve se comportar, quais regras deve respeitar, quais dados precisa armazenar, quais permissões precisa aplicar e quais critérios devem ser usados para validação do MVP e evoluções futuras.

---

## 2. Sumário executivo

O Orquestra será uma plataforma corporativa para criação, configuração, publicação, execução, compartilhamento, auditoria e governança de assistentes de IA no contexto da MCM.

O sistema deve transformar o protótipo visual existente em um produto real com frontend, backend, APIs, banco de dados, autenticação corporativa, permissões, runtime de IA, RAG, MCP/tools, auditoria, cost tracking e retenção de conversas.

O MVP deve priorizar a entrega de valor corporativo com segurança e governança, mantendo escopo controlado e preparando evolução futura para outras empresas do Grupo Intercept.

---

## 3. Requirements Blueprint

```yaml
requirements_blueprint:
  project_name: "Orquestra"
  organization: "MCM"
  execution_mode: "Projeto existente no Lovable, ainda não exportado para ambiente Docker/WSL"
  source_documents:
    - "Documentação técnica do estado atual"
    - "Contexto inicial do projeto"
    - "Brief mestre"
    - "Discovery técnica e estratégica"
    - "Registro de decisões"
  requirement_groups:
    functional:
      total: 45
      must: 37
      should: 6
      could: 2
    non_functional:
      total: 12
    experience:
      total: 10
    data:
      total: 24
    permissions:
      total: 16
    business_rules:
      total: 18
    integrations:
      total: 8
    operational_infrastructure:
      total: 8
    motion_microinteractions:
      total: 5
    ai_orchestration:
      total: 10
  readiness_summary:
    requirements_maturity_level: "Nível 4 — requisitos classificados, priorizados e rastreáveis para próximas etapas"
    ready_for_functional_specification: true
    ready_for_architecture: true
    ready_for_technical_execution: false
  main_blockers:
    - "Corte final de MVP, versão 1, versão 2 e futuro precisa ser validado."
    - "Vector store precisa ser definido."
    - "AgentSpec precisa de detalhamento técnico."
    - "Workspaces piloto precisam ser confirmados."
    - "Primeiros MCP servers/tools precisam ser definidos."
    - "Ambiente de homologação precisa ser definido."
```

---

## 4. Escopo por fase

### 4.1 MVP

O MVP deve entregar:

- Microsoft SSO;
- RBAC inicial;
- tenant e workspaces;
- CRUD de assistentes;
- wizard completo;
- versionamento;
- publicação e aprovação;
- compartilhamento;
- OpenAI e Anthropic;
- chat com LLM real;
- RAG real;
- MCP real;
- Agno runtime;
- AgentSpec;
- auditoria;
- retenção de conversas;
- feedback simples;
- cost tracking inicial;
- evals iniciais;
- backend, banco e APIs reais;
- frontend integrado;
- observabilidade mínima;
- infraestrutura local e caminho de homologação.

### 4.2 Versão 1

Itens candidatos:

- prompt compilado com visualização controlada;
- templates de assistente;
- analytics mais completo;
- gestão refinada de documentos;
- histórico de versões mais amigável;
- permissões mais granulares;
- redaction/PII mais robusto;
- biblioteca de exemplos.

### 4.3 Versão 2

Itens candidatos:

- marketplace interno de assistentes/tools;
- multi-agent avançado;
- relatórios avançados;
- providers adicionais;
- workflows avançados de aprovação;
- automações corporativas mais amplas;
- expansão controlada para outras empresas do Grupo Intercept.

### 4.4 Futuro / não agora

Não entra no MVP:

- WebSocket;
- colaboração em tempo real;
- versão mobile nativa;
- SEO/aquisição;
- marketplace avançado;
- providers adicionais obrigatórios;
- multi-tenant complexo com regras avançadas;
- redaction/PII completo;
- integração ampla com todos os sistemas corporativos.

---

## 5. Perfis do sistema

| Perfil | Descrição | Escopo principal |
|---|---|---|
| Administrador da Plataforma | Super admin do Orquestra | Usuários, permissões, providers, RAG, MCP, tools, auditoria, custos e governança |
| Criador/Owner de Assistente | Usuário autorizado a criar e gerir assistentes | Criar, editar, testar, publicar, compartilhar e acompanhar assistentes próprios |
| Editor de Assistente | Usuário autorizado a editar assistentes específicos | Editar configurações permitidas sem ampliar permissões indevidas |
| Usuário Consumidor do Chat | Usuário que usa assistentes publicados/compartilhados | Conversar, consultar fontes e enviar feedback |

---

## 6. Requisitos funcionais

| ID | Nome | Descrição | Prioridade | Fase | Status |
|---|---|---|---|---|---|
| RF-001 | Autenticação Microsoft SSO | Permitir entrada com conta corporativa Microsoft. | Must | MVP | Approved |
| RF-002 | Sessão do usuário autenticado | Consultar usuário logado, perfil, tenant, workspaces e permissões. | Must | MVP | Approved |
| RF-003 | Logout seguro | Encerrar sessão e invalidar acesso autenticado. | Must | MVP | Approved |
| RF-004 | Gestão de usuários | Permitir ao administrador consultar, ativar, desativar e classificar usuários. | Must | MVP | Approved |
| RF-005 | Gestão de perfis | Permitir vincular usuários aos perfis oficiais da plataforma. | Must | MVP | Approved |
| RF-006 | Gestão de tenants | Modelar tenant desde o início, com MCM como tenant inicial. | Must | MVP | Approved |
| RF-007 | Gestão de workspaces | Permitir áreas/departamentos como workspaces e associação de usuários. | Must | MVP | Approved |
| RF-008 | Listagem de assistentes | Exibir assistentes visíveis ao usuário conforme permissões. | Must | MVP | Approved |
| RF-009 | Criação de assistente | Permitir criação de assistente por usuário autorizado. | Must | MVP | Approved |
| RF-010 | Wizard de configuração | Permitir configurar objetivo, persona, tom, regras, restrições, exemplos, modelo, RAG e tools. | Must | MVP | Approved |
| RF-011 | Edição de assistente | Permitir edição conforme papel e permissão específica. | Must | MVP | Approved |
| RF-012 | Versionamento de assistente | Gerar versão quando assistente publicado for alterado. | Must | MVP | Approved |
| RF-013 | Teste de assistente | Permitir testar assistente antes da publicação. | Must | MVP | Approved |
| RF-014 | Publicação de assistente | Permitir publicar assistente após validações de estado e permissão. | Must | MVP | Approved |
| RF-015 | Aprovação de publicação ampla | Exigir aprovação administrativa para publicação em nível de organização. | Must | MVP | Approved |
| RF-016 | Arquivamento de assistente | Permitir arquivar assistentes sem exclusão definitiva. | Should | MVP | Approved |
| RF-017 | Restauração de versão | Permitir restaurar versão anterior para administrador e owner. | Should | MVP | Approved |
| RF-018 | Compartilhamento de assistente | Compartilhar com usuário, workspace ou organização com permissões de uso/edição. | Must | MVP | Approved |
| RF-019 | Uso de assistente no chat | Permitir conversa com assistentes publicados e autorizados. | Must | MVP | Approved |
| RF-020 | Chat com streaming | Exibir resposta de IA de forma progressiva. | Must | MVP | Approved |
| RF-021 | Exibição de fontes RAG | Exibir fontes/citações quando resposta usar base de conhecimento. | Must | MVP | Approved |
| RF-022 | Exibição de tools chamadas | Exibir quando uma tool for chamada pelo agente. | Should | MVP | Approved |
| RF-023 | Feedback de resposta | Permitir avaliação positiva/negativa e comentário opcional. | Must | MVP | Approved |
| RF-024 | Histórico de conversas próprias | Usuário deve visualizar suas próprias conversas. | Must | MVP | Approved |
| RF-025 | Visualização de conversas por owner | Owner visualiza conversas dos assistentes que criou. | Must | MVP | Approved |
| RF-026 | Auditoria de conversas por administrador | Administrador visualiza conversas para auditoria. | Must | MVP | Approved |
| RF-027 | Knowledge Hub | Permitir cadastrar e listar bases de conhecimento. | Must | MVP | Approved |
| RF-028 | Upload de documentos | Permitir envio de documentos para bases autorizadas. | Must | MVP | Approved |
| RF-029 | Ingestão e indexação | Processar documentos para recuperação contextual. | Must | MVP | Approved |
| RF-030 | Controle de RAG restrito | Impedir acesso indireto a bases restritas por meio de assistentes. | Must | MVP | Approved |
| RF-031 | MCP Hub | Permitir cadastrar servidores MCP e tools em registry governado. | Must | MVP | Approved |
| RF-032 | Aprovação de tools de alto risco | Exigir aprovação admin para tools de alto risco. | Must | MVP | Approved |
| RF-033 | Vinculação de tools a assistente | Permitir vincular tools liberadas a assistentes autorizados. | Must | MVP | Approved |
| RF-034 | Execução de tools | Permitir execução auditável de tools aprovadas. | Must | MVP | Approved |
| RF-035 | Agno runtime | Executar agentes no runtime Agno com especificação versionada. | Must | MVP | Approved |
| RF-036 | AgentSpec | Gerar, versionar e sincronizar especificação do agente. | Must | MVP | Approved |
| RF-037 | Providers OpenAI e Anthropic | Permitir configuração inicial de OpenAI e Anthropic. | Must | MVP | Approved |
| RF-038 | Fallback de modelo | Permitir fallback quando provider/modelo falhar. | Must | MVP | Approved |
| RF-039 | Cost tracking | Registrar custo/uso por assistente. | Must | MVP | Approved |
| RF-040 | Evals iniciais | Permitir avaliação inicial de qualidade dos assistentes. | Should | MVP | Approved |
| RF-041 | Analytics mínimo | Exibir métricas básicas de uso, custo e feedback. | Should | MVP | Approved |
| RF-042 | Audit logs | Registrar ações críticas da plataforma. | Must | MVP | Approved |
| RF-043 | Prompt compilado | Disponibilizar visualização controlada do prompt final/compilado. | Should | v1 | Candidate |
| RF-044 | Templates de assistente | Permitir criar assistente a partir de template. | Could | v1 | Candidate |
| RF-045 | Marketplace interno simples | Permitir catálogo interno de assistentes e tools aprovadas. | Could | v2 | Candidate |

---

## 7. Detalhamento dos requisitos funcionais críticos

### RF-001 — Autenticação Microsoft SSO

**Descrição:** o sistema deve permitir autenticação com conta corporativa Microsoft.

**Prioridade:** Must  
**Fase:** MVP  
**Critérios de aceite:**

- Dado que o usuário acessa a plataforma, quando escolhe entrar com Microsoft, então deve ser direcionado ao fluxo corporativo de autenticação.
- Dado que a autenticação é válida, quando o usuário retorna ao sistema, então uma sessão segura deve ser criada.
- Dado que a autenticação falha, quando o usuário retorna ao sistema, então deve visualizar mensagem clara de erro.

### RF-009 — Criação de assistente

**Descrição:** usuários autorizados devem poder criar assistentes.

**Critérios de aceite:**

- Dado que o usuário possui permissão de criação, quando inicia um novo assistente, então o sistema deve criar um rascunho.
- Dado que o usuário não possui permissão, quando tenta criar assistente, então o sistema deve bloquear a ação.
- Dado que o assistente é criado, então deve possuir tenant, owner e status inicial de rascunho.

### RF-010 — Wizard de configuração

**Descrição:** o sistema deve oferecer wizard para configuração orientada de assistentes.

**Critérios de aceite:**

- O wizard deve permitir configurar nome, objetivo, persona, tom, regras, restrições, exemplos, provider/modelo, RAG e tools.
- O usuário deve conseguir salvar rascunho.
- Campos obrigatórios devem ser validados.
- Recursos não autorizados não devem ficar disponíveis para seleção.

### RF-014 — Publicação de assistente

**Descrição:** assistentes devem poder ser publicados conforme regras de permissão e aprovação.

**Critérios de aceite:**

- Assistente deve ser testado antes da publicação.
- Publicação ampla deve exigir aprovação administrativa.
- Assistente com RAG restrito ou tool de alto risco deve respeitar validações adicionais.
- Publicação deve gerar evento de auditoria.

### RF-018 — Compartilhamento de assistente

**Descrição:** o sistema deve permitir compartilhamento com usuário, workspace ou organização.

**Critérios de aceite:**

- O compartilhamento deve diferenciar uso e edição.
- Um assistente pode ter workspace principal e também ser compartilhado com usuários/workspaces adicionais.
- Compartilhamento não pode conceder acesso indireto a RAG restrito.
- Compartilhamento deve gerar evento de auditoria.

### RF-019 — Uso de assistente no chat

**Descrição:** usuários autorizados devem poder conversar com assistentes publicados.

**Critérios de aceite:**

- Usuário só deve visualizar assistentes aos quais possui acesso.
- A resposta deve ser gerada por provider real.
- Resposta com RAG deve indicar fontes.
- Chamada de tool deve ser visível e auditável.
- Conversa deve ser armazenada conforme política de retenção.

### RF-027 — Knowledge Hub

**Descrição:** o sistema deve permitir gestão de bases de conhecimento.

**Critérios de aceite:**

- Usuário autorizado pode criar base.
- Base pode ter classificação/restrição.
- Documentos podem ser vinculados a bases.
- Acesso à base deve respeitar permissões.

### RF-031 — MCP Hub

**Descrição:** o sistema deve permitir governança de MCP servers e tools.

**Critérios de aceite:**

- Admin pode cadastrar MCP server.
- Admin pode aprovar ou rejeitar tools.
- Tools de alto risco exigem aprovação.
- Execuções devem gerar logs.

### RF-035 — Agno runtime

**Descrição:** o sistema deve executar agentes usando Agno como runtime separado.

**Critérios de aceite:**

- Backend deve sincronizar especificação do agente com runtime.
- Runtime deve executar agente com base na especificação versionada.
- Falhas de runtime devem ser registradas.
- Chat deve receber resposta ou erro tratável.

### RF-039 — Cost tracking

**Descrição:** o sistema deve registrar uso e custo por assistente.

**Critérios de aceite:**

- Cada execução deve registrar provider/modelo quando disponível.
- Custos devem ser associados ao assistente.
- Admin deve acessar visão global.
- Owner deve acessar custos dos próprios assistentes.

---

## 8. Requisitos não funcionais

| ID | Categoria | Descrição | Métrica/Alvo | Prioridade |
|---|---|---|---|---|
| RNF-001 | Segurança | Backend deve ser autoridade de autenticação e autorização. | Bloqueio de acesso indevido | Must |
| RNF-002 | Segurança | Secrets, tokens e credenciais não devem ser gravados em logs. | 0 ocorrência conhecida | Must |
| RNF-003 | Auditoria | Ações críticas devem gerar trilha auditável. | 100% dos eventos críticos | Must |
| RNF-004 | Retenção | Conversas devem ser retidas por 360 dias. | 360 dias | Must |
| RNF-005 | Disponibilidade | Serviços principais devem possuir healthcheck. | Healthcheck por serviço crítico | Must |
| RNF-006 | Performance | Chat deve iniciar streaming sem bloquear a interface. | Feedback visual imediato | Must |
| RNF-007 | Acessibilidade | Interface deve ter navegação por teclado e foco visível em ações principais. | Validação manual mínima | Should |
| RNF-008 | Responsividade | Interface deve ser desktop-first com suporte mínimo a notebooks e telas menores. | Layout sem quebra crítica | Must |
| RNF-009 | Observabilidade | Falhas de runtime, provider, RAG e tools devem ser registradas. | Logs consultáveis | Must |
| RNF-010 | Manutenibilidade | Projeto final deve separar frontend, backend e runtime. | Estrutura modular | Must |
| RNF-011 | Escalabilidade | Ingestão, embeddings e evals devem suportar execução assíncrona. | Fila/job planejado | Should |
| RNF-012 | Privacidade | Acesso a conversas deve obedecer perfil e relação com o assistente. | Controle por permissão | Must |

---

## 9. Requisitos de experiência e interface

| ID | Nome | Descrição | Relacionado |
|---|---|---|---|
| RX-001 | Login corporativo claro | Tela de login deve comunicar entrada via Microsoft. | RF-001 |
| RX-002 | Acesso negado | Usuário sem permissão deve ver estado de acesso negado, não tela quebrada. | RF-002 |
| RX-003 | Wizard orientado | Wizard deve dividir configuração do assistente em etapas claras. | RF-010 |
| RX-004 | Estados de IA | Chat deve indicar processamento, streaming, tool call, fallback e erro. | RF-019/RF-020 |
| RX-005 | Fontes visíveis | Respostas com RAG devem exibir fontes de forma compreensível. | RF-021 |
| RX-006 | Feedback simples | Resposta deve permitir avaliação rápida sem interromper conversa. | RF-023 |
| RX-007 | Estados de documentos | Upload/indexação devem exibir pendente, processando, concluído e erro. | RF-028/RF-029 |
| RX-008 | Tabelas administrativas | Listagens devem suportar busca, filtros e estados vazios. | RF-004/RF-008/RF-042 |
| RX-009 | Motion funcional | Animações devem servir a feedback e clareza, com respeito a redução de movimento. | RF-020/RF-029 |
| RX-010 | Desktop-first | Experiência deve priorizar uso corporativo em desktop/notebook. | Todos |

### 9.1 Estados obrigatórios

O frontend deve prever:

- carregando;
- vazio;
- erro;
- sucesso;
- sem permissão;
- processando;
- resposta em streaming;
- tool em execução;
- fallback de modelo;
- RAG sem fonte;
- publicação pendente;
- aprovação concedida;
- aprovação rejeitada;
- documento indexando;
- documento com erro.

---

## 10. Requisitos de dados

| ID | Entidade | Descrição | Sensibilidade | Auditoria |
|---|---|---|---|---|
| RD-001 | tenants | Organizações/empresas atendidas pela plataforma. | Interno | Sim |
| RD-002 | users | Usuários autenticados e seus dados corporativos mínimos. | PII | Sim |
| RD-003 | roles | Perfis globais do sistema. | Interno | Sim |
| RD-004 | permissions | Permissões por recurso/ação. | Interno | Sim |
| RD-005 | workspaces | Áreas/departamentos dentro do tenant. | Interno | Sim |
| RD-006 | workspace_members | Relação entre usuários e workspaces. | Interno | Sim |
| RD-007 | assistants | Assistentes e metadados principais. | Interno | Sim |
| RD-008 | assistant_versions | Versões de configuração do assistente. | Interno | Sim |
| RD-009 | assistant_shares | Compartilhamentos e permissões por target. | Interno | Sim |
| RD-010 | knowledge_bases | Bases de conhecimento e classificação. | Sensível possível | Sim |
| RD-011 | knowledge_base_documents | Documentos enviados para RAG. | Sensível possível | Sim |
| RD-012 | document_chunks | Trechos processados para recuperação. | Sensível possível | Sim |
| RD-013 | embeddings | Vetores/índices para busca semântica. | Sensível possível | Sim |
| RD-014 | mcp_servers | Servidores MCP cadastrados. | Interno | Sim |
| RD-015 | mcp_tools | Tools disponíveis e classificação de risco. | Interno/Sensível | Sim |
| RD-016 | assistant_tools | Tools vinculadas a assistentes. | Interno | Sim |
| RD-017 | conversations | Conversas entre usuários e assistentes. | Sensível possível | Sim |
| RD-018 | messages | Mensagens e respostas de IA. | Sensível possível | Sim |
| RD-019 | feedbacks | Avaliações de respostas. | Interno | Sim |
| RD-020 | audit_logs | Eventos críticos auditáveis. | Interno/Sensível | Sim |
| RD-021 | provider_usage_costs | Uso, tokens, custo e provider por execução. | Interno | Sim |
| RD-022 | eval_datasets | Datasets mínimos de avaliação. | Interno | Sim |
| RD-023 | eval_runs | Execuções de avaliação e resultados. | Interno | Sim |
| RD-024 | runtime_deployments | Estado de sincronização com runtime. | Interno | Sim |

---

## 11. Requisitos de permissão

| ID | Recurso | Ação | Quem pode | Condições |
|---|---|---|---|---|
| RP-001 | assistant | create | Administrador, Criador/Owner | Dentro do tenant |
| RP-002 | assistant | use | Usuários com share ou publicação permitida | Respeitar RAG/tools |
| RP-003 | assistant | edit | Admin, owner ou editor autorizado | Não ampliar permissões indevidas |
| RP-004 | assistant | publish_workspace | Admin ou owner | Assistente testado |
| RP-005 | assistant | publish_tenant | Admin | Aprovação obrigatória |
| RP-006 | assistant | archive | Admin ou owner | Sem exclusão física |
| RP-007 | assistant | delete | Administrador | Exclusão definitiva restrita |
| RP-008 | knowledge_base | create | Admin, Criador/Owner | Conforme política |
| RP-009 | knowledge_base | restricted_use | Usuários/workspaces autorizados | Sem acesso indireto |
| RP-010 | mcp_server | manage | Administrador | Credenciais protegidas |
| RP-011 | mcp_tool | approve_high_risk | Administrador | Obrigatório para alto risco |
| RP-012 | conversation | view_all | Administrador | Finalidade de auditoria |
| RP-013 | conversation | view_owned_assistant | Owner | Assistentes próprios |
| RP-014 | conversation | view_own | Usuário autenticado | Apenas próprias |
| RP-015 | analytics | view_global | Administrador | Dados agregados |
| RP-016 | analytics | view_owned | Owner | Assistentes próprios |

---

## 12. Regras de negócio

| ID | Regra | Justificativa |
|---|---|---|
| RN-001 | Todo assistente nasce como rascunho. | Evitar publicação acidental. |
| RN-002 | Todo assistente deve pertencer a um tenant. | Permitir expansão e isolamento organizacional. |
| RN-003 | Todo assistente deve ter owner_user_id. | Garantir responsabilidade e gestão. |
| RN-004 | Assistente pode ter workspace principal. | Contextualizar por área/departamento. |
| RN-005 | Todo compartilhamento deve passar por assistant_shares. | Centralizar uso e edição. |
| RN-006 | Uso e edição são permissões separadas. | Evitar que consumidor edite assistente. |
| RN-007 | Publicação para toda organização exige aprovação admin. | Governança corporativa. |
| RN-008 | Assistente com RAG restrito não pode burlar permissão da base. | Proteção de dados. |
| RN-009 | Tools de alto risco exigem aprovação admin. | Reduzir risco operacional. |
| RN-010 | Tool não aprovada não pode ser chamada. | Segurança de execução. |
| RN-011 | Edição de assistente publicado gera nova versão. | Rastreabilidade. |
| RN-012 | Conversas são retidas por 360 dias. | Auditoria e governança. |
| RN-013 | Admin vê todas as conversas para auditoria. | Controle institucional. |
| RN-014 | Owner vê conversas dos assistentes que criou. | Melhoria e governança do agente. |
| RN-015 | Editor não vê conversas de terceiros salvo permissão explícita. | Privacidade e segregação. |
| RN-016 | Usuário vê apenas suas próprias conversas. | Privacidade. |
| RN-017 | Secrets nunca devem aparecer em logs. | Segurança. |
| RN-018 | Falhas de provider devem registrar evento e acionar fallback quando configurado. | Resiliência. |

---

## 13. Requisitos de integração

| ID | Sistema/Provider | Objetivo | Autenticação | Prioridade | Fase |
|---|---|---|---|---|---|
| RI-001 | Microsoft Entra ID | Autenticação corporativa | OAuth/SSO | Must | MVP |
| RI-002 | OpenAI | Provider LLM inicial | API Key/segredo | Must | MVP |
| RI-003 | Anthropic | Provider LLM inicial | API Key/segredo | Must | MVP |
| RI-004 | Agno Runtime | Execução dos agents | Serviço interno | Must | MVP |
| RI-005 | MCP Servers | Execução de tools | Conforme servidor | Must | MVP |
| RI-006 | Vector store/embeddings | RAG | A definir | Must | MVP |
| RI-007 | Storage de documentos | Arquivos de bases | A definir | Should | MVP |
| RI-008 | Redis/fila | Jobs assíncronos | Interno | Should | MVP |

---

## 14. Requisitos de IA orquestrada

| ID | Nome | Tipo | Prioridade | Dependência |
|---|---|---|---|---|
| RAI-001 | Chat com LLM real | LLM/agent | Must | OpenAI/Anthropic |
| RAI-002 | AgentSpec versionado | runtime | Must | Agno |
| RAI-003 | Runtime Agno | agent | Must | Agno |
| RAI-004 | RAG com fontes | rag | Must | Vector store |
| RAI-005 | MCP/tool calling | mcp/tool | Must | MCP |
| RAI-006 | Guardrails iniciais | guardrail | Should | Segurança |
| RAI-007 | Fallback model | model routing | Must | OpenAI/Anthropic |
| RAI-008 | Cost tracking | finops | Must | Provider usage |
| RAI-009 | Evals iniciais | eval | Should | Golden dataset mínimo |
| RAI-010 | Observabilidade de IA | observability | Should | Logs/traces mínimos |

---

## 15. Requisitos operacionais e infraestruturais

| ID | Nome | Escopo | Validação |
|---|---|---|---|
| RO-001 | Projeto deve ser preparado para frontend, backend e runtime separados. | Todos | Estrutura do repositório |
| RO-002 | Ambiente local será estruturado após exportação do Lovable. | Local | Validação em Docker/WSL |
| RO-003 | Banco PostgreSQL deve ser provisionado. | Local/Homologação/Produção | Conexão e migrations |
| RO-004 | Runtime Agno deve rodar como serviço separado. | Local/Homologação/Produção | Healthcheck e execução |
| RO-005 | Serviços críticos devem ter healthcheck. | Todos | Smoke test |
| RO-006 | Variáveis sensíveis não devem ser versionadas. | Todos | Revisão de repositório |
| RO-007 | Deve existir documentação de variáveis por camada. | Todos | .env.example |
| RO-008 | Ingestão, embeddings e evals devem suportar jobs assíncronos. | Todos | Execução controlada |

---

## 16. Requisitos de motion e microinterações

| ID | Nome | Tipo | Contexto | Prioridade | Objetivo |
|---|---|---|---|---|---|
| RMOT-001 | Streaming de resposta | feedback | Chat | Must | Indicar geração progressiva |
| RMOT-002 | Tool call em andamento | feedback | Chat | Should | Indicar ação externa |
| RMOT-003 | Upload/indexação | loading/status | Knowledge Hub | Should | Indicar progresso/estado |
| RMOT-004 | Publicação/aprovação | feedback | Assistentes | Should | Indicar sucesso/pendência/erro |
| RMOT-005 | Skeletons de dashboard | loading | Analytics | Could | Melhorar percepção de carregamento |

Motion deve ser funcional, discreta e acessível. Não deve ser usada apenas como decoração.

---

## 17. Matriz Requisito → Fluxo → Tela → API → Entidade → Teste

> Os contratos de API e entidades abaixo são propostos para rastreabilidade. Os contratos finais devem ser detalhados nos documentos técnicos específicos.

| Requisito | Fluxo | Tela/Rota | API proposta | Entidade | Permissão | Teste | Fase |
|---|---|---|---|---|---|---|---|
| RF-001 | Login | Login | auth session | users | auth.login | TST-001 | MVP |
| RF-009 | Criar assistente | Wizard | assistants | assistants | assistant.create | TST-009 | MVP |
| RF-014 | Publicar | Detalhe do assistente | assistant publishing | assistants/versions | assistant.publish | TST-014 | MVP |
| RF-018 | Compartilhar | Compartilhamento | assistant shares | assistant_shares | assistant.share | TST-018 | MVP |
| RF-019 | Chat | Chat Workspace | chat streaming | conversations/messages | assistant.use | TST-019 | MVP |
| RF-027 | Knowledge Hub | Knowledge Hub | knowledge bases | knowledge_bases | knowledge_base.read | TST-027 | MVP |
| RF-028 | Upload | Knowledge Hub | documents upload | documents/chunks | knowledge_base.upload | TST-028 | MVP |
| RF-031 | MCP Hub | MCP Hub | mcp registry | mcp_servers/tools | mcp.manage | TST-031 | MVP |
| RF-035 | Runtime | Runtime status | runtime sync | runtime_deployments | runtime.sync | TST-035 | MVP |
| RF-042 | Auditoria | Audit Logs | audit logs | audit_logs | audit.read | TST-042 | MVP |

---

## 18. Restrições

### 18.1 Técnicas

- O projeto ainda não foi exportado do Lovable.
- A organização final em ambiente Docker/WSL ocorrerá após exportação.
- Backend deve ser autoridade de autenticação e autorização.
- Runtime de IA deve ser separado do backend principal.
- WebSocket fica fora do MVP.
- Providers adicionais ficam para evolução futura.
- Vector store ainda requer decisão.
- AgentSpec ainda requer detalhamento técnico.

### 18.2 Segurança

- Secrets não podem ser versionados.
- API keys, tokens e credenciais não podem aparecer em logs.
- RAG restrito não pode ser acessado indiretamente.
- Tools de alto risco exigem aprovação administrativa.
- Conversas são dados potencialmente sensíveis.
- Acesso a conversas deve respeitar perfil e relação com o assistente.

### 18.3 Produto

- MVP deve ser robusto, mas com escopo controlado.
- O protótipo visual não deve ser tratado como produto final.
- Áreas piloto ainda precisam ser confirmadas.
- Workspaces iniciais ainda precisam ser definidos.

---

## 19. Premissas

- A MCM será o tenant inicial.
- O sistema deve estar preparado para expansão futura para o Grupo Intercept.
- Microsoft SSO será a autenticação oficial.
- OpenAI e Anthropic serão providers iniciais.
- Agno será o runtime obrigatório.
- RAG real e MCP real fazem parte do escopo alvo do MVP.
- PostgreSQL será a base transacional.
- Conversas serão armazenadas por 360 dias.
- O MVP será validado inicialmente em ambiente interno/controlado.
- O frontend atual será higienizado após exportação do Lovable.

---

## 20. Riscos

| ID | Tipo | Descrição | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|---|
| RISK-001 | Produto | Escopo do MVP ficar grande demais | Alta | Alto | Fatiar MVP, versão 1, versão 2 e futuro |
| RISK-002 | Técnico | Integração Agno mais complexa que previsto | Média | Alto | Realizar spike técnico cedo |
| RISK-003 | Dados | RAG expor dados restritos | Média | Crítico | Permissões por base e bloqueio de acesso indireto |
| RISK-004 | Segurança | Tool de alto risco ser usada indevidamente | Média | Crítico | Aprovação admin e auditoria |
| RISK-005 | Financeiro | Custo de LLM crescer sem controle | Média | Alto | Cost tracking desde o MVP |
| RISK-006 | Operação | Falta de treinamento e governança | Média | Médio | Documentação e processo de adoção |
| RISK-007 | Infraestrutura | Ambiente de homologação indefinido | Média | Alto | Definir estratégia antes da implementação |
| RISK-008 | Experiência | Wizard ficar complexo demais | Média | Médio | Validar fluxo com usuários internos |
| RISK-009 | IA | Alucinação ou resposta inadequada | Alta | Alto | RAG, fontes, feedback e evals |
| RISK-010 | Segurança IA | Prompt injection | Média | Crítico | Guardrails e validação de contexto |

---

## 21. Critérios gerais de aceite

O MVP será considerado validável quando:

- usuário autenticar via Microsoft SSO;
- permissões impedirem acesso indevido;
- administrador gerenciar usuários e permissões básicas;
- owner criar assistente pelo wizard;
- assistente for testado antes da publicação;
- assistente publicado for usado no chat;
- chat responder com LLM real;
- assistente usar RAG real com fontes;
- assistente executar tool aprovada via MCP;
- ações críticas gerarem auditoria;
- conversas forem armazenadas com política de acesso;
- feedback for registrado;
- custo por assistente for acompanhado;
- versões de assistente forem registradas;
- runtime Agno executar agente com base no AgentSpec;
- sistema operar em ambiente de homologação controlado.

---

## 22. Maturidade dos requisitos

Classificação atual:

```txt
Nível 4 — Requisitos classificados, priorizados e rastreados para fluxos, telas, APIs, dados e testes em nível preliminar.
```

O projeto pode avançar para especificação funcional, arquitetura, design, backend, frontend, APIs e banco, mantendo decisões técnicas especializadas para aprofundamento.

Para atingir nível 5, ainda é necessário:

- validar corte final do MVP;
- confirmar workspaces piloto;
- detalhar AgentSpec;
- escolher vector store;
- definir primeiros MCP servers/tools;
- validar ambiente de homologação;
- revisar requisitos com stakeholders.

---

## 23. Encaminhamentos para próximos documentos

### 23.1 Especificação funcional

Aprofundar:

- fluxos de login;
- criação/edição/teste/publicação de assistentes;
- compartilhamento;
- chat;
- upload/indexação de documentos;
- uso de RAG;
- uso de tools;
- feedback;
- auditoria;
- custos;
- histórico de versões.

### 23.2 Design system e frontend

Aprofundar:

- telas;
- rotas;
- estados;
- componentes;
- tabelas;
- formulários;
- wizard;
- chat;
- acessibilidade;
- responsividade;
- motion funcional.

### 23.3 Arquitetura

Aprofundar:

- camadas;
- boundaries;
- backend;
- runtime Agno;
- AgentSpec;
- REST/SSE/fila;
- PostgreSQL;
- vector store;
- RAG;
- MCP;
- segurança;
- observabilidade.

### 23.4 Backend, APIs e Banco

Aprofundar:

- serviços;
- regras de domínio;
- políticas de autorização;
- contratos;
- entidades;
- migrations;
- auditoria;
- conversas;
- custos;
- evals.

### 23.5 Segurança e compliance

Aprofundar:

- Microsoft SSO;
- RBAC;
- tenant isolation;
- acesso por recurso;
- RAG restrito;
- tools de alto risco;
- secrets;
- conversas;
- retenção;
- audit logs;
- prompt injection;
- dados sensíveis.

### 23.6 Orquestração de IA

Aprofundar:

- Agno runtime;
- AgentSpec;
- model routing;
- fallback;
- RAG;
- embeddings;
- MCP;
- tools;
- guardrails;
- evals;
- cost tracking;
- observabilidade de IA.

---

## 24. Próximos passos

1. Revisar este documento com stakeholders principais.
2. Validar corte final de MVP, versão 1, versão 2 e futuro.
3. Atualizar registro de decisões quando houver alteração de escopo.
4. Iniciar a especificação funcional.
5. Iniciar a arquitetura de software.
6. Planejar aprofundamento específico de orquestração de IA.
7. Preparar validações técnicas para Agno, RAG, MCP e Microsoft SSO.

---

## 25. Conclusão

Os requisitos do Orquestra indicam um produto corporativo robusto, com forte dependência de governança, segurança, IA, RAG, MCP, runtime, auditoria e controle de custos.

A recomendação é seguir para especificação funcional e arquitetura, mantendo o requisito de escopo controlado para evitar que o MVP fique amplo demais antes da validação técnica e operacional.
