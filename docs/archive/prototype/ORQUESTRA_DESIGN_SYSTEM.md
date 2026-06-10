# Orquestra — Design System

> Documento corporativo de Design System do projeto Orquestra.  
> Preparado para uso interno na MCM.

---

## 1. Objetivo

Definir o contrato visual e experiencial do Orquestra, garantindo consistência de interface, responsividade, acessibilidade, padrões de componentes, padrões de telas, estados dinâmicos, estados de IA e handoff claro para o frontend real.

Este documento orienta como as interfaces do Orquestra devem parecer, se comportar, se adaptar em diferentes dispositivos e como devem comunicar estados de sistema, segurança, permissões, IA, RAG, MCP/tools, auditoria e operação.

---

## 2. Sumário executivo

O Orquestra será uma plataforma corporativa de assistentes de IA para criação, configuração, publicação, execução, compartilhamento, auditoria e governança de assistentes inteligentes.

A interface deve transmitir confiança, clareza, controle, segurança, modernidade e robustez corporativa. O produto deve se diferenciar de um painel administrativo genérico por oferecer uma experiência especializada para IA corporativa, sem exageros visuais, sem efeitos decorativos excessivos e sem comprometer legibilidade, acessibilidade ou operação.

O Design System deve servir como base para:

- revisão do protótipo atual;
- geração ou refinamento de telas no Lovable;
- handoff para frontend;
- padronização de componentes;
- responsividade;
- dark mode;
- estados de IA;
- feedback visual;
- governança visual;
- evolução futura do produto.

---

## 3. Design System Blueprint

```yaml
design_system_blueprint:
  project_name: "Orquestra"
  organization: "MCM"
  product_type: "Plataforma corporativa de assistentes de IA"
  visual_maturity: "Nível 4 — contrato visual, estados críticos e responsividade definidos"
  execution_mode: "Projeto existente no Lovable, ainda não exportado para ambiente Docker/WSL"
  identity_status: "Identidade inicial corporativa definida neste documento, sujeita a refinamento visual após revisão do protótipo"
  brand_personality:
    - "corporativo"
    - "confiável"
    - "tecnológico"
    - "seguro"
    - "moderno"
    - "orientado a governança"
  visual_direction:
    - "interface limpa e operacional"
    - "densidade moderada para dados corporativos"
    - "hierarquia forte para ações e status"
    - "motion funcional e discreta"
    - "componentes consistentes em todo o produto"
  frontend_stack_reference:
    framework: "React + Vite + TypeScript"
    ui_stack: "Tailwind CSS + shadcn/ui"
    toast_pattern: "Sonner"
    routing_default: "React Router DOM ou padrão adotado no projeto exportado"
  dark_mode_required: true
  desktop_first: true
  mobile_support: "responsividade mínima real, sem tratar mobile como tabela espremida"
  ai_interface_visual_required: true
  motion_required: true
  public_pages_visual_required: false
  white_label_required_now: false
  white_label_ready_future: true
```

---

## 4. Princípios de design

### 4.1 Clareza antes de impacto visual

A interface deve deixar claro:

- onde o usuário está;
- qual assistente ou área está sendo manipulada;
- qual ação é permitida;
- qual ação está bloqueada;
- qual estado do sistema está ocorrendo;
- quando a IA está pensando, respondendo, consultando fonte ou executando tool.

### 4.2 Governança visível

Como o Orquestra é uma plataforma de IA corporativa, a interface deve tornar visíveis elementos de governança:

- status do assistente;
- versão;
- owner;
- workspace;
- visibilidade;
- permissões;
- base de conhecimento vinculada;
- tools vinculadas;
- risco de tool;
- logs e auditoria;
- custos e uso.

### 4.3 IA transparente

O usuário deve conseguir entender quando uma resposta:

- está sendo gerada;
- usa RAG;
- possui fontes;
- acionou tools;
- usou fallback;
- falhou por provider, runtime ou permissão;
- foi bloqueada por política.

### 4.4 Consistência antes de criatividade isolada

Não deve haver padrões visuais diferentes por tela para resolver o mesmo problema.

Componentes, badges, cards, tabelas, modais, filtros, formulários e estados devem seguir uma linguagem comum.

### 4.5 Desktop-first com responsividade real

O uso principal é corporativo, em desktop/notebook. Porém, telas menores devem continuar utilizáveis.

Listagens densas não devem ser apenas espremidas em mobile. O padrão mobile deve migrar para cards, sheets, drawers e ações compactas quando necessário.

### 4.6 Acessibilidade como requisito mínimo

A experiência deve prever:

- contraste adequado;
- foco visível;
- labels acessíveis;
- navegação por teclado;
- áreas de toque adequadas;
- feedback não dependente apenas de cor;
- respeito a `prefers-reduced-motion`.

---

## 5. Direção visual

### 5.1 Personalidade visual

O Orquestra deve parecer:

- confiável;
- institucional;
- técnico;
- robusto;
- premium corporativo;
- moderno sem parecer experimental;
- orientado a produtividade.

Evitar:

- estética excessivamente futurista;
- gradientes chamativos sem função;
- excesso de roxo/neon/ciano;
- animações decorativas;
- cards com pouca legibilidade;
- dashboards visualmente poluídos;
- interfaces que pareçam apenas mock promocional.

### 5.2 Paleta inicial recomendada

A paleta abaixo é uma recomendação inicial para o produto, podendo ser refinada após revisão visual do protótipo e validação com stakeholders.

| Token | Valor inicial | Uso |
|---|---|---|
| primary | #1F3A5F | Ações principais, links importantes, foco institucional |
| primary_foreground | #FFFFFF | Texto sobre cor principal |
| secondary | #5B6B7A | Ações secundárias e elementos de apoio |
| accent | #0F766E | Destaques de IA, estados ativos e pontos de orientação |
| background | #F7F9FC | Fundo geral light mode |
| foreground | #111827 | Texto principal light mode |
| card | #FFFFFF | Superfícies de cards |
| muted | #EEF2F7 | Áreas sutis e separadores visuais |
| muted_foreground | #64748B | Texto secundário |
| border | #D8E0EA | Bordas de cards, inputs e tabelas |
| success | #16A34A | Sucesso |
| warning | #D97706 | Alerta |
| error | #DC2626 | Erro/destrutivo |
| info | #2563EB | Informação |
| ai_processing | #7C3AED | Estado de IA processando, usado com moderação |
| tool_running | #0EA5E9 | Tool em execução |
| rag_source | #0F766E | Fonte/evidência RAG |

### 5.3 Dark mode

Dark mode deve ser previsto desde o início, mas sem inversão automática cega.

Diretrizes:

- fundo escuro com contraste confortável;
- cards claramente separados do background;
- bordas sutis, porém perceptíveis;
- textos secundários ainda legíveis;
- cores semânticas preservadas;
- estados de IA e tools reconhecíveis;
- gráficos legíveis.

---

## 6. Tipografia

### 6.1 Fonte recomendada

Fonte padrão recomendada:

```txt
Inter
```

Alternativa para refinamento premium:

```txt
Plus Jakarta Sans
```

Fallback:

```txt
system-ui, sans-serif
```

### 6.2 Escala tipográfica

| Estilo | Uso | Observação |
|---|---|---|
| Display | Uso raro em tela inicial/hero interna | Evitar em telas densas |
| H1 | Título principal da tela | Um por tela |
| H2 | Seções principais | Usar para dividir áreas |
| H3 | Títulos de cards importantes | Evitar excesso |
| Body | Texto padrão | Base de leitura |
| Body small | Metadados e descrições | Contraste suficiente |
| Label | Formulários | Sempre visível quando possível |
| Caption | Datas, status e metadados | Não usar com contraste baixo |

### 6.3 Regras

- Não usar múltiplas fontes sem justificativa.
- Não usar título grande em telas de operação densa.
- Labels de formulário devem ser visíveis.
- Texto secundário não pode prejudicar acessibilidade.
- KPIs devem suportar valores longos sem quebrar card.

---

## 7. Espaçamento, grid e densidade

### 7.1 Base de espaçamento

Usar base de 4px.

| Token | Valor |
|---|---:|
| xs | 4px |
| sm | 8px |
| md | 12px |
| base | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 40px |
| 3xl | 48px |
| 4xl | 64px |

### 7.2 Densidade

O Orquestra terá telas administrativas e dashboards. A densidade deve ser moderada:

- mais compacta que landing page;
- menos apertada que ERP antigo;
- adequada para leitura de tabelas, status e logs;
- confortável para uso diário.

### 7.3 Grid

- Dashboard: grid responsivo de KPIs e cards.
- Listagens: tabela em desktop, cards em mobile.
- Detalhe de assistente: layout em duas colunas no desktop, seções empilhadas em telas menores.
- Chat: área principal + painel lateral no desktop, drawer no mobile.

---

## 8. Layout system

### 8.1 Layouts oficiais

| Layout | Uso |
|---|---|
| AuthLayout | Login e telas de autenticação |
| AppLayout | Área autenticada geral |
| DashboardLayout | Visões analíticas e painéis |
| SettingsLayout | Admin, configurações e permissões |
| EmptyLayout | Erros, 403, 404, manutenção |
| ChatLayout | Chat workspace, quando separado do layout geral |

### 8.2 AppLayout

Deve conter:

- sidebar;
- topbar;
- breadcrumb quando aplicável;
- seletor de workspace/tenant quando necessário;
- avatar/menu do usuário;
- indicador de ambiente quando necessário;
- content container com padding responsivo;
- page header com título, descrição e ações.

### 8.3 Sidebar

Desktop expandido:

- ícone + label;
- grupos;
- item ativo;
- possibilidade de colapso.

Desktop colapsado:

- ícones;
- tooltip;
- item ativo visível.

Mobile:

- drawer/sheet;
- botão de menu na topbar;
- foco controlado ao abrir e fechar.

### 8.4 Topbar

Pode conter:

- breadcrumbs;
- seletor de workspace;
- ações rápidas;
- avatar;
- menu de usuário;
- status de ambiente.

### 8.5 ChatLayout

O chat deve priorizar:

- área de conversa clara;
- composer sempre acessível;
- seleção de assistente;
- fontes e tool calls visualmente distinguíveis;
- histórico quando disponível;
- estados de IA visíveis.

---

## 9. Padrões de tela

### 9.1 Matriz Tela → Layout → Componentes → Estados → Responsividade

| Tela | Rota | Layout | Componentes | Estados | Desktop | Tablet | Mobile | Acessibilidade |
|---|---|---|---|---|---|---|---|---|
| Login | /login | AuthLayout | Button, Card, Alert, LoadingState | loading, error, success | Tela centralizada | Layout compacto | Layout full-width com card | Foco visível no botão Microsoft |
| Dashboard | /app | DashboardLayout | MetricCard, ChartCard, Card, Skeleton | loading, empty, error, success | Grid de KPIs | Grid reduzido | Cards empilhados | Gráficos com rótulos |
| Assistentes | /app/assistants | AppLayout | PageHeader, DataTable, CardList, FilterBar | loading, empty, error, forbidden | Tabela completa | Colunas reduzidas | Cards | Ações por permissão |
| Detalhe do assistente | /app/assistants/:id | AppLayout | Tabs, Badge, Card, VersionList | loading, not_found, forbidden, success | Duas colunas | Uma coluna adaptada | Seções empilhadas | Status legível |
| Wizard de assistente | /app/assistants/new | AppLayout | Stepper, Form, Card, Button, Alert | draft, saving, validation_error, success | Stepper lateral ou topo | Stepper compacto | Etapas verticais | Labels visíveis |
| Chat Workspace | /app/chat | AppLayout | ChatList, ChatComposer, SourceCard, ToolCallCard | thinking, streaming, tool_call, fallback, error | Layout com painel lateral | Painel recolhível | Assistentes em drawer | Estados de IA textuais |
| Knowledge Hub | /app/knowledge | AppLayout | DataTable, FileUpload, Progress, Badge | uploading, indexing, indexed, failed | Tabela + detalhes | Tabela reduzida | Cards de documentos | Status não só por cor |
| MCP Hub | /app/mcp | AppLayout | ProviderCard, ToolCard, Badge, Dialog | connected, pending, error, expired | Grid de cards | Grid reduzido | Cards empilhados | Credenciais mascaradas |
| Analytics | /app/analytics | DashboardLayout | MetricCard, ChartCard, DataTable | loading, empty, error, success | Grid analítico | Grid reduzido | Cards empilhados | Valores longos controlados |
| Audit Logs | /app/audit | AppLayout | DataTable, FilterBar, DetailDrawer | loading, empty, filtered, error | Tabela completa | Tabela reduzida | Cards com metadados | Busca e filtros acessíveis |
| Admin | /app/admin | SettingsLayout | Tabs, DataTable, Dialog, Badge | loading, empty, forbidden, success | Tabs + tabela | Tabs compactas | Seções empilhadas | Permissões claras |
| 403 | /403 | EmptyLayout | ErrorState, Button | forbidden | Mensagem central | Mensagem central | Mensagem central | Ação de retorno |

### 9.2 Telas estruturantes

O MVP deve prever telas para:

- login;
- dashboard;
- assistentes;
- detalhe do assistente;
- wizard de criação;
- chat;
- Knowledge Hub;
- MCP Hub;
- analytics;
- audit logs;
- admin;
- configurações;
- 403;
- 404;
- 500 ou erro geral.

### 9.3 Estrutura mínima por tela

Toda tela deve conter, quando aplicável:

- título;
- descrição curta;
- ação primária;
- ações secundárias;
- filtros;
- conteúdo principal;
- loading;
- empty state;
- error state;
- feedback após ação;
- comportamento sem permissão.

---

## 10. Componentes base

| Componente | Propósito | Variantes | Estados | Acessibilidade |
|---|---|---|---|---|
| Button | Ações primárias, secundárias e destrutivas. | default, secondary, outline, ghost, destructive, link | default, hover, focus, active, disabled, loading | Nome acessível e foco visível |
| Input | Entrada textual curta. | default, error, disabled | idle, focus, error, disabled | Label visível e erro associado |
| Textarea | Entrada textual longa. | default, error, disabled | idle, focus, error, disabled | Helper text quando necessário |
| Select | Poucas opções estáticas. | default, error, disabled | open, selected, empty | Teclado e rótulo acessível |
| Combobox | Busca em lista dinâmica. | single, multi | loading, empty, selected, error | Navegação por teclado |
| Dialog | Fluxos curtos e confirmação. | default, alert, destructive | open, loading, error | Controle de foco |
| Sheet/Drawer | Filtros, menus mobile e detalhes laterais. | left, right, bottom | open, close | Foco preso no painel |
| DataTable | Listagens densas em desktop. | default, compact | loading, empty, error, success | Alternativa mobile |
| CardList | Listagem responsiva em mobile. | default, compact | loading, empty, error | Ações alcançáveis |
| MetricCard | Indicadores e KPIs. | default, trend, warning | loading, empty, success | Texto e variação não só por cor |
| ChatMessage | Mensagem de usuário/assistente. | user, assistant, system | streaming, completed, error | Leitura sequencial |
| SourceCard | Fonte usada pelo RAG. | compact, expanded | loading, available, unavailable | Título e metadados claros |
| ToolCallCard | Chamada de tool/MCP. | pending, running, success, error | running, done, failed | Status textual explícito |
| Toast | Feedback não bloqueante. | success, error, info, warning | visible, dismissed | Não substituir erros críticos |
| EmptyState | Ausência de dados. | default, action | empty | Mensagem útil e ação clara |
| ErrorState | Erro recuperável ou crítico. | inline, page | error | Sem stack trace |

### 10.1 Botões

Variantes mínimas:

- default/primary;
- secondary;
- outline;
- ghost;
- destructive;
- link.

Estados:

- default;
- hover;
- focus;
- active;
- disabled;
- loading.

Regra:

```txt
Ação primária deve ser visualmente clara, mas não deve competir com múltiplas ações secundárias.
```

### 10.2 Modais e dialogs

Estrutura padrão:

```txt
Dialog
├─ Header
│  ├─ Título
│  └─ Descrição opcional
├─ Body
└─ Footer
   ├─ Ação secundária
   └─ Ação primária
```

Regras:

- ações destrutivas usam confirmação;
- body longo deve ter scroll;
- footer pode ser sticky em modais longos;
- foco deve ser controlado;
- no mobile, botões podem ocupar largura total.

### 10.3 Cards

Cards devem ser usados para:

- resumo de informação;
- KPIs;
- assistentes;
- documentos em mobile;
- tools;
- fontes;
- estados de IA.

Cards devem evitar excesso de texto e ter hierarquia clara.

### 10.4 Badges

Badges devem representar:

- status;
- risco;
- perfil;
- versão;
- visibilidade;
- workspace;
- provider;
- tipo de tool.

Badges não devem depender apenas de cor. O texto do badge deve ser claro.

---

## 11. CRUD UX

### 11.1 Listagem

Listagens devem oferecer:

- busca;
- filtros;
- ordenação;
- paginação;
- ações por linha;
- ações por permissão;
- loading;
- empty;
- error;
- alternativa mobile.

### 11.2 Criação

- Formulários simples podem usar dialog.
- Fluxos complexos devem usar página dedicada ou wizard.
- O wizard de assistente deve ter etapas claras.
- O usuário deve poder salvar rascunho.
- Validações devem aparecer inline.

### 11.3 Edição

- Deve estar claro que o usuário está editando.
- Campos bloqueados devem explicar o motivo.
- Alteração em assistente publicado deve indicar geração de nova versão.
- Conflitos devem ser tratados.

### 11.4 Exclusão/arquivamento

No Orquestra, preferir arquivamento para assistentes, preservando histórico e auditoria.

Ações destrutivas reais devem ser restritas e confirmadas.

---

## 12. DataTable e responsividade

### 12.1 Desktop

Usar DataTable completa para:

- usuários;
- assistentes;
- documentos;
- tools;
- audit logs;
- custos;
- evals.

### 12.2 Tablet

Reduzir colunas secundárias e mover ações para dropdown.

### 12.3 Mobile

Usar CardList responsiva.

Cada card deve conter:

- título principal;
- status;
- metadados críticos;
- ação principal;
- menu de ações secundárias.

### 12.4 Regra

Mobile não deve perder busca, filtros, ordenação e ações essenciais. Deve adaptar a apresentação.

---

## 13. Formulários

### 13.1 Padrão geral

Todo formulário deve ter:

- label visível;
- helper text quando necessário;
- erro abaixo do campo;
- indicação de obrigatório;
- agrupamento por seções;
- ações claras;
- bloqueio de duplo submit.

### 13.2 Campos esperados

- Input;
- Textarea;
- PasswordInput;
- Select;
- Combobox;
- MultiCombobox;
- Checkbox;
- Switch;
- DatePicker;
- FileUpload;
- CurrencyInput;
- PercentInput.

### 13.3 Wizard de assistente

O wizard deve ter seções como:

- identificação;
- objetivo;
- persona e tom;
- regras e restrições;
- exemplos;
- provider/modelo;
- bases de conhecimento;
- tools;
- visibilidade e compartilhamento;
- revisão;
- teste;
- publicação.

### 13.4 File upload

Para documentos de Knowledge Hub, o upload deve exibir:

- área de drop;
- tipos permitidos;
- limite de tamanho;
- progresso;
- status de processamento;
- erro de validação;
- resultado de indexação.

---

## 14. Estados de interface

### 14.1 Estados gerais

- loading;
- skeleton;
- empty;
- error;
- success;
- disabled;
- pending;
- forbidden;
- not found;
- offline.

### 14.2 Estados específicos do Orquestra

Assistentes:

- draft;
- pending_approval;
- published;
- archived;
- version_current;
- version_previous.

Knowledge Hub:

- uploaded;
- validating;
- indexing;
- indexed;
- failed;
- restricted.

MCP/tools:

- disconnected;
- connected;
- pending_approval;
- approved;
- rejected;
- high_risk;
- running;
- failed.

IA/chat:

- thinking;
- streaming;
- retrieving_sources;
- executing_tool;
- fallback;
- blocked_by_policy;
- runtime_error;
- provider_error;
- completed.

---

## 15. Feedback, toasts e mensagens

### 15.1 Padrão

Usar toast para feedback simples e não bloqueante. Usar alerta inline ou banner para erros contextuais. Usar tela de erro para falhas críticas.

### 15.2 Exemplos

| Contexto | Feedback |
|---|---|
| Assistente salvo | Toast de sucesso |
| Publicação enviada para aprovação | Toast + badge pending |
| Falha de provider | Alerta no chat |
| Tool de alto risco bloqueada | Alert contextual |
| Upload iniciado | Toast informativo + progresso |
| Documento falhou na indexação | Estado de erro no item |
| Sem permissão | Tela 403 ou ação oculta/desabilitada |

---

## 16. Padrões visuais de permissão

### 16.1 Comportamentos

- Menu sem acesso: ocultar.
- Ação inexistente para o perfil: ocultar.
- Ação bloqueada por estado: desabilitar e explicar.
- Acesso direto sem permissão: tela 403.
- Recurso restrito: badge/alert contextual.

### 16.2 Regra

A UI melhora clareza, mas não substitui autorização backend.

---

## 17. Padrões visuais para IA

### 17.1 Chat

A experiência de chat deve distinguir:

- mensagem do usuário;
- resposta do assistente;
- mensagem de sistema;
- resposta em streaming;
- erro recuperável;
- fallback;
- resposta com fontes;
- tool call.

### 17.2 Fontes RAG

Fonte deve aparecer como elemento separado da resposta, com:

- título;
- origem/base;
- trecho ou referência;
- indicador de confiança quando disponível;
- link ou detalhe quando aplicável.

### 17.3 Tool calls

Tool call deve exibir:

- nome amigável da tool;
- status;
- tempo/resultado resumido;
- erro quando falhar;
- indicação de risco quando aplicável.

### 17.4 Feedback de resposta

Feedback deve ser:

- simples;
- não intrusivo;
- disponível ao final da resposta;
- com positivo/negativo e comentário opcional.

---

## 18. Motion e microinterações

Motion deve ser funcional e discreta.

### 18.1 Usos recomendados

- streaming de resposta;
- skeletons;
- upload/indexação;
- tool call em andamento;
- transição de status;
- abertura de drawer/sheet;
- feedback de sucesso/erro;
- mudança de etapa no wizard.

### 18.2 Regras

- Respeitar `prefers-reduced-motion`.
- Não depender só de animação para transmitir informação.
- Não bloquear uso.
- Não causar layout shift.
- Não exagerar em telas de operação.

---

## 19. Dashboards, métricas e gráficos

### 19.1 Componentes

- MetricCard;
- ChartCard;
- filtros por período;
- indicadores positivos/negativos;
- tabelas analíticas;
- listas de uso/custo;
- cards de falhas e fallback.

### 19.2 Regras

- KPIs devem suportar valores longos.
- Gráficos precisam de título e contexto.
- Empty state deve explicar ausência de dados.
- Cores de gráficos devem usar tokens.
- Valores monetários devem ser legíveis.
- Percentuais devem ser padronizados.

---

## 20. Acessibilidade

### 20.1 Regras mínimas

- Todo campo deve ter nome acessível.
- Preferir label visível.
- Foco deve ser visível.
- Modais devem controlar foco.
- Botões devem ter nome acessível.
- Feedback não deve depender apenas de cor.
- Contraste deve ser suficiente.
- Área de toque deve ser adequada em mobile.
- Hierarquia de títulos deve ser coerente.
- Estados de IA devem ter texto visível, não só animação.

### 20.2 Chat e IA

- Streaming não deve impedir leitura.
- Tool call deve ter status textual.
- Fontes devem ser navegáveis por teclado.
- Feedback deve ser acessível.
- Erros devem ser anunciáveis por texto.

---

## 21. Dark mode

Dark mode deve ser suportado com tokens próprios.

### 21.1 Regras

- Não inverter cores automaticamente.
- Manter contraste.
- Preservar distinção entre cards e fundo.
- Garantir legibilidade de tabelas e modais.
- Preservar semântica de sucesso, alerta e erro.
- Gráficos devem continuar legíveis.
- Estados de IA não devem parecer decorativos demais.

---

## 22. Multi-tenant e branding futuro

O MVP começa com MCM como tenant inicial. O Design System deve prever expansão futura, sem exigir white label completo agora.

### 22.1 Preparação futura

Prever tokens para:

- nome da organização;
- logotipo;
- favicon;
- theme color;
- cor primária;
- cor secundária;
- imagem institucional;
- light/dark mode.

### 22.2 Regra

Se o branding do tenant não carregar no futuro, a plataforma deve cair para o tema base do Orquestra sem quebrar layout.

---

## 23. PWA e assets visuais

Quando aplicável, prever:

- favicon;
- ícone de app;
- theme color;
- background color;
- nome curto;
- splash coerente;
- assets dentro da estrutura do frontend.

PWA não é prioridade visual do MVP, mas deve ser compatível com evolução futura.

---

## 24. Instruções para refinamento no Lovable

Ao refinar a UI no Lovable, aplicar:

- tokens de marca e semânticos;
- tipografia consistente;
- layouts oficiais;
- componentes reutilizáveis;
- wizard multi-etapas;
- DataTable responsiva;
- cards no mobile;
- estados de loading, empty, error e forbidden;
- feedbacks com toast/alert;
- dialogs com header/body/footer;
- confirmação para ações destrutivas;
- dark mode;
- acessibilidade mínima;
- estados de IA;
- fontes RAG;
- tool calls;
- motion funcional simples.

O Lovable deve representar experiência e fluxos visuais, mas não deve prometer backend, banco, runtime, RAG, MCP ou integrações reais sem implementação posterior.

---

## 25. Higienização visual pós-Lovable

Após exportar ou revisar o projeto, validar:

- cores hardcoded;
- tokens duplicados;
- tipografia inconsistente;
- componentes duplicados;
- modais fora de padrão;
- tabelas sem responsividade;
- formulários sem estados;
- ausência de empty/error/loading states;
- dark mode quebrado;
- estados de IA apenas decorativos;
- mocks parecendo dados reais;
- dashboards com valores quebrando layout;
- mobile espremido;
- permissões apenas visuais sem fallback;
- ausência de mensagens amigáveis.

---

## 26. Governança visual

### 26.1 Regras

- Criar novo componente apenas se componente existente não atender.
- Preferir variantes antes de duplicar componente.
- Registrar exceções visuais relevantes.
- Manter tokens como fonte da verdade.
- Evitar cores hardcoded.
- Não alterar padrão de tela sem justificativa.
- Validar visual antes de handoff técnico.
- Revisar acessibilidade de componentes críticos.

### 26.2 Decisões que devem ser registradas

- alteração de paleta;
- alteração de fonte;
- mudança de layout base;
- adoção de dark mode;
- exceções para componente crítico;
- mudança de comportamento mobile;
- padrão visual de estados de IA;
- padrão visual para tool calls;
- padrão visual para dashboards.

---

## 27. Handoff para frontend

O frontend deve receber:

- tokens;
- paleta;
- tipografia;
- layouts;
- componentes;
- padrões de tela;
- estados gerais;
- estados específicos de IA;
- padrões de DataTable e CardList;
- padrões de formulários;
- dialogs;
- feedbacks;
- dark mode;
- acessibilidade;
- motion funcional;
- instruções de higienização pós-Lovable.

O frontend será responsável por implementar:

- estrutura React;
- rotas;
- componentes;
- hooks;
- services;
- API client;
- forms;
- schemas;
- mocks controlados;
- permission gates;
- tratamento global de erros;
- integração com backend.

---

## 28. Critérios de aceite visual

| ID | Critério |
|---|---|
| CA-01 | Tokens principais foram definidos ou possuem fallback seguro. |
| CA-02 | Tipografia padrão foi definida. |
| CA-03 | Layouts principais foram definidos. |
| CA-04 | Componentes base foram especificados. |
| CA-05 | Telas críticas possuem estados de loading, empty, error e forbidden. |
| CA-06 | DataTable possui alternativa mobile. |
| CA-07 | Formulários possuem labels, erros e feedback. |
| CA-08 | Chat possui estados visuais de IA. |
| CA-09 | Fontes RAG possuem padrão visual. |
| CA-10 | Tool calls possuem padrão visual. |
| CA-11 | Motion é funcional e respeita redução de movimento. |
| CA-12 | Dark mode foi previsto. |
| CA-13 | Acessibilidade mínima foi documentada. |
| CA-14 | Permissões possuem comportamento visual. |
| CA-15 | O protótipo pode ser auditado contra este Design System após exportação. |
| CA-16 | O handoff para frontend está claro. |

---

## 29. Maturidade visual

Classificação atual:

```txt
Nível 4 — contrato visual, padrões críticos, estados de IA, responsividade e handoff definidos.
```

Para atingir nível 5, ainda é necessário:

- revisar o protótipo exportado;
- auditar tokens e componentes reais;
- validar dark mode na interface concreta;
- validar mobile real;
- revisar acessibilidade;
- confirmar paleta final com stakeholders;
- gerar checklist visual pós-exportação.

---

## 30. Próximos passos

1. Revisar este Design System com produto e frontend.
2. Usar este documento como base para refinamento visual no Lovable, se necessário.
3. Após exportação do Lovable, auditar a interface real contra estes padrões.
4. Atualizar o registro de decisões visuais quando houver alteração relevante.
5. Gerar o documento de Arquitetura de Software.
6. Em seguida, detalhar Frontend, Orquestração de IA, APIs, Banco, Segurança e Backend.

---

## 31. Conclusão

O Design System do Orquestra define uma base visual corporativa, confiável e funcional para um produto de IA governada.

A interface deve equilibrar sofisticação e clareza operacional, tornando visíveis permissões, status, versionamento, fontes, tool calls, custos e auditoria sem sobrecarregar a experiência.

A próxima etapa recomendada é avançar para arquitetura e, após a exportação do protótipo, validar a aderência visual real do frontend.
