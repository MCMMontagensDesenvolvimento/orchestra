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

1. Esses perfis fazem sentido? SIM, EXCETO AUDITOR/COMPLIANCE, VISUALIZADOR, GESTOR DE AREA E SEGURANÇA TI.
2. Algum perfil deve ser removido? SIM, EXCETO AUDITOR/COMPLIANCE, VISUALIZADOR, GESTOR DE AREA E SEGURANÇA TI.
3. Algum perfil precisa ser adicionado? POR HORA, NÃO.
4. O Administrador da Plataforma terá acesso total? SIM(SUPER ADMIN).
5. O Criador/Owner pode publicar assistentes sozinho? SIM, RESPEITANDO OS RAGS E LLMS LIBERADAS PARA ELE PREVIAMENTE.
6. O Editor pode alterar prompt, modelo, tools, bases de conhecimento e permissões? SIM, RESPEITANDO OS RAGS E LLMS LIBERADAS PARA ELE PREVIAMENTE, CASO O ORIGINAL TENHA UM RECURSO QUE ELE NÃO TENHA ACESSO, NÃO PODERAR REMOVER NA EDIÇÃO.
7. O Usuário Consumidor pode apenas conversar com assistentes publicados? ISSO.
8. O Auditor/Compliance pode visualizar conversas, logs, prompts, tools e documentos? N/A
9. Existe algum perfil específico para Segurança/TI? N/A
10. Existe algum perfil específico para Gestor de Área? N/A

---

## 2. Permissões por módulo

### 2.1 Assistentes

1. Quem pode criar assistentes? Administrador da Plataforma, Criador/Owner de Assistente.
2. Quem pode editar assistentes? Administrador da Plataforma, Criador/Owner de Assistente - Editor de Assistente.
3. Quem pode duplicar assistentes? Administrador da Plataforma, Criador/Owner de Assistente.
4. Quem pode arquivar assistentes? Administrador da Plataforma, Criador/Owner de Assistente.
5. Quem pode publicar assistentes? Administrador da Plataforma, Criador/Owner de Assistente.
6. Quem pode testar assistentes antes da publicação? Administrador da Plataforma, Criador/Owner de Assistente.
7. Quem pode ver o prompt compilado? all.
8. Quem pode ver histórico de versões? all.
9. Quem pode restaurar uma versão anterior? Administrador da Plataforma, Criador/Owner de Assistente.
10. Quem pode excluir definitivamente um assistente, se isso for permitido? Administrador da Plataforma.

### 2.2 Knowledge Hub

1. Quem pode criar bases de conhecimento? Administrador da Plataforma, Criador/Owner de Assistente.
2. Quem pode subir documentos? Administrador da Plataforma, Criador/Owner de Assistente.
3. Quem pode excluir documentos? Administrador da Plataforma.
4. Quem pode reprocessar/reindexar documentos? Administrador da Plataforma.
5. Quem pode ver bases classificadas como confidenciais ou restritas? Administrador da Plataforma.
6. Deve existir aprovação para bases com dados sensíveis? SIM.
7. Quem define classificação de dados e retenção? Administrador da Plataforma(APROVAÇÃO).

### 2.3 MCP / Tools

1. Quem pode cadastrar servidor MCP? Administrador da Plataforma.
2. Quem pode editar credenciais/conexões? Administrador da Plataforma.
3. Quem pode aprovar tools? Administrador da Plataforma.
4. Quem pode vincular tools a assistentes? Administrador da Plataforma, Criador/Owner de Assistente, Editor de Assistente(TENDO PERMISSÃO).
5. Tools de alto risco precisam de aprovação humana? SIM.
6. Quem pode visualizar logs de execução de tools? Administrador da Plataforma, Criador/Owner de Assistente.
7. Quem pode rotacionar credenciais? Administrador da Plataforma.

### 2.4 Chat

1. Quem pode conversar com um assistente? ALL(COM PERMISSÃO).
2. O usuário vê apenas assistentes publicados? SIM.
3. O usuário pode ver fontes/citações usadas pelo RAG? SIM.
4. O usuário pode ver tools chamadas pelo agente? SIM.
5. O usuário pode aprovar tool calls durante a conversa? NÃO.
6. O usuário pode enviar feedback da resposta? AVALIAR.
7. Conversas devem ser visíveis para o owner do assistente? AVALIAR.
8. Conversas devem ser auditáveis por compliance/admin? AVALIAR.

### 2.5 Analytics e Auditoria

1. Quem pode ver analytics de uso? Administrador da Plataforma.
2. Quem pode ver custo por assistente? Administrador da Plataforma.
3. Quem pode ver logs de auditoria? Administrador da Plataforma.
4. Logs de auditoria devem ser acessíveis ao owner do assistente ou apenas admin/compliance? AOS DOIS PERFIS.
5. Quais eventos precisam ser auditados obrigatoriamente? AVALIAR.

---

## 3. Compartilhamento de assistentes/agentes

### 3.1 Modelo de visibilidade

Qual modelo deve existir no MVP? ALL MODELS.

Opções possíveis:

1. Assistente privado — visível apenas ao criador e admins.
2. Assistente compartilhado com usuários específicos.
3. Assistente compartilhado com time/workspace.
4. Assistente publicado para toda a organização.
5. Assistente restrito por área/departamento.
6. Assistente restrito por nível de risco/classificação de dados.

Perguntas:

1. O assistente nasce privado por padrão? SIM.
2. Quem pode compartilhar um assistente? Administrador da Plataforma, Criador/Owner de Assistente.
3. O compartilhamento será por usuário, grupo, área, workspace ou organização? SIM ALL.
4. Deve existir diferença entre “pode usar no chat” e “pode editar”? NÃO.
5. Deve existir aprovação antes de publicar para muitas pessoas? AVALIAR MELHOR METODO.
6. Um assistente pode ser público para toda a MCM? SIM.
7. Um assistente pode ficar restrito a uma área, como RH, Jurídico, TI ou Engenharia? SIM.
8. Um assistente pode usar bases de conhecimento restritas mesmo sendo compartilhado? NÃO.
9. Como tratar assistentes que usam tools de alto risco? VALIDAÇÃO ADMIN.
10. O compartilhamento terá prazo/expiração? NÃO.

---

## 4. Tenant, workspace e teams

### 4.1 Escopo organizacional

1. O Orquestra será usado apenas pela MCM ou deve nascer preparado para várias empresas?NO MVP SIM, MAS PODE ESCALAR PARA AS DEMAIS EMPRESAS DO GRUPO.
2. No MVP, teremos tenant único ou multi-tenant real?APENAS UM.
3. “Acme Corp” no protótipo representa uma empresa/tenant ou é apenas placeholder?AVALIAR.
4. Devemos modelar `tenant_id` desde o início mesmo que exista apenas a MCM?AVALIAR(LÉO)
5. Haverá separação por áreas/departamentos? SIM
6. Essas áreas devem ser chamadas de workspaces, teams, departamentos ou unidades? workspaces.
7. Usuários poderão participar de mais de um workspace/team? SIM
8. Assistentes pertencem a um usuário, workspace, área ou tenant? USUARIO.
9. Bases de conhecimento pertencem a um workspace/área ou são globais? global.
10. Servidores MCP/tools pertencem a um workspace/área ou são globais? global.

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

<!-- perfeito, faz total sentido! -->
---

## 5. Criação, publicação e ciclo de vida dos assistentes

1. Quais etapas do wizard são obrigatórias no MVP? all.
2. O wizard de 12 etapas deve ser mantido completo? caso avalie a necessidade de add alguma, avaliaremos.
3. Quem aprova a publicação de um assistente? Administrador da Plataforma, Criador/Owner de Assistente. incluindo edição.
4. Todo assistente precisa passar por teste antes de publicar? sim.
5. Deve existir status `draft`, `published` e `archived`? sim.
6. Deve existir status `pending_approval`? sim.
7. O assistente publicado pode ser editado diretamente ou deve gerar nova versão? gerar versão.
8. Versionamento de assistente é obrigatório no MVP? sim.
9. Quem pode reverter versão? Administrador da Plataforma, Criador/Owner de Assistente.
10. O prompt compilado deve ser gerado no backend? avaliar.

---

## 6. IA, LLM, RAG e MCP no MVP

1. O MVP precisa ter chat com LLM real? sim.
2. O MVP precisa ter RAG real ou pode começar com base mockada? RAG REAL.
3. O MVP precisa ter MCP real ou pode começar com registry visual? MCP REAL.
4. Quais providers de LLM serão permitidos inicialmente? OPEN AI, Anthropic.
5. Será usada Azure OpenAI, OpenAI, Anthropic, Gemini, AWS Bedrock ou outro? ESSES.
6. Deve existir model routing? SIM.
7. Deve existir fallback model no MVP? SIM.
8. Deve existir controle de custo por assistente? SIM.
9. Deve existir limite de uso por usuário/área? NÃO.
10. Deve existir eval/golden dataset no MVP? SIM.

---

## 7. Agno / runtime de agentes

1. A ideia é usar Agno como runtime principal dos agentes? SIM.
2. Agno deve ser obrigatório ou apenas candidato para PoC? OBRIGATÓRIAMENTE.
3. O Orquestra deve criar agentes diretamente no Agno ou gerar uma configuração intermediária? AVALIAR EM CONJUNTO(GILSON, VITOR E LEO).
4. Faz sentido existir um `AgentSpec` salvo no backend do Orquestra? SIM.
5. O Orquestra deve ser a fonte de verdade dos agentes e o Agno apenas o executor? AVALIAR EM CONJUNTO(GILSON, VITOR E LEO).
6. O runtime de agentes deve rodar como serviço separado? AVALIAR EM CONJUNTO(GILSON, VITOR E LEO).
7. O runtime deve ser Python? AVALIAR EM CONJUNTO(GILSON, VITOR E LEO).
8. Como o backend do Orquestra deve chamar esse runtime: REST, SSE, WebSocket, fila ou outro? AVALIAR EM CONJUNTO(GILSON, VITOR E LEO).
9. Quais recursos do Agno precisam ser validados na PoC? AVALIAR EM CONJUNTO(GILSON, VITOR E LEO).
10. Qual critério faria a equipe desistir do Agno e usar outro caminho? LENTIDÃO NO DEV OU FALTA DE RECURSOS ESSENCIAIS.

---

## 8. Segurança, auditoria e governança

1. Quais ações precisam obrigatoriamente gerar log de auditoria? CRUD E EXECUÇÃO.
2. Conversas com IA devem ser armazenadas? SIM PARA AUDITORIA, GUARDAR NO FRIO.
3. Por quanto tempo conversas devem ser retidas? 360 DIAS.
4. Prompts e respostas podem conter dados sensíveis? SIM, SEGUINDO CONFIG E PERMISSÕES DO AGENTE.
5. Deve haver mascaramento/redaction de PII? AVALIAR.
6. Quem pode ver conversas de outros usuários? Administrador da Plataforma.
7. Quem pode ver prompts compilados? Administrador da Plataforma.
8. Quem pode ver logs de tool calls? Administrador da Plataforma.
9. Quem pode ver custos por usuário/área? Administrador da Plataforma, Criador/Owner de Assistente.
10. Como aprovar tools de alto risco? Administrador da Plataforma.

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

SEGUIR PREMISSAS DA ENGENHARIA DE SOFTWARE APLICADA.

Pergunta final:

> O que precisa existir obrigatoriamente para considerar o MVP do Orquestra entregue?
TODAS AS FUNÇÕES LISTADAS NO SPR_00.
