# Orquestra — Roteiro de Ajuste Frontend no Lovable

> Roteiro para ajustar o frontend do Orquestra no Lovable antes da exportação do projeto.  
> Este roteiro não deve criar backend real, banco real, runtime real, RAG real ou MCP real. O objetivo é organizar e preparar o protótipo visual para futura integração.

---

## 1. Contexto

Estamos evoluindo o Orquestra, uma plataforma corporativa de assistentes de IA para criação, configuração, publicação, execução, compartilhamento, governança, auditoria e monitoramento de assistentes inteligentes.

O projeto atualmente está no Lovable e ainda não foi exportado para ambiente local/Docker/WSL.

O objetivo deste ajuste é melhorar o frontend/protótipo para que ele fique mais organizado, coerente, responsivo, acessível, preparado para futura exportação e pronto para integração posterior com backend, APIs, banco de dados e runtime de IA.

---

## 2. Objetivo do ajuste

Ajustar o frontend do Orquestra para:

- organizar telas, rotas, layouts e navegação;
- melhorar aderência ao Design System do projeto;
- separar melhor responsabilidades visuais;
- deixar mocks identificados como mocks;
- preparar estrutura conceitual de módulos;
- melhorar responsividade;
- melhorar estados de loading, empty, error e forbidden;
- melhorar experiência de chat com IA;
- melhorar visualização de fontes RAG;
- melhorar visualização de tool calls;
- melhorar telas de Knowledge Hub e MCP Hub;
- melhorar telas de Assistentes, Wizard, Analytics, Audit Logs e Admin;
- evitar que dados mockados pareçam dados reais;
- preparar handoff futuro para exportação e refatoração.

---

## 3. Limites importantes

Não criar backend real.

Não criar banco de dados real.

Não criar autenticação real.

Não criar integrações reais com OpenAI, Anthropic, Agno, MCP, RAG ou providers.

Não colocar secrets, tokens, API keys ou credenciais.

Não simular que o sistema está pronto para produção.

Não criar lógicas críticas apenas no frontend.

Não tratar mock como dado real.

O frontend pode ter mocks para visualização, mas eles devem estar claramente preparados para substituição futura por API real.

---

## 4. Arquitetura conceitual a respeitar

O Orquestra será organizado futuramente assim:

```txt
Frontend React/Vite
↓
Backend Orquestra
↓
Banco PostgreSQL
↓
Runtime de IA
↓
LLMs, RAG, MCP e tools
```

Nesta etapa do Lovable, ajustar apenas o frontend/protótipo.

---

## 5. Layouts esperados

Criar ou organizar os seguintes layouts:

- AuthLayout para login;
- AppLayout para área autenticada;
- DashboardLayout para dashboard e analytics;
- SettingsLayout para administração/configurações;
- ChatLayout para chat;
- EmptyLayout para 403, 404 e erro geral.

O AppLayout deve ter:

- sidebar;
- topbar;
- breadcrumbs quando fizer sentido;
- seletor de workspace quando fizer sentido;
- menu do usuário;
- page header;
- descrição da página;
- ações principais;
- conteúdo responsivo.

---

## 6. Rotas/telas esperadas

Organizar ou revisar as seguintes telas:

```txt
/login
/app
/app/assistants
/app/assistants/new
/app/assistants/:id
/app/assistants/:id/edit
/app/chat
/app/knowledge
/app/mcp
/app/analytics
/app/audit
/app/admin
/app/profile
/app/settings
/403
/404
/500
```

---

## 7. Módulos visuais esperados

O protótipo deve representar claramente os módulos:

- auth;
- dashboard;
- assistants;
- chat;
- knowledge;
- mcp;
- analytics;
- audit;
- admin;
- settings;
- profile.

Cada módulo deve ter telas e componentes visualmente coerentes.

---

## 8. Assistentes

A área de assistentes deve permitir visualizar:

- listagem de assistentes;
- status: rascunho, pendente de aprovação, publicado e arquivado;
- owner;
- workspace;
- versão;
- provider/modelo;
- bases vinculadas;
- tools vinculadas;
- permissões de uso/edição;
- ações disponíveis por perfil;
- empty state;
- loading state;
- forbidden state;
- error state.

A listagem deve ser responsiva:

- tabela em desktop;
- cards em mobile.

---

## 9. Wizard de criação de assistente

O wizard deve ser claro, com etapas:

1. Identificação.
2. Objetivo.
3. Persona e tom.
4. Regras e restrições.
5. Exemplos.
6. Provider/modelo.
7. Bases de conhecimento.
8. Tools.
9. Visibilidade e compartilhamento.
10. Revisão.
11. Teste.
12. Publicação.

O wizard deve permitir salvar como rascunho visualmente.

Campos obrigatórios devem ter validação visual.

Recursos bloqueados devem aparecer desabilitados com explicação.

---

## 10. Chat com IA

A tela de chat deve ter:

- seleção de assistente;
- histórico de conversas;
- área de mensagens;
- composer;
- estado “IA pensando”;
- streaming visual de resposta;
- fontes RAG visíveis quando aplicável;
- tool calls visíveis quando aplicável;
- fallback de modelo quando aplicável;
- erro amigável;
- feedback positivo/negativo;
- comentário opcional.

Estados mínimos:

- idle;
- sending;
- thinking;
- streaming;
- retrieving sources;
- executing tool;
- completed;
- failed;
- fallback.

---

## 11. Knowledge Hub

A tela de Knowledge Hub deve mostrar:

- bases de conhecimento;
- classificação/restrição;
- documentos;
- upload;
- status de processamento;
- indexando;
- indexado;
- falha;
- base restrita;
- fontes disponíveis;
- empty state;
- error state.

Não implementar upload real; apenas simular visualmente como mock controlado.

---

## 12. MCP Hub

A tela de MCP Hub deve mostrar:

- servidores MCP;
- status de conexão;
- tools disponíveis;
- tools aprovadas;
- tools pendentes;
- tools de alto risco;
- ações de aprovação visual;
- logs/resumo de execução;
- mensagens de erro amigáveis.

Não armazenar credenciais nem secrets no frontend.

---

## 13. Analytics

A tela de analytics deve mostrar, com dados mockados:

- total de conversas;
- uso por assistente;
- custo estimado por assistente;
- feedback positivo/negativo;
- falhas de provider;
- fallback usado;
- tool calls;
- evals iniciais;
- filtros por período;
- filtros por assistente;
- filtros por workspace.

---

## 14. Audit Logs

A tela de auditoria deve mostrar:

- tabela de eventos;
- filtros por tipo;
- filtros por ator;
- filtros por recurso;
- filtros por período;
- detalhe em drawer;
- estados de loading, empty, error e filtered.

Eventos visuais esperados:

- login;
- criação de assistente;
- edição;
- publicação;
- compartilhamento;
- upload de documento;
- tool call;
- feedback;
- falha de provider;
- fallback;
- acesso negado.

---

## 15. Admin

A área admin deve conter visualmente:

- usuários;
- perfis;
- permissões;
- workspaces;
- configurações de providers;
- configurações de plataforma.

As ações devem estar condicionadas por permissão visual.

Usuário sem permissão deve ver 403.

---

## 16. Responsividade

A interface deve ser desktop-first, mas responsiva.

Regras:

- tabelas viram cards no mobile;
- filtros viram drawer/sheet no mobile;
- sidebar vira menu/drawer;
- ações secundárias vão para dropdown;
- chat deve funcionar em tela menor;
- wizard deve ficar vertical no mobile;
- cards não devem quebrar layout;
- gráficos devem adaptar ou empilhar.

---

## 17. Acessibilidade

Aplicar:

- labels visíveis em formulários;
- foco visível;
- botões com nomes claros;
- estados não dependentes apenas de cor;
- contraste adequado;
- diálogos com comportamento acessível;
- mensagens de erro textuais;
- estados de IA com texto visível.

---

## 18. Motion e microinterações

Usar motion de forma discreta e funcional:

- skeletons;
- transição de etapas do wizard;
- resposta em streaming;
- indicador de IA pensando;
- tool call em execução;
- upload/indexação;
- abertura de drawer/modal.

Respeitar redução de movimento.

Não usar motion apenas decorativa.

---

## 19. Mocks

Os dados exibidos devem ser claramente mockados/demonstrativos.

Preparar conceito de alternância futura:

```txt
VITE_USE_MOCKS=true
VITE_MOCK_SCENARIO=success
```

Não importar mocks diretamente em componentes visuais principais quando possível; manter a ideia de service/hook como fonte futura de dados.

---

## 20. Resultado esperado

Ao final do ajuste no Lovable, o projeto deve estar visualmente mais organizado e pronto para futura exportação.

A entrega deve deixar claro:

- quais telas existem;
- quais módulos existem;
- quais dados são mock;
- quais fluxos existem;
- quais estados foram considerados;
- quais permissões aparecem visualmente;
- quais partes dependem de backend futuro;
- quais partes dependem de runtime de IA futuro.

---

## 21. Não fazer

Não criar backend real.

Não criar banco real.

Não criar autenticação real.

Não criar integração real com providers.

Não expor secrets.

Não criar dados sensíveis reais.

Não usar nomes de metodologias internas.

Não inserir marcas, assinaturas ou referências externas que não façam parte do projeto MCM.

Não dizer que o produto está pronto para produção.

---

## 22. Critérios de aceite do ajuste

- Rotas principais estão representadas.
- Layout autenticado está consistente.
- Wizard está claro.
- Chat tem estados de IA.
- RAG sources estão visíveis.
- Tool calls estão visíveis.
- Knowledge Hub está coerente.
- MCP Hub está coerente.
- Analytics está coerente.
- Audit Logs está coerente.
- Admin está coerente.
- Loading, empty, error e forbidden aparecem nas telas críticas.
- Mobile possui comportamento real.
- Mocks são tratados como mocks.
- O frontend está preparado para futura exportação/refatoração.
