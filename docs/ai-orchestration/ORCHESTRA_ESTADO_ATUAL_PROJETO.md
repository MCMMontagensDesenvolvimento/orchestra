# Documentação Técnica do Estado Atual do Projeto Orchestra

> Auditoria técnica baseada no repositório local em 17 de julho de 2026, branch `fase-16l-documentacao-estado-atual-projeto`, commit-base `bc69d06`. O documento diferencia implementação confirmada, comportamento parcial, simulação, ausência e recomendação. Nenhum ambiente externo, segredo ou banco foi inspecionado ou alterado.

> Atualização de 20 de julho de 2026: as fases 16M–16R superaram parte das lacunas registradas nesta fotografia. A 16Q adicionou uma integração MCP/HTTP real somente contra o demo local fictício; a 16R acrescenta uma homologação E2E opt-in e provider-free que combina AgentRun, RAG governado, Agno stub, gateway e MCP demo, mantendo conectores externos/corporativos e produção fail-closed. O runbook vigente é `ORCHESTRA_E2E_CHAT_RAG_MCP_READONLY_16R.md`.

> Atualização de 21 de julho de 2026: a 16S consolidou evals contínuas offline de qualidade/segurança; a 16T implementou o boundary governado para a única tool corporativa read-only `corporate.status.read`, sem configurar ou chamar endpoint real; e a 16U prepara a janela de homologação supervisionada com preflight sem rede, readiness acompanhada, uma única execução manual, auditoria allowlistada e rollback. Endpoint e segredo reais não ficam no Git, nenhuma chamada real é automática e todos os defaults permanecem fail-closed. O runbook vigente é `ORCHESTRA_HOMOLOGACAO_SUPERVISIONADA_CONECTOR_READONLY_16U.md`.

> Atualização de 22 de julho de 2026: a 16V cria no backend do Orchestra os alvos seguros `GET /v1/status` e `GET /v1/status/availability`, com payload estrito `status`, `summary` e `updatedAt`. `/health` é preservado, Prisma não muda e nenhum MCP real é executado. A primeira chamada real supervisionada fica para a 16W. O runbook vigente é `ORCHESTRA_ENDPOINT_STATUS_READONLY_16V.md`.

> Atualização de 23 de julho de 2026: a 16W prepara a primeira execução supervisionada de `corporate.status.read`, com harness offline, local-check e SQL allowlistado. Foi adotada a Opção C: não há exceção HTTP corporativa nem `--run-once-local`, pois o transporte exige HTTPS/egress público e o contrato da 16V ainda difere do esperado pelo adapter 16T. Nenhuma chamada real ocorreu; a execução única exige ambiente HTTPS homologado. O runbook vigente é `ORCHESTRA_PRIMEIRA_EXECUCAO_REAL_TOOL_STATUS_16W.md`.

> Atualização de 23 de julho de 2026 — 16X: o adapter de `corporate.status.read` agora aceita estritamente o contrato 16V (`ok|degraded`, `summary`, `updatedAt`) e normaliza o `/health` legado sem propagar `service` ou `requestId`. O alinhamento funcional não libera HTTP/loopback, não configura origem ou secret, não altera Prisma e não associa MCP a Assistant. Não houve nenhuma chamada real; UI/CRUD MCP e teste visual permanecem para fase posterior. O runbook vigente é `ORCHESTRA_ALINHAMENTO_TOOL_STATUS_ENDPOINT_16X.md`.

> Atualização de 23 de julho de 2026 — 16Y: a readiness HTTPS fixa o backend/API `https://api.orchestra.mcm.eng.br` como origem futura, valida offline origem/allowlists, paths, contrato e referência lógica, e fornece templates HTTPS/audit sem executá-los. A 16Y não executa chamada real, não testa UI/CRUD MCP e não altera Prisma. A 16Z recebe o handoff como preparação de publicação, não como autorização de execução. O runbook vigente é `ORCHESTRA_READINESS_HTTPS_TOOL_STATUS_16Y.md`.

> Atualização de 23 de julho de 2026 — 16Z: o projeto continua totalmente local. A fase documenta a futura topologia HTTPS de frontend e backend/API, DNS, TLS, proxy, Compose, environment, secrets, CORS/cookies, health/readiness e rollback, com preflight e smoke offline. As URLs planejadas `https://orchestra.mcm.eng.br` e `https://api.orchestra.mcm.eng.br` não estão ativas. A 16Z não publica, não executa chamada real, não executa MCP real, mantém UI/CRUD MCP fora de escopo e deixa a primeira execução da tool para depois da publicação e validação da API. O runbook vigente é `ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md`.

> Atualização de 23 de julho de 2026 — 17A: o projeto permanece totalmente local e o deploy real ainda não ocorreu. A fase transforma a preparação 16Z em um plano operacional homologado Local → HTTPS, com responsáveis, pré-requisitos, decisão go/no-go, janela, checklists de infraestrutura/aplicação/dados/segurança, evidências e rollback. As URLs continuam planejadas e inativas; CI, preflight e smoke permanecem offline/dry-run, e MCP/corporate continua fail-closed. O runbook vigente é `ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md`.

> Atualização de 23 de julho de 2026 — 17B: os artefatos de produção receberam hardening offline em Compose, Dockerfiles e Nginx, com redes explícitas, exposição mínima, imagem operacional separada, processos não-root, runtime read-only, headers/cache e gates fail-closed. Não houve build/container, deploy, rede, migration, MCP real ou teste UI/CRUD MCP. O ambiente permanece local, as URLs planejadas continuam inativas e a primeira execução real da tool depende de publicação HTTPS futura. O runbook vigente é `ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md`.

> Atualização de 24 de julho de 2026 — 17C: foi criado um inventário offline governado
> e machine-readable de secrets/variáveis de homologação e produção, sem coletar valor
> real e sem criar `.env` real. Nenhum deploy, chamada externa, MCP real ou teste
> UI/CRUD MCP ocorreu. As URLs permanecem planejadas/inativas e não foram
> materializadas em env examples, Compose ou CI. A primeira execução real da tool
> continua dependente de publicação HTTPS futura e de aviso ao usuário. O runbook
> vigente é `ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md`.

> Atualização de 27 de julho de 2026 — 17D: o estado versionado foi consolidado como
> candidato de release homologável por runbook, manifesto JSON e gates offline. A 17D é
> preflight, não deploy: o ambiente segue local, nenhum valor real foi coletado, nenhum
> `.env` real foi criado e as URLs continuam planejadas/inativas, somente documentais.
> Não houve chamada real, provider externo, MCP/tool real ou teste UI/CRUD MCP; nenhum
> endpoint/secret foi materializado em env examples, Compose, CI ou código funcional.
> A primeira execução real da tool depende de publicação HTTPS futura, e o usuário será
> avisado antes do teste direto na tela. Estado: `releasePreflightReady=true`,
> `deployGo=false`. O runbook vigente é
> `ORCHESTRA_PREFLIGHT_RELEASE_HOMOLOGAVEL_17D.md`.

## 0. Resumo Executivo

O Orchestra é hoje um **control plane corporativo de IA em estágio de MVP técnico avançado / homologação local**, com frontend React, API Express, persistência PostgreSQL/Prisma, governança de assistentes, conversas persistentes, `AgentRun`, Knowledge/RAG, catálogo MCP, auditoria, observabilidade técnica, avaliações determinísticas e um bridge Python/Agno executável por HTTP. O projeto já ultrapassou a condição de protótipo puramente visual: os principais domínios têm rotas, serviços, repositórios, modelos Prisma e testes reais. Evidências centrais: `frontend/src/App.tsx`, `backend/src/app/routes.ts`, `backend/prisma/schema.prisma`, `backend/src/modules/agent-runs`, `backend/src/modules/knowledge`, `backend/src/modules/runtime` e `runtime/agno-bridge`.

A trilha recente consolidou contexto conversacional, provider externo governado, observabilidade de Chat, execução por `agno_http`, RAG resolvido pelo control plane, descriptors de tools, autenticação do canal de runtime, gateway sandbox, bridge Agno em Docker, Knowledge/RAG operacional e política de escopo de resposta. A matriz Chat/RAG está codificada em testes e smokes estáticos. Evidências: documentos 15D–16K em `docs/ai-orchestration`, `backend/tests/api/agent-runs.test.ts`, `scripts/smoke-chat-rag-operacional-16k.sh` e `scripts/smoke-knowledge-rag-16i.sh`.

A maturidade não é ainda de produto operacional pleno. Os maiores limitadores são:

- execução MCP externa ainda não implementada; o sandbox e o gateway retornam resultado simulado e registram `externalMcpCalled=false` (`backend/src/modules/mcp/mcp.service.ts`, `backend/src/modules/runtime/runtime.tool-gateway.service.ts`, `backend/src/modules/mcp/remote/mcp-remote.client.ts`);
- observabilidade existente principalmente em tabelas, APIs, metadata, testes, SQL e runbooks, sem console operacional dedicado no frontend (`backend/src/modules/ai-observability`, `frontend/src/services/analytics.service.ts`, `frontend/src/pages/Analytics/AnalyticsPage.tsx`);
- ações visuais ainda locais ou placeholder, especialmente sincronização/credenciais/health MCP, reindexação global de Knowledge, duplicação de Assistant, edição/diff de prompt compilado e feedback de mensagem (`frontend/src/pages/MCP`, `frontend/src/pages/Knowledge`, `frontend/src/pages/Assistants`, `frontend/src/components/chat/FeedbackBar.tsx`);
- perfil de produção endurecido estaticamente, mas ainda não homologado live: CI de validação existe e a 17B adiciona bridge/profile operacional, pgvector, proxy relativo, imagens não-root e migration one-shot, porém não há CD, secret manager, TLS/ingress, backup/restore ou build/deploy comprovado (`.github/workflows/ci.yml`, `docker-compose.prod.yml`, `frontend/nginx.conf`, `backend/Dockerfile.prod`);
- segurança de produção pendente de hardening: segredo JWT possui fallback de desenvolvimento no código, o modelo `Session` não é usado pelo fluxo JWT atual, não há evidência versionada de secrets manager, rotação central, TLS/ingress ou revogação de sessão server-side (`backend/src/config/env.ts`, `backend/src/shared/security/session.ts`, `backend/prisma/schema.prisma`);
- limites/custos e alertas existem como domínio e endpoints de avaliação, mas não foram encontrados no precheck do `AgentRun`; o registro de uso não encaminha custo normalizado para `AiRunUsageEvent` (`backend/src/modules/ai-observability`, `backend/src/modules/agent-runs/agent-runs.service.ts`).

Recomendação principal: manter Chat/RAG/Agno como baseline homologada, iniciar a próxima frente por **observabilidade operacional visual e controle de custo**, em paralelo ao hardening de produção; só depois ampliar MCP externo. Isso reduz o risco de executar integrações com efeito externo antes de existir visão de operação, rate limits, aprovação, resposta a incidentes e rollback comprovados.

## 1. State Audit Blueprint

```yaml
state_audit_blueprint:
  project_name: "Orchestra"
  source_type: "Projeto local / GitHub"
  project_status: "Ativo; baseline Chat/RAG/Agno homologada localmente e em evolução"
  maturity_level: "MVP técnico avançado / pré-produção"
  analysis_depth: "Profundo"
  frontend_status: "Funcional em API real nos domínios principais; UX híbrida com ações locais e áreas ainda sem API consolidada"
  backend_status: "API real ampla, modular e persistente; integrações externas e enforcement operacional ainda parciais"
  database_status: "Schema Prisma e 21 migrations versionadas; pgvector presente no desenvolvimento e incompatibilidade no perfil de produção a resolver"
  api_status: "REST /api/v1 implementada; sem especificação OpenAPI versionada"
  auth_status: "JWT em cookie, RBAC e Microsoft SSO condicional implementados; revogação server-side e hardening produtivo pendentes"
  mock_level: "Médio; opt-in no frontend e presente em runtime, embeddings, tools e dados de demonstração"
  hardcoded_level: "Médio; heurísticas de intenção, métricas de protótipo e algumas ações de UI permanecem codificadas"
  repository_standard_status: "Parcial; organização forte, lockfiles e CI de validação presentes, mas README raiz e CD ainda pendentes"
  ai_detected: "Sim"
  ai_orchestration_detected: "Sim; control plane, AgentRun, Agno HTTP, RAG e descriptors de tools"
  package_manager_detected: "npm com package-lock.json separado em frontend e backend"
  package_manager_compliant: "Sim"
  backend_readiness: "Apto para desenvolvimento e homologação local controlada"
  production_readiness: "Não pronto sem hardening de infraestrutura, segurança, observabilidade, custos e integrações"
  critical_risks:
    - "Perfil de produção não fecha pgvector, migrations, proxy da API e runtime Agno de forma versionada"
    - "MCP externo não executa; gateways atuais são sandbox/simulação"
    - "JWT pode assumir fallback inseguro se o ambiente produtivo for iniciado sem configuração deliberada"
    - "Limites de uso, custos e alertas não estão comprovadamente no caminho de enforcement do AgentRun"
    - "Não há suíte E2E de navegador nem pipeline de entrega/deploy versionado"
  main_recommendation: "Priorizar observabilidade operacional e hardening produtivo antes de liberar MCP/tools externos"
```

## 2. Linha do Tempo Técnica Consolidada

O status “documentado/homologado” abaixo significa que há runbook, smoke ou evidência histórica versionada; não significa que credenciais ou serviços externos tenham sido reexecutados nesta auditoria.

| Fase | Entrega | Status atual | Evidências | Validações e observações |
|---|---|---|---|---|
| 15D | Contexto conversacional governado | Implementado | `backend/src/modules/chat-conversations/chat-conversation-context.ts`, `backend/src/modules/runtime/runtime.context.ts`, `docs/ai-orchestration/ORCHESTRA_CHAT_CONTEXTO_CONVERSACIONAL_15D.md` | Limites, truncamento, sanitização e testes em `backend/tests/unit/chat-conversation-context.test.ts` |
| 15E | Homologação funcional do contexto | Documentado/homologado | `docs/ai-orchestration/ORCHESTRA_CHAT_HOMOLOGACAO_CONTEXTO_15E.md`, `scripts/smoke-chat-contexto-15e.sh` | Runbook e smoke local; não reexecutado nesta auditoria |
| 15F | Provider externo governado no Chat | Implementado com opt-in | `backend/src/modules/llm/providers/openai-llm-provider.ts`, `backend/src/modules/runtime/runtime.local-adapter.ts`, `docs/ai-orchestration/ORCHESTRA_CHAT_PROVIDER_EXTERNO_GOVERNADO_15F.md` | Testes usam clientes injetados/fakes; execução real depende de flags, policy e credencial |
| 15G | Observabilidade governada no Chat | Implementado parcialmente no produto | `frontend/src/lib/agent-run-llm-metadata.ts`, `frontend/src/pages/Chat/ChatPage.tsx`, `docs/ai-orchestration/ORCHESTRA_CHAT_OBSERVABILIDADE_GOVERNADA_15G.md` | Exibe allowlist técnica por run/evento; ainda não é console operacional agregado |
| 15H | Homologação com provider real | Documentado/homologado | `docs/ai-orchestration/ORCHESTRA_CHAT_HOMOLOGACAO_PROVIDER_REAL_15H.md`, `scripts/smoke-chat-provider-real-15h.sh` | Preflight seguro versionado; credencial/provider atual pendente de confirmação |
| 15I | Consolidação do Chat governado | Handoff concluído | `docs/ai-orchestration/ORCHESTRA_CHAT_GOVERNADO_HANDOFF_15I.md` | Consolida 15C–15H e registra riscos da época |
| 16A | Agno como executor LLM do Chat | Implementado | `backend/src/modules/runtime/runtime.agno-http-adapter.ts`, `backend/src/modules/runtime/runtime.assistant-spec.builder.ts`, `docs/ai-orchestration/ORCHESTRA_AGNO_LLM_REAL_CHAT_16A.md` | Fluxo real exige `RUNTIME_PROVIDER=agno_http` e configuração explícita |
| 16B | RAG governado via Agno | Implementado | `backend/src/modules/agent-runs/agent-runs.service.ts`, `backend/src/modules/runtime/runtime.context.ts`, `docs/ai-orchestration/ORCHESTRA_AGNO_RAG_GOVERNADO_CHAT_16B.md` | Retrieval ocorre no Orchestra; runtime recebe contexto já resolvido e limitado |
| 16C | MCP/tools governados no Chat | Parcial | `backend/src/modules/runtime/runtime.assistant-spec.builder.ts`, `backend/tests/runtime/runtime-mcp-governed-context.test.ts`, `docs/ai-orchestration/ORCHESTRA_AGNO_MCP_TOOLS_GOVERNADOS_CHAT_16C.md` | Descriptors governados são reais; execução MCP externa continua fora do fluxo |
| 16D | Segurança do canal Agno HTTP | Implementado | `backend/src/config/agno-runtime-http-security.ts`, `backend/src/modules/runtime/runtime.agno-http-client.ts`, `scripts/smoke-agno-runtime-security-16d.sh` | Bearer, URL sanitizada, timeout e configuração fail-closed; TLS/ingress externo pendente de confirmação |
| 16E | Homologação segura com Agno real | Documentado/homologado | `docs/ai-orchestration/ORCHESTRA_AGNO_REAL_HOMOLOGACAO_SEGURA_16E.md`, `scripts/smoke-agno-real-16e.sh` | Runbook de evidências permitidas e rollback; ambiente real não revalidado nesta auditoria |
| 16F | Gateway governado de tool execution | Implementado como sandbox simulado | `backend/src/modules/runtime/runtime.tool-gateway.service.ts`, `backend/tests/runtime/runtime-tool-gateway.test.ts`, `docs/ai-orchestration/ORCHESTRA_AGNO_TOOL_GATEWAY_GOVERNADO_16F.md` | Revalida run/spec/tool/policy e persiste eventos; resposta marca `simulated=true` e `externalMcpCalled=false` |
| 16G | Demo local ponta a ponta | Runbook concluído | `docs/ai-orchestration/ORCHESTRA_AGNO_DEMO_LOCAL_PONTA_A_PONTA_16G.md`, `scripts/smoke-agno-demo-local-16g.sh` | Roteiro operacional; não é automação de produção |
| 16H | Bridge Agno real em Docker | Implementado | `runtime/agno-bridge`, `docker-compose.agno-bridge.yml`, `scripts/smoke-agno-bridge-docker-16h.sh` | Modos `stub` e `real`; testes Python offline e testes de contrato Docker |
| 16I | Knowledge/RAG operacional avançado | Implementado | `backend/src/modules/knowledge`, `backend/src/modules/embeddings`, `frontend/src/pages/Knowledge/KnowledgeDetailPage.tsx`, `docs/ai-orchestration/ORCHESTRA_KNOWLEDGE_RAG_OPERACIONAL_16I.md` | Upload TXT/MD/CSV, ingestão, embeddings opcionais, readiness e retrieval keyword/semantic/hybrid |
| 16I.1 | UI/policy/actions de embeddings e RAG | Implementado | `frontend/src/hooks/queries/useKnowledge.ts`, `frontend/src/services/knowledge.service.ts`, rotas de policy/embeddings em `backend/src/modules/knowledge/knowledge.routes.ts` | Ações reais para policy e embeddings; conectores de data source ainda catálogo |
| 16I.2 | Correção de grounding/ranking híbrido offline | Implementado | `backend/src/modules/knowledge/knowledge.service.ts`, `backend/src/modules/knowledge/knowledge.repository.ts`, `scripts/smoke-knowledge-rag-16i.sh` | Modo `hybrid_stub_keyword_priority` impede o stub semântico de superar prioridade lexical |
| 16J | Política governada de escopo de resposta | Implementado | `backend/src/shared/policies/response-scope.ts`, migration `20260716160000_phase_16j_answer_scope_policy`, seletor em `frontend/src/pages/Assistants/AssistantDetailPage.tsx` | Persistida em metadata da execution policy; default `knowledge_first` |
| 16J.1 | Detector de consultas não gerais com base vinculada | Implementado com heurística | `backend/src/modules/agent-runs/agent-runs.service.ts`, `backend/tests/api/agent-runs.test.ts` | Razão `non_general_query_with_knowledge_bindings`; regras linguísticas codificadas exigem evals contínuas |
| 16K | Homologação operacional Chat/RAG | Documentado e automatizado | `docs/ai-orchestration/ORCHESTRA_CHAT_RAG_HOMOLOGACAO_OPERACIONAL_16K.md`, `scripts/smoke-chat-rag-operacional-16k.sh`, `backend/tests/api/agent-runs.test.ts` | Dry-run desta auditoria: 34 verificações aprovadas; a matriz possui oito cenários automatizados |
| 16M–16Q | Observabilidade, custos, hardening e MCP demo real read-only | Implementado/homologado | runbooks e smokes 16M–16Q, `runtime/mcp-readonly-demo`, `docker-compose.mcp-readonly-demo.yml` | Defaults produtivos continuam fechados; a chamada real existe somente para o demo local allowlisted |
| 16R | Homologação E2E Chat/RAG/MCP read-only | Implementado como harness local opt-in | `docs/ai-orchestration/ORCHESTRA_E2E_CHAT_RAG_MCP_READONLY_16R.md`, `scripts/homologacao-e2e-chat-rag-mcp-16r.sh`, `scripts/smoke-e2e-chat-rag-mcp-16r.sh`, `runtime/e2e-fixtures/16r` | Mesmo AgentRun deve provar RAG resolvido e MCP HTTP real; Agno permanece stub, sem provider externo; policy MCP abre apenas por passo local explícito |
| 16S–16U | Evals, boundary corporativo e homologação supervisionada | Implementado/documentado, fail-closed | runbooks e smokes 16S–16U, `backend/src/modules/mcp/remote/corporate-readonly` | Nenhuma chamada corporativa real foi executada; endpoint e segredo reais permanecem fora do Git |
| 16V | Endpoints operacionais read-only | Implementado localmente | `backend/src/modules/status`, `backend/tests/api/status.test.ts`, `scripts/smoke-endpoint-status-readonly-16v.sh` | Cria o alvo seguro; payload sanitizado, sem banco/provider/MCP; chamada real fica para 16W |
| 16W | Preparação da primeira execução da tool de status | Harness offline, Opção C | `ORCHESTRA_PRIMEIRA_EXECUCAO_REAL_TOOL_STATUS_16W.md`, scripts 16W | Sem execução real; HTTP local inelegível, contrato a reconciliar e HTTPS homologado pendente |
| 16X | Alinhamento tool/status 16V | Implementado e testado offline | `corporate-readonly.transport.ts`, teste unitário, runbook e smoke 16X | Contrato reconciliado; nenhuma chamada real, origem HTTPS e validação visual ainda pendentes |
| 16Y | Readiness HTTPS da tool de status | Implementado como preflight offline | `ORCHESTRA_READINESS_HTTPS_TOOL_STATUS_16Y.md`, scripts 16Y e CI dry-run | Origem API e templates fixos; sem rede/MCP real; handoff para preparação 16Z |
| 16Z | Preparação da publicação HTTPS | Documentado e validado offline | `ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md`, preflight/smoke 16Z e CI dry-run | Ambiente local; DNS/TLS/deploy não executados; MCP/corporate fail-closed |
| 17A | Plano de deploy homologado Local → HTTPS | Documentado e validado offline | `ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md`, preflight/smoke 17A e CI dry-run | Plano operacional; deploy real não ocorreu, URLs inativas e MCP/corporate fail-closed |
| 17B | Hardening de Compose, imagens e Nginx | Implementado e validado estaticamente | `ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md`, preflight/smoke 17B e CI dry-run | Sem build/deploy/rede; URLs inativas, providers fechados e UI/CRUD MCP fora de escopo |
| 17C | Inventário de secrets e variáveis | Documentado e validado offline | `ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md`, inventário JSON, preflight/smoke 17C e CI dry-run | Sem valores reais ou `.env`; sem deploy/chamada/MCP/UI; URLs apenas planejadas |

## 3. Estrutura do Repositório

| Caminho | Responsabilidade | Status | Evidência | Observações |
|---|---|---|---|---|
| `/frontend` | SPA React, rotas, hooks, services, UI e testes | Real com modo mock opt-in | `frontend/package.json`, `frontend/src/App.tsx`, `frontend/src/lib/env.ts` | Mocks são bloqueados em ambientes classificados como produção; há ações locais remanescentes |
| `/backend` | API REST, governança, persistência, runtime boundary e integrações | Real e modular | `backend/src/app/routes.ts`, `backend/src/modules`, `backend/package.json` | Express 4; execução de runs é síncrona no processo, inferido a partir da implementação atual |
| `/backend/prisma` | Schema, seeds e migrations | Real | `backend/prisma/schema.prisma`, 21 diretórios em `backend/prisma/migrations` | Não foi criada nem aplicada migration nesta auditoria |
| `/runtime/agno-bridge` | Executor HTTP Python usando SDK Agno | Real com modo stub | `runtime/agno-bridge/bridge.py`, `contract.py`, `Dockerfile`, `requirements.txt` | Provider real condicionado a configuração; sem streaming e sem file input |
| `/docs/ai-orchestration` | Handoffs, contratos, homologações e runbooks IA | Amplo | documentos de fases 10–16 e `README.md` | É a principal evidência histórica recente |
| `/docs/*` | Produto, arquitetura, backend, API, database, segurança, operações | Amplo, parcialmente desatualizado | `docs/README.md` e subpastas | `docs/README.md` ainda descreve integrações recentes como futuras |
| `/scripts` | Smokes locais, preflights e validações estáticas | Real | `scripts/smoke-*.sh`, `scripts/agno-mock-runtime.mjs` | Parte dos scripts exige ambiente; os dry-runs não usam provider ou banco |
| `/docker-compose.dev.yml` | Frontend, backend e PostgreSQL/pgvector local | Implementado | serviços `frontend`, `backend`, `db` | Agno não sobe no compose-base; exige override específico |
| `/docker-compose.agno-bridge.yml` | Override com backend apontando para bridge | Implementado para local/homologação | serviço `agno-bridge` | Usa configuração local deliberada; não integra o compose de produção |
| `/docker-compose.prod.yml` | Topologia declarativa de produção e operações | Endurecido offline, não homologado live | `docker-compose.prod.yml`, Dockerfiles `.prod`, `frontend/nginx.conf` | Frontend/backend/db, bridge opt-in e migration opt-in; TLS, secret manager, backup/restore e deploy continuam externos |
| `/.env.example`, `/backend/.env.example`, `/frontend/.env.example`, `/runtime/agno-bridge/.env.example` | Contrato de configuração sem credenciais operacionais | Presente | arquivos versionados | Nomes de variáveis foram auditados; valores reais e arquivos `.env` não foram lidos |
| `/README.md` | Entrada principal do repositório | Desatualizado | `README.md` | Ainda afirma que backend, banco, autenticação, RAG, MCP e runtime não existem |

## 4. Stack Técnica Atual

| Camada | Stack confirmada | Evidência | Estado |
|---|---|---|---|
| Frontend | React 18, TypeScript, Vite 8, React Router, TanStack Query, Axios, Tailwind, Radix/shadcn, Recharts | `frontend/package.json`, `frontend/src/App.tsx` | Operacional; frontend real nos domínios principais |
| Backend | Node.js 20, Express 4, TypeScript, Zod, Pino, Helmet, CORS, rate limit | `backend/package.json`, `backend/src/app/middlewares.ts` | Operacional |
| ORM/banco | Prisma 6, PostgreSQL 16, pgvector | `backend/package.json`, `backend/prisma/schema.prisma`, migration `20260625114000_phase10c_pgvector_chunk_embeddings` | Operacional em desenvolvimento; produção precisa alinhar imagem/extensão |
| Autenticação | JWT assinado em cookie HttpOnly, login de desenvolvimento condicionado e Microsoft SSO/MSAL | `backend/src/modules/auth`, `backend/src/shared/security/session.ts` | Implementado, com hardening produtivo pendente |
| Runtime IA | Adapter local, adapters Agno/Agno HTTP e bridge Python com Agno 2.7.1 | `backend/src/modules/runtime`, `runtime/agno-bridge/requirements.txt` | Local e HTTP implementados; real depende de configuração |
| Providers | Local determinístico; OpenAI no backend local; OpenAI/Azure OpenAI/Anthropic no bridge | `backend/src/modules/llm/providers`, `runtime/agno-bridge/bridge.py` | Governados e opt-in; disponibilidade atual pendente de confirmação |
| Knowledge/RAG | Upload textual, chunking, embeddings disabled/stub/OpenAI, keyword/semantic/hybrid, pgvector, citações | `backend/src/modules/knowledge`, `backend/src/modules/embeddings` | Operacional com limitações de formatos e qualidade |
| MCP/tools | Catálogo, policies, bindings, precheck, sandbox, descriptors e gateway | `backend/src/modules/mcp`, `backend/src/modules/runtime/runtime.tool-gateway.service.ts` | Governança real; chamada externa ausente |
| Testes | Vitest/Supertest, Testing Library, Python `unittest`, smokes Bash | `backend/tests`, `frontend/src/test`, `runtime/agno-bridge/tests`, `/scripts` | Boa cobertura de backend/contratos; E2E navegador ausente |
| Containers | Dockerfiles dev/prod, Compose dev/prod/override Agno, Nginx frontend | arquivos Docker e Compose na raiz | Desenvolvimento estruturado; produção parcial |

O package manager detectado e adotado é npm, com `package-lock.json` em frontend e backend. Não foi encontrado workspace npm monolítico; os dois pacotes são geridos separadamente.

## 5. Arquitetura Atual

O Orchestra controla identidade, RBAC, tenant/workspace, versão/publicação de assistentes, políticas, contexto conversacional, retrieval, descriptors de tools, limites de contrato, rastreabilidade e persistência. O Agno atua como executor externo: recebe um spec já governado e não deve descobrir contexto ou tools por conta própria. Evidências: `backend/src/modules/runtime/runtime.assistant-spec.builder.ts`, `runtime/agno-bridge/contract.py` e `runtime/agno-bridge/bridge.py`.

```text
[React/Vite]
     |
     | cookie de sessão + REST /api/v1
     v
[Express: control plane Orchestra]
     |-- Auth/RBAC/Tenant/Workspace
     |-- Assistants/Versions/Policies
     |-- Conversations -> AgentRun -> AgentRunEvent
     |-- Knowledge -> ingestão -> chunks/embeddings -> RagQuery/Results
     |-- MCP catalog -> bindings/policies -> descriptors/gateway sandbox
     |-- Audit + Usage + Quality
     |
     | AssistantRuntimeSpecV1 + bearer + contexto resolvido
     v
[Agno bridge HTTP: /health, /capabilities, /execute]
     |
     | provider explicitamente permitido
     v
[Provider externo]

Persistência transversal: PostgreSQL/Prisma
```

Fluxo Chat atual:

1. O frontend cria/abre conversa e envia mensagem por `frontend/src/services/chat.service.ts`.
2. `chat-conversations.service.ts` persiste a mensagem do usuário e solicita um `AgentRun`.
3. `agent-runs.service.ts` executa precheck, resolve versão/publicação, policy, contexto e intenção RAG.
4. Quando habilitado, o Orchestra executa `knowledgeService.queryRag`, persiste `RagQuery`/`RagQueryResult` e monta apenas fontes governadas.
5. `runtime.assistant-spec.builder.ts` cria o spec; `runtime.agno-http-adapter.ts` chama o bridge.
6. O bridge valida contrato/policy/modelo, chama o provider quando em modo real e retorna resposta, uso e eventos.
7. O backend persiste o resultado no `AgentRun`, eventos, uso e mensagem do assistente; o frontend mostra a resposta e detalhes allowlistados.

A fronteira MCP alcança o servidor local fictício da 16Q por um transporte HTTP restrito, somente em homologação opt-in. A 16T também prepara um adapter corporativo real, mas sem origem configurada e desabilitado por default; a 16U define sua homologação supervisionada; a 16W mantém a execução real bloqueada; e a 16X reconcilia o contrato do adapter com a 16V sem abrir o transporte. O sandbox 16F continua simulado, e nenhum endpoint corporativo foi chamado. Evidências: `mcp-readonly-demo`, `corporate-readonly`, `runtime.tool-gateway.service.ts` e os runbooks 16T–16X.

## 6. Frontend — Estado Atual

| Tela/Rota | Status | Dados reais/mockados | Ações principais | Pendências | Evidência |
|---|---|---|---|---|---|
| `/login` | Implementado | SSO/dev login real ou sessão mock em ambiente permitido | Iniciar SSO, dev login, validar sessão | Confirmar IdP/tenant produtivo e UX de erros reais | `frontend/src/pages/Auth/LoginPage.tsx`, `frontend/src/services/auth.service.ts` |
| `/app/dashboard` | Parcial | Real: Assistants, Audit e MCP; mock: métricas ricas | KPIs básicos e atividade | API consolidada de conversas/custos/latência; cards operacionais | `DashboardPage.tsx`; `dashboard.service.ts` ainda lança erro fora de mock, embora a página real agregue outros services |
| `/app/assistants` | Implementado com lacunas | API real ou mocks opt-in | listar, filtrar, publicar, despublicar, arquivar, restaurar | “Duplicar” apenas exibe toast; métricas `conversations`, custo e satisfação são mapeadas como zero | `AssistantsPage.tsx:89-113`, `assistants.service.ts:194-224` |
| `/app/assistants/new`, `/:id/edit` | Implementado | API real ou mock | wizard, criar/atualizar versão e publicar | Validar persistência completa dos 12 passos e responsividade em E2E | `AssistantWizardPage.tsx`, `assistants.service.ts` |
| `/app/assistants/:id` | Parcial avançado | Maioria real por APIs | lifecycle, approvals, policy, runs, RAG, MCP sandbox | aba de prompt compilado edita somente estado local; diff anterior é sintético; copiar/exportar exige revisão de autorização e dados | `AssistantDetailPage.tsx:2050-2273` |
| `/app/chat`, `/app/chat/:assistantId` | Implementado | Conversas, mensagens, runs e eventos reais; mock opt-in | criar/arquivar conversa, enviar/repetir, carregar eventos | Fontes/citações e tool calls não têm visual operacional integrado; metadata 16J não aparece na allowlist atual da tela | `ChatPage.tsx`, `chat.service.ts`, `agent-runs.service.ts` |
| `/app/knowledge` | Implementado com ação local | Catálogo real ou mock | criar, editar, duplicar, arquivar | “Re-indexar” geral usa `setTimeout` local; campos de tamanho/retention/embedding podem vir de metadata/defaults de apresentação | `KnowledgePage.tsx:149-177`, `knowledge.service.ts:286-318` |
| `/app/knowledge/:id` | Implementado parcialmente | Upload/ingestão/policy/embeddings reais; data source apenas catálogo | upload TXT/MD/CSV, texto manual, ingestão, embeddings, readiness | conectores não executam; formatos binários/OCR ausentes; revisar exposição autorizada de conteúdo | `KnowledgeDetailPage.tsx`, `knowledge.service.ts`, `knowledge.routes.ts` |
| `/app/mcp` | Parcial | Catálogo real ou mock | CRUD, status, duplicar, filtros | sincronizar, health, rotacionar/revogar credenciais e enable/disable em massa têm comportamento visual/local | `McpHubPage.tsx:207-265`, `mcp.service.ts` |
| `/app/mcp/:id` | Parcial | Tools/bindings reais | catalogar tool, alterar approval | botões de sincronizar e ativar/desativar apenas exibem toast; tool é cadastrada “sem execução MCP real” | `McpDetailPage.tsx:115-185` |
| `/app/analytics` | Ausente no modo real | Mock ou lista vazia | gráficos no protótipo | conectar `ai-observability/usage-summary`; remover valores de custo por modelo hardcoded | `analytics.service.ts`, `AnalyticsPage.tsx` |
| `/app/audit` | Parcial | API real ou mock | lista e KPIs calculados | botão de filtro não aplica filtro; severidade é inferida no frontend por nome da ação | `AuditPage.tsx`, `audit.service.ts` |
| `/app/admin/*` | Leitura parcial | users/roles/permissions/workspaces e catálogo LLM reais | navegar e consultar | “Convidar usuário”/busca sem mutation ou filtro; CRUD completo não exposto na tela | `AdminPage.tsx`, `admin.service.ts` |
| Componentes `FeedbackBar`, `RAGSourcesList`, `ToolCallCard` | Inativos/mock | Somente estado/Tipos mock | visualização prototípica | Não estão importados pelo Chat atual; feedback não envia ao backend | `frontend/src/components/chat`, busca de imports no frontend |

Há responsividade por classes e variantes mobile em várias telas, mas **pendente de confirmação** em browsers/dispositivos reais porque não existem specs Playwright/Cypress versionadas.

## 7. Backend/API — Estado Atual

As rotas de domínio são registradas sob `/api/v1`; as exceções públicas são health e os endpoints operacionais 16V sob `/v1/status`. Evidência: `backend/src/app/routes.ts`.

| Módulo | Status | Rotas/serviços | Persistência | Pendências | Evidência |
|---|---|---|---|---|---|
| Health | Implementado | `/health`, `/health/db` | consulta Prisma no health DB | health profundo de dependências externas no deploy | `modules/health` |
| Status operacional 16V/16X | Implementado, read-only e alinhado à tool | `/v1/status`, `/v1/status/availability` | nenhuma | validar ingress/SLO e primeira chamada real em HTTPS homologado | `modules/status`, `corporate-readonly.transport.ts`, testes e runbook 16X |
| Auth | Implementado condicional | `/auth/sso/*`, `/auth/microsoft/*`, `/auth/dev-login`, `/auth/me`, logout | User, ExternalIdentity; JWT no cliente | Session server-side/revogação; configuração produtiva | `modules/auth`, `shared/security/session.ts` |
| Tenants/workspaces/users/roles/permissions | Implementado | CRUD parcial e RBAC | Prisma | UI de administração e testes E2E completos | módulos correspondentes e routes |
| Assistants/governança | Implementado | CRUD, versions, publication, rollback, approval, policy, feedback, test results, shares | modelos `Assistant*` | alinhar UI local e qualidade automatizada | `modules/assistants`, `assistants.routes.ts` |
| Conversations | Implementado | conversas por assistant, detalhe, messages, archive | `Conversation`, `ConversationMessage` | retenção/export/delete e streaming | `modules/chat-conversations`, migration 15C |
| Agent runs | Implementado | criar via assistant, listar, detalhe, eventos, cancelar | `AgentRun`, `AgentRunEvent` | fila/worker, streaming, cancelamento distribuído e idempotência ponta a ponta | `modules/agent-runs` |
| Runtime | Implementado com modos | providers, capabilities, health, config, callback de tool | metadata/eventos em AgentRun | produção do bridge, HA, retry/circuit breaker e streaming | `modules/runtime` |
| Knowledge/RAG | Implementado | bases, docs, upload, ingestão, chunks, sources, readiness, queries, embeddings, bindings/policy | modelos Knowledge/RAG/embedding | formatos avançados, evals, conectores e políticas de retenção | `modules/knowledge`, `modules/embeddings` |
| MCP catálogo/sandbox | Parcial | servers/tools/resources/prompts/bindings/precheck/tool-calls | modelos MCP e eventos | transporte externo real e approval operacional | `modules/mcp`, `mcp.routes.ts` |
| MCP remoto | Fundação read-only opt-in | discovery/readiness, import/apply, egress/SSRF, client injetável e gateway governado | catálogo remoto/ledger e tool-calls sanitizados | transporte produtivo e secret manager ainda não homologados; default retorna `MCP_REMOTE_NOT_IMPLEMENTED` | `modules/mcp/remote`, `runtime.tool-gateway.service.ts` |
| LLM | Implementado condicional | providers, health, capabilities, config, test generation | ProviderConfig/usage onde aplicável | ampliar providers e observabilidade de custo | `modules/llm` |
| Auditoria | Implementado | `/audit-logs` | `AuditLog` | filtros/UI, retenção, export e SIEM | `modules/audit` |
| Observabilidade IA | Backend implementado | usage events/summary, policies, regras e endpoints de avaliação | `AiRunUsageEvent`, `AiUsageLimitPolicy`, `AiObservabilityAlertRule` | enforcement no AgentRun, custo e UI | `modules/ai-observability` |
| Qualidade IA | Backend implementado, produto ausente | test sets/cases, runs determinísticos, results | modelos `AiQuality*` | geração de outputs, judge/evals reais, UI e integração CI | `modules/ai-quality` |
| Settings | Leitura | `/settings` | `Setting` | mutations e UI específica | `modules/settings` |

A API não possui documento OpenAPI/Swagger versionado. Os contratos estão distribuídos em Zod, tipos TypeScript, testes e documentos em `docs/api`; isso é suficiente para desenvolvimento interno, mas aumenta custo de integração e risco de divergência para consumidores externos.

## 8. Banco de Dados e Prisma

O schema representa uma plataforma multi-tenant com índices de tenant/workspace, soft delete em vários domínios e relações explícitas. As entidades principais confirmadas são:

- identidade e autorização: `Tenant`, `Workspace`, `User`, `ExternalIdentity`, `Role`, `Permission`, memberships e `Session`;
- assistentes: `Assistant`, versões, publications, shares, feedback, resultados de teste, approvals e execution policy;
- Knowledge/RAG: bases, documents, chunks, embeddings, source references, data sources, ingestion jobs/events, bindings, policies, queries e resultados;
- execução: conversations/messages, `AgentRun`, `AgentRunEvent`, `ToolCall`, `McpToolCall` e eventos;
- MCP: servers, tools, resources, prompts, bindings, policies, catálogo remoto e ledger;
- observabilidade/qualidade: usage records, limites, alertas e modelos de test set/evaluation.

Evidência: `backend/prisma/schema.prisma`.

Existem 21 migrations versionadas entre foundation e a policy de escopo 16J. As migrations recentes relevantes incluem pgvector/embeddings, catálogo MCP remoto, usage/costs, limites, alertas, qualidade, conversas e metadata de execution policy. Evidência: `backend/prisma/migrations`.

Riscos e regras operacionais:

1. A migration de embeddings verifica a disponibilidade da extensão `vector` e falha deliberadamente quando ausente. Desde a 17B, compose dev e prod usam `pgvector/pgvector:0.8.3-pg16`; a compatibilidade real ainda depende de build, backup/restore e migration em ambiente de homologação.
2. A 17B adiciona target/imagem `operations` e serviço `migrate` no profile opt-in homônimo. O backend não executa migration no startup; a aplicação continua separada, one-shot e auditável.
3. O modelo `Session` existe, mas o fluxo atual assina/verifica JWT sem consultar a tabela; revogação, inventário e expiração server-side estão parcialmente modelados e não operacionais.
4. Conteúdo funcional é persistido em texto: mensagens, `KnowledgeDocument.contentText`, chunks, query RAG e excerpts. `rawContentLogged=false` refere-se à metadata operacional e não deve ser interpretado como ausência de conteúdo no banco.
5. Não foi executado `prisma migrate dev`, `db push`, seed ou acesso ao banco nesta auditoria.

Recomendação: em ambientes compartilhados ou produtivos usar somente `npm --prefix backend run prisma:migrate:deploy` para migrations já revisadas, após backup, teste em clone e verificação de drift. Nunca usar `migrate dev` em produção.

## 9. Knowledge/RAG — Estado Atual

### Implementado

- Upload autenticado de TXT, Markdown e CSV, com validação de nome, extensão, MIME, tamanho, binário e UTF-8 (`knowledge.upload.ts`, `knowledge.routes.ts`).
- Cadastro textual manual, armazenamento de conteúdo e hash (`knowledge.service.ts`, `KnowledgeDocument` no Prisma).
- Chunking determinístico com normalização, tamanho, overlap, offsets, hash e estimativa de tokens (`knowledge.chunking.ts`).
- Ingestão transacional e idempotente por `contentHash`, com chunks antigos marcados stale, source references e eventos (`knowledge.service.ts`, `knowledge.repository.ts`).
- Embeddings fail-closed: disabled por padrão, stub determinístico offline e provider OpenAI opcional (`modules/embeddings`).
- Persistência vetorial em `knowledge_chunk_embeddings` com pgvector (`schema.prisma`, migration 10C).
- Retrieval keyword, semantic e hybrid; fallback governado; limite por top-K, excerpt e contexto (`knowledge.config.ts`, `knowledge.service.ts`).
- `hybrid_stub_keyword_priority`, com resultado semântico do stub tratado como auxiliar ao ranking lexical (`knowledge.service.ts`).
- Readiness de base e assistente considerando documentos, chunks, embeddings, workspace, bindings e `allowRuntimeRetrieval` (`knowledge.service.ts`).
- Persistência de `rag_queries` e `rag_query_results`, associação opcional ao `AgentRun`, rank, score, match type, excerpt e source reference (`schema.prisma`, `knowledge.service.ts`).
- Contexto RAG resolvido pelo Orchestra antes do runtime e enviado com metadata allowlistada (`agent-runs.service.ts`, `runtime.assistant-spec.builder.ts`).
- UI para upload, ingestão, policy e embeddings (`KnowledgeDetailPage.tsx`).

### Parcial

- O stub gera vetor determinístico, não semântica de linguagem; serve para contrato/offline, não para medir relevância produtiva (`stub-embedding.provider.ts`).
- OpenAI embeddings existem, mas sua disponibilidade/configuração atual é **pendente de confirmação**; testes não chamam provider externo.
- O modo hybrid degrada para keyword quando embeddings não estão prontos; isso é comportamento controlado, mas precisa ser visível operacionalmente.
- `AssistantKnowledgeBinding.retrievalMode` ainda usa valores legados como `retrieval_placeholder`; o retrieval oficial é governado principalmente por configuração/policy atual (`schema.prisma`, `knowledge.schema.ts`).
- Data sources são catalogados, mas não há execução de conectores (`KnowledgeDetailPage.tsx:301-318`).
- A UI retorna/exibe conteúdo de documentos para usuários autorizados; não foram encontradas DLP, criptografia por campo ou política automatizada de retenção.
- O detector RAG usa regex, sinais explícitos, labels de fonte e presença de binding. Isso atende aos casos homologados, mas pode produzir falso positivo/negativo fora do vocabulário testado (`agent-runs.service.ts`).

### Recomendado

- Criar corpus de evals por domínio, medir recall@k, precision@k, MRR, grounding e taxa de fallback.
- Validar embeddings reais e dimensões por ambiente com golden dataset, sem usar o stub como proxy de qualidade.
- Adicionar PDF/DOCX/XLSX/OCR somente com antivírus, content-type real, limites, extração isolada e classificação.
- Implementar conectores incrementais, deduplicação, reprocessamento em job/worker, retry e dead-letter.
- Definir retenção, deleção, legal hold, criptografia e acesso a conteúdo/excerpts.
- Expor na UI a fonte real, motivo do ranking, modo efetivo, degradação e query correlacionada, sem mostrar payload bruto.

## 10. Response Scope / Governança de Resposta

A policy `responseScopeMode` é persistida na metadata de `AssistantExecutionPolicy`, normalizada por `backend/src/shared/policies/response-scope.ts` e exposta no detalhe do Assistant. O default é `knowledge_first`.

- `knowledge_only`: restringe a resposta ao contexto RAG governado; sem contexto suficiente, deve informar ausência na base, sem complementar com conhecimento geral.
- `knowledge_first`: prioriza a base e permite fallback geral quando não há contexto resolvido; nesse caso marca `fallbackOutsideKnowledgeUsed=true`.
- `general_allowed`: permite perguntas gerais; usa RAG quando há sinal explícito, match com fonte ou consulta não geral associada a bindings.
- `response_scope_question`: a pergunta é sobre poder usar informação fora da base; o retrieval é pulado e o runtime recebe instrução compatível com o modo.
- `general_question_no_knowledge_signal`: pergunta explicitamente classificada como geral e sem sinal de base; RAG é pulado fora de `knowledge_only`.
- `non_general_query_with_knowledge_bindings`: consulta não geral sem marcador explícito, mas com base vinculada; RAG é tentado.
- `fallbackOutsideKnowledgeUsed`: verdadeiro somente em `knowledge_first` quando não há RAG resolvido.
- `rawContentLogged=false`: invariante persistida na metadata operacional do runtime; não contém prompt, documento ou resposta bruta.

| Modo | Pergunta da base | Pergunta geral | Pergunta fora da base | Consulta corporativa sem marcador explícito |
|---|---|---|---|---|
| `knowledge_only` | Tenta RAG e responde apenas com base no contexto resolvido | Tenta RAG por força do modo; sem resultado, não usa conhecimento geral | Pula RAG com `response_scope_question` e mantém restrição | Tenta RAG; sem fonte suficiente, informa ausência na base |
| `knowledge_first` | Tenta RAG; com fonte, não marca fallback | Pula RAG com `general_question_no_knowledge_signal`; marca fallback geral | Pula RAG com `response_scope_question`; marca fallback geral | Tenta RAG com `non_general_query_with_knowledge_bindings` |
| `general_allowed` | Tenta RAG quando há sinal/label/binding aplicável | Pula RAG e responde em modo geral; não marca fallback | Pula RAG com `response_scope_question`; modo geral permanece permitido | Tenta RAG com `non_general_query_with_knowledge_bindings` |

Evidências: `response-scope.ts`, `agent-runs.service.ts:286-420`, `runtime.assistant-spec.builder.ts`, `backend/tests/api/agent-runs.test.ts` e `ORCHESTRA_CHAT_RAG_HOMOLOGACAO_OPERACIONAL_16K.md`.

Limitação: as categorias gerais e sinais RAG são heurísticas codificadas em português. O comportamento fora da matriz homologada é **inferido a partir da implementação atual** e deve ser coberto por evals antes de ampliar domínios/idiomas.

## 11. MCP/Tools — Estado Atual e Pendências

### Real e governado

- catálogo de servers, tools, resources e prompts;
- bindings Assistant–server/tool e policies com risk, approval, sandbox, allow runtime e blocked by default;
- CRUD, archive/restore e persistência Prisma;
- precheck de tenant/workspace, status, binding, policy, risco, approval e AgentRun;
- `McpToolCall` e eventos correlacionados por request/trace/run;
- descriptors sanitizados no spec do runtime;
- gateway autenticado com limite de payload, sequência, idempotência e revalidação de spec;
- discovery/readiness/import plan/apply e catálogo remoto estruturais.

Evidências: `backend/src/modules/mcp`, `backend/src/modules/runtime/runtime.tool-gateway.*`, models MCP no `schema.prisma` e testes MCP.

### Stub/simulado

- `mcpService` produz output sandbox declarando que nenhum servidor externo foi chamado.
- `runtime.tool-gateway.service.ts` mantém o sandbox fixo e aceita um ramo remoto somente após revalidação; testes usam client fake com `simulated=true`.
- `activeRuns` do gateway é um `Map` em memória; reinício perde sessões de callback ativas.
- o transporte MCP remoto default lança `MCP_REMOTE_NOT_IMPLEMENTED`; somente transportes injetados e aprovados atravessam o boundary.
- sincronização, health, rotação e revogação fictícios foram removidos da UI MCP; readiness real continua fora da tela.

### Boundary 16T–17C e plano operacional 17A

- a 16T implementa o adapter governado e estritamente read-only para `corporate.status.read`, com origem HTTPS exata, egress/SSRF, `secretRef`, GET-only, limites e sanitização;
- a 16T não configurou endpoint real nem realizou chamada corporativa;
- a 16U acrescenta checklist, preflight local sem rede, readiness supervisionada, autorização de uma execução manual, auditoria SQL allowlistada, evidências e rollback;
- a 16V cria `GET /v1/status` e `GET /v1/status/availability` no próprio backend, retornando somente `status`, `summary` e `updatedAt`;
- a 16W adota a Opção C, cria preparação/auditoria offline e não implementa `--run-once-local`;
- a 16X reconcilia o contrato 16T/16V, aceita somente `ok|degraded`, exige os três campos estritos e normaliza `/health` sem propagar `service` ou `requestId`;
- a 16Y valida estruturalmente a origem backend/API prevista, a igualdade textual das allowlists, os paths fixos, o contrato e o audit template sem rede;
- a 16Z documenta a publicação futura, cria preflight/smoke offline e não materializa endpoint ou secret em env/Compose;
- a 17A organiza responsáveis, pré-requisitos, go/no-go, janela, evidências e rollback sem executar deploy, DNS, TLS, containers, migration ou request;
- a 17B endurece Compose, imagens e Nginx de forma offline, sem publicar os domínios planejados nem abrir MCP/corporate/providers;
- a 17C inventaria configuração, secrets, owners, rotação e evidência de forma offline, sem coletar valor real ou criar `.env`;
- nenhuma chamada real foi executada: HTTP local, loopback, private e metadata continuam bloqueados, e a execução ainda depende de HTTPS homologado;
- origem e segredo reais existem somente na sessão segura/secret manager do operador, fora do Git;
- CI, smoke e preflight executam apenas validações estáticas/offline; qualquer chamada real exige janela e aprovação explícitas;
- flags, allowlists e adapter continuam fechados por default após a janela.
- a 16Z não executa chamada real nem testa UI/CRUD MCP; as URLs planejadas continuam inativas e a primeira execução fica para depois da publicação/validação, após aviso ao usuário.
- a 17A também não executa chamada real nem deploy; o ambiente permanece local e a publicação fica para fase posterior autorizada.
- a 17B também não executa build, container, migration ou chamada; a primeira execução real da tool continua dependente de publicação HTTPS futura.
- a 17C também não materializa endpoint/secret em env/Compose/CI, não executa MCP real e não testa UI/CRUD MCP; o usuário será avisado antes do futuro teste direto.
- MCP/Tool real para sistemas sensíveis, teste visual MCP/Assistant e CRUD MCP ponta a ponta permanecem para fases posteriores.

### Pendente antes de ampliar uso real

1. Publicar e homologar manualmente frontend/API em fase posterior, comprovando DNS/TLS, proxy, CORS/cookies e endpoints passivos sem abrir MCP.
2. Homologar discovery e execução externas reais mantendo allowlist, diff, approval e import ledger.
3. Substituir estado em memória do gateway por coordenação persistente/distribuída.
4. Definir idempotência, timeout, retry, circuit breaker, concorrência e compensação por tool.
5. Implementar fila de approval com expiração, segregação de função e trilha de decisão.
6. Executar threat model de prompt injection/tool injection, SSRF, exfiltração e confused deputy.
7. Homologar primeiro tools somente leitura e baixo risco; escrita deve permanecer bloqueada até critérios específicos.
8. Integrar tool calls reais na UI do Chat e na observabilidade operacional.

Conclusão: MCP/tools externos requerem revisão, hardening e homologação antes de qualquer ampliação. O estado atual é adequado para catálogo, governança e sandbox, não para automação corporativa com efeito externo.

## 12. Runtime Agno Bridge — Estado Atual

`runtime/agno-bridge` é um servidor HTTP Python containerizado que valida o contrato do Orchestra e usa o SDK Agno quando configurado em modo real.

| Aspecto | Estado | Evidência / observação |
|---|---|---|
| `/health` | Implementado e autenticável | `BridgeRequestHandler.do_GET`; informa healthy/misconfigured sem expor credenciais |
| `/capabilities` | Implementado | Declara streaming, tools, RAG, provider, file inputs e limites |
| `/execute` | Implementado | JSON estrito, limite de 64 KiB, validação de contrato e respostas sanitizadas |
| Modo stub | Implementado | `StubExecutor`; offline, determinístico, sem provider |
| Modo real | Implementado condicional | `AgnoExecutor`; OpenAI, Azure OpenAI e Anthropic |
| Allowlist de modelos | Implementado | `AGNO_BRIDGE_ALLOWED_MODELS`; vazio significa sem lista adicional, sujeito ao provider configurado |
| Segurança bearer | Implementado | comparação constante e configuração com validação de formato |
| RAG | Implementado como contexto resolvido | não executa retrieval; aceita somente `none` ou `resolved_context` |
| Tools | Parcial | descriptors; no máximo uma chamada quando gateway sandbox está ligado; externa continua simulada |
| Streaming/file input | Ausente | capabilities retornam falso e policy bloqueia attachments |
| Telemetria/log | Restrito | handler não registra requests; configuração de telemetria existe no exemplo |

O bridge limita provider/modelo, bloqueia mismatch e não aceita provider externo em modo stub. A comunicação Orchestra–bridge usa bearer; em produção ainda são necessários TLS/mTLS ou rede privada, rotação, observabilidade do serviço, HA e política de egress. Evidências: `runtime/agno-bridge/bridge.py`, `contract.py`, `Dockerfile`, `.env.example` e testes.

Riscos:

- servidor baseado em `ThreadingHTTPServer`, sem configuração produtiva de workers, graceful draining, métricas ou autoscaling;
- dependências Python com ranges para clients de provider e pin exato apenas do Agno; builds futuros podem variar dentro dos ranges;
- bridge presente apenas no profile opt-in `agno` do `docker-compose.prod.yml`, sem build ou homologação produtiva live;
- callback de tool depende de estado em memória no backend;
- sem streaming, anexos e cancelamento cooperativo do provider.

## 13. Segurança, Privacidade e Governança

### Controles confirmados

- Helmet, CORS com origem configurada, JSON limitado, request ID e Pino (`backend/src/app/middlewares.ts`).
- Redaction de authorization, cookie, tokens e chaves no logger (`backend/src/infrastructure/logger/logger.ts`).
- JWT em cookie HttpOnly, `secure` e `sameSite` configuráveis (`shared/security/session.ts`).
- RBAC por rota e escopo de workspace nos serviços/repositórios; negativas relevantes geram audit (`auth.middleware.ts`).
- Microsoft SSO com state/nonce/PKCE, allowlist de tenant/domínio e vínculo de identidade (`modules/auth/microsoft-sso.*`).
- Runtime HTTP com URL sem credencial embutida, bearer opcional/obrigatório por ambiente, timeouts e respostas fail-closed (`config/agno-runtime-http-security.ts`).
- Contratos e sanitizers rejeitam chaves/padrões sensíveis em metadata (`runtime-contract.schema.ts`, `runtime.agno-http-adapter.ts`, `runtime/agno-bridge/contract.py`).
- `rawContentLogged=false` na metadata de Chat/RAG e logs allowlistados.
- Defaults de embeddings, MCP remoto, tools e providers externos desligados nos exemplos/versionamento.

### Riscos e pendências

| Achado | Evidência | Avaliação |
|---|---|---|
| Fallback de segredo JWT no código | `backend/src/config/env.ts` | Alto: produção deve falhar ao iniciar se segredo forte externo não estiver presente |
| Sessão sem revogação server-side | `Session` existe no Prisma, mas não é usada em `shared/security/session.ts` | Alto para offboarding/incident response; inferido a partir da implementação atual |
| Ausência de secrets manager versionado | compose/env examples | Pendente de confirmação externa; não há integração no repositório |
| Sem TLS/ingress/WAF versionado | Compose e Nginx | Pendente de confirmação externa; obrigatório em produção |
| Conteúdo funcional persistido em claro pelo modelo | `ConversationMessage.content`, documents/chunks/query/excerpts | Exige classificação, retenção, criptografia de storage e controles de acesso/backup |
| Preview de input/output | models de AgentRun/MCP e adapters | Revisar minimização, retenção e classificação; não equivale a raw log completo |
| Cópia/exportação de prompt no browser | `AssistantDetailPage.tsx` | Exige permission gate específico, auditoria e revisão de necessidade |
| Data source e MCP URL | modelos e cadastro UI | Threat model SSRF/egress antes de conectores reais |
| CSRF | cookie + rotas mutáveis; não foi encontrado token CSRF dedicado | Revisão recomendada considerando SameSite, SSO, origem e arquitetura de ingress |
| Provider externo | bridge/providers | DPA, residência, retenção, treinamento, region e allowlist pendentes de confirmação |
| RAG | conteúdo e excerpts | Prompt injection em documentos, data poisoning, exfiltração e ACL por documento precisam hardening |
| MCP/tools | descriptors e futuro transporte | Maior risco de efeito externo; manter fail-closed até homologação |

Nenhum valor de secret, token, key, header de autenticação, prompt ou conteúdo de documento foi incluído nesta documentação.

## 14. Observabilidade e Auditoria

### Implementado

- `agent_runs` com status, source, request/trace, timestamps, erros, precheck e metadata;
- `agent_run_events` sequenciais por run;
- `rag_queries` e `rag_query_results` com modo, status, ranking, fontes e associação a run;
- `mcp_tool_calls` e eventos;
- `audit_logs` para ações e negativas de policy;
- `ai_run_usage_events` com provider/model, tokens, latency, status e metadata sanitizada;
- policies de limite e regras de alerta, com agregação e endpoints de avaliação;
- frontend Chat com detalhe técnico allowlistado;
- scripts smoke e runbooks com SQL de auditoria.

Evidências: models Prisma, `backend/src/modules/ai-observability`, `agent-runs.service.ts`, `ChatPage.tsx` e runbook 16K.

### Lacunas

- `frontend/src/services/analytics.service.ts` retorna lista vazia em modo real; a tela Analytics não usa `/ai-observability/usage-summary`.
- não há tela operacional para runs falhos/bloqueados, RAG degradado, latência, tokens, custo, fallback, tool calls e saúde do runtime.
- a allowlist do Chat mostra RAG/tools básicos, mas não expõe hoje `responseScopeMode`, `ragIntentDetected`, `ragSkippedReason`, `fallbackOutsideKnowledgeUsed` ou fontes detalhadas.
- `recordRuntimeUsageEvent()` registra tokens/latência, mas não encaminha `estimatedCostMinorUnits`/`costCurrency`, embora o adapter normalize esses campos.
- `evaluateAiUsageLimits()` e `evaluateAiObservabilityAlerts()` são chamados pelos endpoints admin de avaliação; não foram encontrados no precheck/execução do `AgentRun`.
- cooldown/notificação de alertas e integração com canal externo não aparecem como fluxo operacional.
- logs, métricas e tracing não estão integrados a uma stack externa versionada; retenção e SLOs são pendentes de confirmação.
- a qualidade IA existe como backend determinístico, mas não há painel nem execução sobre respostas produzidas automaticamente.

Próxima frente recomendada: console operacional com visão por tenant/workspace/assistant/runtime, drill-down por trace, filtros, saúde do bridge, RAG mode/reason, uso/custo, alertas e links para run/query/tool call — sempre por allowlist, sem payload bruto.

## 15. Testes, Smokes e Qualidade

Inventário atual:

- 53 arquivos de teste backend em `backend/tests`;
- 14 arquivos de teste frontend em `frontend/src/test`;
- testes Python do bridge em `runtime/agno-bridge/tests/test_bridge.py`;
- 12 scripts smoke/preflight em `/scripts`, além do runtime mock local.

Cobertura relevante confirmada:

- API: auth, assistants, conversations, runs, Knowledge/MCP, runtime, observabilidade e qualidade;
- runtime: adapters Agno, HTTP client/server, RAG, MCP descriptors, gateway e contrato;
- unitários: RBAC, SSO, chunking/upload, embeddings, MCP remoto, observabilidade, limites, alertas e evals;
- frontend: session/protected route, API client, services reais, pages em modo real, metadata de run e LLM;
- Knowledge 16I/16J: upload, stub, retrieval, policy, ranking, response scope e ações frontend;
- Chat/RAG 16K: oito cenários de escopo/intenção;
- bridge: config, auth, health, capabilities, execute, RAG e gateway com executor injetado.

Smokes principais: `smoke-local.sh`, `smoke-fullstack-real.sh`, `smoke-agno-local.sh`, `smoke-agno-runtime-*`, `smoke-chat-contexto-15e.sh`, `smoke-chat-provider-real-15h.sh`, `smoke-agno-*-16*.sh`, `smoke-knowledge-rag-16i.sh` e `smoke-chat-rag-operacional-16k.sh`.

Validações desta auditoria:

| Comando | Resultado |
|---|---|
| `scripts/smoke-chat-rag-operacional-16k.sh --dry-run` | Aprovado: 34 verificações, 0 falhas |
| `scripts/smoke-knowledge-rag-16i.sh --dry-run` | Aprovado: 75 verificações, 0 falhas |
| `npm --prefix backend run typecheck` | Aprovado |
| `npm --prefix frontend run typecheck` | Aprovado |
| `git diff --check` | Aprovado |

Lacunas:

- não há specs E2E Playwright/Cypress; existe `playwright-fixture.ts` e dependência Playwright, mas nenhum teste de navegador versionado;
- não há teste de carga, soak, concorrência, chaos, failover ou recuperação;
- não há cobertura automatizada com provider real, por decisão de segurança;
- a matriz 16K cobre exemplos específicos; precisa virar corpus versionado maior;
- os gates estáticos 16S–17B estão no CI, mas ainda não há cobertura E2E de navegador nem gate por percentual de cobertura;
- cobertura percentual não foi executada nesta auditoria, portanto é **pendente de confirmação**.

## 16. CI/CD, Docker e Ambientes

### Desenvolvimento e homologação local

- frontend: `http://localhost:5173`; backend/API: `http://localhost:3000`;
- `docker-compose.dev.yml` sobe frontend, backend e banco pgvector com healthchecks e volumes.
- `docker-compose.agno-bridge.yml` adiciona bridge e aponta o backend para ele.
- Dockerfiles dev usam hot reload; Dockerfiles prod fazem builds multi-stage.
- há smokes de fullstack e de bridge/Agno.

### Produção: hardening 17B e gaps remanescentes

Topologia prevista: frontend `https://orchestra.mcm.eng.br`; backend/API `https://api.orchestra.mcm.eng.br`. Esses endereços documentam a intenção de roteamento e não comprovam deploy, DNS, TLS ou disponibilidade.

1. `.github/workflows/ci.yml` executa typechecks, testes focados, build e gates estáticos; não há workflow versionado de entrega/deploy, promoção ou rollback.
2. A 17B inclui bridge Agno apenas no profile opt-in `agno`; HA, workers, egress e operação produtiva não foram homologados.
3. O banco produtivo usa pgvector e volume nomeado, mas backup/restore, capacidade e migration real não foram testados.
4. O profile `operations` oferece job one-shot de `prisma migrate deploy`; ele não é automático e não foi executado.
5. O Nginx faz proxy relativo de `/api/` para o backend e roda não-root em `8080`; o terminador TLS/ingress externo continua pendente.
6. O backend e o banco não publicam portas; somente o frontend faz bind loopback por default, exigindo terminador no host ou override deliberado.
7. O Compose não importa env files de subprojetos e exige secrets críticos em runtime, mas não existe secret store/rotation versionado.
8. Não há manifestos de Kubernetes, Terraform/Bicep, registry, promoção, canary/blue-green, backup, restore ou rollback automatizado.
9. Não há observabilidade de containers/infra nem SLO/alerta de disponibilidade versionados.
10. Dockerfiles, Nginx e Compose foram validados estaticamente; build, ownership, packages nativos e readiness em containers permanecem pendentes.

Saúde atual de containers é **pendente de confirmação**, pois Docker não foi iniciado nesta auditoria. A existência de healthchecks não comprova saúde do ambiente corrente.

Recomendação de pipeline mínimo:

1. lint/typecheck/test/build de frontend/backend/bridge;
2. scans de dependência, imagem e secrets;
3. build imutável com SBOM e assinatura;
4. migration dry-run em clone e `migrate deploy` como job único;
5. deploy em homologação com pgvector e bridge;
6. smoke sem conteúdo sensível;
7. aprovação, deploy progressivo, health/SLO e rollback testado.

## 17. Dados Mockados, Simulados e Hardcoded

| Item | Tipo | Aceitável em dev? | Deve mudar antes de produção? | Evidência |
|---|---|---|---|---|
| `VITE_USE_MOCKS` e `frontend/src/services/mocks` | Mock opt-in | Sim | Manter bloqueio em produção e testar configuração | `frontend/src/lib/env.ts` |
| Métricas de protótipo e custo por modelo | Hardcoded/demo | Sim | Sim; conectar observabilidade real | `AnalyticsPage.tsx`, `mockData.ts` |
| Campos de Assistant em zero | Hardcoded mapper | Temporariamente | Sim para KPIs reais | `assistants.service.ts:210-216` |
| Embedding stub SHA-256 | Stub offline | Sim | Não usar para decisão de relevância; provider real/eval | `stub-embedding.provider.ts` |
| Runtime local determinístico/Agno stub | Stub | Sim | Perfil produtivo deve selecionar executor real deliberado | `runtime.registry.ts`, adapters |
| `FakeRuntimeAdapter` | Fake de boundary | Testes | Não registrar como runtime real | `agent-runs/runtime/fake-runtime-adapter.ts` |
| `agno-mock-runtime.mjs` | Mock de smoke | Sim | Nunca usar como provider produtivo | `/scripts` |
| MCP sandbox output | Simulação | Sim | Sim antes de alegar execução externa | `mcp.service.ts` |
| Gateway 16F | Simulação governada | Sim | Sim para execução MCP real; preservar governança | `runtime.tool-gateway.service.ts` |
| MCP remote client | Boundary read-only injetável; transporte default fail-closed | Sim | Homologar transporte/secret manager antes de habilitar flags | `mcp-remote.client.ts` |
| Data source Knowledge | Catálogo placeholder | Sim | Implementar workers/conectores | `KnowledgeDetailPage.tsx` |
| Reindex Knowledge global | Simulação UI por timeout | Protótipo | Sim | `KnowledgePage.tsx:172-177` |
| Readiness/discovery MCP na UI | Informativo e desabilitado | Sim | Integrar endpoint read-only somente após homologação | `McpHubPage.tsx`, `McpDetailPage.tsx` |
| Duplicar Assistant | Toast sem mutation | Protótipo | Sim | `AssistantsPage.tsx:89-91` |
| Prompt compilado/diff/edição | Derivação local e diff sintético | Protótipo interno | Persistir via contrato ou marcar claramente read-only/local | `AssistantDetailPage.tsx:2050-2135` |
| Feedback de mensagem | Estado local e componente não integrado | Protótipo | Integrar `AssistantFeedback`/mensagem ou remover | `FeedbackBar.tsx` |
| Heurísticas de intenção RAG | Hardcoded funcional | Sim com testes | Evoluir via evals/configuração, não remover sem baseline | `agent-runs.service.ts:286-420` |
| Defaults de frontend Knowledge | Hardcoded de apresentação | Sim | Substituir por dados reais ou rótulo “não configurado” | `knowledge.service.ts:286-318` |

## 18. Inconsistências, Lacunas e Dívidas Técnicas

| Achado | Evidência | Status | Impacto | Severidade | Ação recomendada | Frente sugerida |
|---|---|---|---|---|---|---|
| MCP externo não executa | `mcp-remote.client.ts`, `mcp.service.ts`, gateway | Confirmado | Impede automação externa real | Alta | Implementar transporte após threat model e observabilidade | MCP/Tools |
| Gateway mantém runs em memória | `activeRuns` em `runtime.tool-gateway.service.ts` | Confirmado | Callback perde estado em restart/escala horizontal | Alta | Persistência/coordenação distribuída | MCP/Runtime |
| Artefatos produtivos sem validação live | Compose/Dockerfiles/Nginx 17B | Confirmado | Incompatibilidade pode aparecer no primeiro build/deploy | Alta | Build em ambiente isolado, SBOM/scan, Compose config e smoke HTTPS aprovados | Produção |
| Migration operacional não homologada | profile `operations` 17B | Confirmado | Drift ou schema incompatível ainda pode ocorrer | Alta | Executar `migrate deploy` único após backup/restore e revisão | Produção |
| Terminador TLS/ingress ausente | Nginx interno e plano 17A | Confirmado | URLs planejadas continuam indisponíveis | Crítica | Provisionar DNS/TLS/proxy em fase autorizada | Produção |
| Bridge sem HA produtiva | profile `agno` do Compose | Confirmado | `agno_http` não tem garantias operacionais | Alta | Homologar workers, HA, egress, métricas e rollback | Runtime |
| README raiz incorreto | `README.md` | Confirmado | Onboarding e decisões erradas | Média | Atualizar baseline e links | Documentação |
| Analytics real vazio | `analytics.service.ts` | Confirmado | Operação sem visibilidade | Alta | Conectar usage-summary/runs/RAG | Observabilidade |
| Limites/alertas fora do AgentRun | busca de chamadas e services | Confirmado | Custo/quota podem não bloquear execução | Alta | Inserir avaliação no precheck transacional | Custos/Runtime |
| Custo não persistido no usage event | `recordRuntimeUsageEvent()` | Confirmado | Relatórios financeiros incompletos | Alta | Propagar currency/minor units e validar provider pricing | Custos |
| JWT com fallback fraco | `config/env.ts` | Confirmado | Compromisso de sessão se mal configurado | Crítica | Fail-fast produtivo e secret manager | Segurança |
| Session model não usado | Prisma vs `session.ts` | Confirmado | Sem revogação imediata | Alta | Sessão opaca/refresh ou denylist versionada | Segurança |
| E2E de navegador ausente | inventário de testes | Confirmado | Regressões de fluxo/UX | Alta | Playwright para login, assistant, Knowledge e Chat | Qualidade |
| Detector RAG heurístico | regex em `agent-runs.service.ts` | Confirmado | Falsos positivos/negativos | Média | Golden dataset e telemetria de classificação | RAG/Evals |
| Formatos Knowledge limitados | `knowledge.upload.ts` | Confirmado | Cobertura documental restrita | Média | Pipeline isolado para PDF/Office/OCR | Knowledge |
| Conectores Knowledge ausentes | UI e ausência de worker | Confirmado | Ingestão manual apenas | Média | Conectores incrementais com scheduler | Knowledge |
| Ações UI placeholder | páginas MCP/Knowledge/Assistants | Confirmado | Falsa percepção e UX inconsistente | Alta | Desabilitar/rotular ou implementar ponta a ponta | Frontend |
| Prompt local editável/exportável | `AssistantDetailPage.tsx` | Confirmado | Alteração não persistida e possível vazamento | Alta | Read-only por default, permission/audit e persistência explícita | Frontend/Segurança |
| Audit severity inferida no frontend | `audit.service.ts` | Confirmado | Classificação inconsistente | Média | Severidade emitida pelo backend | Auditoria |
| Sem OpenAPI | inventário do repositório | Confirmado | Integração e versionamento difíceis | Média | Gerar contrato a partir de schemas | API |
| Sem CI/CD/IaC | inventário do repositório | Confirmado | Release manual e não repetível | Crítica | Pipeline, ambientes, SBOM, deploy e rollback | Plataforma |
| Observação técnica mais forte que visual | APIs/tabelas vs frontend | Confirmado | Diagnóstico lento | Alta | Console operacional 16M | Observabilidade |
| Evals não ligados a respostas reais | `ai-quality-runner.service.ts` requer outputs | Confirmado | Qualidade sem loop automático | Média | Executor de eval isolado + baseline | Qualidade IA |
| Rate limit só em auth/gateway | `app/middlewares.ts` | Confirmado | Abuso/custo em Chat/API | Alta | Rate limit por tenant/user/assistant e budget | Segurança/Custos |
| Rollback de aplicação não automatizado | runbooks vs ausência de pipeline | Confirmado | MTTR elevado | Alta | Release imutável e rollback ensaiado | Operações |

## 19. Matriz Achado → Evidência → Impacto → Próxima Frente

| Achado | Evidência | Status | Confiança | Impacto | Severidade | Próxima frente | Ação recomendada | Owner sugerido |
|---|---|---|---|---|---|---|---|---|
| Chat/AgentRun real e rastreável | Conversations, AgentRun, ChatPage | Implementado | Alta | Base sólida para produto | Positiva | Observabilidade | Preservar contratos e adicionar drill-down | Backend + Frontend |
| RAG operacional e governado | Knowledge service, Prisma, testes 16K | Implementado | Alta | Respostas com fonte e policy | Positiva | RAG hardening | Criar evals e operar provider real | IA/RAG |
| Response scope cobre casos homologados | policy, detector, matriz | Implementado com heurística | Alta | Reduz resposta fora de escopo | Média | Evals | Medir classificação por domínio/idioma | IA/RAG |
| Agno bridge real disponível | runtime/agno-bridge | Implementado condicional | Alta | Executor desacoplado | Alta | Runtime produtivo | HA, TLS, métricas, deploy e retry | Plataforma + Backend |
| MCP externo ausente | client e outputs simulados | Parcial | Alta | Sem integração externa real | Alta | MCP/Tools | Implementar somente após hardening | Backend + Segurança |
| Dashboard/Analytics incompletos | services/pages | Parcial | Alta | Operação sem visão agregada | Alta | Observabilidade | Nova tela e APIs agregadas | Frontend + Backend |
| Custos não fecham ponta a ponta | usage recorder e limit services | Parcial | Alta | Risco financeiro | Alta | Custos/rate limits | Propagar custo e bloquear por policy | Backend + FinOps |
| Produção incoerente com pgvector | compose/migration | Ausente | Alta | Deploy falha | Crítica | Produção | Padronizar banco e migration job | Plataforma/DBA |
| Segurança de sessão incompleta | JWT/Session | Parcial | Alta | Revogação e segredo | Crítica | Segurança | Fail-fast + revogação + secrets manager | Segurança + Backend |
| Frontend contém ações placebo | páginas principais | Parcial | Alta | Confusão e erro operacional | Alta | UX/frontend | Inventário botão→endpoint→efeito→audit | Frontend + Produto |
| E2E e CI ausentes | inventário | Ausente | Alta | Regressão/release manual | Crítica | Qualidade/Plataforma | Playwright e pipeline | QA + Plataforma |
| Docs de entrada desatualizados | README raiz/docs | Dívida | Alta | Onboarding incorreto | Média | Documentação | Atualizar após aprovar este baseline | Tech Lead |
| Qualidade backend sem loop real | módulo ai-quality | Parcial | Alta | Sem gate de resposta | Média | Evals | Alimentar respostas controladas e publicar score | IA + QA |

## 20. Roadmap Técnico Recomendado

Como a 16L atual é a documentação de estado, a numeração abaixo começa na próxima fase disponível. A ordem pode ser adaptada sem alterar as dependências técnicas.

| Fase | Objetivo | Entregas | Dependências | Critérios de pronto |
|---|---|---|---|---|
| 16M — Observabilidade Operacional Chat/RAG | Transformar evidência técnica em operação visual | APIs agregadas; tela de runs/RAG/runtime; filtros por trace; modo/reason/fallback; tokens/custo; health do bridge | baseline 16K | dados reais sem raw payload; filtros/RBAC; E2E; runbook e alertas básicos |
| 16N — Custos, rate limits e enforcement | Controlar abuso e gasto antes do provider | custo por provider/model; pricing versionado; limites no precheck; rate limit tenant/user/assistant; alert evaluation | 16M e usage confiável | execução bloqueada de forma auditável; testes de concorrência; dashboard de budget |
| 16O — Hardening de Produção | Fechar deploy reproduzível | pgvector produtivo; migration job; proxy/ingress; bridge; secrets; TLS; backup/restore; CI/CD; rollback | 16M/16N | deploy em homologação do zero, smoke verde, restore e rollback ensaiados |
| 16P — Revisão MCP/Tools | Preparar uma tool externa read-only | transporte, discovery, secret refs, egress, approval, estado persistente, threat model | 16M–16O | tool low-risk homologada; `externalMcpCalled=true` somente quando real; incident/rollback |
| 16Q — Hardening Knowledge/RAG | Elevar qualidade e cobertura | golden dataset, embeddings reais, métricas retrieval, DLP, retention, formatos adicionais seguros | Observabilidade e ambiente produtivo | metas de recall/grounding; sem regressão 16K; ingestão resiliente |
| 16R — Revisão UX/Frontend | Remover ações falsas e alinhar fluxos | inventário de botões; implementação/remoção; Chat com sources/tools; Admin/Audit; responsividade | APIs das fases anteriores | zero ação placebo; permission gates; Playwright crítico; acessibilidade |
| 16S — Evals e Qualidade de Resposta | Operar qualidade contínua | datasets, runner controlado, scorecards, regressão por assistant/version, gate de release | 16Q e observabilidade | baseline versionada, thresholds, histórico e integração CI |
| 16T — Operação e Compliance | Consolidar handoff produtivo | SLO, on-call, incidentes, retenção, auditoria/SIEM, custos, DR e change management | 16O–16S | go-live checklist aprovado, owners definidos e evidência de exercício operacional |

## 21. Backlog Inicial para ClickUp

### Sprint 16M — Observabilidade Operacional do Runtime Chat/RAG

- **Descrição:** criar visão operacional real sobre runs, RAG, provider, custos e falhas.
- **Subtarefas:** definir contrato agregado; conectar `ai-observability`; tela de runs; detalhes allowlistados; filtros; health bridge; cards de RAG; testes; runbook.
- **Status sugerido:** Planejado.
- **Prioridade:** Urgente.
- **Evidências:** `ai-observability.routes.ts`, `ChatPage.tsx`, `analytics.service.ts`.
- **Dependências:** baseline 16K e schema atual.

### Sprint 16N — Enforcement de Quotas, Custos e Rate Limits

- **Descrição:** inserir limites no caminho real de execução.
- **Subtarefas:** propagar custo; catálogo de preços; chamar limit evaluator no precheck; rate limit por escopo; alertas; testes de corrida/idempotência.
- **Status sugerido:** Backlog priorizado.
- **Prioridade:** Urgente.
- **Evidências:** `ai-usage-limits.service.ts`, `agent-runs.service.ts`, `app/middlewares.ts`.
- **Dependências:** observabilidade confiável.

### Sprint 16O — Pipeline e Ambiente de Homologação Produtivo

- **Descrição:** tornar build, migration, deploy e rollback repetíveis.
- **Subtarefas parcialmente concluídas na 17B:** imagem pgvector; job opt-in `migrate deploy`; Nginx interno; bridge opt-in; hardening de imagens/Compose; smoke estático.
- **Subtarefas pendentes:** CD; SBOM/scans; TLS/ingress; secret manager; backup/restore; build e smoke live; rollback comprovado.
- **Status sugerido:** Em andamento, com hardening offline concluído e operação real pendente.
- **Prioridade:** Urgente.
- **Evidências:** `docker-compose.prod.yml`, Dockerfiles, `frontend/nginx.conf`, migration 10C.
- **Dependências:** decisão de plataforma/ambiente.

### Sprint 16P — MCP Externo Read-only Homologado

- **Descrição:** fundação opt-in para o primeiro caminho externo de risco baixo e somente leitura.
- **Subtarefas concluídas:** boundary de transporte injetável; allowlist/SSRF; secret reference lógica; revalidação no gateway; tool read-only; testes de segurança; UI, observabilidade e rollback.
- **Status atual:** Fundação implementada e fail-closed; transporte produtivo e secret manager ainda pendentes de homologação.
- **Prioridade:** Alta.
- **Evidências:** `mcp-remote.client.ts`, `runtime.tool-gateway.service.ts`, docs MCP.
- **Dependências:** 16M, 16N e 16O.

### Sprint 16Q — Integração MCP Read-only Homologada

- **Descrição:** primeira integração HTTP concreta somente contra um demo local, fictício e sem segredo.
- **Subtarefas concluídas:** servidor demo; Compose opt-in; readiness/discovery; transporte HTTP restrito; chamada real pelo gateway; `simulated=false`; UI, analytics, runbook e smoke.
- **Status atual:** Implementada para homologação local; produção e conectores corporativos continuam fail-closed.
- **Prioridade:** Alta.
- **Evidências:** `runtime/mcp-readonly-demo`, `mcp-readonly-demo-http.transport.ts`, `ORCHESTRA_MCP_READONLY_INTEGRACAO_HOMOLOGADA_16Q.md`.
- **Dependências:** 16P e hardening 16O.

### Backlog posterior — Qualidade Retrieval e Embeddings Reais

- **Descrição:** validar RAG com métricas e provider aprovado.
- **Subtarefas:** corpus; labels; embeddings reais; recall/precision/MRR; grounding; tuning top-K/threshold; regressão do modo stub; painel.
- **Status sugerido:** Planejado.
- **Prioridade:** Alta.
- **Evidências:** `knowledge.service.ts`, embeddings providers, testes 16K.
- **Dependências:** ambiente e observabilidade.

### Sprint 16R — Auditoria de Telas, Botões e Fluxos

- **Descrição:** remover comportamento local enganoso e fechar UX operacional.
- **Subtarefas:** mapear cada ação; implementar/desabilitar; prompt read-only/audit; filtros Audit; Admin CRUD; Chat sources/tools; acessibilidade/responsividade.
- **Status sugerido:** Planejado.
- **Prioridade:** Alta.
- **Evidências:** páginas Assistants, Knowledge, MCP, Audit e Admin.
- **Dependências:** endpoints e decisões de produto.

### Sprint 16S — E2E e Evals Contínuas

- **Descrição:** criar quality gates funcionais e de resposta.
- **Subtarefas:** Playwright login→assistant→knowledge→chat; fixtures seguras; runner AI quality; datasets; scorecards; CI; flake policy.
- **Status sugerido:** Planejado.
- **Prioridade:** Alta.
- **Evidências:** ausência de specs E2E; `modules/ai-quality`; `playwright-fixture.ts`.
- **Dependências:** ambiente estável de homologação.

### Sprint 16T — Segurança e Operação de Go-live

- **Descrição:** fechar controles de sessão, dados, incidentes e compliance.
- **Subtarefas:** secret fail-fast; revogação; CSRF review; retention; DLP; provider assessment; SIEM; SLO/on-call; DR; pentest; checklist go-live.
- **Status sugerido:** Backlog priorizado.
- **Prioridade:** Urgente.
- **Evidências:** `env.ts`, `session.ts`, models de conteúdo, ausência de infra externa versionada.
- **Dependências:** plataforma e owners de segurança/compliance.

### Sprint DOC — Atualização do Onboarding e Runbooks

- **Descrição:** alinhar a documentação de entrada ao estado real.
- **Subtarefas:** atualizar README raiz/docs; mapa de ambientes; OpenAPI; operação de migrations; backup/restore; owners; índice de runbooks.
- **Status sugerido:** Pronto para refinamento.
- **Prioridade:** Média.
- **Evidências:** `README.md`, `docs/README.md`, documentos dispersos em `docs/api` e `docs/operations`.
- **Dependências:** aprovação deste documento e decisões de produção.

## 22. Resumo Executivo Final

O Orchestra está em uma posição tecnicamente relevante: frontend e backend reais, domínio corporativo amplo, banco consistente, Chat persistente e rastreável, runtime desacoplado, bridge Agno funcional, RAG governado e matriz de resposta automatizada. Isso sustenta desenvolvimento e homologação local com controle.

Estão prontos como baseline: governança de Assistants, Auth/RBAC condicional, Conversations/AgentRun, contexto conversacional, runtime adapters, bridge Agno, Knowledge/RAG textual, embeddings opcionais, response scope, catálogo MCP, auditoria técnica, usage events e evals determinísticas.

Ainda faltam para produto operacional maduro: ampliação da observabilidade, conectores MCP corporativos reais, infraestrutura produtiva coerente, secret manager, sessão endurecida, E2E/CI/CD, quality loop com respostas reais, conectores e formatos avançados de Knowledge, UX sem placeholders e operação de incidentes/rollback.

O próximo passo recomendado é a fase de Observabilidade Operacional do Runtime Chat/RAG, seguida imediatamente por enforcement de custos/rate limits e hardening de produção. Avançar diretamente para MCP externo sem essas frentes aumenta risco de ação indevida, exfiltração, custo sem controle, diagnóstico lento e rollback incompleto.

As afirmações sobre código e artefatos têm evidência no repositório. Saúde de containers, banco aplicado, credenciais, provider, IdP, ingress, secret manager e ambiente externo atual permanecem **pendentes de confirmação**, pois não foram acessados nesta auditoria.
