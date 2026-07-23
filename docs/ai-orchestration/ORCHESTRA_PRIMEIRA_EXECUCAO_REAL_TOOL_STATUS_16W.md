# Orchestra — Primeira execução real da tool de status 16W

## Objetivo

A Fase 16W prepara a primeira execução supervisionada de `corporate.status.read` contra os endpoints read-only criados na 16V e verifica se o pipeline `AgentRun → runtime governado → gateway → tool → status do Orchestra → resposta sanitizada → metadata/audit/Analytics` pode ser aberto sem reduzir as garantias da 16T e da 16U.

A decisão desta branch é a **Opção C**: a chamada real não foi executada e `--run-once-local` não foi implementado. O backend local usa HTTP, enquanto o transporte corporativo exige HTTPS e o egress corporativo bloqueia loopback. Naquele momento, o adapter 16T também esperava marcadores remotos e estados diferentes da resposta pública estrita da 16V; a 16X resolveu essa divergência no mapper sem criar exceção de transporte. A Opção C permanece válida porque alinhamento de payload não autoriza HTTP local nem loopback.

O resultado da fase é um harness fail-closed para preparação, check local e auditoria, mais o roteiro exato para a execução única futura em ambiente HTTPS homologado. Nenhum modo do script 16W faz rede.

## Escopo

- uma única tool: `corporate.status.read`;
- somente leitura, risco baixo e sem approval pendente no instante autorizado;
- somente os paths compilados `/health`, `/v1/status` e `/v1/status/availability`;
- no máximo uma chamada real por janela futura;
- preparação local, validação de variáveis e SQL allowlistado sem rede;
- origem HTTPS exata somente no processo seguro da janela;
- resposta final sanitizada com `status`, `summary` e `updatedAt`;
- evidências técnicas sem payload bruto;
- rollback imediato após sucesso, bloqueio, timeout ou erro.

## Fora de escopo

- liberar HTTP genérico, loopback corporativo ou origem arbitrária;
- aceitar URL completa, path, query, header ou bearer no input da tool;
- `POST`, `PUT`, `PATCH`, `DELETE`, mutation, escrita ou retry automático;
- ERP, banco corporativo, Drive, Gmail, Slack, Jira, Service Desk ou qualquer sistema sensível;
- versionar endpoint operacional, credencial, bearer, token ou valor de secret;
- ativar MCP remoto, adapter corporativo, runtime Agno ou gateway por default;
- executar chamada live no CI, smoke, dry-run, prepare ou local-check;
- alterar Prisma schema, migrations, provider LLM, RAG, Knowledge ou UI;
- validar visualmente a tela MCP/Assistant ou implementar CRUD MCP ponta a ponta.

## Pré-requisitos

Para a preparação offline:

1. branch/commit 16W identificados;
2. smokes 16S–16V verdes;
3. backend e frontend typecheckando;
4. defaults remotos fechados;
5. Prisma schema e migrations sem alteração;
6. scripts 16W executáveis.

Para uma chamada real futura:

1. janela e mudança formalmente aprovadas;
2. operador e supervisor presentes;
3. origem HTTPS de homologação única, sem path/query/fragment/credenciais;
4. certificado, DNS, ingress e egress aprovados;
5. contrato do alvo compatível com o adapter e testado sem ampliar o payload público da 16V;
6. server, tool, binding, policy, assistant publicado e AgentRun dedicados;
7. runtime `agno_http` autenticado e gateway ativo somente na janela;
8. `secretRef` lógico e identidade exclusivamente read-only;
9. contador da janela em zero e ausência de retry;
10. audit/Analytics e rollback prontos antes de abrir os gates.

## Relação com 16T, 16U e 16V

- a 16T criou o adapter, a tool fixa, o roteamento governado, egress/SSRF, GET-only, limites e sanitização;
- a 16U definiu aprovação, readiness, execução única, evidências allowlistadas e rollback;
- a 16V criou o alvo passivo seguro no Orchestra com exatamente `status`, `summary`, `updatedAt`;
- a 16W preserva esses três boundaries, registra a incompatibilidade local e fornece preparação/auditoria sem alegar uma execução que não ocorreu.
- a 16X posteriormente alinha o adapter ao contrato 16V, preserva a Opção C e registra que nenhuma chamada real ocorreu.

A 16W não transforma o Orchestra em sistema corporativo sensível e não autoriza a reutilização desta tool contra outras origens.

## Matriz de decisão local HTTP vs HTTPS homologado

| Cenário | Decisão | Motivo |
|---|---|---|
| `http://localhost:3000` | preparação e teste passivo 16V somente | transporte corporativo requer HTTPS e egress bloqueia loopback |
| `http://127.0.0.1:3000` | preparação e teste passivo 16V somente | mesma restrição; não é uma exceção corporativa autorizada |
| demo local 16Q | não usar para 16W | tools e contrato diferentes; execução do demo usa POST |
| origem HTTPS de homologação aprovada | elegível para uma chamada supervisionada | somente após contrato, catálogo, runtime, policy e janela verdes |
| produção prevista | não usar nesta fase | deploy, readiness e autorização produtiva não foram comprovados |
| origem arbitrária ou sistema sensível | bloqueado | fora da allowlist, do contrato e do escopo |

Não foi criada exceção de HTTP corporativo. A proteção global de HTTPS/SSRF permanece intacta em todos os ambientes.

## Variáveis de ambiente necessárias

Os defaults versionados permanecem:

```text
MCP_REMOTE_ENABLED=false
MCP_REMOTE_EXECUTION_ENABLED=false
MCP_REMOTE_READONLY_ENABLED=false
MCP_REMOTE_EGRESS_ALLOWLIST=
MCP_REMOTE_REQUIRE_SECRET_REF=true
MCP_REMOTE_ALLOW_WRITE_TOOLS=false
MCP_CORPORATE_READONLY_ENABLED=false
MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=
```

Durante uma janela HTTPS futura, e somente no processo seguro:

| Variável | Regra |
|---|---|
| `NODE_ENV` | pode ser `development` ou ambiente de homologação controlado; a exceção local não existe |
| `MCP_REMOTE_ENABLED` | `true` somente durante readiness/execução |
| `MCP_REMOTE_EXECUTION_ENABLED` | `true` apenas após readiness e aprovação final |
| `MCP_REMOTE_READONLY_ENABLED` | `true` junto do gate de execução |
| `MCP_REMOTE_ALLOW_WRITE_TOOLS` | sempre `false` |
| `MCP_REMOTE_REQUIRE_SECRET_REF` | sempre `true` |
| `MCP_REMOTE_EGRESS_ALLOWLIST` | exatamente a única origem HTTPS aprovada |
| `MCP_CORPORATE_READONLY_ENABLED` | `true` somente na janela |
| `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN` | exatamente a origem HTTPS aprovada |
| `MCP_CORPORATE_READONLY_ORIGIN` | mesma origem, usada apenas pelo preflight operacional 16U |
| `MCP_CORPORATE_READONLY_SECRET_REF` | referência lógica; nunca o valor |

As demais flags de runtime/gateway e o catálogo governado devem seguir a 16U e a configuração do ambiente. Não copie valores de uma sessão para `.env.example`, Compose, workflow, issue ou evidência.

## `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN`

Esta é a origem efetivamente lida pelo backend corporativo 16T. Ela seleciona o adapter somente quando:

- o adapter dedicado está habilitado;
- a base URL do server coincide exatamente;
- o protocolo é HTTPS;
- não há path, query, fragment, usuário ou senha;
- a mesma origem foi permitida pelo egress global.

Ela não aceita uma lista e não deve conter o path `/v1/status`. O adapter escolhe internamente um dos paths fixos. Nos arquivos versionados, seu valor permanece vazio.

## `MCP_CORPORATE_READONLY_ORIGIN` no preflight 16U

Esta variável é operacional: o `--local-check` da 16U valida que existe uma origem HTTPS estruturalmente segura e que `MCP_REMOTE_EGRESS_ALLOWLIST` é exatamente igual. O backend não lê essa variável; antes da janela, o operador materializa a mesma origem em `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN` no processo backend seguro.

Não confundir a variável de preflight com uma autorização. Ela não resolve DNS, não comprova TLS, não abre policy, não configura catálogo e não executa a tool.

## Endpoint e secret fora do Git

O hostname operacional de homologação e o valor da credencial não devem ser gravados no Git. As URLs de topologia previstas neste documento — backend local em `http://localhost:3000`, frontend local em `http://localhost:5173`, backend previsto em `https://api.orchestra.mcm.eng.br` e frontend previsto em `https://orchestra.mcm.eng.br` — são referências arquiteturais do próprio Orchestra, não configuração de egress nem evidência de disponibilidade.

O catálogo persiste somente uma referência lógica aprovada. O valor é resolvido no processo backend no instante da chamada e não deve aparecer em terminal, audit, Analytics, screenshot ou SQL.

## Passo a passo local

O roteiro local prepara e confirma os limites; ele não executa MCP:

```bash
scripts/homologacao-primeira-tool-status-16w.sh --dry-run
scripts/homologacao-primeira-tool-status-16w.sh --prepare-local
scripts/homologacao-primeira-tool-status-16w.sh --local-check
scripts/homologacao-primeira-tool-status-16w.sh --audit-template
scripts/smoke-primeira-tool-status-16w.sh --dry-run
```

Depois, com o backend local iniciado pelo procedimento normal do projeto, os endpoints 16V podem ser testados passivamente:

```bash
curl --fail --silent --show-error http://localhost:3000/health
curl --fail --silent --show-error http://localhost:3000/v1/status
curl --fail --silent --show-error http://localhost:3000/v1/status/availability
```

Esses GETs não são a tool e não provam AgentRun, runtime, gateway, catálogo, audit ou Analytics. Não habilite flags MCP para convertê-los em uma execução local.

## Passo a passo para ambiente HTTPS homologado

Este roteiro é manual e exige a janela 16U. Nenhum comando live é versionado:

1. registrar commit, janela, aprovadores, origem, contrato, identity e rollback fora do Git;
2. executar todos os dry-runs e o preflight 16U;
3. confirmar que o alvo HTTPS expõe somente os três paths fixos e um contrato aceito pelo adapter;
4. confirmar contador zero e ausência de retry no runtime/bridge;
5. materializar origem e referência lógica no processo seguro, sem imprimir valores;
6. habilitar readiness, mantendo execução, binding e policy bloqueados;
7. validar health/readiness pelo boundary governado e revisar metadata allowlistada;
8. abrir exatamente o binding/policy da tool `corporate.status.read`, com `scope=summary`;
9. iniciar um único AgentRun pela API/UI governada e não repetir em erro ou timeout;
10. registrar somente o `runId` e o resumo sanitizado aprovado;
11. fechar imediatamente flags, policy, binding, tool e server;
12. executar a consulta SQL allowlistada e comparar audit/Analytics;
13. revogar/rotacionar a identidade conforme o plano e encerrar a janela.

Até que esses passos ocorram em um ambiente HTTPS compatível e aprovado, o status correto da 16W é “preparado, não executado”.

## Evidências esperadas

Para preparação:

- smokes/dry-runs verdes;
- `realExecution=false`;
- ausência de `--run-once-local`;
- defaults fechados e origens vazias;
- Prisma inalterado.

Para uma execução real futura bem-sucedida:

- exatamente um `runId`;
- `status` concluído;
- `externalMcpCalled=true`;
- `simulated=false`;
- `mcpRemoteAllowed=true`;
- `mcpRemoteBlocked=false`;
- `mcpRemoteToolId` correspondente à tool aprovada;
- host sanitizado, `responseBytes` dentro do limite e latência registrada;
- `rawContentLogged=false`;
- resposta entregue ao runtime limitada a `status`, `summary`, `updatedAt`.

Bloqueio, timeout ou contrato inválido são evidências de fail-closed, não autorização para uma segunda chamada.

## Consultas SQL/audit seguras

Gerar o template:

```bash
scripts/homologacao-primeira-tool-status-16w.sh --audit-template
```

O SQL exige um `run_id`, retorna doze campos técnicos allowlistados e usa `LIMIT 1`. Execute-o manualmente somente no banco de homologação depois de fechar os gates. Não amplie a projeção nem consulte metadata completa, conteúdo de tool ou credenciais.

Em audit, procure a ação sanitizada do gateway remoto read-only e correlacione `entityId`, `requestId` e horário com o único `runId`. Em Analytics, use somente os mesmos campos técnicos; não exporte o evento completo.

## Rollback

Em sucesso, bloqueio ou desvio:

1. desabilitar `MCP_CORPORATE_READONLY_ENABLED`;
2. desabilitar `MCP_REMOTE_EXECUTION_ENABLED`, `MCP_REMOTE_READONLY_ENABLED` e `MCP_REMOTE_ENABLED`;
3. fechar binding, policy, tool e server;
4. remover origem das duas variáveis/allowlists do processo;
5. encerrar o runtime/backend temporário da janela;
6. revogar ou rotacionar a identidade conforme o plano;
7. confirmar que nova execução falha fechada, sem gerar nova chamada;
8. preservar apenas IDs e campos técnicos allowlistados;
9. abrir incidente se houve conteúdo inesperado ou segredo exposto.

Não apague AgentRun, tool call, eventos ou audit para esconder tentativa. Rollback não exige migration.

## Critérios de aceite

- runbook, harness e smoke 16W existem;
- os modos obrigatórios funcionam sem rede;
- `--run-once-local` permanece ausente e a decisão está documentada;
- CI roda somente o smoke 16W em `--dry-run`;
- paths e tool continuam fixos e GET-only;
- escrita e origem arbitrária continuam bloqueadas;
- defaults remotos/corporativos permanecem fail-closed;
- endpoint operacional e valor de secret não são versionados;
- SQL expõe somente os doze campos allowlistados;
- regressões 16S–16V, typechecks e eval offline ficam verdes;
- Prisma schema/migrations permanecem inalterados;
- o resultado não afirma uma chamada real: `realExecution=false`.

Uma execução futura só será aceita como evidência após cumprir a seção HTTPS e produzir exatamente um `runId` com os sinais de sucesso esperados.

## Riscos remanescentes

- o contrato público 16V e o mapper do adapter foram reconciliados pela 16X sem ampliar exposição;
- ingress/TLS/DNS do backend previsto ainda não foram comprovados;
- catálogo, policy, binding, assistant e runtime de homologação dependem de estado persistido e revisão operacional;
- `activeRuns` do gateway é local ao processo e exige afinidade/disponibilidade durante a chamada;
- uma credencial read-only comprometida ainda permite leitura do escopo concedido;
- audit/Analytics podem estar incompletos ou indisponíveis no ambiente;
- erro humano pode abrir mais de um gate ou tentar novamente;
- nenhum teste desta branch comprova a UI real da tela MCP/Assistant.

## Próximo passo sugerido

A 16X concluiu a reconciliação formal do contrato 16T/16V, e a 16Y prepara a readiness da origem HTTPS da API sem rede automática. A 16Y não executa chamada real e não testa UI/CRUD MCP. A execução única fica para a 16Z, com autorização e aviso explícito ao usuário; o fluxo visual MCP/Assistant continua fora desse passo.

Mesmo após a primeira execução de status, MCP/Tool real não deve ser usado para sistemas sensíveis sem threat model, identidade, DLP, approval e rollback próprios.
