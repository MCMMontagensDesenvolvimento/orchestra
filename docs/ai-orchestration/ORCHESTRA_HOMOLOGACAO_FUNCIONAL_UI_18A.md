# Orchestra — Homologação Funcional Local pela UI — Fase 18A

## 1. Objetivo

A Fase 18A abre a frente de homologação funcional local pela interface e organiza o
primeiro ciclo de teste direto em tela do Orchestra. Seu objetivo é transformar a
análise estática das rotas, páginas, menus, botões, formulários, CRUDs, contratos de API
e permissões em um plano manual rastreável e seguro.

**A 18A prepara e orienta os testes; ela não executa a homologação no lugar do
usuário e não corrige achados.** Qualquer teste prático no navegador será realizado
manualmente pelo usuário, no ambiente local, seguindo
`ui/ORCHESTRA_UI_CHECKLIST_MANUAL_18A.md`.

## 2. Escopo

- inventariar a UI implementada a partir do código versionado;
- relacionar rotas canônicas, redirects, páginas de erro e layouts;
- mapear menus, abas, botões, estados, formulários e áreas de CRUD;
- relacionar as APIs que os serviços do frontend consomem;
- identificar guardas de sessão e permissões visíveis no frontend;
- classificar ações como seguras, condicionais ou proibidas na 18A;
- definir ordem manual, critérios de aceite, evidências e classificação de achados;
- criar matriz JSON machine-readable, checklist e templates;
- validar os artefatos por scripts offline, somente leitura;
- preservar Prisma, migrations, backend funcional e frontend funcional.

## 3. Fora de escopo

- corrigir bug funcional, visual, de permissão ou integração;
- alterar regra de negócio, frontend funcional, backend funcional, auth/SSO ou CRUD;
- alterar Prisma schema ou migrations;
- deploy, publicação, DNS, TLS, produção ou URLs planejadas;
- chamada externa, `curl`, `wget`, request, discovery ou execução MCP real;
- habilitar ou executar OpenAI, Azure OpenAI, Anthropic ou embeddings reais;
- criar servidor MCP pela tela;
- associar MCP/tool a Assistant;
- clicar em readiness/discovery de MCP remoto;
- enviar Chat ou criar `AgentRun` quando houver risco de provider/tool externa;
- criar `.env` real, coletar, exibir ou persistir secrets;
- automatizar browser, Playwright, Cypress ou teste visual;
- usar um achado como autorização implícita para mudança.

As URLs planejadas de produção permanecem inativas e não fazem parte do roteiro de
execução local.

## 4. Relação com o SPR_00

A 18A aplica o SPR_00 como governança metodológica:

| Elemento SPR_00 | Aplicação na 18A |
|---|---|
| Objetivo | inventário e preparação da homologação manual local |
| Escopo / fora de escopo | fronteiras explícitas nas seções 2 e 3 |
| Critérios de aceite | matriz da seção 20 e gates offline |
| Evidências | catálogo da seção 17 e templates versionados |
| Risco | matriz da seção 21 |
| GO/NO-GO | decisão documental da seção 20 |
| Rastreabilidade | IDs da matriz JSON, rota, perfil, data e evidência |
| Separação de achados | bug funcional, bug visual, permissão, integração, melhoria e dúvida |

Nenhum registro deve combinar categorias. Um problema visual e um erro funcional
observados juntos geram dois IDs.

## 5. Estado atual local

- baseline da fase: `f7c0ed6`, após a Fase 17D;
- branch de trabalho: `fase-18a-homologacao-funcional-local-ui`;
- aplicação ainda local;
- deploy e teste de produção: não executados;
- provider externo e MCP real: não executados;
- secrets reais: não lidos;
- Prisma/migrations: preservados;
- fontes funcionais de backend/frontend: preservadas;
- status inicial de todos os itens da matriz: `not-tested`.

## 6. Relação com a Fase 17D

A 17D consolidou o candidato de release por evidência offline, com
`releasePreflightReady=true` e `deployGo=false`, mas manteve
`uiCrudTested=false`. A 18A recebe exatamente esse gap:

1. mantém `deployment=false` e `productionTest=false`;
2. não altera o candidato funcional;
3. cria o inventário e a ordem da homologação local em tela;
4. mantém todas as execuções externas fechadas;
5. prepara a coleta de evidência que poderá orientar uma 18B.

O GO da 18A significa somente “material de homologação manual preparado”. Não muda a
decisão de deploy da 17D.

## 7. Premissas de homologação local

- navegador, frontend e backend devem apontar apenas para o ambiente local;
- containers e health são confirmados pelo usuário antes de abrir a UI;
- usar dados fictícios, descartáveis e sem informação pessoal ou corporativa;
- manter flags de providers, embeddings, MCP remoto e tools externas fechadas;
- não imprimir env, cookies, tokens, headers de autorização ou payload bruto;
- não clicar em ações marcadas `prohibited-in-18A`;
- registrar estado anterior e posterior antes de qualquer mutação local permitida;
- parar um fluxo ao primeiro comportamento inesperado e classificar o achado;
- não “tentar corrigir” dados ou configuração para fazer o teste passar;
- screenshots devem ser recortados e sanitizados.

## 8. Perfis e atores

| Ator/perfil | Uso na homologação | Limite conhecido |
|---|---|---|
| Usuário anônimo | login, redirects e erros de sessão | não deve alcançar `/app/*` no modo real |
| Usuário autenticado | navegação e leituras gerais | acesso depende do backend e workspace |
| `admin_platform` | perfil mock detectado, com conjunto amplo de permissões | não prova RBAC real |
| `editor` | role mock detectada | permissões efetivas não são definidas no mock de roles |
| Usuário sem permissão específica | verificar ocultação, disable ou 403 | exige conta/sessão local preparada pelo usuário |
| QA/homologador | executa checklist e coleta evidências | não corrige achados |
| Product Owner | decide regra de negócio e prioridade | não altera severidade técnica sem justificativa |
| Responsável técnico | recebe achado para triagem posterior | correção somente em fase autorizada |

Permissões explicitamente consultadas na UI:
`assistants.update`, `assistants.publish`, `assistants.unpublish`,
`assistants.rollback`, `assistants.archive`, `assistants.restore`,
`assistants.feedback.create`, `assistants.testResults.create`,
`assistants.execution.configure`, `assistants.execution.enable`,
`agent_runs.create` e `agent_runs.cancel`.

Também foram detectadas `audit.read` no contrato/feedback de erro e permissões amplas
na sessão mock. A rota Admin não possui guarda visual de role detectável; isso é risco
de homologação, não conclusão de vulnerabilidade.

## 9. Tipos de teste

| Tipo | O que observar | Evidência mínima |
|---|---|---|
| Smoke visual | render, shell, menu, cabeçalho, ausência de quebra | screenshot sanitizado |
| Navegação | rota, redirect, voltar, abas, deep link | rota local + antes/depois |
| Sessão | login, loading, logout, redirect pós-expiração | perfil e resultado |
| Leitura | loading, empty, success, error, retry e 403 | estado e resposta visual |
| Formulário | required, limites, disable, cancelamento e feedback | entradas não sensíveis |
| CRUD local | create/read/update/archive/restore quando autorizado | IDs locais descartáveis |
| Permissão | ação visível, oculta, desabilitada ou negada | perfil + permissão esperada |
| Responsivo | desktop, drawer mobile, tabelas/cards e overflow | viewport e screenshot |
| Acessibilidade básica | foco, teclado, labels e nomes acessíveis | passos e resultado |
| Integração frontend/API | request local, erro sanitizado e estado atualizado | método/path sem headers/body sensível |

## 10. Classificação de achados

| Categoria | Definição | Exemplo |
|---|---|---|
| Bug funcional | comportamento diverge do contrato esperado | salvar não persiste ou rota errada |
| Bug visual | layout, corte, contraste, sobreposição ou responsividade | modal fora da viewport |
| Bug de permissão | ação/rota exposta, oculta ou autorizada incorretamente | editor vê ação administrativa |
| Bug de integração API | request local, mapping, status ou feedback falha | erro 500 sem mensagem sanitizada |
| Melhoria | comportamento correto com oportunidade de UX/eficiência | filtro poderia preservar seleção |
| Ajuste visual | refinamento estético sem perda funcional | espaçamento inconsistente |
| Dúvida de regra | esperado não pode ser decidido pelo código | arquivar deve remover da busca? |

Usar `ui/ORCHESTRA_UI_BUG_TEMPLATE_18A.md`. Hipótese nunca deve ser registrada como
causa confirmada.

## 11. Estados esperados

O componente `QueryState` padroniza `loading`, `empty`, `error`, `forbidden` e
`success` em várias telas. Além dele, há:

- fallback global `Carregando...` para lazy routes;
- loading de sessão em `ProtectedRoute`;
- skeletons e spinners por consulta/mutation;
- estados de entidade não encontrada em detalhes;
- botão “Tentar novamente” em erros recuperáveis;
- toasts de sucesso/erro em mutations;
- botões desabilitados durante submit;
- mensagens específicas para ausência de publicação, conversa, documentos, tools e
  runs.

Cada tela deve ser testada primeiro em sucesso. Estados empty/error/403 exigem cenário
local deliberado; não devem ser produzidos alterando dados reais.

## 12. Ordem sugerida de homologação

1. confirmar baseline, configuração local, flags fechadas e dados descartáveis;
2. validar login, sessão, proteção de `/app/*` e logout;
3. validar AppShell, sidebar desktop/mobile, topbar, redirects e páginas de erro;
4. Dashboard;
5. Assistants: lista, filtros, detalhe e wizard com rascunho descartável;
6. Knowledge: catálogo, detalhe e documento textual local descartável;
7. MCP: somente leitura do catálogo/detalhe, sem cadastrar, vincular ou consultar remoto;
8. Chat: catálogo e abertura da tela, sem enviar mensagem/AgentRun;
9. Analytics e Audit em leitura;
10. Admin, settings e profile em leitura, por perfil;
11. estados empty/error/403 preparados localmente;
12. responsividade, teclado e revisão cruzada de evidências;
13. classificar achados e decidir GO/NO-GO documental.

## 13. Checklist antes de abrir o navegador

- [ ] branch e commit-base registrados;
- [ ] `git status --short` registrado;
- [ ] containers locais esperados já iniciados pelo usuário;
- [ ] backend health local confirmado pelo usuário;
- [ ] frontend local confirmado pelo usuário;
- [ ] nenhuma URL planejada de produção em uso;
- [ ] `VITE_API_BASE_URL` efetivo aponta para API local/relativa;
- [ ] providers, embeddings, MCP remoto e execução externa continuam fechados;
- [ ] perfil, workspace e permissões de teste identificados;
- [ ] dados fictícios e descartáveis preparados;
- [ ] pasta/registro de evidências preparado sem secrets;
- [ ] ações proibidas da seção 3 destacadas.

## 14. Checklist durante a homologação

- [ ] executar um item da matriz por vez;
- [ ] registrar rota local, perfil e ID do item;
- [ ] capturar estado inicial;
- [ ] executar somente ação permitida;
- [ ] observar loading, disable e feedback;
- [ ] confirmar resultado visual e, quando aplicável, persistência após reload;
- [ ] testar cancelamento antes de submit em formulários;
- [ ] sanitizar screenshots e logs;
- [ ] parar ao encontrar comportamento inesperado;
- [ ] abrir um registro por categoria;
- [ ] manter `status=not-tested` na matriz versionada; resultados pertencem à evidência
  da execução, não à preparação 18A.

## 15. Checklist após a homologação

- [ ] confirmar que nenhuma produção foi chamada;
- [ ] confirmar que nenhum provider/embedding/MCP externo foi executado;
- [ ] confirmar que nenhum secret foi coletado;
- [ ] remover apenas dados locais descartáveis pelo fluxo funcional autorizado;
- [ ] reconciliar IDs de evidências e achados;
- [ ] separar bug, melhoria, ajuste visual e dúvida;
- [ ] revisar severidade e impacto;
- [ ] registrar itens não testados e motivo;
- [ ] produzir decisão GO/NO-GO da sessão;
- [ ] não corrigir achados na branch 18A.

## 16. Sequência por área

| Ordem | Área | Primeiro teste | Mutação máxima na 18A |
|---|---|---|---|
| 1 | Auth | login/sessão/logout local | sessão local |
| 2 | Navegação | menus, redirects e erros | nenhuma |
| 3 | Dashboard | leituras/KPIs | nenhuma |
| 4 | Assistants | lista → detalhe → wizard | rascunho descartável, se autorizado |
| 5 | Knowledge | lista → detalhe → documento | conteúdo textual local descartável |
| 6 | MCP | catálogo/detalhe | nenhuma; cadastro e binding proibidos |
| 7 | Chat | catálogo/tela do assistant | nenhuma mensagem; AgentRun proibido |
| 8 | Analytics/Audit | filtros, detalhe e leitura | nenhuma |
| 9 | Admin | users/roles/settings/profile | leitura; convite/CRUD não autorizado |

## 17. Evidências esperadas

Cada evidência aprovada deve conter:

- ID (`EV-18A-...`);
- data/hora e executor;
- ID da rota/tela/fluxo da matriz;
- ambiente `local`;
- perfil/role e workspace sem dados sensíveis;
- passos resumidos;
- resultado esperado e observado;
- screenshot sanitizado ou referência de log local sanitizado;
- request local apenas por método/path/status, sem headers ou payload sensível;
- decisão `PASS`, `FAIL`, `BLOCKED` ou `NOT_RUN`;
- ID do achado, se houver.

Não coletar cookies, tokens, API keys, connection strings, valores de env, prompt ou
output bruto de provider, conteúdo confidencial, argumentos/output MCP ou headers de
autorização.

## 18. Templates resumidos

### Bug

```text
ID: BUG-18A-
Categoria: funcional | visual | permissão | integração API
Área/tela/rota:
Perfil:
Pré-condições:
Passos:
Esperado:
Obtido:
Severidade:
Evidência sanitizada:
Hipótese (não confirmada):
Decisão:
Fase sugerida para correção: 18B
```

### Melhoria

```text
ID: MEL-18A-
Área/tela:
Comportamento atual correto:
Oportunidade:
Benefício:
Risco/custo:
Evidência:
Decisão:
```

### Ajuste visual

```text
ID: VIS-18A-
Tela/rota/viewport:
Elemento:
Resultado atual:
Referência esperada:
Impacto:
Screenshot sanitizado:
Decisão:
```

### Dúvida de regra

```text
ID: REGRA-18A-
Área/fluxo:
Cenário:
Alternativas observadas:
Código/documento consultado:
Decisor necessário:
Impacto se não decidido:
Decisão:
```

## 19. Critérios de aceite

- os cinco documentos obrigatórios existem;
- a matriz é JSON válido e todos os itens começam em `not-tested`;
- rotas, telas, menus, CRUDs, formulários, ações, perfis e fluxos estão inventariados;
- limites de MCP/provider/produção/Chat externo estão explícitos;
- checklist é executável manualmente e usa somente alvos locais;
- templates separam todas as categorias de achado;
- preflight e smoke 18A são offline, executáveis e somente leitura;
- CI executa apenas `smoke-homologacao-ui-18a.sh --dry-run` para a 18A;
- regressões 17D, 17C, 17B, 17A e 16Z permanecem verdes;
- Prisma/migrations e fontes funcionais estão idênticos ao baseline 18A.

## 20. Matriz GO/NO-GO da 18A

| Decisão | Status esperado | Evidência | Regra |
|---|---|---|---|
| Inventário estático completo | GO | documentos e matriz válidos | autoriza revisão do material |
| Homologação manual local preparada | GO | checklist e templates válidos | autoriza o usuário a iniciar testes locais controlados |
| Correção automática de achados | NO-GO | `bugFixing=false` | correção exige fase posterior |
| Deploy/produção | NO-GO | `deployment=false`, `productionTest=false` | nenhuma execução |
| MCP remoto/provider externo | NO-GO | flags da matriz e guardrails | nenhuma execução |
| Criar/vincular MCP pela tela | NO-GO | fora de escopo | não clicar |
| Chat/AgentRun com tool/provider externo | NO-GO | fora de escopo | não enviar |

Resultado documental esperado:
`uiHomologation=true`, `manualBrowserTestingPrepared=true`, `bugFixing=false`.

## 21. Matriz de risco remanescente

| Risco | Probabilidade | Impacto | Mitigação 18A | Residual |
|---|---|---|---|---|
| análise estática divergir do comportamento em runtime | média | alto | marcar tudo `not-tested` | médio |
| UI expor ação sem guarda visual | média | alto | testar com perfis distintos | médio |
| clique acionar integração externa | baixa/média | crítico | lista explícita de ações proibidas | médio |
| dados de teste contaminarem catálogo local | média | médio | prefixo e cleanup controlado | baixo |
| screenshot/log vazar dado sensível | média | alto | sanitização e recorte | médio |
| placeholders serem reportados como bug | alta | médio | confrontar inventário e dúvida de regra | médio |
| links legados mascararem rota incorreta | média | médio | testar URL final após redirect | baixo |
| Admin/Profile reutilizarem tela inesperada | média | médio | registrar como evidência/dúvida, não corrigir | médio |
| empty/error/403 não serem reproduzíveis | média | baixo | marcar `BLOCKED/NOT_RUN` | baixo |
| teste manual não cobrir responsividade/teclado | média | médio | etapa dedicada | médio |

## 22. Rastreabilidade

- inventário humano: `ui/ORCHESTRA_UI_INVENTARIO_18A.md`;
- matriz canônica: `ui/ORCHESTRA_UI_HOMOLOGATION_MATRIX_18A.json`;
- roteiro de execução: `ui/ORCHESTRA_UI_CHECKLIST_MANUAL_18A.md`;
- registros: `ui/ORCHESTRA_UI_BUG_TEMPLATE_18A.md`;
- validação offline: `scripts/preflight-homologacao-ui-18a.sh`;
- gate CI: `scripts/smoke-homologacao-ui-18a.sh --dry-run`;
- baseline herdado: `ORCHESTRA_PREFLIGHT_RELEASE_HOMOLOGAVEL_17D.md`.

## 23. Próximos passos sugeridos

1. revisar a matriz com Product, QA, Security e responsáveis técnicos;
2. executar o checklist manual local pelo usuário;
3. consolidar evidências sem alterar a matriz-base;
4. escolher a 18B conforme resultado:
   - **18B execução manual guiada**, se ainda faltar evidência;
   - **18B correções funcionais**, se bugs reproduzíveis e priorizados forem aceitos;
5. manter deploy, produção, MCP real e providers externos em fases próprias e
   explicitamente autorizadas.

Nenhuma decisão da 18A autoriza produção ou execução externa.
