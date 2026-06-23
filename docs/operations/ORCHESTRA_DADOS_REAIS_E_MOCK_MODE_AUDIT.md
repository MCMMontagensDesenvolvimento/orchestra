# Orchestra - Auditoria de Dados Reais, Mock Mode e Seeds

Fase 09A / Sprint 18
Escopo: auditoria documental de mocks, modo demo, seeds, fixtures e caminho para dados reais atuais.

Este documento nao altera codigo funcional, contratos HTTP, schema, migrations, autenticacao, RBAC, runtime, RAG, MCP ou LLM. Ele registra o estado observado e recomenda a politica operacional para as fases 09B-09F.

## Contexto

O Orchestra evoluiu de um frontend de alta fidelidade com dados mockados para uma fundacao fullstack com API, banco, autenticacao, governanca de assistants, Knowledge/RAG/MCP, runtime adapter e catalogo LLM. A transicao ainda convive com tres classes de dados:

- `mock mode` de frontend, controlado principalmente por `VITE_USE_MOCKS`, que evita chamadas reais ao backend.
- `backend real em modo local seguro`, com banco real, seeds de bootstrap e providers locais/deterministicos que nao chamam servicos externos.
- `fixtures/test doubles`, usados em testes automatizados e scripts de smoke locais.

A meta da Sprint 18 e deixar claro o que e real, o que e demonstrativo e o que deve ser bloqueado por ambiente antes de remover ou substituir mocks em fases futuras.

## Resumo Executivo

- O principal interruptor de mock do frontend e `VITE_USE_MOCKS`. O `.env.example` define `false`, mas o codigo em `frontend/src/lib/env.ts` usa fallback `true` quando a variavel esta ausente.
- Com `VITE_USE_MOCKS=true`, `ProtectedRoute` libera o app sem sessao real e a maioria dos services retorna dados locais de `frontend/src/data/mockData.ts`.
- `VITE_ENABLE_DEMO_MODE` existe no `.env.example`, mas nao foi encontrado como variavel consumida em `frontend/src`. O modo visual de chat/demo hoje esta codificado na pagina de Chat e nos tipos associados.
- Muitos nomes de variaveis nas paginas ainda usam prefixo `mock...`, mesmo quando os hooks podem estar retornando dados reais via API. Isso aumenta o risco de confusao operacional, mas nao e por si so uma fonte de mock.
- O backend ja possui bases reais e governadas: autenticacao/dev login/SSO, RBAC, assistants, Knowledge/RAG local, MCP sandbox, AgentRun, runtime adapter e LLM catalog. Mocks de backend aparecem majoritariamente em testes, scripts de smoke e adapters locais/deterministicos.
- O seed Prisma e idempotente e cria bootstrap real minimo por padrao: tenant, workspace, usuario admin de desenvolvimento, roles, permissoes, membership e userRole. Assistant exemplo existe apenas no seed demo opcional, bloqueado por ambiente production-like.
- Provedores externos de LLM nao sao chamados pelo frontend. A chamada real de OpenAI, quando habilitada, existe somente no backend e e governada por flags, configuracao e sanitizacao.

## Inventario de Variaveis de Ambiente

### Frontend

| Variavel | Consumida hoje | Default observado | Efeito operacional | Politica recomendada |
| --- | --- | --- | --- | --- |
| `VITE_API_BASE_URL` | Sim, em `frontend/src/lib/env.ts` e `api-client.ts` | `/api/v1` no codigo; `http://localhost:3000/api/v1` no exemplo | Origem/base das chamadas reais ao backend | Obrigatoria em local com frontend/backend separados; validada em staging/prod |
| `VITE_USE_MOCKS` | Sim | `true` se ausente no codigo; `false` no exemplo | Liga mocks globais de services e bypass de rota protegida | `true` apenas em testes/prototipo; `false` em local real, staging e producao |
| `VITE_MOCK_DELAY_MS` | Sim | `400` | Delay artificial dos mocks | Apenas teste/prototipo; `0` em testes rapidos quando necessario |
| `VITE_MOCK_SCENARIO` | Sim | `success` | Simula `success`, `empty`, `error`, `forbidden` em mocks | Apenas teste/prototipo |
| `VITE_ENABLE_DEMO_MODE` | Declarada, nao encontrada em uso funcional | `true` no exemplo | Hoje nao controla o app | 09B deve decidir remover, implementar ou documentar como legado |
| `VITE_APP_NAME`, `VITE_APP_ENV`, `VITE_ENABLE_PWA`, `VITE_DEFAULT_LOCALE`, `VITE_DEFAULT_TIMEZONE` | Declaradas, nao encontradas como lidas por `frontend/src/lib/env.ts` | Valores de exemplo | Metadados/planejado | Classificar como app metadata ou remover em 09B/09C |

### Backend - Core/Auth

| Variavel | Consumida hoje | Default observado | Efeito operacional | Politica recomendada |
| --- | --- | --- | --- | --- |
| `NODE_ENV`, `PORT`, `DATABASE_URL`, `FRONTEND_ORIGIN` | Sim | Desenvolvimento local | Ambiente, porta, banco e CORS/origem do frontend | Obrigatorias por ambiente |
| `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS`, `COOKIE_NAME`, `COOKIE_SECURE`, `COOKIE_SAME_SITE` | Sim | Defaults locais | Sessao/cookie | Segredo forte e cookie seguro em staging/prod |
| `DEV_LOGIN_ENABLED` | Sim | `false` no schema; `true` no `.env.example` | Habilita login dev | Permitido somente local/test; `false` em staging/prod |
| `MICROSOFT_SSO_ENABLED`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`, `MICROSOFT_REDIRECT_URI`, `MICROSOFT_ALLOWED_DOMAINS`, `MICROSOFT_ALLOWED_TENANT_IDS`, `MICROSOFT_POST_LOGOUT_REDIRECT_URI`, `MICROSOFT_SSO_AUTO_LINK_BY_EMAIL` | Sim | SSO desabilitado por default | SSO Microsoft backend-only | Segredos apenas no backend; auto-link por janela controlada, nunca default permanente |

### Backend - Runtime e LLM

| Variavel | Consumida hoje | Default observado | Efeito operacional | Politica recomendada |
| --- | --- | --- | --- | --- |
| `RUNTIME_PROVIDER`, `RUNTIME_ADAPTER_ENABLED`, `RUNTIME_DEFAULT_TIMEOUT_MS`, `RUNTIME_REQUEST_TIMEOUT_MS`, `RUNTIME_REQUIRE_PRECHECK`, `RUNTIME_ALLOW_PROVIDER_FALLBACK`, `RUNTIME_ALLOW_EXTERNAL_TOOLS` | Sim | Provider `local`, adapter ligado, precheck ligado, ferramentas externas bloqueadas | Seleciona runtime e politicas de execucao | `local`/sandbox para dev; fallbacks e ferramentas externas bloqueados ate governanca explicita |
| `AGNO_ENABLED`, `AGNO_EXECUTION_ENABLED`, `AGNO_BASE_URL`, `AGNO_API_KEY`, `AGNO_TIMEOUT_MS`, `AGNO_HEALTHCHECK_ENABLED`, `AGNO_HEALTH_PATH`, `AGNO_CAPABILITIES_PATH`, `AGNO_EXECUTE_PATH`, `AGNO_REQUIRE_SANDBOX`, `AGNO_ALLOW_EXTERNAL_TOOLS`, `AGNO_ALLOW_REMOTE_MCP`, `AGNO_SEND_RAG_CONTEXT`, `AGNO_SEND_MCP_TOOL_DESCRIPTORS`, `AGNO_MAX_INPUT_PREVIEW_CHARS`, `AGNO_MAX_OUTPUT_PREVIEW_CHARS` | Sim | Agno desabilitado, sandbox exigido | Runtime Agno local/HTTP governado | Manter fail-closed; habilitar apenas em ambiente controlado |
| `LLM_PROVIDERS_ENABLED`, `LLM_DEFAULT_PROVIDER`, `LLM_EXECUTION_ENABLED`, `LLM_PROVIDER_TIMEOUT_MS`, `LLM_MAX_INPUT_PREVIEW_CHARS`, `LLM_MAX_OUTPUT_PREVIEW_CHARS`, `LLM_STORE_RAW_PROMPTS`, `LLM_STORE_RAW_OUTPUTS` | Sim | Providers/execution false no schema; local deterministic como default | Catalogo e execucao LLM backend-only | Nao armazenar prompt/output bruto; local deterministic para sandbox |
| `OPENAI_ENABLED`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_DEFAULT_MODEL`, `OPENAI_EXECUTION_ENABLED` | Sim | OpenAI desabilitado no schema; habilitado como exemplo sem chave | Provider OpenAI backend-only | Segredo somente no backend; nunca expor no frontend; execucao desligada salvo aprovacao |
| `AZURE_OPENAI_ENABLED`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_EXECUTION_ENABLED` | Sim | Desabilitado | Provider planejado/fail-closed | Segredo somente no backend |
| `ANTHROPIC_ENABLED`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_DEFAULT_MODEL`, `ANTHROPIC_EXECUTION_ENABLED` | Sim | Desabilitado | Provider planejado/fail-closed | Segredo somente no backend |

### Backend - Placeholders no `.env.example`

As variaveis `LLM_PROVIDER_EXECUTION_ENABLED`, `LLM_TEST_GENERATION_ENABLED`, `LLM_ALLOW_TEST_GENERATION`, `OPENAI_PROVIDER_ENABLED`, `EMBEDDING_PROVIDER`, `EMBEDDING_API_KEY`, `VECTOR_DATABASE_URL`, `VECTOR_DATABASE_API_KEY`, `MCP_SERVER_URL`, `MCP_SERVER_API_KEY`, `AI_RUNTIME_URL`, `AI_RUNTIME_API_KEY`, `AI_TRACE_ENABLED`, `AI_TOKEN_BUDGET_DAILY` e `AI_COST_ALERT_THRESHOLD` aparecem no exemplo, mas nao foram encontradas como consumidas pelo schema atual em `backend/src/config/env.ts`.

Politica: tratar como variaveis futuras/legadas ate 09B validar se devem ser removidas do exemplo, incorporadas ao schema ou movidas para documentacao de backlog. Seus valores nunca devem ser documentados.

## Inventario Frontend

| Area | Arquivos principais | Estado atual | Risco/observacao |
| --- | --- | --- | --- |
| Leitura de env | `frontend/src/lib/env.ts`, `frontend/src/vite-env.d.ts`, `frontend/.env.example` | Centraliza `useMocks`, `mockDelayMs`, `mockScenario`, `apiBaseUrl` | Fallback `VITE_USE_MOCKS=true` pode ativar mock sem intencao |
| API client | `frontend/src/services/api/api-client.ts`, `frontend/src/services/api/endpoints.ts` | Axios central com `baseURL=env.apiBaseUrl` e cookies | Sem chamada direta a providers externos |
| Mock utilities | `frontend/src/services/mocks/mock-utils.ts`, `frontend/src/services/mocks/index.ts` | `mockResponse` suporta success/empty/error/forbidden e delay | Bom para testes; perigoso se ativo em staging/prod |
| Mock datasets | `frontend/src/data/mockData.ts` | Assistants, versions, feedback, tests, knowledge bases, docs, MCP, chat, audit, analytics e users | Dados parecem corporativos/reais; devem ficar marcados como demo |
| Auth | `frontend/src/services/auth.service.ts`, `frontend/src/components/auth/ProtectedRoute.tsx`, `frontend/src/pages/Auth/LoginPage.tsx` | Mock session e SSO mock quando `useMocks`; rota protegida libera com mocks | Maior risco: bypass de autenticacao em mock mode |
| Dashboard/Analytics/Audit | `dashboard.service.ts`, `analytics.service.ts`, `audit.service.ts` e paginas correspondentes | Retornam mocks quando `useMocks`; API real quando falso | Dados mockados podem parecer metricas reais |
| Assistants | `assistants.service.ts`, paginas de assistants | API real para CRUD/governanca quando mocks off; fallback/mock para testes e algumas visoes | Variaveis locais `mock...` confundem leitura do codigo |
| Knowledge/RAG | `knowledge.service.ts`, paginas de Knowledge | API real para catalogo, ingestion, readiness e RAG local quando mocks off | Mocks geram chunks/source references simulados |
| MCP | `mcp.service.ts`, paginas MCP | API real para catalogo, bindings, precheck e tool calls quando mocks off | Sandbox real/local existe; mocks simulam tool calls |
| Agent runs/runtime/LLM | `agent-runs.service.ts`, `runtime.service.ts`, `llm.service.ts` | API real quando mocks off; providers locais simulados em mock mode | Catalogos devem ser exibidos como governados, nao como chamada externa |
| Chat | `chat.service.ts`, `pages/Chat/ChatPage.tsx`, `types/chat.ts` | Chat visual continua explicitamente mockado/prototipo | Nao deve ser apresentado como runtime real |
| Settings/users/roles/workspaces | Services especificos | Mocks ou API simples conforme dominio | Necessita triagem de pronto/placeholder em 09C |
| Testes frontend | `frontend/src/test/**` | Testes usam mocks/vi.mock e validam services | OK para test; env deve ser explicita para evitar flakiness |

## Inventario Backend

| Area | Arquivos principais | Estado atual | Risco/observacao |
| --- | --- | --- | --- |
| Env schema | `backend/src/config/env.ts` | Zod centraliza defaults e parsing | Alguns defaults locais sao inseguros fora de local; `.env.example` tem placeholders nao consumidos |
| Auth/SSO | `backend/src/modules/auth/**` | SSO Microsoft real backend-only; dev-login controlado por flag | `DEV_LOGIN_ENABLED` deve ser false fora de local/test |
| RBAC | Prisma seed, auth context, middlewares/repos | Permissoes e roles reais persistidas | Seed precisa ser politica de bootstrap, nao fixture de negocio |
| Assistants/governance | `backend/src/modules/assistants/**` | Dados reais persistidos via Prisma | Sem mock funcional relevante fora dos testes |
| Knowledge/RAG | `backend/src/modules/knowledge/**` | Catalogo, ingestion/chunking e query local deterministica | RAG semantico/vector store ainda fora do escopo |
| MCP | `backend/src/modules/mcp/**` | Catalogo e sandbox local governado | MCP externo real ainda fora do escopo; manter sandbox como modo seguro |
| AgentRun/runtime | `backend/src/modules/agent-runs/**`, `backend/src/modules/runtime/**` | Runtime local deterministico, Agno stub/local opcional, eventos persistidos | Fakes/adapters locais devem ser explicitados como control plane seguro |
| LLM | `backend/src/modules/llm/**` | Catalogo sanitizado, local deterministic, OpenAI backend-only, Azure/Anthropic fail-closed | OpenAI real so pode ser chamado pelo backend quando flags e secrets permitirem |
| Testes backend | `backend/tests/**` | Mocks, fixtures e `vi.stubGlobal(fetch)` em tests | Aceitavel; nao confundir com runtime produtivo |
| Scripts | `scripts/smoke-local.sh`, `scripts/smoke-agno-local.sh`, `scripts/agno-mock-runtime.mjs` | Smokes locais e runtime Agno mockado | Dev-only; nao usar em staging/prod |

## Inventario de Seeds e Bootstrap

| Fonte | Conteudo criado/usado | Classificacao | Politica recomendada |
| --- | --- | --- | --- |
| `backend/prisma/seed.ts` | Tenant `orchestra-dev`, workspace default, usuario admin de desenvolvimento, roles, permissoes, membership e userRole | Bootstrap local/dev | Idempotente e util localmente; bloquear uso irrestrito em staging/prod |
| `backend/prisma/seed.ts` | Assistant exemplo somente com opt-in demo, versao draft, instrucoes dummy e `runtimeEnabled=false` | Fixture de validacao local opcional | Manter bloqueado em staging/producao e validar idempotencia com banco local |
| `backend/tests/**` | Fixtures de tenants, users, assistants, runs, RAG, MCP, SSO | Test-only | Manter isolado; nunca depender desses dados fora do runner |
| `frontend/src/data/mockData.ts` | Dados demo de produto, usuarios, conversas, documentos e ferramentas | Demo/mock frontend | Permitido so com `VITE_USE_MOCKS=true`; adicionar banner/guard em 09B |
| `scripts/agno-mock-runtime.mjs` | Runtime HTTP local deterministic para smoke Agno | Dev/smoke-only | Nunca configurar como runtime de staging/prod |

## Politica Proposta Por Ambiente

| Ambiente | Frontend | Backend auth | Runtime/LLM | Seeds/fixtures | Observabilidade minima |
| --- | --- | --- | --- | --- | --- |
| Test | `VITE_USE_MOCKS=true` permitido de forma explicita; delay baixo/zero | Dev-login/mocks apenas no runner | Providers fakes/stubs permitidos | Fixtures isoladas | Testes devem declarar env, nao depender de fallback |
| Local dev prototipo | `VITE_USE_MOCKS=true` permitido com banner/demo claro | Dev-login permitido | Sem provider externo real | Mock data permitido | Nao validar dados como reais |
| Local dev real | `VITE_USE_MOCKS=false`; `VITE_API_BASE_URL` apontando para backend | Dev-login opcional; SSO opcional | Runtime local deterministic; LLM local deterministic; OpenAI off salvo teste governado | Seed bootstrap permitido | Smoke local e checagem de endpoints |
| Staging | `VITE_USE_MOCKS=false`; demo off | SSO real; dev-login false; auto-link somente janela controlada | External providers off por default; habilitacao por change control | Seed apenas bootstrap minimo; sem fixtures demo | Auditoria, health e grep de secrets |
| Producao | `VITE_USE_MOCKS=false`; demo off | SSO real; dev-login false; auto-link false por default | Provedores reais so por backend, com flags e segredos gerenciados | Sem fixtures; dados reais por processos operacionais | Logs/auditoria/alertas sem prompt/output bruto |

## Principais Riscos

- Mock mode acidental: fallback `VITE_USE_MOCKS=true` pode ativar mocks quando a variavel nao e definida.
- Bypass de autenticacao: `ProtectedRoute` retorna `<Outlet />` em mock mode.
- Dados demonstrativos com aparencia real: nomes, custos, datas, documentos e ferramentas no mock dataset podem ser confundidos com dados de producao.
- Variaveis declaradas mas nao consumidas: `VITE_ENABLE_DEMO_MODE` e placeholders backend podem gerar falsa sensacao de controle.
- Seed Prisma separado na 09C: bootstrap padrao real/idempotente; assistant exemplo apenas com opt-in demo.
- Nomes `mock...` em paginas dificultam distinguir dado real de dado demonstrativo durante manutencao.
- Backend `.env.example` habilita algumas flags locais/convenientes; sem checklist, isso pode vazar para ambientes superiores.
- OpenAI real existe no backend: a fronteira esta correta, mas qualquer habilitacao deve ser tratada como mudanca governada e auditavel.

## Recomendacoes Para 09B-09F

### 09B - Politica de ambiente e guard rails

- Tornar `VITE_USE_MOCKS` explicitamente obrigatoria por ambiente ou fail-closed quando ausente fora de test/prototipo.
- Criar indicador visual/telemetrico de mock mode em ambientes locais.
- Decidir destino de `VITE_ENABLE_DEMO_MODE`: implementar, remover ou manter como legado documentado.
- Separar `.env.example` por perfil ou comentar com "local only", "staging/prod forbidden" e "future placeholder".

### 09C - Remocao progressiva de dependencia visual de mocks

- Renomear variaveis locais `mock...` nas paginas que ja recebem dados reais de hooks.
- Substituir Dashboard/Analytics/Audit por chamadas reais ou empty states honestos.
- Manter Chat explicitamente como prototipo ate existir contrato real de conversa/runtime.

### 09D - Seeds e fixtures por finalidade

- Manter seed de bootstrap obrigatorio separado do seed demo opcional.
- Adicionar comando/documentacao para aplicar apenas bootstrap em staging/prod.
- Manter assistant exemplo condicionado a flag local/demo e bloqueado em ambientes production-like.

### 09E - Validacao fullstack com dados reais

- Criar smoke `frontend + backend + db` com `VITE_USE_MOCKS=false`.
- Validar login, `/auth/me`, catalogos, assistants, Knowledge/RAG local, MCP sandbox, runtime e LLM catalog sem mocks frontend.
- Adicionar grep/checagem CI para impedir mock mode em builds de staging/prod.

### 09F - Hardening operacional

- Formalizar runbook de promocao local -> staging -> producao.
- Confirmar que prompts e outputs brutos nao sao persistidos/renderizados.
- Confirmar que segredos ficam apenas em backend/secret manager.
- Manter OpenAI e demais providers como backend-only, com auditoria e flags de execucao.

## Atualizacao 09B - Guardrails Implementados

- `VITE_USE_MOCKS` passou a ser opt-in: ausente, vazio, falso ou invalido resulta em `useMocks=false`.
- Mock mode e permitido somente em `test`, `local`, `development`, `dev`, `prototype` e `prototipo`.
- `staging`, `homolog`, `homologation`, `production` e `prod` bloqueiam o bootstrap quando `VITE_USE_MOCKS=true`.
- Ambientes desconhecidos tambem falham fechado quando solicitam mock mode.
- `ProtectedRoute` so libera acesso sem sessao quando `useMocks=true` e `mockModeAllowed=true`.
- O setup do Vitest fixa um baseline `test` com mocks desligados. Testes que exercitam services mockados habilitam mocks por mock de modulo explicito, sem depender de `frontend/.env`.
- `VITE_ENABLE_DEMO_MODE` permanece como placeholder legado e nao recebeu comportamento funcional nesta fase.


## Atualizacao 09C - Bootstrap Real e Seed Demo

- `backend/prisma/seed.ts` passou a executar bootstrap real/idempotente por padrao, sem criar assistant demo automaticamente.
- Dados demo ficam condicionados a opt-in explicito por `ORCHESTRA_SEED_DEMO=true`, `SEED_DEMO_DATA=true` ou `--demo`.
- Demo seed e bloqueado em `production`, `prod`, `staging`, `homolog` e `homologation`.
- O bootstrap padrao cria tenant, workspace, usuario admin local/dev, roles, permissions, memberships e user roles.
- O seed nao cria `ExternalIdentity` Microsoft fake; usuarios reais devem ser vinculados pelo fluxo SSO real.
- O runbook operacional esta em `docs/operations/ORCHESTRA_BOOTSTRAP_E_SEEDS.md`.

## Atualizacao 09D - API real sem fallback implicito

### Dominios estabilizados

- Auth/session, Assistants, Audit, Knowledge, MCP, AgentRun, Runtime e catalogo LLM continuam usando seus endpoints reais quando `VITE_USE_MOCKS=false`; falhas desses services sao propagadas, sem `catch` que devolva dataset demo.
- O Dashboard em modo real passou a agregar somente Assistants, Audit e catalogo MCP vindos do backend. Contadores fixos, custos, conversas e tendencias demonstrativas ficam restritos ao componente de mock mode.
- O detalhe de Assistant usa exclusivamente `GET /assistants/:id` como fonte do registro. Uma falha ou ausencia nao e mais substituida pelo item equivalente ou pelo primeiro item da listagem.
- Bindings de Knowledge e MCP no detalhe de Assistant usam o contrato real. O fallback para IDs embutidos no dataset do Assistant permanece apenas quando mock mode esta explicitamente ativo.
- O catalogo LLM e o runtime continuam backend-only e sanitizados; nenhum provider externo e chamado diretamente pelo frontend.

### Prototipos explicitos

- Chat permanece um simulador visual. Com mock mode desligado, a rota mostra um estado explicito de prototipo indisponivel e nao consulta nem renderiza conversas, mensagens, fontes ou tool calls demo.
- Analytics consolidado ainda nao possui endpoint backend. O service retorna lista vazia em modo real e a pagina mostra empty state honesto; graficos e custos estaticos aparecem somente no mock mode.
- Analytics por Assistant permanece visivel somente no mock mode. Em modo real, a aba explica que o contrato agregado ainda nao existe.
- A timeline detalhada de uma Knowledge Base continua demonstrativa apenas no mock mode. Em modo real, a aba exibe estado indisponivel em vez de eventos ficticios.

### Fallbacks removidos ou bloqueados

- Removido o fallback do detalhe de Assistant para dados da listagem e para o primeiro Assistant disponivel.
- Bloqueado o uso de dados agregados demo no Dashboard real.
- Bloqueada a montagem do Chat demo quando `VITE_USE_MOCKS=false`.
- Bloqueados graficos de Analytics e eventos locais de Knowledge no modo de API real.
- O erro de Chat sem contrato real passou a ser uma rejeicao assincrona consistente, sem retorno de mensagens mockadas.

### Testes adicionados

- Services maduros sao exercitados com `useMocks=false` e seus endpoints backend sao verificados.
- Falha de API em Assistants e validada como erro propagado, sem retorno silencioso do dataset local.
- Analytics e Chat sao validados como dominios sem fallback demo no modo real.
- Dashboard e Chat sao renderizados em testes com mock mode desligado para comprovar os estados honestos.

### Pendencias para 09E e 09F

- Executar smoke fullstack com frontend, backend e banco reais para Auth, Assistants, Audit, Knowledge, MCP, AgentRun, Runtime e LLM.
- Criar contrato backend de Analytics e de conversas antes de habilitar essas experiencias no modo real.
- Continuar a troca de nomes locais `mock...` em paginas secundarias de MCP, Knowledge e Wizard, sem refatoracao ampla.
- Revisar estados de erro das queries secundarias em telas de detalhe, onde a query principal ja e real mas paineis auxiliares ainda podem mostrar apenas vazio.
- Adicionar verificacao de CI para builds production-like com mock mode bloqueado e para impedir novos fallbacks de erro para datasets demo.

## Atualizacao 09E - Smoke Fullstack com Dados Reais

- Criado `scripts/smoke-fullstack-real.sh` para validar `frontend`, `backend` e `db` reais sob `docker-compose.dev.yml`.
- O script falha se `VITE_USE_MOCKS=true` estiver configurado nos arquivos de ambiente ou no container frontend.
- Migrations sao verificadas por `prisma migrate status`; o script nao aplica migrations automaticamente.
- O bootstrap padrao roda com `ORCHESTRA_SEED_DEMO=false` e `SEED_DEMO_DATA=false` forcados.
- O contador do Assistant demo e comparado antes e depois do bootstrap, impedindo que o smoke real introduza fixture demo.
- Health, database health, frontend login e configuracao SSO sanitizada sao sempre validados.
- Endpoints autenticados sao exercitados com dev-login apenas em ambiente local nao produtivo.
- Quando dev-login esta desabilitado, checks autenticados sao marcados como `SKIPPED` e o fluxo manual Microsoft e documentado.
- O smoke aceita catalogos reais vazios e nao cria registros de negocio para obter sucesso.
- O runbook completo esta em `docs/operations/ORCHESTRA_SMOKE_FULLSTACK_DADOS_REAIS.md`.

## Criterios de Aceite da Sprint 18

- Documento de auditoria criado em `docs/operations/`.
- Inventario de env vars, frontend, backend, seeds, fixtures e scripts registrado.
- Politica proposta por ambiente documentada.
- Recomendacao clara para 09B definida.
- Nenhum codigo funcional, schema ou migration alterado.
- Nenhum segredo, token ou valor real de credencial documentado.
- Validacoes documentais executadas: `git diff --check`, `git status --short`, `git diff --stat` e greps solicitados.

## Checklist Operacional Local

1. Confirmar perfil desejado: prototipo mockado ou local real.
2. Para local real, definir no frontend: `VITE_USE_MOCKS=false` e `VITE_API_BASE_URL=http://localhost:3000/api/v1`.
3. Para prototipo mockado, definir `VITE_USE_MOCKS=true` de forma explicita e nao validar dados como reais.
4. No backend local, usar banco local, segredo JWT local, `DEV_LOGIN_ENABLED=true` apenas se necessario e SSO conforme teste.
5. Rodar migrations e seed de bootstrap local.
6. Subir backend e frontend.
7. Verificar `/api/v1/auth/me`, `/api/v1/llm/providers`, `/api/v1/runtime/providers`, catalogos de assistants/Knowledge/MCP.
8. Confirmar que respostas de LLM/runtime indicam local deterministic ou provider real governado pelo backend.
9. Antes de staging/prod, garantir `VITE_USE_MOCKS=false`, `DEV_LOGIN_ENABLED=false`, demo off, SSO real, secrets em backend/secret manager e seed demo desabilitado.

## Fora de Escopo Nesta Fase

- Remover mocks do frontend.
- Implementar troca completa mock -> real.
- Alterar backend, schema, migrations ou contratos HTTP.
- Alterar autenticacao, RBAC, runtime, RAG, MCP, LLM ou SSO.
- Implementar execucao real de MCP externo, RAG semantico, embeddings ou vector store.
- Habilitar OpenAI ou qualquer provider externo pelo frontend.
- Commitar alteracoes.
