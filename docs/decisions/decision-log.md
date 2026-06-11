# Orchestra - Decision Log

Registro das decisoes consolidadas para orientar as proximas fases de arquitetura, backend e infraestrutura.

## DEC-001 - Nomenclatura canonica do produto

O produto e o repositorio passam a usar a nomenclatura `Orchestra` em documentos operacionais, metadata, README e configuracoes publicas.

Status: decidida.

## DEC-002 - Estrategia de frontend pos-prototipo

O frontend nasceu de um prototipo visual e ja passou por uma fase inicial de higienizacao tecnica. O codigo atual deve ser tratado como base frontend local para evolucao tecnica, nao como arquitetura final de backend ou runtime.

Status: decidida.

## DEC-003 - Uso de mocks no frontend

Enquanto o frontend nao for integrado a API real, ele permanece usando mocks controlados por `VITE_USE_MOCKS`. A existencia da fundacao backend da Fase 04 nao altera o comportamento do frontend.

Status: decidida.

## DEC-004 - Rotas da aplicacao

As rotas principais da area autenticada usam o prefixo `/app/*`. Redirects legados podem existir para compatibilidade ate revisao futura.

Status: decidida.

## DEC-005 - Servidor Vite local

O Vite local usa `host: "0.0.0.0"`, porta `5173` e `strictPort: true`, favorecendo desenvolvimento local, WSL e Docker.

Status: decidida.

## DEC-006 - Package manager

O package manager padrao do frontend e `npm`, com `package-lock.json` versionado.

Status: decidida.

## DEC-007 - Backend, API, banco e runtime

Backend real, API de gestao, banco PostgreSQL, Prisma e autenticacao estrutural de desenvolvimento foram implementados na Fase 04. RAG real, MCP real, providers reais, SSO, streaming e runtime real continuam nao implementados.

Status: decidida.

## DEC-BE-001 - Backend Express modular em TypeScript strict

O backend inicial usa Express com TypeScript strict e organizacao por modulos sob `backend/src/modules`. Essa escolha prioriza simplicidade, previsibilidade local e uma base suficiente para o control plane.

Status: decidida.

## DEC-BE-002 - Validacao de entrada com Zod

Payloads HTTP passam por schemas Zod antes de chegar aos controllers. Erros de validacao retornam `422 VALIDATION_ERROR` com `fieldErrors`.

Status: decidida.

## DEC-BE-003 - Logs estruturados com Pino

O backend usa Pino e `pino-http` para logs estruturados, incluindo request id e metadados de requisicao.

Status: decidida.

## DEC-BE-004 - Dev-login apenas fora de producao

A autenticacao implementada na Fase 04 e um dev-login para desenvolvimento local. Ele e bloqueado quando `NODE_ENV=production` e nao substitui SSO corporativo.

Status: decidida.

## DEC-BE-005 - RBAC/ABAC estrutural no backend

Permissoes e escopo de workspace sao aplicados no backend por middlewares e helpers compartilhados. As politicas finais podem evoluir, mas o frontend nao deve ser a autoridade de autorizacao.

Status: decidida.

## DEC-API-001 - REST JSON versionado para gestao

A API de gestao usa REST + JSON sob `/api/v1`. Healthchecks ficam em `/health` e `/health/db` fora do prefixo versionado.

Status: decidida.

## DEC-API-002 - Erros e request id padronizados

Erros HTTP retornam `status`, `code`, `message`, `fieldErrors` quando aplicavel e `requestId`. O request id tambem e enviado no header `X-Request-Id`.

Status: decidida.

## DEC-DB-001 - UUID, snake_case e tenancy desde a migration inicial

O schema usa UUID nativo como identificador, tabelas e colunas em snake_case no banco, e campos de tenant/workspace desde a primeira migration.

Status: decidida.

## DEC-DB-002 - Schema inicial inclui entidades futuras sem runtime

Entidades como knowledge bases, MCP servers/tools, conversations, agent runs, tool calls, provider configs e usage records existem como estrutura de dados inicial. Elas nao significam execucao real de IA nesta fase.

Status: decidida.

## DEC-INFRA-001 - Compose local com frontend, backend e PostgreSQL

A infraestrutura local inicial usa Docker Compose com `frontend`, `backend` e `db`, healthchecks e volumes nomeados. Servicos futuros entram apenas em fases posteriores.

Status: decidida.

## DEC-INFRA-002 - Frontend containerizado para desenvolvimento local fullstack

O frontend passa a ter `frontend/Dockerfile.dev` dedicado, usando Node.js 20 e `npm install` com `package-lock.json`. O servidor Vite roda em `0.0.0.0:5173` para permitir acesso via Docker Compose e navegador local.

Status: decidida.

## DEC-INFRA-003 - Compose dev sobe frontend, backend e db em API mode

O Compose de desenvolvimento passa a construir o frontend pelo Dockerfile dev, aguardar backend healthy quando possivel e usar `VITE_USE_MOCKS=false` por padrao em `frontend/.env.example`, mantendo a possibilidade de alternar para mocks por variavel de ambiente local.

Status: decidida.

## DEC-INFRA-004 - Frontend healthcheck estatico via health.html

O frontend expoe `frontend/public/health.html` como healthcheck simples para desenvolvimento e imagem estatica de producao. O smoke local e os healthchecks de Compose podem validar esse arquivo sem depender de rotas autenticadas.

Status: decidida.

## DEC-INFRA-005 - Producao frontend usa build estatico com Nginx

O `frontend/Dockerfile.prod` e estrutural nesta fase e gera artefatos estaticos via Vite, servidos por Nginx com fallback de SPA. Variaveis publicas `VITE_*` sao aplicadas em build time.

Status: decidida.

## DEC-008 - Proxima fase tecnica

Apos arquitetura e fundacao backend/API/banco/infra, as proximas fases devem detalhar seguranca final, integracao do frontend com API real e runtime de IA em servico separado.

Status: decidida.

## DEC-ARCH-001 - Orchestra como control plane e runtime separado

Orchestra deve atuar como control plane corporativo. A execucao de agent runs, model calls, RAG, tool calls, streaming e traces deve ficar em runtime de IA separado ou servico executor dedicado.

Status: decidida.

## DEC-ARCH-002 - Backend como autoridade de permissoes e governanca

O backend deve ser a fonte de verdade para usuarios, sessoes, tenants, workspaces, roles, permissoes, publicacao, versionamento, auditoria e governanca.

Status: decidida.

## DEC-ARCH-003 - PostgreSQL e Prisma como base de persistencia

PostgreSQL + Prisma sao a base recomendada para persistencia inicial, migrations, tipagem e modelagem incremental do backend.

Status: recomendada.

## DEC-ARCH-004 - REST para gestao e SSE para streaming de IA

REST + JSON deve ser usado para gestao/configuracao. SSE deve ser usado como estrategia inicial de streaming de eventos de IA.

Status: decidida.

## DEC-ARCH-005 - Tenant e workspace desde o MVP

`tenant_id` e `workspace_id` devem ser considerados desde o MVP para reduzir retrabalho em isolamento, sharing, permissoes e auditoria.

Status: decidida.

## DEC-ARCH-006 - Secrets apenas no backend ou ambiente seguro

Credenciais de IA, embeddings, runtime, MCP, vector store e integracoes nao devem ser expostas ao frontend.

Status: decidida.

## DEC-ARCH-007 - Publicacao de assistant via versionamento

Assistentes publicados devem depender de versoes imutaveis e auditaveis, permitindo reproducibilidade e rollback.

Status: decidida.

## DEC-ARCH-008 - Tool calls sensiveis com policy e aprovacao humana

Tools de risco devem ser controladas por allowlist, policy, escopo de permissao e aprovacao humana quando aplicavel.

Status: recomendada.

## DEC-ARCH-009 - Observabilidade de IA desde o boundary de runtime

Agent runs, RAG, tools, tokens, custos, fallbacks, erros e feedback devem gerar eventos e metricas correlacionadas.

Status: recomendada.

## DEC-ARCH-010 - Infraestrutura inicial simples

O MVP inicial deve priorizar `frontend`, `backend` e `db`. Redis, workers, vector store e servicos MCP dedicados devem entrar apenas com justificativa e fase clara.

Status: decidida.

## DEC-AUTH-001 - Integracao frontend usa cookie HttpOnly e credentials include

O frontend em modo API real usa `withCredentials: true` para consumir a sessao HttpOnly emitida pelo backend. Tokens nao devem ser persistidos em `localStorage`.

Status: decidida.

## DEC-AUTH-002 - Dev-login permanece restrito a ambiente nao produtivo

O `POST /api/v1/auth/dev-login` continua disponivel para desenvolvimento local e bloqueado em producao. Ele nao substitui SSO corporativo.

Status: decidida.

## DEC-FE-API-001 - Frontend mantem modo mock/API via VITE_USE_MOCKS

O frontend preserva mocks com `VITE_USE_MOCKS=true` e usa a API real com `VITE_USE_MOCKS=false`. A migracao ocorre service por service.

Status: decidida.

## DEC-DOMAIN-001 - Core domain prioriza tenants, workspaces, users, roles, permissions e assistants

A Fase 05 prioriza o control plane fundacional. Runtime de IA, RAG, MCP, providers externos e streaming permanecem fora do escopo.

Status: decidida.

## DEC-SSO-001 - Microsoft SSO preparado como integracao backend-side futura

As variaveis e a documentacao de Microsoft SSO foram preparadas para uma fase posterior. O client secret deve permanecer somente no backend ou em secret manager.

Status: decidida.

## DEC-AUDIT-001 - Acoes criticas do core domain geram audit log

Alteracoes em tenants, workspaces, users, roles, permissoes, assistants, versions, publication e sharing devem registrar eventos de auditoria com tenant, ator e request id quando disponiveis.

Status: decidida.

## DEC-ASST-001 - Publicacao aponta para versao especifica do assistant

Publicacoes de assistant devem usar `AssistantPublication` dedicada e apontar para `AssistantVersion`. A versao ativa para uso futuro de runtime deve ser lida pela publicacao ativa, nao apenas pelo status do assistant.

Status: decidida.

## DEC-ASST-002 - Alteracoes em assistant publicado exigem nova versao

Alteracoes de configuracao feitas pelo frontend em modo API real criam nova versao draft antes de nova publicacao. O objetivo e preservar rastreabilidade e evitar sobrescrita silenciosa da versao publicada.

Status: decidida.

## DEC-ASST-003 - Rollback preserva historico

Rollback nao apaga publicacoes anteriores. A publicacao ativa corrente e inativada, e uma nova publicacao ativa e criada apontando para a versao restaurada.

Status: decidida.

## DEC-ASST-004 - Feedback pode existir antes do runtime real

Feedback pode ser registrado por assistant e, opcionalmente, por versao antes da existencia do runtime/chat real. Esse registro prepara metricas e governanca futuras sem acionar provedores de IA.

Status: decidida.

## DEC-ASST-005 - Test results manuais antecipam avaliacoes futuras

Resultados de teste manuais/simulados sao persistidos por assistant e versao para criar a base de avaliacoes futuras. Nenhum teste desta fase chama runtime, RAG, MCP ou provider real.

Status: decidida.

## DEC-SEC-ASSISTANTS-001 - Publicacao e rollback exigem permissao server-side

Publicacao, despublicacao, rollback, arquivamento, restauracao, feedback e test results devem ser autorizados no backend por permissao e policy de dominio. O frontend apenas ajusta a experiencia visual.

Status: decidida.

## DEC-GOV-001 - Approval request como entidade auditavel para acoes sensiveis

Approvals de assistant devem ser persistidos em entidade propria, com tenant, workspace, requester, decision maker, action, status, motivos e metadata sanitizada. Isso preserva historico antes de workflows multi-etapas mais avancados.

Status: decidida.

## DEC-GOV-002 - Execution precheck antes de runtime real de IA

Antes de qualquer runtime real, o control plane deve expor precheck de execucao para informar se um assistant poderia executar em determinado modo e quais bloqueios se aplicam.

Status: decidida.

## DEC-GOV-003 - Sandbox policy preparada antes de providers, RAG e MCP reais

Sandbox deve existir como policy de governanca antes de integracoes reais. Nesta fase, sandbox permanece bloqueando tools externas e providers reais, com logs obrigatorios.

Status: decidida.

## DEC-GOV-004 - Backend como autoridade de approval e execution policy

Frontend pode exibir ou ocultar controles com base nas permissoes da sessao, mas approval, execution policy, sandbox policy e bloqueios continuam validados no backend.

Status: decidida.

## DEC-GOV-005 - Approval workflow simples antes de workflow multi-etapas avancado

O workflow inicial suporta request, approve, reject, cancel, listagem e historico. Separacao avancada de responsabilidades, expiracao automatica e cadeias multi-aprovador ficam para fases posteriores.

Status: decidida.
