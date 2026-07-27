# Orchestra — Preflight de release homologável sem deploy (Fase 17D)

## Objetivo

A Fase 17D consolida o estado versionado do Orchestra como candidato de release
homologável e responde, por evidência exclusivamente local, se os artefatos obrigatórios,
os gates estáticos e os defaults fail-closed estão coerentes para uma futura janela
controlada de publicação HTTPS.

**A 17D é preflight de release, não deploy.** A decisão documental desta fase pode ser
`RELEASE_PREFLIGHT_READY=true`, enquanto a decisão operacional permanece
`DEPLOY_GO=false`.

## Escopo

- inventariar os artefatos versionados obrigatórios do candidato;
- declarar um manifesto JSON machine-readable, sem valores reais;
- validar offline documentação, scripts, Compose, Dockerfiles, Nginx e env examples;
- verificar que CI executa somente o smoke 17D em `--dry-run`;
- preservar os gates e regressões offline das fases 16S–17C;
- registrar critérios de aceite, GO/NO-GO, evidências, riscos e próximos passos;
- confirmar que Prisma, migrations, backend e frontend funcionais não mudaram.

## Fora de escopo

- deploy, publicação, promoção, provisionamento, DNS, TLS ou chamada a URL;
- `curl`, `wget`, request real, Docker Compose live, container, build de imagem,
  migration, backup, restore ou rollback real;
- criar `.env` real, coletar, resolver, ler, imprimir ou versionar valor real;
- chamar OpenAI, Azure OpenAI, Anthropic, embeddings ou qualquer provider externo;
- descobrir, cadastrar, associar ou executar MCP/tool real;
- criar servidor MCP pela tela, testar UI/CRUD MCP ou associar MCP a Assistant;
- testar Chat/AgentRun, botões, CRUDs, fluxo visual ou qualquer tela;
- alterar Prisma schema/migrations, runtime Chat, RAG/Knowledge, providers, auth/SSO,
  backend funcional ou frontend funcional;
- transformar este documento ou seus templates em autorização de mudança.

## Estado atual local

O Orchestra segue totalmente local na máquina do usuário. A branch da fase foi
inspecionada em `234fb89`: esse estado contém a Fase 17C integrada em `cc717cc` e a
normalização posterior do nome Orchestra. Não há nesta fase evidência de registry,
host, DNS, TLS, ingress, banco de produção, secret manager, deploy ou disponibilidade
pública.

Nenhum valor real foi coletado. Nenhum `.env` real foi criado. Nenhuma URL foi
chamada. Nenhum container, migration, MCP, tool, provider ou UI/CRUD foi executado.

## URLs planejadas e inativas

| Superfície | URL planejada | Classificação 17D |
|---|---|---|
| Frontend | `https://orchestra.mcm.eng.br` | `documentationOnly=true`, `plannedInactive=true` |
| Backend/API | `https://api.orchestra.mcm.eng.br` | `documentationOnly=true`, `plannedInactive=true` |

As URLs são somente documentação de alvo futuro. Permanecem ausentes de env examples,
Compose, CI e código funcional, não devem ser resolvidas nem chamadas nesta fase e não
constituem valores de runtime.

## Relação com 16Z, 17A, 17B e 17C

1. **16Z** preparou a publicação HTTPS offline e fail-closed, sem publicar.
2. **17A** criou o plano operacional homologado Local → HTTPS, sem executá-lo.
3. **17B** endureceu Compose, Dockerfiles, Nginx e healthchecks, sem subir containers.
4. **17C** criou o inventário governado de secrets/variáveis, sem valores e sem `.env`.
5. **17D** consolida esses artefatos em um candidato verificável, sem autorizar deploy.

A primeira execução real da tool depende de publicação HTTPS futura, validação da API e
janela explicitamente aprovada. UI/CRUD MCP continua fora de escopo.

O usuário será avisado antes de qualquer teste direto na tela.

## Artefatos obrigatórios da release homologável

| Grupo | Artefatos | Evidência offline |
|---|---|---|
| Governança | runbooks 16Z, 17A, 17B, 17C e 17D; README e estado atual | arquivos versionados e seções obrigatórias |
| Manifestos | inventário JSON 17C e manifesto JSON 17D | parse JSON e contrato de campos |
| Produção | `docker-compose.prod.yml`, Dockerfiles prod e `frontend/nginx.conf` | presença e assertions fail-closed |
| Configuração | quatro `.env.example` governados | valores locais/vazios e flags fechadas |
| Gates | preflight/smoke 16Z–17D e regressões 16S–16Y | scripts presentes e dry-runs |
| CI | `.github/workflows/ci.yml` | uma única invocação 17D: smoke `--dry-run` |

A lista canônica machine-readable está em
`release/ORCHESTRA_RELEASE_MANIFEST_17D.json`.

## Políticas e flags fail-closed

| Domínio | Estado versionado esperado |
|---|---|
| Providers | `LLM_PROVIDERS_ENABLED=false`, `LLM_EXECUTION_ENABLED=false` e execuções OpenAI/Azure OpenAI/Anthropic desabilitadas |
| Embeddings | `EMBEDDINGS_ENABLED=false` e `EMBEDDINGS_EXECUTION_ENABLED=false` |
| Agno | `AGNO_ENABLED=false`, `AGNO_EXECUTION_ENABLED=false`, bridge em `stub` |
| Tools | `RUNTIME_ALLOW_EXTERNAL_TOOLS=false`, HTTP tools desabilitadas, máximo de calls `0`, gateway desabilitado |
| MCP remoto | enabled/execution/discovery/read-only desabilitados, allowlist vazia e write tools bloqueadas |
| Corporate | adapter desabilitado e origin operacional vazia |

Qualquer ausência, divergência, valor inesperado ou tentativa de habilitação resulta em
falha do preflight e mantém o candidato em NO-GO.

## Matriz de critérios de aceite

| Critério | Evidência | Aceite |
|---|---|---|
| Runbook e manifesto 17D existem | presença local | obrigatório |
| Manifesto e inventário são JSON válido | parse local por Node.js | obrigatório |
| Boundary de não execução está declarado | campos booleanos do manifesto | todos os campos operacionais `false` |
| Prontidão de preflight está declarada | `releasePreflightReady` | `true` |
| Deploy permanece bloqueado | `deployGo` | `false` |
| Artefatos 16Z–17C existem | presença local | obrigatório |
| Scripts 17D são executáveis | permissão local | obrigatório |
| CI executa apenas smoke 17D dry-run | inspeção textual | exatamente uma invocação |
| URLs continuam só documentais | varredura de runtime/config | nenhuma materialização operacional |
| Secrets continuam ausentes | varredura de credencial aparente e contrato JSON | nenhum valor real |
| Defaults continuam fail-closed | env examples e Compose | todas as assertions passam |
| Código funcional não mudou | estado Git por paths | Prisma/backend/frontend limpos |
| Regressões anteriores passam | dry-runs 16S–17C | obrigatório |

## Matriz GO/NO-GO

| Decisão | Status 17D | Evidência exigida | Responsável | Regra |
|---|---|---|---|---|
| Aceitar candidato de preflight | GO | smoke/preflight 17D e regressões verdes | Release Manager | permite homologar artefato, não publicar |
| Executar deploy real | NO-GO | janela, owners, infra, secrets, backup/restore e aprovação ainda ausentes | Change Manager + Platform | default é NO-GO |
| Habilitar provider/embeddings | NO-GO | aprovação, secrets, quota, egress e observabilidade futuros | AI Platform + Security | manter flags fechadas |
| Executar MCP/tool real | NO-GO | HTTPS publicada, origin/secretRef, egress, auditoria e janela futuros | Security + MCP Owner | nenhuma execução na 17D |
| Testar UI/CRUD MCP | NO-GO | fase de tela explicitamente aberta e aviso ao usuário | Product + QA | nenhuma tela na 17D |
| Alterar dados/migration | NO-GO | backup/restore e plano aprovado futuros | DBA | nenhuma operação na 17D |

Um GO de candidato não implica GO de implantação. A decisão default para deploy continua
NO-GO até uma janela futura formalmente aprovada.

## Checklist de release homologável

- [ ] runbook 17D revisado;
- [ ] manifesto 17D parseado e contrato validado;
- [ ] inventário 17C parseado e sem valores reais;
- [ ] artefatos e scripts obrigatórios presentes;
- [ ] scripts 17D executáveis, offline e somente leitura;
- [ ] CI contém somente o smoke 17D em `--dry-run`;
- [ ] env examples locais e Compose fail-closed;
- [ ] URLs planejadas ausentes de configuração e código funcional;
- [ ] nenhuma credencial aparente no escopo documental;
- [ ] Prisma/migrations e fontes funcionais sem alteração;
- [ ] regressões 16S–17C aprovadas;
- [ ] `releasePreflightReady=true` e `deployGo=false`.

## Checklist antes de deploy futuro

- [ ] change ID, janela, Release Manager e autoridade de GO/NO-GO nomeados;
- [ ] ambiente alvo, registry, digests, DNS, TLS, ingress e firewall aprovados;
- [ ] secret manager, workload identities e valores reais provisionados fora do Git;
- [ ] configuração efetiva revisada sem imprimir valores;
- [ ] backup íntegro e restore ensaiado com evidência;
- [ ] migration revisada, ordem de execução e compatibilidade pgvector aprovadas;
- [ ] CORS, cookies, SSO, redirects e observabilidade homologados;
- [ ] plano 17A, interrupção, rollback e comunicação aprovados;
- [ ] providers, embeddings, Agno, tools, MCP e corporate mantidos fechados no primeiro deploy;
- [ ] autorização explícita registrada antes de qualquer comando operacional.

## Checklist antes de habilitar MCP real futuro

- [ ] API HTTPS realmente publicada e validada;
- [ ] origin exata aprovada e egress/SSRF allowlistados;
- [ ] identidade read-only e `secretRef` lógico provisionados fora do Git;
- [ ] discovery, execução, readonly e corporate aprovados separadamente;
- [ ] write tools continuam bloqueadas;
- [ ] timeouts, limites de payload e auditoria sanitizada aprovados;
- [ ] MCP associado somente ao Assistant autorizado;
- [ ] uma única execução supervisionada dentro da janela;
- [ ] rollback por flags e revogação de credencial prontos.

## Checklist antes de teste direto na tela

- [ ] usuário avisado explicitamente de que o teste direto começará;
- [ ] publicação HTTPS, auth/SSO e API validadas;
- [ ] escopo da tela, botões e CRUDs aprovado;
- [ ] servidor MCP, Assistant e tool corretos identificados sem expor secrets;
- [ ] dados de teste não sensíveis preparados;
- [ ] evidência visual e sanitização autorizadas;
- [ ] rollback e responsável presentes;
- [ ] nenhuma ação de escrita além do escopo explicitamente aprovado.

## Evidências esperadas

- saída dos dry-runs com `deployment=false` e `realExecution=false`;
- validação do manifesto com `releasePreflightReady=true` e `deployGo=false`;
- tabela textual GO/NO-GO com deploy em NO-GO;
- `git diff --check` sem erro;
- typechecks backend/frontend aprovados;
- regressões offline aprovadas;
- `git status --short` contendo somente os artefatos documentais, scripts e CI da 17D;
- registro explícito de que nenhuma rede, secret, URL, container, migration, MCP,
  provider ou UI foi usado.

Evidência futura nunca deve conter dump de env, secret, token, bearer, API key,
connection string, payload bruto de provider/MCP ou screenshot sensível.

## Rollback

Como a 17D não implanta nem muda runtime, não existe rollback operacional a executar.
Se o candidato falhar, a decisão é NO-GO: interromper a promoção, preservar a evidência,
corrigir os artefatos em nova revisão e repetir os gates offline.

Em uma janela futura, o rollback seguirá a 17A: conter tráfego, manter providers/tools
fechados, restaurar release/dados conforme evidência aprovada e revogar credenciais
afetadas. Este texto não executa nem autoriza essas ações.

## Riscos remanescentes

- nenhum build de imagem ou `docker compose config` com configuração real foi validado;
- infraestrutura, DNS, TLS, registry e digests ainda não existem como evidência;
- secret manager, valores, permissões e rotação ainda não foram homologados;
- backup/restore e migration não foram executados no ambiente alvo;
- CORS, cookies, SSO e redirects não foram testados em HTTPS;
- observabilidade, capacidade, HA e rollback real não foram exercitados;
- providers, embeddings, Agno, MCP e tool real permanecem sem validação live;
- UI/CRUD MCP, Assistant e Chat/AgentRun real permanecem sem teste;
- um PASS estático não detecta divergência futura na configuração efetiva.

## Validação offline

O preflight 17D oferece:

- `--dry-run`: contrato estático completo;
- `--check-manifest`: validação machine-readable do manifesto;
- `--go-no-go-template`: tabela textual, sem executar comandos;
- `--help`: fronteiras e modos.

O smoke 17D exercita esses modos, confirma que são somente leitura, valida CI e
executa a regressão 17C, que preserva transitivamente 17B, 17A, 16Z, 16Y, 16X, 16W,
16V, 16U, 16T e 16S.

Nenhum modo chama rede ou DNS, executa `curl`/`wget`, Docker Compose, deploy, migration,
rollback, MCP/tool, provider externo, browser, UI/CRUD, leitura de secret ou alteração
de arquivo.

## Handoff para a Fase 18A

A Fase 18A recebe o gap `uiCrudTested=false` da 17D e abre uma frente separada de
homologação funcional **local** pela interface. Ela inventaria rotas, telas, menus,
botões, formulários, CRUDs, chamadas de API e permissões e prepara o usuário para o
primeiro teste direto em tela por checklist manual.

Esse handoff não altera o resultado da 17D:

- `releasePreflightReady=true` continua sendo prontidão documental;
- `deployGo=false` permanece inalterado;
- a 18A não executa produção/deploy;
- a 18A não corrige bugs ou altera frontend/backend funcionais;
- a 18A não cria servidor MCP, não associa MCP a Assistant e não executa MCP real;
- a 18A não executa provider externo, embeddings reais ou Chat/AgentRun
  externo-capable;
- todos os itens da nova matriz começam em `not-tested`;
- qualquer teste prático será executado manualmente pelo usuário no ambiente local.

O checklist anterior “antes de teste direto na tela” continua válido para o cenário
futuro de MCP/produção. Para a homologação estritamente local e fail-closed da 18A, a
fonte canônica passa a ser
`ui/ORCHESTRA_UI_CHECKLIST_MANUAL_18A.md`.

## Próximos passos sugeridos

1. revisar e aceitar o candidato com Release Manager, Platform, Security, DBA e IAM;
2. manter `DEPLOY_GO=false` até change e janela explicitamente aprovados;
3. escolher plataforma, registry, secret manager, DNS/TLS e observabilidade;
4. completar backup/restore, configuração e evidências fora do Git;
5. executar a janela futura seguindo 17A, inicialmente com integrações fechadas;
6. validar publicação HTTPS antes de abrir qualquer provider, MCP ou tool;
7. usar a 18A para organizar o teste direto local, mantendo qualquer execução externa
   dependente de publicação e autorização futuras.

Resultado esperado da fase:
`RELEASE_PREFLIGHT_READY=true`, `DEPLOY_GO=false`, ambiente local e nenhuma execução real.
