# Questionário de Decisões Pendentes — Orquestra

> Objetivo: coletar decisões iniciais de produto, governança e arquitetura com o idealizador do projeto antes de avançar na documentação funcional e técnica.

---

## 1. Perfis, papéis e permissões

### 1.1 Quais perfis de usuário devem existir no MVP?

Sugestão inicial para validação:

- Administrador da Plataforma
- Criador/Owner de Assistente
- Editor de Assistente
- Usuário Consumidor do Chat
- Auditor/Compliance
- Visualizador
- Gestor de Área
- Segurança/TI

Perguntas:

1. Esses perfis fazem sentido?
2. Algum perfil deve ser removido?
3. Algum perfil precisa ser adicionado?
4. O Administrador da Plataforma terá acesso total?
5. O Criador/Owner pode publicar assistentes sozinho?
6. O Editor pode alterar prompt, modelo, tools, bases de conhecimento e permissões?
7. O Usuário Consumidor pode apenas conversar com assistentes publicados?
8. O Auditor/Compliance pode visualizar conversas, logs, prompts, tools e documentos?
9. Existe algum perfil específico para Segurança/TI?
10. Existe algum perfil específico para Gestor de Área?

---

## 2. Permissões por módulo

### 2.1 Assistentes

1. Quem pode criar assistentes?
2. Quem pode editar assistentes?
3. Quem pode duplicar assistentes?
4. Quem pode arquivar assistentes?
5. Quem pode publicar assistentes?
6. Quem pode testar assistentes antes da publicação?
7. Quem pode ver o prompt compilado?
8. Quem pode ver histórico de versões?
9. Quem pode restaurar uma versão anterior?
10. Quem pode excluir definitivamente um assistente, se isso for permitido?

### 2.2 Knowledge Hub

1. Quem pode criar bases de conhecimento?
2. Quem pode subir documentos?
3. Quem pode excluir documentos?
4. Quem pode reprocessar/reindexar documentos?
5. Quem pode ver bases classificadas como confidenciais ou restritas?
6. Deve existir aprovação para bases com dados sensíveis?
7. Quem define classificação de dados e retenção?

### 2.3 MCP / Tools

1. Quem pode cadastrar servidor MCP?
2. Quem pode editar credenciais/conexões?
3. Quem pode aprovar tools?
4. Quem pode vincular tools a assistentes?
5. Tools de alto risco precisam de aprovação humana?
6. Quem pode visualizar logs de execução de tools?
7. Quem pode rotacionar credenciais?

### 2.4 Chat

1. Quem pode conversar com um assistente?
2. O usuário vê apenas assistentes publicados?
3. O usuário pode ver fontes/citações usadas pelo RAG?
4. O usuário pode ver tools chamadas pelo agente?
5. O usuário pode aprovar tool calls durante a conversa?
6. O usuário pode enviar feedback da resposta?
7. Conversas devem ser visíveis para o owner do assistente?
8. Conversas devem ser auditáveis por compliance/admin?

### 2.5 Analytics e Auditoria

1. Quem pode ver analytics de uso?
2. Quem pode ver custo por assistente?
3. Quem pode ver logs de auditoria?
4. Logs de auditoria devem ser acessíveis ao owner do assistente ou apenas admin/compliance?
5. Quais eventos precisam ser auditados obrigatoriamente?

---

## 3. Compartilhamento de assistentes/agentes

### 3.1 Modelo de visibilidade

Qual modelo deve existir no MVP?

Opções possíveis:

1. Assistente privado — visível apenas ao criador e admins.
2. Assistente compartilhado com usuários específicos.
3. Assistente compartilhado com time/workspace.
4. Assistente publicado para toda a organização.
5. Assistente restrito por área/departamento.
6. Assistente restrito por nível de risco/classificação de dados.

Perguntas:

1. O assistente nasce privado por padrão?
2. Quem pode compartilhar um assistente?
3. O compartilhamento será por usuário, grupo, área, workspace ou organização?
4. Deve existir diferença entre “pode usar no chat” e “pode editar”?
5. Deve existir aprovação antes de publicar para muitas pessoas?
6. Um assistente pode ser público para toda a MCM?
7. Um assistente pode ficar restrito a uma área, como RH, Jurídico, TI ou Engenharia?
8. Um assistente pode usar bases de conhecimento restritas mesmo sendo compartilhado?
9. Como tratar assistentes que usam tools de alto risco?
10. O compartilhamento terá prazo/expiração?

---

## 4. Tenant, workspace e teams

### 4.1 Escopo organizacional

1. O Orquestra será usado apenas pela MCM ou deve nascer preparado para várias empresas?
2. No MVP, teremos tenant único ou multi-tenant real?
3. “Acme Corp” no protótipo representa uma empresa/tenant ou é apenas placeholder?
4. Devemos modelar `tenant_id` desde o início mesmo que exista apenas a MCM?
5. Haverá separação por áreas/departamentos?
6. Essas áreas devem ser chamadas de workspaces, teams, departamentos ou unidades?
7. Usuários poderão participar de mais de um workspace/team?
8. Assistentes pertencem a um usuário, workspace, área ou tenant?
9. Bases de conhecimento pertencem a um workspace/área ou são globais?
10. Servidores MCP/tools pertencem a um workspace/área ou são globais?

### 4.2 Sugestão para MVP

Validar se faz sentido:

```txt
tenant = MCM
workspace = área/departamento
team = grupo de usuários dentro de um workspace
assistant = pertence a um workspace, com owner e permissões de compartilhamento
knowledge_base = pertence a um workspace ou é global com restrição
mcp_server/tool = global ou restrito por workspace conforme risco
```

---

## 5. Criação, publicação e ciclo de vida dos assistentes

1. Quais etapas do wizard são obrigatórias no MVP?
2. O wizard de 12 etapas deve ser mantido completo?
3. Quem aprova a publicação de um assistente?
4. Todo assistente precisa passar por teste antes de publicar?
5. Deve existir status `draft`, `published` e `archived`?
6. Deve existir status `pending_approval`?
7. O assistente publicado pode ser editado diretamente ou deve gerar nova versão?
8. Versionamento de assistente é obrigatório no MVP?
9. Quem pode reverter versão?
10. O prompt compilado deve ser gerado no backend?

---

## 6. IA, LLM, RAG e MCP no MVP

1. O MVP precisa ter chat com LLM real?
2. O MVP precisa ter RAG real ou pode começar com base mockada?
3. O MVP precisa ter MCP real ou pode começar com registry visual?
4. Quais providers de LLM serão permitidos inicialmente?
5. Será usada Azure OpenAI, OpenAI, Anthropic, Gemini, AWS Bedrock ou outro?
6. Deve existir model routing?
7. Deve existir fallback model no MVP?
8. Deve existir controle de custo por assistente?
9. Deve existir limite de uso por usuário/área?
10. Deve existir eval/golden dataset no MVP?

---

## 7. Agno / runtime de agentes

1. A ideia é usar Agno como runtime principal dos agentes?
2. Agno deve ser obrigatório ou apenas candidato para PoC?
3. O Orquestra deve criar agentes diretamente no Agno ou gerar uma configuração intermediária?
4. Faz sentido existir um `AgentSpec` salvo no backend do Orquestra?
5. O Orquestra deve ser a fonte de verdade dos agentes e o Agno apenas o executor?
6. O runtime de agentes deve rodar como serviço separado?
7. O runtime deve ser Python?
8. Como o backend do Orquestra deve chamar esse runtime: REST, SSE, WebSocket, fila ou outro?
9. Quais recursos do Agno precisam ser validados na PoC?
10. Qual critério faria a equipe desistir do Agno e usar outro caminho?

---

## 8. Segurança, auditoria e governança

1. Quais ações precisam obrigatoriamente gerar log de auditoria?
2. Conversas com IA devem ser armazenadas?
3. Por quanto tempo conversas devem ser retidas?
4. Prompts e respostas podem conter dados sensíveis?
5. Deve haver mascaramento/redaction de PII?
6. Quem pode ver conversas de outros usuários?
7. Quem pode ver prompts compilados?
8. Quem pode ver logs de tool calls?
9. Quem pode ver custos por usuário/área?
10. Como aprovar tools de alto risco?

---

## 9. Prioridade do MVP

Ordene por prioridade:

```txt
[ ] Login Microsoft SSO
[ ] RBAC inicial
[ ] CRUD de assistentes
[ ] Wizard completo
[ ] Publicação/versionamento de assistentes
[ ] Knowledge Hub real
[ ] Upload e ingestão de documentos
[ ] RAG real
[ ] Chat com LLM real
[ ] MCP registry real
[ ] Tool calling real
[ ] Analytics real
[ ] Audit log real
[ ] Evals
[ ] Cost tracking
[ ] Agno PoC
[ ] Integração Agno em produção
```

Pergunta final:

> O que precisa existir obrigatoriamente para considerar o MVP do Orquestra entregue?
