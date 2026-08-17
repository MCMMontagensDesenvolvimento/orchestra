# Orchestra — MCP remoto governado real (Fase 18F)

Status desta entrega: **18F.1A concluída e 18F.1B.1 implementada como boundary
autenticado estritamente offline**. A readiness HTTPS real da 18F.1B continua não
executada. Este runbook não autoriza nem realiza qualquer operação remota.

## Objetivo da 18F

Preparar, validar e executar por etapas a adoção de um MCP remoto corporativo real sob
controles fail-closed. A trilha separa readiness, discovery e execução de tool para que
cada aumento de capacidade dependa de uma decisão operacional própria, evidência
sanitizada e rollback explícito.

## Diagnóstico 18F.0

A infraestrutura necessária já existe em `backend/src/modules/mcp/remote/`: configuração,
client, readiness, discovery, egress, policy read-only, interfaces de transporte, factory,
transporte fail-closed e adapter `corporate-readonly`.

O readiness atual aceita `purpose: 'discovery'` com
`MCP_REMOTE_DISCOVERY_ENABLED=true` enquanto
`MCP_REMOTE_EXECUTION_ENABLED=false`; nesse caminho, execution fica marcada como
separadamente bloqueada. A execução de tool continua exigindo seu próprio gate. O
discovery real, por sua vez, alcançaria validação de egress, resolução de host e
transporte remoto, portanto não é chamado na 18F.1A.

Os defaults versionados continuam fechados, a allowlist e a origem corporativa
continuam vazias e não há endpoint operacional materializado. Os procedimentos 16U e
16Y foram desenhados para a futura execução única da tool e exigem execution habilitada;
por isso não são reutilizados como procedimento operacional da 18F.1A e permanecem
inalterados.

## Divisão da Fase 18F

| Subfase | Resultado autorizado | Rede | Execution |
| --- | --- | --- | --- |
| 18F.1A | Preflight offline e contrato operacional | não | bloqueada |
| 18F.1B.1 | Boundary target corporativo autenticado e testes offline | não | bloqueada |
| 18F.1B | Readiness HTTPS real supervisionado | somente em janela futura aprovada | bloqueada |
| 18F.1C | Discovery remoto real read-only | somente em janela futura aprovada | bloqueada |
| 18F.1D | Primeira tool read-only real supervisionada | somente em janela futura aprovada | autorização própria |
| 18F.1E | Evidências, rollback e fechamento | conforme evidências aprovadas | volta ao default fechado |

Nenhuma subfase é iniciada automaticamente pela anterior.

## Escopo da 18F.1A

- documentar o contrato da Fase 18F e o handoff entre suas subfases;
- validar estaticamente os componentes MCP remotos existentes;
- validar que os defaults versionados continuam fail-closed e sem origem operacional;
- validar, apenas no processo do operador, flags, origem única, allowlist e secretRef;
- fornecer checklist GO/NO-GO e smoke offline para a CI;
- executar somente leitura local de arquivos versionados e das variáveis explicitamente
  allowlistadas no modo `--local-check`.

Contrato invariável da entrega:

```text
18F.1A:
network=false
realReadiness=false
realDiscovery=false
realToolExecution=false
browserRequired=false
deployment=false
migration=false
production=false
```

## Fora de escopo

Não há chamada HTTP, DNS, socket, provider, MCP, readiness real, discovery real ou tool.
Também não há browser, AgentRun, acesso a banco, Prisma, migration, Docker live, deploy,
produção, endpoint novo, alteração de frontend/backend funcional ou mudança de default.

## Relação com as fases anteriores

- **16T** estabeleceu o boundary do conector `corporate.status.read` e seu transporte
  read-only, ainda desabilitado por default.
- **16U** definiu uma homologação supervisionada que inclui execução única e, por isso,
  requer `MCP_REMOTE_EXECUTION_ENABLED=true`; seus artefatos são históricos e não mudam.
- **16Y** validou estruturalmente o readiness HTTPS ligado à futura tool e também mantém
  o contrato histórico de execution habilitada na janela; somente seu smoke estático
  reconhece os novos paths, sem apagar a evidência histórica do runbook.
- **16Z** preparou a publicação HTTPS futura sem materializá-la.
- **17A** definiu o plano de deploy homologado, mas não autorizou deploy ou produção.
- **18D** forneceu catálogo e precheck MCP locais, sem transporte remoto ou execução.
- **18E** endureceu governança e dados técnicos da UI, sem autorizar MCP remoto.
- **18F** começa a progressão operacional real, mantendo readiness, discovery e tool em
  decisões separadas.

## Flags do perfil local-check

No processo efêmero usado pelo operador na 18F.1A, o contrato é exatamente:

| Variável | Valor obrigatório |
| --- | --- |
| `MCP_REMOTE_ENABLED` | `true` |
| `MCP_REMOTE_DISCOVERY_ENABLED` | `true` |
| `MCP_REMOTE_EXECUTION_ENABLED` | `false` |
| `MCP_REMOTE_READONLY_ENABLED` | `true` |
| `MCP_REMOTE_ALLOW_WRITE_TOOLS` | `false` |
| `MCP_REMOTE_REQUIRE_SECRET_REF` | `true` |
| `MCP_CORPORATE_READONLY_ENABLED` | `true` |

Esses valores descrevem somente o perfil do preflight. Eles não alteram `.env.example`,
`backend/.env.example`, Compose, CI ou defaults do backend. Em particular, execution
permanece obrigatoriamente `false`.

## Origem e allowlist

Somente o processo operacional pode receber:

- `MCP_CORPORATE_READONLY_ORIGIN`;
- `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN`;
- `MCP_REMOTE_EGRESS_ALLOWLIST`.

A origem deve ser uma única origem HTTPS canônica, sem username/password, path além de
`/`, query ou fragment. Localhost, nomes `.local`, hosts de metadata e endereços IP
loopback, privados, link-local ou reservados são rejeitados sem resolução DNS.

`MCP_CORPORATE_READONLY_ALLOWED_ORIGIN` deve ser textualmente idêntica a
`MCP_CORPORATE_READONLY_ORIGIN`. A allowlist deve conter exatamente o mesmo texto, sem
segunda origem, lista separada por vírgula ou path.

Nenhuma origem operacional pode ser gravada em env examples, Compose, CI ou código
funcional.

## SecretRef

`MCP_CORPORATE_READONLY_SECRET_REF` é uma variável operacional do preflight e existe
somente no processo efêmero do operador. Ela aceita exclusivamente uma referência no
formato `env://ORCHESTRA_CORPORATE_READONLY_[A-Z0-9_]+`, com ao menos um caractere no
sufixo e no máximo 240 caracteres no total, alinhada ao resolver, ao client e ao schema
de entrada atuais.

Para a readiness real futura, o mesmo valor lógico deve ser gravado em
`McpServer.secretRef`. O backend não lê
`MCP_CORPORATE_READONLY_SECRET_REF` diretamente: o campo do servidor é a referência que
o transporte recebe. O valor real apontado pela referência deve existir apenas no
environment ou secret manager do processo backend. O resolver real exige valor de 12 a
4096 caracteres ASCII imprimíveis, mas a 18F.1A não verifica esse conteúdo porque nunca
resolve a referência.

O preflight não lê a variável apontada, não aceita credencial raw e não imprime nem
persiste o valor real. Nenhum modo carrega `.env` automaticamente.

## Blocker identificado antes da 18F.1B

A auditoria offline encontrou uma assimetria no desenho anterior. O
`CorporateReadonlyHttpTransport` exigia `secretRef`, resolvia o valor e enviava
`Authorization: Bearer`, mas chamava os endpoints públicos `GET /health`,
`GET /v1/status` e `GET /v1/status/availability`. Esses handlers não validam Bearer.

Assim, o `secretRef` era um gate do client e proteção do acesso à credencial, mas um
sucesso não comprovava autenticação ponta a ponta nem identidade read-only no target.
Esse é um blocker para readiness **autenticada**, embora não impeça um teste de mera
conectividade HTTPS. A 18F.1B.1 corrige o contrato em código sem abrir rede.

## Boundary corporativo autenticado da 18F.1B.1

Os endpoints operacionais públicos permanecem semanticamente inalterados e continuam
fora do target corporativo:

```text
GET /health
GET /v1/status
GET /v1/status/availability
```

O boundary inbound dedicado contém somente três rotas GET fixas, sem parâmetros de
path, query ou body e sem fallback público:

```text
GET /v1/corporate-readonly/health
GET /v1/corporate-readonly/status
GET /v1/corporate-readonly/status/availability
```

O health autenticado retorna exatamente `status`, `service`, `timestamp` e `requestId`,
compatível com `CorporateReadonlyHttpTransport.checkHealth()`. Status e availability
retornam exatamente `status`, `summary` e `updatedAt`, conforme o contrato 16X. Não há
campos adicionais, conteúdo raw, header, token, secretRef ou detalhe interno.

O transporte usa exclusivamente os três paths autenticados. Uma falha neles encerra a
operação; não existe tentativa subsequente em `/health` ou `/v1/status*` públicos.

## Gate inbound e autenticação efetiva

`MCP_CORPORATE_READONLY_ENABLED` continua governando somente o transporte outbound. Ele
não foi reutilizado porque acoplar a habilitação do client à exposição do target uniria
duas direções de confiança distintas. O boundary inbound possui gate dedicado:

```text
MCP_CORPORATE_READONLY_TARGET_ENABLED=false
```

O default é `false` nos env examples, no schema e no Compose de produção. Habilitar o
transporte outbound não abre automaticamente o target inbound.

O token esperado existe somente como
`ORCHESTRA_CORPORATE_READONLY_STATUS_TOKEN` no environment ou secret manager do processo
target. Não há valor ou placeholder de credencial nos env examples. O Compose apenas
permite a injeção do ambiente externo e mantém o gate inbound fechado.

O middleware aceita exclusivamente o texto exato `Bearer <token>` no header
`Authorization`. O token configurado precisa ter de 12 a 4096 caracteres ASCII
imprimíveis sem espaço, as mesmas restrições materiais do resolver corporativo. Ausência
de gate, token ausente/inválido, Bearer ausente, vazio, Basic ou Bearer incorreto falham
fechado com resposta sanitizada. A comparação usa digest de tamanho fixo e
`timingSafeEqual`; não há diferença de erro que revele o valor esperado.

Para o target planejado no próprio backend Orchestra, o valor lógico gravado em
`McpServer.secretRef` deve ser
`env://ORCHESTRA_CORPORATE_READONLY_STATUS_TOKEN`. O resolver do client e o middleware
do target então usam o mesmo valor mantido apenas no ambiente seguro do processo. O
valor real nunca deve ser impresso, persistido, incluído em metadata ou copiado para
evidência.

O auto-logging HTTP ignora integralmente o prefixo `/v1/corporate-readonly/`, evitando
captura de Authorization e também de tentativas indevidas por query. O boundary não
chama audit, banco, MCP, provider, discovery, tool ou AgentRun.

## Estado offline da 18F.1B.1

A implementação e seus testes usam apenas token sintético determinístico dentro do
processo de teste. Nesta subfase:

```text
network=false
realReadiness=false
realDiscovery=false
realToolExecution=false
browserRequired=false
deployment=false
migration=false
production=false
```

Nenhuma chamada HTTPS, DNS, MCP, provider ou browser foi realizada. A 18F.1B real
permanece não executada e exige janela, autorização e evidência manual sanitizada.

## Execução do preflight

Todos os modos são offline:

```bash
scripts/preflight-mcp-remoto-governado-18f.sh --dry-run
scripts/preflight-mcp-remoto-governado-18f.sh --local-check
scripts/preflight-mcp-remoto-governado-18f.sh --go-no-go-template
scripts/preflight-mcp-remoto-governado-18f.sh --help
```

`--dry-run` lê somente artefatos versionados. `--local-check` lê apenas as onze variáveis
descritas neste runbook e nunca exibe seus valores. O operador deve injetá-las por um
canal efêmero aprovado; este documento deliberadamente não fornece endpoint ou
credencial. `--go-no-go-template` apenas imprime o checklist textual de decisão.

## Fail-closed

- os defaults versionados de remote, discovery, execution, read-only e adapter
  corporativo continuam `false`;
- o gate inbound `MCP_CORPORATE_READONLY_TARGET_ENABLED` continua `false`;
- write tools continuam bloqueadas e secretRef continua obrigatória;
- allowlist e origem corporativa continuam vazias nos artefatos versionados;
- o transporte genérico continua `FailClosedMcpRemoteClientTransport` quando nenhum
  destino governado corresponde;
- o transporte corporativo não possui fallback para os endpoints públicos;
- o preflight não chama o service de discovery, client, factory ou transporte;
- qualquer variável ausente, valor divergente, origem não pública ou secretRef não
  lógico resulta em NO-GO.

## Critérios GO/NO-GO da 18F.1A

GO exige, cumulativamente:

- `--dry-run` e o smoke concluídos com `FAIL=0`;
- `--local-check` concluído com as onze variáveis efêmeras e sem revelar valores;
- execution e write tools explicitamente bloqueadas;
- origem pública HTTPS única, igualdade textual e allowlist unitária;
- secretRef no namespace `env://ORCHESTRA_CORPORATE_READONLY_*`, limitada a 240
  caracteres e sem resolução;
- defaults e escopo da fase intactos;
- evidência sanitizada revisada por responsável humano.

Qualquer falha é NO-GO. Um GO da 18F.1A significa apenas que o preflight offline está
aprovado; não significa readiness, discovery, execução, deploy ou produção aprovados.

## Evidências permitidas

- summaries com flags booleanas e contadores PASS/FAIL;
- `git status --short`, `git diff --stat` e `git diff --check`;
- resultado de sintaxe Bash, typechecks e regressões offline;
- checklist GO/NO-GO preenchido com responsável, data e referência de mudança.

Não são evidências permitidas: endpoint operacional, hostname real, allowlist real,
valor de secretRef, variável resolvida, token, headers, payload bruto, dump de ambiente,
resposta de provider/MCP, conteúdo de banco ou screenshot com dado sensível.

## Riscos

- um GO offline não comprova disponibilidade, TLS, DNS ou contrato do servidor remoto;
- diferenças entre a configuração efêmera e a futura janela podem invalidar a decisão;
- a resolução DNS e o egress real só serão avaliados na subfase que explicitamente os
  autorizar;
- o adapter corporativo possui capacidade de rede quando invocado, embora nenhum caminho
  funcional seja chamado nesta subfase;
- secretRef lógica válida sintaticamente não comprova existência, permissão ou rotação da
  credencial.
- habilitar somente o outbound ou somente o inbound não completa o handshake; os dois
  gates e o mesmo segredo server-side precisam ser aprovados na futura janela.

## Rollback da 18F.1A

A subfase não cria estado operacional. O rollback consiste em encerrar o processo
efêmero, descartar suas variáveis, retirar o step 18F.1A da CI e reverter somente o
runbook, o preflight, o smoke e a referência curta do índice por meio do fluxo normal de
change control. Defaults, banco e serviços não exigem rollback porque não foram alterados.

## Handoff explícito para 18F.1B

A 18F.1B deverá ter autorização e janela próprias para **readiness HTTPS real
supervisionado**, ainda com `MCP_REMOTE_EXECUTION_ENABLED=false`. Antes de qualquer
rede, deverá identificar responsável, endpoint aprovado por canal não versionado,
política de DNS/egress, evidências sanitizadas, timeout, interrupção e rollback.

O caminho atual de readiness 18F.1B não cria `AgentRun`, `ToolCall` ou audit persistido.
Por isso, a evidência da 18F.1B será manual e sanitizada, sem secretRef, valor real,
header de autorização ou payload bruto.

A 18F.1A não executa nem agenda esse handoff. Discovery permanece reservado à 18F.1C e
a primeira tool real à 18F.1D.

Antes da janela, confirmar separadamente o gate outbound, o gate inbound, a referência
lógica cadastrada, a presença do token apenas no secret manager/processo target, os três
paths autenticados, TLS/egress e a ausência de fallback. A evidência não pode conter o
token, Authorization, secretRef, headers ou payload bruto.
