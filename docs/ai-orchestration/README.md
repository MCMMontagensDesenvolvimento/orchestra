# AI Orchestration

Status: preparado. A Sprint 14/Fase 11 foi fechada com MCP remoto governado ate repository real transacional/idempotente e API interna admin read-only para entries e ledgers. A Fase 06 criou catalogo governado de Knowledge/RAG/MCP, a Fase 06B adicionou readiness local com chunks textuais, a Fase 06C adicionou query RAG local com citations, a Fase 06D adicionou MCP execution sandbox, a Fase 07A adicionou Runtime Adapter Boundary, a Fase 07B adicionou Agno local runtime opcional, a Fase 07C adicionou LLM Provider Integration controlada, a Fase 11A documenta discovery/contrato para MCP remoto real governado, a Fase 11B adiciona a base backend fail-closed de readiness/client stub MCP remoto, a Fase 11C adiciona discovery remoto governado com transporte injetavel, sanitizacao, diff e policy bloqueada por default, a Fase 11D adiciona review package/audit/approval gate para discovery remoto sem importar tools no catalogo, a Fase 11E adiciona import plan governado para catalogo como draft nao aplicavel, a Fase 11F adiciona apply service backend-only com repository/transaction boundary, autorizacao explicita, idempotencia e auditoria sanitizada, a Fase 11G adiciona o adapter de persistencia fail-closed apos discovery do schema atual, com erro controlado e auditoria sanitizada, a Fase 11H documenta o design da migration futura com entry remota, apply ledger, constraints e materializacao posterior, sem alterar o schema, a Fase 11I implementa a migration/schema base com `McpRemoteCatalogEntry`, `McpRemoteCatalogApplyLedger`, defaults/CHECKs fail-closed e testes estruturais, a Fase 11J implementa o repository real transacional/idempotente sobre essas tabelas sem endpoint, runtime ou materializacao operacional, a Fase 11K adiciona API interna admin read-only para consultar entries e ledgers com RBAC, scoping e DTOs sanitizados, e a Fase 11L consolida fechamento/hardening documental da Sprint 14. Runtime produtivo de IA, MCP externo real, tool calls produtivos fora do sandbox, materializacao em `McpTool` e integracao Agno/AgentOS produtiva continuam fora do escopo ate as proximas subfases.

A Fase 12A adiciona a fundacao backend de observabilidade de uso/custos de IA com migration `AiRunUsageEvent`, repository/service/tipos e testes, sem dashboard, limites automaticos, billing, runtime produtivo ou tracking bruto de prompt/response.

A Fase 12B adiciona a fundacao backend de limites e quotas de IA com `AiUsageLimitPolicy`, agregacao read-only sobre `AiRunUsageEvent` e evaluator para tenant/workspace/assistant/user em modos monitor_only/enforce, sem plugar enforcement no runtime.

A Fase 12C adiciona API admin read-only de observabilidade com `audit.read`, scoping por tenant/workspace, eventos e summary bigint-safe, leitura de policies e simulacao de limites sem persistencia ou runtime.

A Fase 12D adiciona fundacao backend de alertas governados de observabilidade com `AiObservabilityAlertRule`, evaluator read-only sobre `AiRunUsageEvent`, API admin de leitura/simulacao e garantias explicitas de ausencia de delivery real, scheduler, frontend, billing ou runtime enforcement.

A Fase 12E consolida o fechamento documental da Sprint 16/Fase 12 com linha do tempo, arquitetura entregue, modelos/tabelas, API admin, seguranca, validacoes, riscos remanescentes e backlog recomendado, sem alterar codigo ou criar feature nova.

A Fase 13A adiciona a fundacao backend de avaliacao simples de qualidade de assistentes de IA com test sets, test cases, evaluation runs/results, evaluator deterministico por assertions e API admin read-only/simulacao, sem LLM real, LLM-as-judge, runtime, MCP remoto, Agno produtivo, worker, scheduler, dashboard ou billing.

A Fase 13B adiciona evaluation runs deterministicos persistidos e snapshots sanitizados de assistant/test set, com criacao admin explicita de run/results por `candidateOutput` fornecido no body, sem executar LLM/provider/runtime/MCP/Agno e sem scheduler, worker, dashboard ou billing.

A Fase 13C adiciona `ai.quality.read`/`ai.quality.write`, CRUD governado e auditado de test sets/test cases, autoria de casos e lifecycle archive/restore, mantendo evaluator e runs deterministicos sem LLM/provider/runtime/MCP/Agno.

A Fase 13D consolida o fechamento documental da Sprint 19/Fase 13 com arquitetura entregue, rotas, RBAC, garantias de seguranca/privacidade, snapshots, runbook operacional, checklist tecnico, riscos remanescentes e backlog recomendado. A Fase 13 fica consolidada como avaliacao deterministica governada, sem LLM-as-judge, sem provider externo, sem runtime automatico, sem MCP/Agno produtivo, sem scheduler/worker/queue/dashboard/billing.

A Fase 14A adiciona o contrato versionado `AssistantRuntimeSpecV1` e schemas Zod strict para request/response, eventos, erros, health e capabilities de um runtime Agno-compatible futuro. A entrega e contract-first, sem habilitar Agno por padrao, sem execucao real nova, sem frontend, sem migration e sem transferir RBAC/governanca ao runtime externo.

A Fase 14B adiciona um servico HTTP minimo Agno-compatible com `/health`, `/capabilities` e `/execute`, validacao pelo contrato 14A, resposta sandbox deterministica e erros normalizados. A entrega nao pluga o backend principal no runtime, nao chama provider externo, nao executa RAG/MCP real e nao habilita Agno por padrao.

A Fase 14C adiciona o adapter backend `agno_http`, client HTTP server-to-server e builder de `AssistantRuntimeSpecV1` para conectar o backend principal ao runtime HTTP minimo da 14B de forma governada, fail-closed e desligada por padrao, sem frontend, migration, provider externo real ou RAG/MCP real dentro do runtime.

A Fase 14D conecta o endpoint real de `AgentRun` ao provider `agno_http` via runtime registry, preservando o default local, validacao dos contratos V1, fail-closed, eventos/metadata sanitizados e isolamento completo do frontend, sem provider externo, RAG/MCP real ou migration.

A Fase 14E adiciona RAG governado no runtime Agno HTTP, enviando ao `agno_http` somente `rag.mode=resolved_context` com fontes ja resolvidas, sanitizadas e limitadas pelo Orquestra, atras de flag desligada por padrao e sem retrieval livre no runtime.

A Fase 14F adiciona descriptors governados de tools/MCP ao runtime Agno HTTP, usando `tools.mode=gateway` somente com flag explicita, allowlist, limites e metadata sanitizada, sem descoberta livre, MCP remoto direto ou tool execution externa pelo Agno.

A Fase 14G adiciona observabilidade, limites e auditoria ponta a ponta no caminho `AgentRun -> agno_http -> runtime HTTP`, com traceId/runId/requestId, usage, latencia, status, erro, summaries de RAG/tools e audit metadata sanitizada, sem payload bruto, provider externo, MCP remoto direto ou tool execution nova.

A Fase 16P adiciona a fundação opt-in de MCP externo read-only: allowlist/SSRF, referências lógicas de secret, client/transporte injetável, revalidação no gateway e observabilidade sanitizada. O transporte default permanece fail-closed e nenhuma chamada externa produtiva é habilitada por padrão. Consulte `ORCHESTRA_MCP_EXTERNO_READONLY_16P.md`.

A Fase 16Q homologa a primeira integração MCP/HTTP real somente contra o servidor local fictício `runtime/mcp-readonly-demo`, com health/readiness/discovery, `catalog.search`, `catalog.get_status`, exceção HTTP exata proibida em produção, gateway governado e distinção `simulated=false` para o demo. Produção e conectores corporativos continuam fail-closed. Consulte `ORCHESTRA_MCP_READONLY_INTEGRACAO_HOMOLOGADA_16Q.md`.

A Fase 16S adiciona evals contínuas, determinísticas, offline e provider-free para qualidade e segurança, incluindo gates do conector corporativo, defaults fechados, bloqueio de escrita e ausência de payload bruto. Consulte `ORCHESTRA_EVALS_QUALIDADE_SEGURANCA_16S.md`.

A Fase 16T prepara o boundary governado do conector corporativo read-only com a única tool `corporate.status.read`, origem HTTPS exata, egress/SSRF, `secretRef` lógico, resposta limitada e observabilidade sanitizada. Ela não configura nem chama endpoint corporativo real e mantém o adapter desabilitado por default. Consulte `ORCHESTRA_CONECTOR_CORPORATIVO_READONLY_16T.md`.

A Fase 16U prepara a homologação supervisionada desse boundary: checklist de aprovação, preflight sem rede, readiness acompanhada, uma única execução manual autorizada, SQL allowlistado, evidências, rollback e encerramento. Endpoint e segredo reais permanecem fora do Git; nenhuma chamada real ocorre em CI, smoke ou preflight e a abertura só pode acontecer manualmente durante uma janela aprovada. Consulte `ORCHESTRA_HOMOLOGACAO_SUPERVISIONADA_CONECTOR_READONLY_16U.md`.

A Fase 16V cria o alvo seguro no próprio backend do Orchestra para a futura tool `corporate.status.read`: `GET /v1/status` e `GET /v1/status/availability`, com payload estrito e não sensível. Ela preserva `/health`, não executa MCP real e mantém os defaults remotos fail-closed. Consulte `ORCHESTRA_ENDPOINT_STATUS_READONLY_16V.md`.

A Fase 16W prepara a primeira execução supervisionada com harness offline, check local, SQL allowlistado e smoke estático. A análise adota a Opção C: não cria exceção HTTP corporativa nem `--run-once-local`, porque o transporte exige HTTPS/egress público e o contrato estrito da 16V ainda não coincide com o contrato esperado pelo adapter 16T. Nenhuma chamada real ocorreu; a execução única fica condicionada a ambiente HTTPS homologado. Consulte `ORCHESTRA_PRIMEIRA_EXECUCAO_REAL_TOOL_STATUS_16W.md`.

A Fase 16X alinha `corporate.status.read` ao contrato estrito da 16V: `ok|degraded`, `summary` limitado e `updatedAt` ISO. A execução da tool usa `/v1/status` ou `/v1/status/availability`; `/health` permanece readiness e é normalizado sem propagar `service` ou `requestId`. HTTPS exato, egress/SSRF, GET-only, `secretRef`, limites e defaults fail-closed permanecem intactos. Houve alinhamento funcional do mapper, mas nenhuma chamada real, UI/CRUD MCP ou associação a Assistant. Consulte `ORCHESTRA_ALINHAMENTO_TOOL_STATUS_ENDPOINT_16X.md`.

A Fase 16Y prepara a readiness HTTPS para a origem backend/API prevista `https://api.orchestra.mcm.eng.br`, com preflight estrutural, igualdade textual de allowlists, paths e contrato fixos, template HTTPS sem execução e SQL allowlistado. A 16Y não executa chamada real, não testa UI/CRUD MCP e não associa MCP a Assistant; o CI roda somente o smoke offline em `--dry-run`. A 16Z recebe esse handoff como preparação de publicação, não como autorização de execução real. Consulte `ORCHESTRA_READINESS_HTTPS_TOOL_STATUS_16Y.md`.

A Fase 16Z documenta e valida offline a futura publicação HTTPS, separando frontend e backend/API e cobrindo DNS, TLS, reverse proxy, Docker Compose, environment, secrets, CORS/cookies, health/readiness e rollback. O ambiente ainda é local; as URLs planejadas não estão ativas. A 16Z não publica, não executa chamada real, não executa MCP real e mantém UI/CRUD MCP fora de escopo. A primeira execução da tool fica para uma fase posterior à publicação e à validação da API HTTPS, quando o usuário será avisado antes do teste direto. Consulte `ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md`.

A Fase 17A consolida o plano operacional homologado Local → HTTPS, com papéis, pré-requisitos, matriz go/no-go, janela, checklists antes/durante/depois, banco/backup/restore, SSO, observabilidade, segurança, evidências e rollback. A 17A é plano, não execução: o deploy real ainda não ocorreu, o ambiente continua local e as URLs continuam planejadas/inativas. O preflight e o smoke são offline e o CI executa somente o smoke em `--dry-run`; MCP/corporate permanece fail-closed e UI/CRUD MCP continua fora de escopo. Consulte `ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md`.

A Fase 17B aplica hardening offline aos artefatos de produção: Compose com redes/porta mínima/profile operacional, imagens multi-stage não-root, runtime backend sem dev dependencies, Nginx não privilegiado com SPA fallback/headers/cache e defaults MCP/corporate/providers fail-closed. O deploy real ainda não ocorreu, as URLs permanecem planejadas/inativas e não foram materializadas em env/Compose/CI/código funcional. A fase não chama rede, não sobe containers, não executa migration ou MCP real e não testa UI/CRUD MCP. Consulte `ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md`.

A Fase 17C cria o inventário governado e machine-readable de secrets e variáveis para
homologação/produção, com owners, origem esperada, classificação, rotação, validação
offline e evidência sanitizada. Nenhum valor real foi coletado, nenhum `.env` real foi
criado e nenhum endpoint/secret foi materializado em env examples, Compose ou CI. O
deploy real ainda não ocorreu; as URLs continuam planejadas/inativas, providers e MCP
permanecem fail-closed e UI/CRUD MCP continua fora de escopo. A primeira execução real
da tool depende de publicação HTTPS futura e o usuário será avisado antes do teste
direto. Consulte `ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md`.

A Fase 17D consolida um preflight de release homologável sem deploy, com runbook,
manifesto JSON, matriz GO/NO-GO e gates estritamente offline. O estado permanece local,
nenhum valor real foi coletado, nenhum `.env` real foi criado e as URLs seguem
planejadas/inativas, somente documentais. Não houve deploy, chamada real, provider
externo, MCP/tool real ou teste UI/CRUD MCP; nenhum endpoint/secret foi materializado em
env examples, Compose, CI ou código funcional. A primeira execução real da tool depende
de publicação HTTPS futura, e o usuário será avisado antes de qualquer teste direto na
tela. O resultado da fase é `releasePreflightReady=true` e `deployGo=false`. Consulte
`ORCHESTRA_PREFLIGHT_RELEASE_HOMOLOGAVEL_17D.md`.

A Fase 18A abre a frente de homologação funcional local pela UI e prepara o teste
direto em tela pelo usuário. A entrega inventaria rotas, páginas, menus, botões,
formulários, CRUDs, APIs e permissões; fornece matriz JSON, checklist manual, templates
de evidência/achados e gates offline. Todos os itens começam em `not-tested`: a 18A
organiza a execução manual, mas ainda não corrige bugs, não altera frontend/backend
funcionais, não executa deploy/produção, não chama MCP real nem provider externo. Na
UI, cadastro/binding/readiness/discovery MCP, embeddings reais e envio de
Chat/AgentRun permanecem explicitamente bloqueados. A próxima fase sugerida é 18B para
execução manual guiada ou correções funcionais aceitas, conforme as evidências.
Consulte `ORCHESTRA_HOMOLOGACAO_FUNCIONAL_UI_18A.md` e os artefatos em `ui/`.

A Fase 18C corrige o Wizard de Assistants após a triagem 18B: adota
`version.configuration` com schema versionado como fonte canônica das 12 etapas,
compila `instructions` com seções determinísticas, reidrata edição pelo detalhe real,
preserva versões legadas sem split heurístico, separa área de `workspaceId` e sincroniza
Knowledge Bindings antes de publicar. MCP permanece somente informativo no Wizard.
Também foram corrigidos os layouts mobile do catálogo, stepper, scores, revisão e ações.
Não houve migration, alteração Prisma, deploy, provider externo, MCP real, embeddings ou
Chat/AgentRun. Consulte
`ui/ORCHESTRA_UI_CORRECAO_WIZARD_ASSISTANTS_18C.md`.

A etapa 18C.1 adiciona smoke/preflight próprios para essa correção funcional e
torna os gates históricos 17D/18A phase-aware. O modo padrão `--dry-run`
continua bloqueando secrets, URLs de produção, deploy, Compose live, migration,
MCP/provider real, embeddings, Chat/AgentRun externo e browser live, mas não
falha apenas porque uma fase posterior alterou fonte funcional de forma
governada. A identidade histórica permanece verificável com
`--strict-baseline`, sem regravar hashes. A CI executa
`scripts/smoke-correcao-wizard-assistants-18c.sh --dry-run`; typecheck, build e
testes direcionados permanecem validações explícitas. A regressão transitiva
17D → 17C → 17B permanece ativa; os dois gates transitivos também aceitam
mudança funcional posterior no dry-run e preservam a auditoria histórica no
modo estrito. A suíte frontend completa permanece 95/96: a única falha é o
baseline preexistente de Analytics que espera nenhuma chamada, enquanto a
implementação existente consulta `/ai-observability/runtime-runs`; esse
desalinhamento não possui diff na 18C e continua fora do escopo.

A Fase 18D torna o MCP Hub demonstrável por um catálogo local seedado e
idempotente, com um servidor `MCP Demo Local — Corporate Readonly`, três tools
read-only, policies fail-closed, bindings `sandbox_only`, auditoria sanitizada e
precheck visual que retorna `ready` sem autorizar execução (`allowed=false`). O
catálogo seedado é protegido contra mutações e não possui URL, secret ou transporte
MCP. Rede externa, write tools, providers, embeddings, Chat/AgentRun, produção,
deploy e migrations permanecem bloqueados. Consulte
`mcp/ORCHESTRA_MCP_TOOLS_GOVERNADO_LOCAL_18D.md`.

A Fase 18E.1 faz hardening do shell autenticado pós-homologação: o perfil abre
um menu antes do logout explícito, busca e notificações passam a declarar que
não estão disponíveis, tenant/workspace aparecem somente como contexto e o
collapse da Sidebar persiste localmente. Não há endpoint, alteração de RBAC ou
autenticação, execução real, migration ou deploy. Consulte
`ui/ORCHESTRA_UI_HARDENING_GOVERNANCA_18E_1.md`.

A Fase 18F.1A adiciona somente o preflight offline do MCP remoto governado real;
não executa readiness, discovery, tool, rede ou provider real. Consulte
`mcp/ORCHESTRA_MCP_REMOTO_GOVERNADO_REAL_18F.md`.

A Fase 14H consolida o MVP tecnico da integracao com Agno Runtime, adicionando handoff operacional, checklist de homologacao/rollback e smoke seguro de MVP para runtime HTTP minimo e fronteira de frontend, sem feature nova, migration, frontend ou mudanca de defaults.

A Fase 15C adiciona conversas persistentes privadas por usuario no Chat, mensagens persistidas, arquivamento logico, envio de mensagem pelo backend de conversa e resposta do assistente vinculada ao `AgentRun`.

A Fase 15D adiciona contexto conversacional governado para runtime: o backend seleciona mensagens anteriores da conversa persistente, aplica limites e sanitizacao, mantem a nova mensagem como `AgentRun.input` e envia o historico apenas em campo separado e seguro do runtime.

A Fase 15E formaliza a homologacao funcional local do Chat persistente com contexto conversacional governado, documentando pre-condicoes, comandos, evidencias, consultas SQL e criterios de aceite para o fluxo `Chat -> AgentRun -> agno_http`, sem adicionar feature produtiva.

A Fase 15F integra o contexto conversacional governado ao caminho de provider LLM externo selecionado por policy do assistant, mantendo o frontend enviando somente `{ input }`, repassando ao provider apenas historico governado sem IDs internos e preservando eventos/metadata publicos quantitativos.

A Fase 15G adiciona observabilidade governada na UI existente do Chat/AgentRun, exibindo runtime, contexto conversacional e provider LLM por contadores/flags allowlisted, sem criar endpoint novo, sem migration e sem expor historico bruto, IDs internos de mensagens de contexto ou payload bruto de provider.

A Fase 15H formaliza a homologacao operacional ponta a ponta do fluxo `Chat -> AgentRun -> runtime local -> provider externo`, com preflight seguro, roteiro manual para primeira e segunda mensagens, validacao da UI 15G, consultas SQL quantitativas e checklist de ausencia de vazamentos, sem feature produtiva nova.

A Fase 15I consolida o handoff tecnico da trilha de Chat/AgentRun governado, reunindo linha do tempo, arquitetura final, estado real, evidencias, seguranca, limites, riscos e a recomendacao de evolucao para Agno full-stack na Fase 16, sem criar feature produtiva nova.

A Fase 16A habilita o Agno HTTP como executor LLM real governado no Chat, com provider/model selecionados por policy, contexto conversacional minimizado no contrato, resposta persistida no Chat, observabilidade segura e testes ponta a ponta com fake runtime sem chamar provider real.

A Fase 16B conecta a consulta RAG oficial do Orchestra ao Chat executado por `agno_http`, levando somente fontes resolvidas, limitadas e sanitizadas em `AssistantRuntimeSpecV1.rag`, com fail-closed antes do runtime, observabilidade quantitativa e runtime local preservado.

A Fase 16C conecta bindings MCP/tools governados pelo Orchestra ao Chat executado por `agno_http`, enviando somente descriptors minimizados em `AssistantRuntimeSpecV1.tools`, com schema strict, gateway simbolico, limites, bloqueio de approval/risco nao baixo, fake sem execucao externa e observabilidade apenas quantitativa.

A Fase 16D endurece a comunicacao server-to-server `Orchestra -> agno_http -> Agno`, com URL/timeout strict, autenticacao de health/capabilities/execute, registry sanitizado, rotacao e preflight seguro, sem fallback silencioso.

A Fase 16E formaliza a homologacao full-stack segura com Agno real, reunindo runbook, smoke offline por default, check autenticado somente de health/capabilities, Chat manual, RAG por contadores e descriptors com `maxToolCalls=0`, sem provider real em automacao ou execucao MCP/tool.

A Fase 16F adiciona o primeiro callback interno `Agno -> Orchestra` para tool calls governadas, autenticado pela fronteira 16D, correlacionado a um `AgentRun` ativo e limitado a tool low risk, sem approval e sandbox deterministico. O gateway e desligado por padrao, nao chama MCP externo, nao altera o frontend e nao persiste argumentos/output/schema bruto.

A Fase 16G consolida um pacote de demo local ponta a ponta com Agno real, reunindo runbook, perfis 16E/16G, chave descartavel, preflight offline por default, health/capabilities autenticados, roteiros manuais de Chat/LLM, RAG, descriptors e gateway sandbox, evidencias, apresentacao e rollback. O pacote nao inclui Agno real no repositorio, nao automatiza Chat/provider/tool, nao habilita MCP externo e preserva todos os defaults fail-closed.

A Fase 16H adiciona o servico Docker local `agno-bridge`, com contrato runtime V1 strict, SDK Agno real isolado, provider keys somente no container, RAG resolvido pelo Orchestra, descriptors governados, callback opcional ao gateway sandbox 16F, testes offline e preflight seguro. O backend permanece fail-closed por default; MCP/tool externa real, frontend, migrations e deploy cloud continuam fora.

A Fase 16I torna o Knowledge/RAG operacional para TXT/MD/CSV, com upload real, parsing deterministico, ingestao idempotente, source references, embeddings opcionais `stub`/OpenAI, retrieval keyword/semantic/hybrid governado, readiness de base/assistente, UI minima e smoke offline.

Esta pasta deve concentrar a estrategia de IA do Orchestra.

Topicos esperados:

- Runtime de assistentes.
- Providers de modelos.
- RAG.
- MCP.
- Tool calls.
- Guardrails.
- Avaliacao e auditoria de respostas.

## Documentos

- `ORCHESTRA_RAG_READINESS_HANDOFF.md`: readiness local, busca textual em chunks autorizados e handoff para RAG semantico futuro.
- `ORCHESTRA_RAG_RETRIEVAL_CONTRACT_HANDOFF.md`: contrato de retrieval local, citations, queryId e handoff para runtime futuro.
- `ORCHESTRA_MCP_EXECUTION_HANDOFF.md`: contrato de precheck/tool call sandbox, eventos e handoff para executor MCP futuro.
- `ORCHESTRA_MCP_REMOTO_DISCOVERY_11A.md`: discovery tecnico do MCP atual, gaps e contrato governado para MCP remoto real sem execucao externa nesta subfase.
- `ORCHESTRA_MCP_REMOTO_READINESS_FAIL_CLOSED_11B.md`: contratos backend, flags fail-closed, client stub e readiness estrutural para MCP remoto sem chamada externa real.
- `ORCHESTRA_MCP_REMOTO_DISCOVERY_GOVERNADO_11C.md`: discovery remoto governado backend-only, com transporte injetavel, sanitizacao, specHash, diff e default policy bloqueada.
- `ORCHESTRA_MCP_REMOTO_DISCOVERY_AUDIT_APPROVAL_11D.md`: review package, snapshot/hash, proposed actions, audit event sanitizado e approval gate para discovery remoto sem import automatico.
- `ORCHESTRA_MCP_REMOTO_CATALOG_IMPORT_PLAN_11E.md`: plano governado de importacao/reconciliacao para catalogo MCP remoto, com operations draft, validation/preflight e audit event sanitizado sem aplicar alteracoes.
- `ORCHESTRA_MCP_REMOTO_CATALOG_IMPORT_APPLY_11F.md`: apply service governado backend-only para o import plan MCP remoto, com repository/transaction boundary, autorizacao explicita, idempotencia, audit event sanitizado e runtime ainda bloqueado.
- `ORCHESTRA_MCP_REMOTO_CATALOG_PERSISTENCE_ADAPTER_11G.md`: discovery do catalogo MCP e adapter de persistencia fail-closed, com erro controlado, auditoria sanitizada e gaps de schema documentados para a 11H.
- `ORCHESTRA_MCP_REMOTO_CATALOG_SCHEMA_DESIGN_11H.md`: design docs-only da migration futura para entry remota e apply ledger, com lifecycle, constraints, idempotencia, backfill e publication boundary separados do runtime.
- `ORCHESTRA_MCP_REMOTO_CATALOG_SCHEMA_MIGRATION_11I.md`: migration/schema base para entry remota e apply ledger, com `String + CHECK`, uniques/idempotencia, defaults fail-closed, Prisma Client e testes estruturais sem adapter real ou runtime.
- `ORCHESTRA_MCP_REMOTO_CATALOG_REPOSITORY_REAL_11J.md`: repository real transacional/idempotente para persistir apply governado em `McpRemoteCatalogEntry` e `McpRemoteCatalogApplyLedger`, mantendo runtime, endpoint e materializacao fora do escopo.
- `ORCHESTRA_MCP_REMOTO_CATALOG_ADMIN_READ_API_11K.md`: API interna admin read-only para entries e ledgers do catalogo MCP remoto importado, com `mcp.manage`, workspace scope, filtros allowlist e DTOs sanitizados sem mutacao/runtime.
- `ORCHESTRA_MCP_REMOTO_SPRINT_14_FECHAMENTO_11L.md`: fechamento/hardening da Sprint 14/Fase 11, com linha do tempo, arquitetura final, checklist, riscos remanescentes e plano recomendado para Sprint 15.
- `ORCHESTRA_OBSERVABILIDADE_USAGE_COSTS_12A.md`: fundacao backend para eventos de uso/custos de IA com `AiRunUsageEvent`, sanitizacao de metadata, tokens, latencia, status e custo estimado sem dashboard, limites ou billing.
- `ORCHESTRA_OBSERVABILIDADE_LIMITES_QUOTAS_12B.md`: fundacao backend para policies de limite/quota, janelas UTC, metricas agregadas, bigint/minor units e evaluator monitor_only/enforce sem runtime automatico.
- `ORCHESTRA_OBSERVABILIDADE_ADMIN_READ_API_12C.md`: API backend admin read-only para eventos, summary, policies e simulacao de limites com `audit.read`, DTOs sanitizados e scoping explicito.
- `ORCHESTRA_OBSERVABILIDADE_ALERTAS_GOVERNADOS_12D.md`: fundacao backend para regras de alerta governadas, metricas sobre `AiRunUsageEvent`, evaluator read-only e API admin sem delivery real, scheduler ou CRUD.
- `ORCHESTRA_OBSERVABILIDADE_SPRINT_16_FECHAMENTO_12E.md`: fechamento e handoff tecnico da Sprint 16/Fase 12, consolidando arquitetura, validacoes, riscos e backlog recomendado para observabilidade de IA.
- `ORCHESTRA_QUALITY_EVALUATION_FOUNDATION_13A.md`: fundacao backend de avaliacao de qualidade com test sets/cases, runs/results, evaluator deterministico por assertions e API admin protegida por `audit.read`.
- `ORCHESTRA_QUALITY_EVALUATION_RUNS_SNAPSHOTS_13B.md`: evaluation runs persistidos e snapshots sanitizados de assistant/test set, com operacao admin deterministica e results transacionais sem LLM/provider/runtime.
- `ORCHESTRA_QUALITY_RBAC_CRUD_GOVERNADO_13C.md`: RBAC dedicado e CRUD governado/auditado de test sets e test cases, com scoping, validacao, sanitizacao e migration de autoria sem LLM-as-judge.
- `ORCHESTRA_QUALITY_EVALUATION_SPRINT_19_FECHAMENTO_13D.md`: fechamento documental da Sprint 19/Fase 13 com arquitetura consolidada, rotas, RBAC, seguranca, snapshots, runbook, validacoes, riscos e backlog.
- `ORCHESTRA_AGNO_READINESS_HANDOFF.md`: stub/readiness Agno, flags e caminho para integracao futura.
- `ORCHESTRA_RUNTIME_ADAPTER_HANDOFF.md`: boundary de runtime, resumos RAG/MCP e eventos normalizados.
- `ORCHESTRA_AGNO_LOCAL_RUNTIME_HANDOFF.md`: handoff da integracao HTTP local Agno-compatible e mock runtime.
- `ORCHESTRA_AGNO_RUNTIME_CONTRACT_14A.md`: contrato versionado da Assistant Runtime Spec v1, request/response, eventos, erros, health/capabilities e regras de seguranca para runtime Agno-compatible futuro.
- `ORCHESTRA_AGNO_RUNTIME_HTTP_MINIMO_14B.md`: servico HTTP minimo Agno-compatible com health, capabilities, execute sandbox, erros normalizados, smoke local e handoff para a 14C.
- `ORCHESTRA_BACKEND_AGNO_RUNTIME_ADAPTER_14C.md`: adapter backend `agno_http`, client HTTP server-to-server, builder de AssistantRuntimeSpecV1, fail-closed, flags/envs e handoff para chat real futuro.
- `ORCHESTRA_CHAT_AGNO_RUNTIME_14D.md`: fluxo real de AgentRun pelo `agno_http`, contratos V1, fail-closed, output/eventos sanitizados, modelo dinamico e fronteira backend-only.
- `ORCHESTRA_RAG_GOVERNADO_AGNO_RUNTIME_14E.md`: contexto RAG governado no `agno_http` como `resolved_context`, com flags, limites, sanitizacao e ausencia de retrieval livre no runtime.
- `ORCHESTRA_MCP_TOOLS_GOVERNADOS_AGNO_RUNTIME_14F.md`: descriptors governados de tools/MCP no `agno_http`, com allowlist, limites, sanitizacao, eventos seguros e ausencia de execucao externa direta.
- `ORCHESTRA_OBSERVABILIDADE_LIMITES_AUDITORIA_RUNTIME_AGNO_14G.md`: observabilidade, limites e auditoria do caminho `AgentRun -> agno_http`, com trace/usage/latencia/status/erro, summaries seguros e ausencia de payload bruto.
- `ORCHESTRA_MVP_AGNO_RUNTIME_HANDOFF_14H.md`: handoff do MVP Agno Runtime, com arquitetura final, flags, defaults seguros, smoke, homologacao, rollback, limites, riscos e proximos passos pos-MVP.
- `ORCHESTRA_CHAT_CONVERSAS_PERSISTENTES_15C.md`: conversas persistentes privadas por usuario, mensagens persistidas, arquivamento logico e resposta do assistente vinculada ao `AgentRun`.
- `ORCHESTRA_CHAT_CONTEXTO_CONVERSACIONAL_15D.md`: contexto conversacional governado para runtime, selecionado pelo backend, limitado, sanitizado, auditado e separado do `input` atual.
- `ORCHESTRA_CHAT_HOMOLOGACAO_CONTEXTO_15E.md`: homologacao funcional local do Chat persistente com contexto conversacional governado, cobrindo pre-condicoes, comandos, evidencias, consultas SQL e criterios de aceite do fluxo `Chat -> AgentRun -> agno_http`.
- `ORCHESTRA_CHAT_PROVIDER_EXTERNO_GOVERNADO_15F.md`: integracao governada do contexto conversacional com provider LLM externo selecionado por policy do assistant, sem alterar o contrato publico do frontend e sem expor conteudo/IDs internos em eventos publicos.
- `ORCHESTRA_CHAT_OBSERVABILIDADE_GOVERNADA_15G.md`: observabilidade governada na UI existente do Chat/AgentRun para runtime, contexto conversacional e provider LLM, com campos allowlisted e runbook visual sem vazamento de historico bruto ou payload de provider.
- `ORCHESTRA_CHAT_HOMOLOGACAO_PROVIDER_REAL_15H.md`: runbook operacional ponta a ponta do Chat ate o provider externo, com preflight nao destrutivo, cenarios local/real/fail-closed, validacao visual e de banco apenas por flags e contadores seguros.
- `ORCHESTRA_CHAT_GOVERNADO_HANDOFF_15I.md`: consolidacao e handoff tecnico da trilha 15C-15H, com arquitetura final, estado real do Chat, fronteiras do Agno, evidencias, riscos e plano recomendado para a Fase 16.
- `ORCHESTRA_AGNO_LLM_REAL_CHAT_16A.md`: integracao governada `Chat -> AgentRun -> agno_http -> LLM`, com contrato minimizado, policy de provider/model, fake runtime, observabilidade, homologacao manual e rollback.
- `ORCHESTRA_AGNO_RAG_GOVERNADO_CHAT_16B.md`: integracao `Chat -> AgentRun -> RAG governado -> agno_http`, com retrieval oficial no Orchestra, contexto resolvido e minimizado, limites, fail-closed, observabilidade segura, homologacao e rollback.
- `ORCHESTRA_AGNO_MCP_TOOLS_GOVERNADOS_CHAT_16C.md`: integracao `Chat -> AgentRun -> MCP/tools governados -> agno_http`, com selecao no Orchestra, descriptors minimizados, gateway simbolico, fake sem chamadas externas, observabilidade quantitativa, homologacao e rollback.
- `ORCHESTRA_AGNO_RUNTIME_SECURITY_16D.md`: hardening da comunicacao `Orchestra -> agno_http -> Agno`, com URL/timeout strict, autenticacao de health/capabilities/execute, registry sem configuracao privada, rotacao, preflight e checklist de homologacao.
- `ORCHESTRA_AGNO_REAL_HOMOLOGACAO_SEGURA_16E.md`: homologacao full-stack segura `Chat -> AgentRun -> agno_http real -> Agno`, com preflight, procedimento manual, evidencias permitidas, RAG quantitativo, descriptors sem execucao e rollback.
- `ORCHESTRA_AGNO_TOOL_GATEWAY_GOVERNADO_16F.md`: callback server-to-server governado `Agno -> Orchestra` para tool low risk em sandbox deterministico, com contrato strict, correlacao de run/spec, limites, idempotencia local, auditoria sanitizada e default desligado.
- `ORCHESTRA_AGNO_DEMO_LOCAL_PONTA_A_PONTA_16G.md`: runbook oficial da demo local com Agno real, chave descartavel fora do Git, preflight seguro, health/capabilities autenticados, Chat/RAG/descriptors/gateway sandbox manuais, evidencias, roteiro de apresentacao, troubleshooting e rollback.
- `ORCHESTRA_AGNO_BRIDGE_DOCKER_REAL_16H.md`: implementacao e runbook do `agno-bridge` Docker local com SDK Agno real por tras do contrato V1, provider keys isoladas, RAG/descriptors governados, callback sandbox 16F opcional, testes offline, evidencias, rollback e riscos.
- `ORCHESTRA_KNOWLEDGE_RAG_OPERACIONAL_16I.md`: Knowledge/RAG operacional para upload TXT/MD/CSV, ingestao idempotente, embeddings opcionais, retrieval governado, readiness, UI, validacao e rollback.
- `ORCHESTRA_E2E_CHAT_RAG_MCP_READONLY_16R.md`: homologacao local opt-in do mesmo AgentRun com RAG resolvido, Agno stub, gateway governado, MCP demo HTTP real/read-only, Analytics/audit sanitizados, fail-closed e cleanup marcado.
- `ORCHESTRA_EVALS_QUALIDADE_SEGURANCA_16S.md`: evals contínuas offline/provider-free de qualidade, escopo, RAG, MCP read-only, segurança e ausência de payload bruto.
- `ORCHESTRA_CONECTOR_CORPORATIVO_READONLY_16T.md`: boundary governado para `corporate.status.read`, implementado sem endpoint real configurado e desabilitado por default.
- `ORCHESTRA_HOMOLOGACAO_SUPERVISIONADA_CONECTOR_READONLY_16U.md`: procedimento de janela aprovada, preflight local sem rede, execução única manual, auditoria allowlistada, rollback e evidências sem conteúdo bruto.
- `ORCHESTRA_ENDPOINT_STATUS_READONLY_16V.md`: endpoints locais seguros `GET /v1/status` e `GET /v1/status/availability`, contrato sanitizado, testes, smoke offline e handoff da primeira chamada real para a 16W.
- `ORCHESTRA_PRIMEIRA_EXECUCAO_REAL_TOOL_STATUS_16W.md`: decisão HTTP local versus HTTPS homologado, preparação offline da execução única, evidências, SQL seguro e rollback; nenhuma chamada real foi executada.
- `ORCHESTRA_ALINHAMENTO_TOOL_STATUS_ENDPOINT_16X.md`: contrato comum da tool, normalização do health legado, validação estrita dos endpoints 16V, segurança, readiness futura e validação offline; nenhuma chamada real foi executada.
- `ORCHESTRA_READINESS_HTTPS_TOOL_STATUS_16Y.md`: readiness estrutural para a origem HTTPS da API, preflight sem rede, templates HTTPS/audit e handoff para a preparação de publicação 16Z, sem execução real.
- `ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md`: arquitetura, checklists, preflight e smoke offline da futura publicação HTTPS; as URLs são planejadas, não ativas, e MCP permanece fail-closed.
- `ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md`: plano operacional Local → HTTPS com matriz de pré-requisitos/go-no-go, janela, responsáveis, evidências e rollback; o deploy real não ocorreu.
- `ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md`: hardening offline de Compose, Dockerfiles, Nginx, env examples e gates estáticos; sem deploy, chamada real, MCP real ou UI/CRUD MCP.
- `ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md`: inventário offline governado de configuração e secrets, sem valores reais ou `.env` operacional; inclui owners, rotação, evidência sanitizada e gates de publicação/provider/MCP.
- `ORCHESTRA_PREFLIGHT_RELEASE_HOMOLOGAVEL_17D.md`: preflight e manifesto do candidato de release homologável, com `deployGo=false` e nenhuma execução real.
- `ORCHESTRA_HOMOLOGACAO_FUNCIONAL_UI_18A.md`: runbook que abre e governa a preparação da homologação funcional local pela interface, sem correções ou execução externa.
- `ui/ORCHESTRA_UI_INVENTARIO_18A.md`: inventário estático de rotas, telas, menus, ações, formulários, CRUDs, APIs, guardas e estados.
- `ui/ORCHESTRA_UI_HOMOLOGATION_MATRIX_18A.json`: matriz machine-readable com todos os itens inicialmente `not-tested`.
- `ui/ORCHESTRA_UI_CHECKLIST_MANUAL_18A.md`: sequência prática para teste manual pelo usuário no navegador local.
- `ui/ORCHESTRA_UI_BUG_TEMPLATE_18A.md`: templates separados de bugs, melhorias, ajustes, dúvidas e evidências aprovadas.
- `ui/ORCHESTRA_UI_TRIAGEM_ASSISTANTS_WIZARD_18B.md`: triagem read-only e causa raiz dos bugs de persistência, reidratação, bindings e responsividade do Wizard.
- `ui/ORCHESTRA_UI_CORRECAO_WIZARD_ASSISTANTS_18C.md`: correção funcional do contrato estruturado, fallback legado, Knowledge Bindings e responsividade, sem execução externa.
- `ui/ORCHESTRA_UI_HARDENING_GOVERNANCA_18E_1.md`: hardening do AppShell/Topbar com logout explícito, estados honestos para capacidades indisponíveis, contexto não interativo e persistência visual da Sidebar.
- `scripts/preflight-correcao-wizard-assistants-18c.sh` e `scripts/smoke-correcao-wizard-assistants-18c.sh`: gate phase-aware, offline e read-only da correção 18C, com allowlist funcional e guardrails obrigatórios.
- `ORCHESTRA_LLM_PROVIDER_INTEGRATION.md`: catalogo LLM, provider local deterministico, providers externos fail-closed e eventos LLM em AgentRun.
- `ORCHESTRA_RAG_SEMANTICO_DISCOVERY.md`: discovery tecnico da Fase 10A para RAG semantico, embeddings e vector store.
- `ORCHESTRA_VECTOR_STORE_EMBEDDING_CONTRACT.md`: decisao tecnica da Fase 10B para pgvector, tabela de embeddings, readiness semantico e fail-closed.
- `ORCHESTRA_EMBEDDINGS_FAIL_CLOSED_10D.md`: base backend-only de embeddings em modo fail-closed, sem provider externo e com readiness integrada ao RAG local.
- `ORCHESTRA_EMBEDDINGS_PROVIDER_GOVERNADO_10E.md`: adapter estrutural OpenAI para embeddings governados, com readiness diferenciada e execucao externa ainda bloqueada.
- `ORCHESTRA_EMBEDDINGS_EXECUTION_OPENAI_10F.md`: execucao OpenAI controlada para embeddings no backend, com cliente HTTP injetavel, limites e testes sem internet.
- `ORCHESTRA_EMBEDDINGS_PERSISTENCIA_CONTROLADA_10G.md`: persistencia controlada e idempotente de embeddings em `knowledge_chunk_embeddings`, sem ativar vector search no RAG.
- `ORCHESTRA_RAG_RETRIEVAL_SEMANTICO_10H.md`: endpoint backend-only para retrieval semantico com pgvector e fallback lexical, sem alterar o `queryRag` oficial.
- `ORCHESTRA_RAG_QUERY_SEMANTICA_OFICIAL_10I.md`: integracao do retrieval semantico ao `queryRag` oficial, com persistencia em `RagQuery`, citations, auditoria e fallback lexical controlado.
- `ORCHESTRA_RAG_SEMANTICO_FECHAMENTO_SPRINT13_10J.md`: fechamento tecnico da Sprint 13, criterios de aceite, smoke operacional, riscos, rollback e proximas fases para RAG semantico.
