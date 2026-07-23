# Orchestra — Homologação supervisionada do conector read-only 16U

## Objetivo

A Fase 16U define a janela controlada para homologar o boundary corporativo read-only preparado na 16T contra um endpoint real previamente aprovado. Ela acrescenta checklist, preflight local sem rede, readiness supervisionada, autorização para uma única execução manual, auditoria segura, evidências, rollback e encerramento.

Este procedimento não configura endpoint ou segredo no Git, não faz chamada real automaticamente e não habilita MCP remoto por default. A única tool permitida é `corporate.status.read`. Sem aprovação completa e janela aberta, o resultado esperado é fail-closed.

A Fase 16V implementa no backend do Orchestra o alvo seguro `GET /v1/status` e `GET /v1/status/availability`, sem executar a tool. A Fase 16W reutiliza estes controles, mas adota a Opção C: não abre exceção para o HTTP local nem implementa execução live local. A chamada real continua condicionada a uma origem HTTPS homologada e contrato compatível.

## Escopo

- um ambiente corporativo dedicado de homologação;
- uma origem HTTPS exata, informada pelo operador somente no ambiente local/seguro;
- uma identidade exclusiva de leitura, resolvida server-side por `secretRef` lógico;
- readiness manual e supervisionada;
- no máximo uma execução real de `corporate.status.read` por janela aprovada;
- validação de audit/Analytics somente por campos técnicos allowlistados;
- contenção, revogação e preservação de evidências técnicas.

## Fora de escopo

- produção, tráfego contínuo, scheduler, retry automático ou execução em CI/smoke;
- discovery amplo, mais de uma tool ou qualquer operação de escrita;
- endpoint, hostname, URL, credencial ou valor de segredo versionado;
- Gmail, Drive, Slack, e-mail, ERP, banco transacional ou dado sensível;
- alterações de schema Prisma, migrations, seed ou carga de dados;
- captura de prompt, contexto, argumentos, output, body, headers ou resposta bruta;
- uso da homologação como aprovação permanente do conector.

## Pré-requisitos

Antes de reservar a janela, devem existir fora do Git:

1. identificador da mudança e da janela, início/fim e canal de coordenação;
2. operador executor, supervisor independente, owner técnico, owner de dados e responsável por segurança;
3. endpoint de homologação aprovado pelos critérios abaixo;
4. identidade exclusiva read-only e procedimento de revogação exercitável;
5. `secretRef` lógico aprovado e valor disponível no secret manager do processo backend;
6. server, tool, binding e policy previamente revisados, ainda bloqueados;
7. assistant e versão publicados exclusivamente para homologação;
8. acesso de leitura a audit/Analytics e ao banco de homologação;
9. plano de rollback com responsáveis presentes durante toda a janela;
10. smokes 16P–16T, evals 16S e preflight 16U `--dry-run` verdes no mesmo commit.

## Critérios de aprovação do endpoint

O supervisor deve confirmar e registrar, fora do Git:

- ambiente dedicado de homologação, sem compartilhamento com produção;
- origem HTTPS única, sem path, query, fragment, usuário ou senha;
- DNS e todos os endereços resolvidos públicos, sem loopback, faixas privadas, link-local, metadata ou resolução mista;
- certificado TLS válido, cadeia e renovação aprovadas;
- ausência de redirects;
- apenas os paths fixos implementados na 16T para health/status;
- métodos GET sem side effect e sem parâmetros arbitrários;
- timeout de até 3 segundos e resposta limitada a 16 KiB;
- rate limit suficiente para readiness e uma execução, sem retry automático;
- contrato de resposta read-only, `non_sensitive` e sanitizável;
- owner, monitoração e contato de incidente disponíveis na janela.

Mudança de origem, DNS, certificado, schema, classificação, identidade ou owner invalida a aprovação e exige nova revisão.

## Critérios de dados não sensíveis

A homologação só pode prosseguir quando o owner de dados atestar que a resposta contém exclusivamente status operacional fictício ou agregado, sem:

- dado pessoal, identificador de pessoa ou dado de dispositivo individual;
- informação financeira, comercial restrita, jurídica, médica ou de cliente;
- nomes internos confidenciais, IDs transacionais, conteúdo de documento ou mensagem;
- token, chave, cookie, header, URL assinada, connection string ou referência de secret;
- stack trace, consulta, payload ecoado ou detalhe de infraestrutura explorável.

O schema remoto deve se limitar ao resumo sanitizado aceito pela 16T. Dado inesperado, mesmo que a UI não o mostre, reprova a janela e aciona rollback.

## Checklist antes da janela

- [ ] mudança, janela, escopo e critério de abortar aprovados;
- [ ] operador e supervisor presentes e com segregação de função;
- [ ] origem, DNS, TLS, paths, GET-only e ausência de redirect revisados;
- [ ] classificação `non_sensitive` assinada pelo owner de dados;
- [ ] tool exata `corporate.status.read`, read-only e low risk confirmada;
- [ ] server/binding/policy identificados e inicialmente bloqueados;
- [ ] `MCP_REMOTE_ALLOW_WRITE_TOOLS=false` confirmado;
- [ ] `secretRef` lógico revisado e segredo fora do Git, UI, logs e evidências;
- [ ] identidade sem escopos de escrita e revogação disponível;
- [ ] allowlist contém somente a origem aprovada;
- [ ] timeout, limite de resposta e uma única execução acordados;
- [ ] audit/Analytics acessíveis sem consulta a conteúdo bruto;
- [ ] comandos de rollback preparados e owner de incidente disponível;
- [ ] `git status --short` sem mudança em Prisma schema/migrations;
- [ ] validações offline obrigatórias verdes.

## Flags e envs necessárias

Todos os defaults versionados permanecem fechados. Os valores de abertura existem somente no processo local/seguro durante a janela.

| Variável | Estado da janela | Regra |
|---|---|---|
| `MCP_REMOTE_ENABLED` | `true` somente no runtime aprovado | gate global já existente; não é alterado no Git |
| `MCP_REMOTE_EXECUTION_ENABLED` | `true` somente após approval | volta a `false` no encerramento |
| `MCP_REMOTE_READONLY_ENABLED` | `true` somente após approval | não autoriza escrita |
| `MCP_REMOTE_ALLOW_WRITE_TOOLS` | sempre `false` | qualquer outro valor reprova |
| `MCP_REMOTE_REQUIRE_SECRET_REF` | sempre `true` | valor bruto não é aceito |
| `MCP_REMOTE_EGRESS_ALLOWLIST` | exatamente a origem aprovada | uma única entrada, sem lista adicional |
| `MCP_CORPORATE_READONLY_ENABLED` | `true` somente durante readiness/execução | volta a `false` imediatamente depois |
| `MCP_CORPORATE_READONLY_ORIGIN` | origem operacional para o preflight 16U | não é versionada nem lida pelo backend |
| `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN` | mesma origem, materializada no processo backend | contrato da 16T; nunca gravar em arquivo versionado |
| `MCP_CORPORATE_READONLY_SECRET_REF` | referência lógica para o preflight 16U | não contém o valor do segredo |

O `--local-check` valida somente as seis variáveis operacionais exigidas pela 16U: `MCP_CORPORATE_READONLY_ENABLED`, `MCP_CORPORATE_READONLY_ORIGIN`, `MCP_CORPORATE_READONLY_SECRET_REF`, `MCP_REMOTE_EGRESS_ALLOWLIST`, `MCP_REMOTE_EXECUTION_ENABLED` e `MCP_REMOTE_READONLY_ENABLED`. Ele não substitui a revisão dos demais gates.

Após o `--local-check` verde e com o supervisor presente, o operador pode materializar a origem no processo backend com a variável da 16T. Isso ocorre somente na sessão segura e não em `.env`, Compose, workflow ou arquivo de evidência.

## SecretRef

`MCP_CORPORATE_READONLY_SECRET_REF` deve conter apenas uma referência lógica no namespace `env://`, apontando para um nome controlado pelo secret manager. O preflight valida formato e presença da referência, mas deliberadamente não resolve, lê ou imprime o valor referenciado.

O mesmo `secretRef` lógico deve estar associado ao server MCP de homologação com `authType=bearer`. O valor é injetado no processo backend pelo secret manager e resolvido somente no instante da chamada. Não copie a referência para screenshots quando isso contrariar a política interna; nunca copie o valor.

Ausência da referência, valor bruto no lugar da referência, namespace diferente, segredo indisponível ou identidade com permissão além de leitura bloqueiam a janela.

## Allowlist exata

`MCP_REMOTE_EGRESS_ALLOWLIST` deve ser textualmente igual a `MCP_CORPORATE_READONLY_ORIGIN`: uma única origem HTTPS, sem separador, espaço, path, query, fragment ou credenciais embutidas. O `--local-check` falha se a origem não for HTTPS ou se a allowlist estiver ausente/diferente.

O check local é estrutural e não consulta DNS, certificado ou serviço. Esses itens pertencem à aprovação supervisionada e ao readiness governado. A origem aprovada também deve ser materializada em `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN` apenas no processo backend da janela.

## Preflight seguro

Antes da janela:

```bash
scripts/preflight-conector-readonly-16u.sh --dry-run
```

Na sessão local/segura, depois de definir as seis variáveis operacionais sem persistir histórico sensível:

```bash
scripts/preflight-conector-readonly-16u.sh --local-check
```

O script não carrega `.env`, não imprime valores, não resolve segredo, não abre rede, não acessa banco e não executa migration. Um resultado verde comprova somente coerência local; não comprova aprovação, disponibilidade ou segurança do endpoint.

## Readiness supervisionada

Com a janela formalmente aberta, operador e supervisor executam a seguinte sequência manual:

1. confirmar commit, janela e checklist no registro externo;
2. executar novamente o preflight local e guardar apenas seu resumo PASS;
3. materializar origem e segredo no processo backend seguro;
4. manter binding e execução bloqueados;
5. habilitar apenas os gates necessários ao readiness;
6. iniciar o backend de homologação e acionar a ação governada de readiness;
7. confirmar host sanitizado, `failClosed`, tool exata, GET-only, read-only e classificação não sensível;
8. confirmar que nenhum valor, header ou conteúdo bruto apareceu em terminal, audit ou Analytics;
9. se qualquer sinal divergir, não abrir policy/binding e executar rollback.

Readiness verde é condição necessária, não autorização de execução. Não se usa comando genérico de rede, dump de environment ou tracing de request/response como evidência.

## Execução única controlada

A autorização vale para exatamente um `AgentRun` manual, iniciado pelo operador durante a janela e observado pelo supervisor:

1. registrar o identificador único da janela e o assistant/version publicados;
2. confirmar server/tool/binding/policy exatos e `corporate.status.read` com `scope=summary`;
3. confirmar contador de execuções reais da janela em zero;
4. abrir binding/policy somente para esse run e manter escrita bloqueada;
5. iniciar uma única execução pela interface/API governada do Orchestra;
6. não repetir automaticamente em timeout, erro, bloqueio ou resposta inválida;
7. registrar apenas o `runId` retornado e os sinais allowlistados;
8. fechar imediatamente policy, binding e flags antes de analisar o resultado;
9. qualquer segunda tentativa exige nova janela e nova aprovação.

Nenhum script da 16U executa essa chamada. CI, smoke, preflight e audit permanecem offline/provider-free.

## Validação de audit/Analytics

Após fechar os gates, conferir somente:

- `runId` e `status`;
- `externalMcpCalled` e `simulated`;
- `mcpRemoteAllowed`, `mcpRemoteBlocked` e `mcpRemoteBlockedReason`;
- `mcpRemoteHost` e `mcpRemoteToolId`;
- `responseBytes`, `latencyMs` e `rawContentLogged`.

Para sucesso real, espera-se `externalMcpCalled=true`, `simulated=false`, tool exata, host sanitizado, `rawContentLogged=false`, status concluído e limites respeitados. Para tentativa bloqueada, a razão deve ser sanitizada e `externalMcpCalled` não pode indicar chamada.

Não abrir metadata completa nem selecionar input, contexto, args, output, body, headers, credencial ou `secretRef`. Se Analytics ou audit exibir qualquer conteúdo bruto, classificar como incidente, preservar os IDs técnicos e acionar rollback/containment.

## Consulta SQL segura

O operador gera a consulta versionada e a revisa antes de executá-la no banco de homologação:

```bash
scripts/audit-conector-readonly-16u.sh --sql-template
```

O template exige um `run_id` explícito e projeta somente os campos allowlistados da seção anterior. Ele não conecta ao banco e não executa SQL. Não substituir a projeção por `SELECT *`, metadata completa ou colunas de conteúdo.

## Evidências

Guardar no sistema de mudança aprovado, com acesso restrito:

- commit e resultado das validações offline;
- identificador e período da janela;
- nomes/funções dos aprovadores, sem credenciais;
- atestados de endpoint e dados não sensíveis;
- resumo PASS do preflight, sem valores;
- `runId`, status, timestamps e campos allowlistados do template SQL;
- confirmação de uma execução no máximo;
- confirmação de rollback, revogação/fechamento e contador final;
- decisão final aprovada ou reprovada e riscos aceitos.

Não anexar terminal completo, environment, URL, resposta, screenshots com conteúdo, request/response, logs brutos ou export de banco.

## Critérios de sucesso

A homologação é aprovada somente quando:

- todos os aprovadores e critérios do endpoint/dados estavam válidos durante a janela;
- preflight e readiness passaram sem bypass;
- houve exatamente uma execução manual de `corporate.status.read`;
- a execução respeitou GET-only, timeout e limite de resposta;
- `externalMcpCalled=true`, `simulated=false` e status concluído;
- `rawContentLogged=false` e nenhuma superfície expôs conteúdo bruto ou segredo;
- audit/Analytics e SQL seguro correlacionam o mesmo `runId`;
- rollback/encerramento foram concluídos e comprovados;
- nenhuma mudança foi feita em schema/migrations ou defaults fail-closed.

Sucesso na 16U autoriza apenas registrar a evidência da janela. Não autoriza produção, execução recorrente, outra origem, outra tool ou dado sensível.

## Rollback

Na conclusão ou em qualquer desvio, executar nesta ordem:

1. definir `MCP_CORPORATE_READONLY_ENABLED=false`;
2. definir `MCP_REMOTE_EXECUTION_ENABLED=false` e `MCP_REMOTE_READONLY_ENABLED=false`;
3. desabilitar binding, policy, tool e server da homologação;
4. remover origem das variáveis/allowlist do processo seguro;
5. encerrar o processo backend da janela;
6. revogar/rotacionar a identidade no secret manager quando houve chamada, dúvida ou incidente;
7. confirmar que uma nova execução falha fechada;
8. preservar somente evidências técnicas allowlistadas e abrir incidente se necessário.

O rollback não apaga runs, audit ou eventos técnicos e não exige migration. Não se repete a chamada para “confirmar” uma falha.

## Encerramento da janela

Antes de liberar a equipe:

- confirmar flags fechadas, allowlist vazia no processo e adapter indisponível;
- confirmar binding/policy/tool/server desabilitados conforme o plano;
- encerrar sessões/processos temporários e remover variáveis da sessão;
- confirmar revogação ou retorno da credencial ao estado aprovado;
- registrar número de tentativas e o único `runId`, quando existir;
- executar novamente dry-runs/smokes offline;
- classificar a homologação como aprovada, reprovada ou abortada;
- registrar follow-ups e prazo sem manter a janela aberta.

## Critérios para reprovar a homologação

Reprovar ou abortar imediatamente se ocorrer:

- aprovação, owner, janela, endpoint ou classificação incompletos;
- origem não HTTPS, allowlist divergente, DNS/TLS/redirect inesperado;
- secret bruto, referência inválida ou identidade com permissão de escrita;
- tool diferente de `corporate.status.read` ou operação diferente de GET;
- qualquer segunda execução, retry automático ou chamada fora da janela;
- resposta fora do schema, acima do limite, sensível ou não sanitizável;
- `rawContentLogged` diferente de `false` ou conteúdo bruto em qualquer evidência;
- ausência/inconsistência de audit, Analytics ou correlação do `runId`;
- falha de rollback, flags abertas ao final ou alteração de default versionado;
- mudança em Prisma schema/migrations ou endpoint/segredo encontrado no Git.

Falha técnica, timeout ou bloqueio fail-closed não deve ser transformado em nova tentativa na mesma janela.

## Riscos remanescentes

- DNS, certificado, serviço ou classificação podem mudar após a aprovação;
- uma credencial read-only comprometida ainda pode ler todo o escopo concedido;
- o serviço pode devolver conteúdo indevido apesar do schema acordado;
- operadores podem materializar flags/allowlists incorretamente fora do Git;
- audit/Analytics dependem de metadata sanitizada e retenção operacional corretas;
- uma janela bem-sucedida não mede carga, disponibilidade contínua ou comportamento de produção;
- o resolver baseado em environment exige higiene de processos e secret manager externo;
- o gateway mantém limitações operacionais já documentadas na 16T.

Por esses riscos, o estado permanente continua desabilitado e cada nova execução real exige aprovação supervisionada própria.

## Handoff para 16V e 16W

- 16V cria e testa o alvo HTTP read-only, sem abrir flags, configurar segredo ou executar MCP;
- 16W prepara a execução, registra a decisão entre HTTP local e HTTPS e mantém `realExecution=false`;
- o modo live local foi recusado porque o boundary corporativo exige HTTPS/egress público e o contrato estrito da 16V ainda precisa ser reconciliado com o adapter;
- a primeira execução real de `corporate.status.read` permanece futura e exige ambiente HTTPS formalmente aprovado;
- a topologia prevista é frontend `https://orchestra.mcm.eng.br` e backend/API `https://api.orchestra.mcm.eng.br` em produção, e frontend `http://localhost:5173` e backend/API `http://localhost:3000` localmente;
- a existência dos endpoints 16V não substitui aprovação, readiness, execução única, auditoria allowlistada ou rollback definidos nesta 16U.
- MCP/Tool real continua proibido para sistemas sensíveis; teste visual MCP/Assistant e CRUD MCP ponta a ponta permanecem para fases posteriores.
