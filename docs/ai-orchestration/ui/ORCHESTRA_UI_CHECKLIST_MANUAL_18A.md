# Orchestra — Checklist Manual de Homologação Local da UI — Fase 18A

## Como usar

Este roteiro será executado **manualmente pelo usuário**, no navegador local. A Fase
18A apenas o prepara. Não há automação de UI, correção de bug, deploy, produção,
provider externo ou MCP real.

Use a matriz `ORCHESTRA_UI_HOMOLOGATION_MATRIX_18A.json` para IDs e o
`ORCHESTRA_UI_BUG_TEMPLATE_18A.md` para evidências. Resultados permitidos:
`PASS`, `FAIL`, `BLOCKED` e `NOT_RUN`.

## Guardrails obrigatórios

Não executar na 18A:

- URL de produção, DNS ou endpoint externo;
- criação/edição/status/archive de servidor MCP;
- criação de tool MCP;
- associação MCP a Assistant;
- “Testar readiness seguro” ou “Consultar catálogo read-only” de MCP remoto;
- precheck/run sandbox MCP;
- provider LLM externo ou embeddings reais;
- envio/reenvio de mensagem no Chat;
- criação/cancelamento de AgentRun;
- qualquer botão cujo efeito externo não esteja comprovadamente fechado;
- upload de arquivo sensível;
- captura de cookie, token, header, secret, env ou payload bruto.

Se um botão proibido estiver visível, registrar somente sua presença/estado. Não
clicar.

## 1. Preparar o registro da sessão

- [ ] ID da sessão: `HOM-18A-____`;
- [ ] data/hora e executor;
- [ ] branch e commit registrados;
- [ ] `git status --short` registrado;
- [ ] sistema operacional e navegador/versão;
- [ ] viewport desktop e mobile planejados;
- [ ] perfil/role/workspace de cada rodada;
- [ ] pasta ou sistema de evidências preparado;
- [ ] prefixo de dados descartáveis definido, por exemplo `HOM18A-`;
- [ ] nenhum dado pessoal, corporativo ou segredo será usado.

## 2. Preparar o ambiente local

Os comandos exatos para iniciar o projeto continuam nos runbooks locais existentes.
Nesta fase, o usuário apenas confirma o estado já preparado; este checklist não inicia
containers, não migra banco e não cria `.env`.

- [ ] confirmar que somente serviços locais esperados estão em uso;
- [ ] confirmar containers locais esperados como `running/healthy`;
- [ ] confirmar que nenhuma migration está pendente de execução para este teste;
- [ ] confirmar backend health por endereço local já aprovado;
- [ ] confirmar frontend por endereço local já aprovado;
- [ ] confirmar base da API relativa/local (`/api/v1` ou equivalente local);
- [ ] confirmar `VITE_USE_MOCKS` e cenário pretendido;
- [ ] se testar modo real, confirmar mock desabilitado;
- [ ] confirmar providers externos desabilitados;
- [ ] confirmar embeddings externos desabilitados;
- [ ] confirmar MCP remoto/corporate/tools externas desabilitados;
- [ ] confirmar que não há URL planejada de produção na barra do navegador;
- [ ] registrar evidência sanitizada dessas confirmações sem mostrar valores.

Critério: qualquer dúvida sobre alvo/flags resulta em `BLOCKED`; não abrir a UI.

## 3. Login e sessão

### 3.1 Proteção de rota

- [ ] sem sessão, abrir uma rota local `/app/dashboard`;
- [ ] confirmar redirect para `/login`;
- [ ] confirmar que o retorno não exibe conteúdo autenticado durante loading;
- [ ] registrar `route-app-index`/`actor-anonymous`.

### 3.2 Login local

- [ ] confirmar título, labels de e-mail/senha e botão Entrar;
- [ ] confirmar mostrar/ocultar senha;
- [ ] confirmar que “Esqueceu a senha?” não causa efeito externo;
- [ ] observar loading/disable durante submit;
- [ ] confirmar erro sanitizado quando o backend local estiver indisponível somente se
  esse cenário já estiver preparado com segurança;
- [ ] executar login local com conta de teste;
- [ ] confirmar redirect para a origem preservada ou `/app/dashboard`;
- [ ] não registrar credencial, cookie ou request body.

### 3.3 SSO

- [ ] registrar estado do controle Microsoft: oculto/loading/disabled/ready;
- [ ] não configurar SSO externo;
- [ ] não iniciar redirect externo na 18A;
- [ ] classificar divergência como dúvida/bug conforme configuração local esperada.

### 3.4 Sessão e logout

- [ ] recarregar uma rota autenticada;
- [ ] confirmar permanência de sessão local esperada;
- [ ] registrar usuário/tenant apenas por identificador não sensível;
- [ ] clicar no controle de usuário somente quando pronto para encerrar;
- [ ] confirmar logout e redirect `/login`;
- [ ] confirmar que voltar para `/app/*` exige nova sessão.

## 4. Shell, menus e rotas

### 4.1 Desktop

- [ ] validar oito itens da sidebar;
- [ ] validar active state em cada rota;
- [ ] colapsar e expandir sidebar;
- [ ] validar tooltips/labels no modo colapsado;
- [ ] validar topbar, tenant e nome do usuário;
- [ ] registrar busca global e notificação como controles sem handler confirmado;
- [ ] não clicar no usuário até finalizar a rodada, pois o clique executa logout.

### 4.2 Mobile

- [ ] reduzir viewport;
- [ ] abrir drawer por “Abrir menu”;
- [ ] navegar por um item;
- [ ] confirmar fechamento do drawer;
- [ ] verificar overflow de tabs, tabelas e cabeçalhos;
- [ ] registrar viewport em evidência.

### 4.3 Rotas

- [ ] visitar todas as rotas canônicas da matriz;
- [ ] confirmar `/app` → `/app/dashboard`;
- [ ] confirmar `/app/admin` → `/app/admin/users`;
- [ ] testar redirects legados sem realizar mutações;
- [ ] registrar URL final canônica;
- [ ] validar `/403`, `/404`, `/500` e uma rota inexistente;
- [ ] validar retorno das páginas de erro.

## 5. Estados transversais

Em cada área, observar quando disponível:

- [ ] lazy loading global;
- [ ] skeleton/spinner;
- [ ] empty state e CTA;
- [ ] error state sanitizado;
- [ ] retry;
- [ ] 403;
- [ ] success;
- [ ] entidade não encontrada;
- [ ] botão disabled durante mutation;
- [ ] toast de sucesso/erro.

Não remover dados ou permissões só para fabricar um estado. Se o cenário não estiver
preparado, usar `NOT_RUN`.

## 6. Dashboard

- [ ] abrir `/app/dashboard`;
- [ ] observar loading de Assistants, Audit e MCP tools;
- [ ] validar KPIs e ausência de `NaN`/undefined;
- [ ] validar Assistants recentes;
- [ ] validar Atividade recente;
- [ ] validar estado vazio, se naturalmente disponível;
- [ ] validar retry apenas se houver erro local preparado;
- [ ] confirmar que nenhum dado mock substitui erro no modo real;
- [ ] registrar `flow-dashboard-read`.

## 7. Assistants

### 7.1 Catálogo

- [ ] abrir `/app/assistants`;
- [ ] buscar por nome, descrição e área;
- [ ] limpar busca;
- [ ] abrir/fechar filtros;
- [ ] combinar status, área e responsável;
- [ ] limpar filtros;
- [ ] ordenar por atualização, nome, conversas, custo e satisfação;
- [ ] alternar cards/tabela;
- [ ] abrir menu de ações;
- [ ] comparar ações visíveis com permissões do perfil;
- [ ] validar links “Ver detalhes” e “Editar” sem salvar;
- [ ] não usar “Testar” para enviar execução;
- [ ] registrar “Duplicar” como comportamento local/placeholder se somente toast.

### 7.2 Wizard

- [ ] abrir `/app/assistants/new`;
- [ ] percorrer as 12 etapas:
  Identidade, Objetivo, Persona, Tom e Voz, Regras, Modelos, Conhecimento,
  Ferramentas, Formato, Exemplos, Limites e Revisão;
- [ ] validar required de nome, área e objetivo;
- [ ] validar Anterior/Próximo e progresso mobile;
- [ ] validar limites e selects;
- [ ] não selecionar ou vincular MCP;
- [ ] cancelar/voltar e confirmar ausência de mutation;
- [ ] se houver autorização explícita para mutation local, salvar somente rascunho
  descartável prefixado `HOM18A-`;
- [ ] não publicar para abrir caminho de execução externa;
- [ ] recarregar o catálogo e confirmar persistência apenas do rascunho autorizado.

### 7.3 Detalhe

- [ ] abrir Assistant existente não sensível;
- [ ] validar header/status/versão/ambiente;
- [ ] percorrer as dez abas;
- [ ] validar not-found e retry somente se cenário seguro disponível;
- [ ] verificar lifecycle por permissão sem executar ações irreversíveis;
- [ ] registrar Duplicar se permanecer toast local;
- [ ] validar Configuração/Governança em leitura;
- [ ] observar execution policy e precheck sem alterar ou executar;
- [ ] validar Knowledge em leitura;
- [ ] não criar/remover binding MCP;
- [ ] não executar MCP sandbox;
- [ ] não criar/cancelar AgentRun;
- [ ] não executar RAG/provider externo;
- [ ] validar Prompt Compilado apenas com dados não sensíveis;
- [ ] testar view sections/raw/diff, expand/collapse e copy somente se a evidência não
  expuser conteúdo;
- [ ] validar Analytics/Audit em leitura.

## 8. Knowledge

### 8.1 Catálogo

- [ ] abrir `/app/knowledge`;
- [ ] buscar e limpar busca;
- [ ] filtrar status/classificação;
- [ ] alternar cards/tabela;
- [ ] abrir create/edit e validar campos sem submit;
- [ ] validar cancelamento;
- [ ] registrar Re-indexar conforme comportamento atual;
- [ ] se autorizado, criar base local descartável sem conector externo;
- [ ] se autorizado, editar e arquivar apenas o registro descartável;
- [ ] registrar estados anterior/posterior.

### 8.2 Detalhe e documentos

- [ ] abrir `/app/knowledge/:id`;
- [ ] validar KPIs/readiness;
- [ ] percorrer Documentos, Data Sources, Assistentes, Configuração e Atividade;
- [ ] buscar documentos;
- [ ] abrir modal Registrar Documento;
- [ ] validar cancelamento, required e limites;
- [ ] se autorizado, cadastrar texto não sensível ou arquivo TXT/MD/CSV descartável;
- [ ] se autorizado, solicitar apenas ingestão local;
- [ ] validar progresso, chunks e source references;
- [ ] não solicitar embeddings reais de documento/base;
- [ ] validar que ação bloqueada apresenta mensagem sanitizada, sem tentar habilitar
  provider;
- [ ] validar data source apenas como catálogo, sem executar connector;
- [ ] validar policy sem habilitar fallback externo;
- [ ] limpar somente registros descartáveis pelo fluxo autorizado.

## 9. MCP — leitura somente

- [ ] abrir `/app/mcp`;
- [ ] validar KPIs, busca, filtros e card/table;
- [ ] abrir somente servidor existente;
- [ ] percorrer Tools, Resources, Prompts, Bindings, Logs e Configuração;
- [ ] validar empty/success em leitura;
- [ ] validar navegação para Assistant vinculado sem alterar vínculo;
- [ ] **não** abrir submit de “Registrar Servidor”;
- [ ] **não** editar, ativar/desativar, duplicar ou arquivar servidor;
- [ ] **não** catalogar/editar/arquivar tool;
- [ ] **não** alterar approval;
- [ ] **não** clicar “Testar readiness seguro”;
- [ ] **não** clicar “Consultar catálogo read-only”;
- [ ] registrar `realMcpExecution=false`.

## 10. Chat — shell sem execução

- [ ] abrir `/app/chat`;
- [ ] validar catálogo de Assistants publicados ou empty state;
- [ ] abrir uma tela de Assistant publicado, se houver;
- [ ] validar header/publicação/modelo/versão;
- [ ] validar painel de conversas já existente somente em leitura;
- [ ] não criar nova conversa;
- [ ] não arquivar conversa;
- [ ] não enviar mensagem;
- [ ] não reenviar mensagem;
- [ ] não criar/cancelar AgentRun;
- [ ] não carregar eventos se isso exigir execução prévia nova;
- [ ] confirmar `realProviderExecution=false` e `realMcpExecution=false`;
- [ ] registrar `flow-chat-shell`.

## 11. Analytics

- [ ] abrir `/app/analytics`;
- [ ] validar seis KPIs;
- [ ] testar busca por `input_summary` com texto não sensível;
- [ ] testar selects de status, runtime, RAG, scope, flags externas e limite;
- [ ] limpar filtros;
- [ ] paginar;
- [ ] abrir run existente em drawer;
- [ ] confirmar somente campos allowlistados;
- [ ] não capturar input/output bruto;
- [ ] testar 403 com perfil preparado, se disponível;
- [ ] fechar drawer por teclado e mouse.

## 12. Auditoria

- [ ] abrir `/app/audit`;
- [ ] validar KPIs e lista;
- [ ] validar table/cards conforme viewport;
- [ ] observar status de risco;
- [ ] registrar o botão Filtros sem assumir implementação;
- [ ] não expor IDs ou descrições sensíveis;
- [ ] testar 403 somente com perfil preparado.

## 13. Admin, settings e profile

Executar com `admin_platform` e, se disponível, perfil restrito.

- [ ] `/app/admin/users`: loading/empty/error/success;
- [ ] registrar busca e “Convidar Usuário” sem executar convite;
- [ ] `/app/admin/roles`: roles e permissões;
- [ ] `/app/admin/settings`: catálogo LLM sanitizado e workspaces;
- [ ] usar Atualizar somente como leitura;
- [ ] confirmar que nenhum provider externo é chamado;
- [ ] `/app/settings`: registrar conteúdo real reutilizado;
- [ ] `/app/profile`: registrar conteúdo real reutilizado;
- [ ] comparar acesso/403 entre perfis;
- [ ] se um perfil restrito acessar Admin, registrar evidência e abrir achado/dúvida;
- [ ] não alterar usuário, role, permission, workspace ou setting.

## 14. Mensagens de erro e sucesso

Para mutations locais explicitamente autorizadas:

- [ ] observar disable/spinner;
- [ ] confirmar toast de sucesso;
- [ ] recarregar e confirmar persistência;
- [ ] confirmar mensagem de erro sanitizada;
- [ ] confirmar que o estado anterior não foi perdido em falha;
- [ ] registrar método/path/status local, sem header/body sensível;
- [ ] não repetir mutation em loop;
- [ ] interromper se o resultado divergir.

## 15. Permissões

Para cada perfil disponível:

- [ ] registrar role e permission keys sem token;
- [ ] testar acesso a menu/rota;
- [ ] registrar ação visível, oculta ou desabilitada;
- [ ] confirmar resposta do backend em ação permitida preparada;
- [ ] confirmar 403/negação para ação não permitida preparada;
- [ ] cobrir lifecycle de Assistant;
- [ ] cobrir governance/test feedback;
- [ ] cobrir `audit.read`;
- [ ] cobrir Admin;
- [ ] não usar UI como prova única de segurança.

## 16. Responsividade e acessibilidade básica

- [ ] desktop largo;
- [ ] tablet;
- [ ] mobile;
- [ ] zoom 200% onde viável;
- [ ] navegação por Tab/Shift+Tab;
- [ ] ativação por Enter/Espaço;
- [ ] foco visível;
- [ ] labels de inputs;
- [ ] nomes acessíveis em icon buttons;
- [ ] modais e drawers fecham e devolvem foco;
- [ ] tabelas/tabs não cortam conteúdo crítico;
- [ ] contraste/legibilidade observacional;
- [ ] registrar viewport e browser.

## 17. Registro de evidências e bugs

Para cada item:

- [ ] ID da matriz;
- [ ] resultado;
- [ ] perfil;
- [ ] rota local;
- [ ] passos;
- [ ] esperado/obtido;
- [ ] screenshot/log sanitizado;
- [ ] request apenas método/path/status, se necessário;
- [ ] achado vinculado;
- [ ] nenhum secret/dado sensível.

Separar:

- [ ] bug funcional;
- [ ] bug visual;
- [ ] bug de permissão;
- [ ] bug de integração API;
- [ ] melhoria;
- [ ] ajuste visual;
- [ ] dúvida de regra.

## 18. Encerramento e GO/NO-GO

- [ ] todos os itens executados têm resultado;
- [ ] itens não executados têm motivo;
- [ ] evidências foram sanitizadas;
- [ ] dados descartáveis autorizados foram reconciliados;
- [ ] nenhuma correção foi aplicada;
- [ ] nenhuma produção foi chamada;
- [ ] nenhum deploy ocorreu;
- [ ] nenhum MCP real ocorreu;
- [ ] nenhum provider/embedding externo ocorreu;
- [ ] nenhum AgentRun externo-capable foi criado;
- [ ] Prisma/migrations permaneceram inalterados;
- [ ] achados foram priorizados para fase posterior;
- [ ] decisão registrada:
  - GO para avançar à triagem/18B;
  - NO-GO se houver evidência incompleta ou risco crítico.

### Resumo da sessão

```text
Sessão:
Executor:
Data:
Commit:
Perfil(is):
PASS:
FAIL:
BLOCKED:
NOT_RUN:
Bugs funcionais:
Bugs visuais:
Bugs de permissão:
Bugs de integração API:
Melhorias:
Ajustes visuais:
Dúvidas de regra:
Produção chamada: não
Deploy: não
MCP real: não
Provider/embedding externo: não
Correções aplicadas: não
Decisão: GO | NO-GO
Próxima fase sugerida:
```
