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

## DEC-KNOWLEDGE-001 - Knowledge/RAG como catalogo governado antes de runtime

A Fase 06 implementa Knowledge Bases, documentos, data sources, policies, ingestion jobs placeholder e bindings com assistants como estrutura governada. RAG real, embeddings, chunking real e vector store permanecem fora do escopo.

Status: decidida.

## DEC-MCP-001 - MCP como catalogo bloqueado por padrao

MCP servers, tools, resources, prompts, policies e assistant bindings sao persistidos como catalogo governado. A execucao MCP real nao existe nesta fase. Tools nascem com `allowRuntimeExecution=false`, `sandboxOnly=true` e `blockedByDefault=true`.

Status: decidida.

## DEC-MCP-002 - Tools de alto risco exigem approval

Tools MCP com risco `high` ou `critical` devem exigir approval e nao podem receber override que remova essa exigencia. Bindings MCP usam `sandbox_only` por padrao.

Status: decidida.

## DEC-SEC-001 - Catalogo rejeita secrets em JSON e templates

Metadados, configs, schemas e templates de catalogo nao devem conter secrets, tokens, passwords, api keys, authorization headers ou equivalentes. A validacao Zod bloqueia essas chaves antes da persistencia.

Status: decidida.

## DEC-FE-API-002 - Knowledge/MCP preserva modo mock e usa API real por service

O frontend da Fase 06 integra Knowledge/MCP em API mode por services e TanStack Query, mantendo fallback mock via `VITE_USE_MOCKS=true` e sem adicionar providers, runtime, upload binario ou execucao MCP.

Status: decidida.

## DEC-KNOW-ING-001 - Ingestao local sincrona antes de workers reais

A Fase 06B usa ingestao local sincrona e controlada para `contentText`, com `KnowledgeIngestionJob` e eventos estruturados. Falhas validaveis, como ausencia de texto simples, tambem geram job `failed` e erro persistido no documento antes de retornar `422`. Workers, filas e conectores reais ficam para fase posterior.

Status: decidida.

## DEC-KNOW-ING-002 - Chunking textual local antes de embeddings e vector store

O backend cria `KnowledgeChunk` por algoritmo deterministico baseado em caracteres e paragrafos. Nao ha embeddings, vetores, pgvector ou vector database nesta fase.

Status: decidida.

## DEC-KNOW-ING-003 - Source references antes de citacoes reais em runtime

Cada chunk recebe `KnowledgeSourceReference` com label, URI e offsets simples para preparar citacoes futuras sem depender de parser robusto ou runtime de IA.

Status: decidida.

## DEC-RAG-READY-001 - RAG readiness sem retrieval semantico real

O endpoint de readiness retorna bases vinculadas, documentos ingeridos e chunks ativos em modo `local_chunks_only`. A busca local opcional e keyword-based e nao representa retrieval semantico.

Status: decidida.

## DEC-RAG-002 - RAG query local antes de embeddings e vector store

A Fase 06C implementa `POST /api/v1/assistants/:id/rag/query` com retrieval local deterministico por keyword antes de embeddings, vector store ou retrieval semantico. O objetivo e validar escopo, permissoes, readiness, citations e auditoria dentro do control plane.

Status: decidida.

## DEC-RAG-003 - Citations baseadas em KnowledgeChunk e SourceReference

As fontes retornadas por RAG query usam `KnowledgeChunk` como evidencia textual e `KnowledgeSourceReference` como referencia rastreavel. O response expoe `citationLabel`, ids, excerpt limitado, titulo do documento e URI de fonte quando disponivel.

Status: decidida.

## DEC-RAG-004 - Query e resultados persistidos para rastreabilidade

Toda tentativa de query RAG local cria `RagQuery`, inclusive bloqueios e no results. Fontes retornadas criam `RagQueryResult` com rank, score, match type, excerpt limitado e ids de fonte para auditoria posterior.

Status: decidida.

## DEC-RAG-005 - Retrieval local limitado e nao semantico nesta fase

O score atual e deterministico e baseado em matches de titulo, conteudo e metadata de fonte. Ele nao deve ser interpretado como relevancia semantica e nao substitui embeddings, reranking ou vector search.

Status: decidida.

## DEC-RUNTIME-002 - Contrato RAG preparado para runtime futuro

`RagQuery` possui correlacao opcional com `AgentRun`, request id e trace id. Um runtime futuro podera usar `ragQueryId` em eventos e respostas, preservando o backend como autoridade de fontes, escopo e auditoria.

Status: decidida.

## DEC-SEC-KNOW-001 - Conteudo bruto fora dos audit logs

`contentText` e conteudo de chunks nao devem ser gravados em audit logs. Auditoria registra ids, contadores, status, estrategia e erros sanitizados.

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

## DEC-RUN-001 - AgentRun como registro auditavel de execucao

Toda tentativa de execucao de assistant deve criar `AgentRun` com tenant, workspace, requester, modo, status, request id, trace id, snapshot de precheck e eventos ordenados.

Status: decidida.

## DEC-RUN-002 - Precheck bloqueante antes do runtime boundary

O backend deve executar precheck obrigatorio antes de acionar qualquer runtime boundary. Quando o precheck bloqueia, o sistema ainda cria um run `blocked` para preservar rastreabilidade.

Status: decidida.

## DEC-RUN-003 - Runtime fake ate existir executor real

A Fase 05E usa `FakeRuntimeAdapter`. Ele nao chama providers externos, tools externas, RAG ou streaming, e retorna eventos controlados para validar contratos observaveis.

Status: decidida.

## DEC-RUN-004 - Eventos persistidos antes de streaming

Eventos de run devem ser persistidos em `agent_run_events` com `sequence` por run. REST expoe a timeline agora; SSE fica reservado para fase futura.

Status: decidida.

## DEC-RUN-005 - Cancelamento apenas para status nao terminal

Cancelamento e aceito somente para `queued`, `prechecking` e `running`. Runs `blocked`, `completed`, `failed` e `cancelled` retornam conflito de dominio.

Status: decidida.

## DEC-RUN-006 - Metadata de run deve ser sanitizada

Metadata e logs de `AgentRun` nao devem persistir prompts completos, conteudo sensivel, credentials, tokens, passwords, authorization headers ou api keys. O backend guarda resumo da entrada e ids tecnicos.

Status: decidida.

## DEC-FE-001 - Lazy loading por rota para reduzir chunk inicial

O frontend passa a carregar paginas de rota com `React.lazy` e `Suspense`, mantendo providers, layouts e guards principais estaticos. A decisao reduziu o maior chunk JS de aproximadamente `1,189.87 kB` para `383.98 kB` e removeu o alerta Vite de chunk acima de `500 kB`.

Status: decidida.

## DEC-FE-002 - Nao aplicar upgrade major automatico de Vite na Fase 05F

O advisory moderado de Vite/esbuild exige `npm audit fix --force`, que instalaria `vite@8.0.16`. A Fase 05F nao aplica esse salto major porque o audit de nivel alto passa e o upgrade de toolchain precisa de fase propria com matriz de regressao.

Status: decidida.

## DEC-FE-003 - UI primitives devem evitar exports mistos desnecessarios

Primitives React usados pelo frontend devem exportar componentes a partir dos arquivos de componente. Helpers como variants podem viver em arquivos dedicados quando forem consumidos externamente, reduzindo warnings de Fast Refresh sem refactor visual amplo.

Status: decidida.

## DEC-MCP-EXEC-001 - MCP execution comeca como sandbox local sem chamadas externas

A execucao MCP da Fase 06D e local, deterministica e simulada. O backend nao chama MCP server externo, provider real, runtime real ou servico de IA real nesta fase.

Status: decidida.

## DEC-MCP-EXEC-002 - Tool calls persistem eventos e policy snapshot

As tentativas de execucao MCP usam `McpToolCall` e `McpToolCallEvent` dedicados. Cada registro inclui status, risk snapshot, approval snapshot, request id, trace id, previews limitados e `policySnapshot` sanitizado.

Status: decidida.

## DEC-MCP-EXEC-003 - Tools high e critical exigem approval ou bloqueio controlado

Tools MCP com risk `high` ou `critical`, ou configuradas com `requiresApproval`, nao executam automaticamente no sandbox. O resultado governado e `approval_required`, salvo quando outra policy bloquear primeiro.

Status: decidida.

## DEC-MCP-EXEC-004 - Payload bruto nao e persistido em audit/tool call history

Audit logs e historico de tool calls nao armazenam input ou output bruto completo. O backend persiste apenas hash, previews truncados, IDs, reasons, status, duration e metadados sanitizados.

Status: decidida.

## DEC-MCP-EXEC-005 - AgentRun pode vincular tool calls sem executar runtime real

`agentRunId` e opcional em MCP tool calls. Quando informado e valido, a tool call registra eventos correspondentes em `AgentRunEvent`; isso cria correlacao de controle sem acoplar o Orchestra a runtime real.

Status: decidida.
