# Orchestra — Readiness HTTPS da tool de status 16Y

## Objetivo

A Fase 16Y prepara a camada de readiness HTTPS para a futura primeira execução real de `corporate.status.read`. Ela responde, de forma estrutural e offline, se a topologia, a origem aprovada, os paths fixos, o contrato 16V/16X, as variáveis da janela e o template de auditoria estão coerentes.

A 16Y não executa chamada real, não executa MCP e não comprova DNS, TLS, ingress ou disponibilidade. A Fase 16Z usa esse baseline para preparar a publicação HTTPS, ainda sem deploy ou execução real.

## Escopo

- runbook operacional de readiness HTTPS;
- preflight com modos offline e origem compilada;
- validação local das variáveis materializadas somente no processo da janela;
- templates manuais de HTTPS e auditoria, sem execução;
- smoke estático no CI em `--dry-run`;
- regressões das fases 16S, 16T, 16U, 16V, 16W e 16X;
- documentação do handoff para a preparação de publicação 16Z.

## Fora de escopo

- chamada HTTP/HTTPS automática, DNS, TLS, `curl` live ou acesso a endpoint no CI;
- execução real de MCP, discovery remoto, tool call, AgentRun ou provider externo;
- uso de OpenAI ou qualquer provider;
- criação de server MCP pela tela, associação de MCP a Assistant ou teste de UI/CRUD MCP;
- teste visual da tela MCP/Assistant;
- aceitar URL, origem, path, método ou header por argumento;
- gravar endpoint operacional em `.env.example` ou `docker-compose.prod.yml`;
- versionar ou imprimir segredo, credencial, bearer, token ou API key;
- alterar backend, frontend, Prisma schema ou migrations.

O usuário será avisado antes de qualquer teste direto no sistema. Esse aviso e a autorização pertencem a uma fase posterior à publicação e validação da API, não à 16Y nem à 16Z.

## Relação com 16T, 16U, 16V, 16W e 16X

- a 16T implementou o boundary corporativo fail-closed, GET-only, com HTTPS exato, egress/SSRF, limites e `secretRef` lógico;
- a 16U definiu janela supervisionada, aprovação, evidências allowlistadas e rollback;
- a 16V criou os endpoints passivos e o contrato público seguro;
- a 16W preparou a primeira execução, mas manteve `realExecution=false` porque o ambiente local é HTTP;
- a 16X alinhou o mapper ao contrato `status`, `summary`, `updatedAt` e reservou `/health` para readiness;
- a 16Y fixa a topologia HTTPS prevista e valida a preparação sem chamar a rede;
- a 16Z deverá preparar a futura publicação HTTPS, sem deploy, rede ou chamada real.

A 16Y não substitui nenhum controle anterior e não transforma readiness em autorização.

## Topologia prevista

| Papel | URL prevista | Uso na 16Y |
|---|---|---|
| Frontend de produção | `https://orchestra.mcm.eng.br` | referência de UI; não é origem da tool |
| Backend/API de produção | `https://api.orchestra.mcm.eng.br` | origem HTTPS aprovada para a futura tool |

A origem correta para `corporate.status.read` é o backend/API, não o frontend. O preflight não aceita a URL do frontend nem outra URL arbitrária.

As URLs neste runbook são referências explícitas de topologia do Orchestra. Elas não devem ser copiadas para `.env.example`, `backend/.env.example`, `docker-compose.prod.yml` ou workflow.

## Origem HTTPS aprovada

A única origem estruturalmente aprovada pela 16Y é:

```text
https://api.orchestra.mcm.eng.br
```

Ela deve ser textualmente idêntica nas três variáveis de origem/allowlist da janela. Não é permitido acrescentar `/`, path, query, fragment, porta alternativa, username ou password. HTTP, frontend, localhost, loopback, IP privado, link-local, metadata e origem adicional são bloqueados.

O check é propositalmente estrutural: não resolve DNS, não abre socket e não examina certificado. DNS público, TLS válido e disponibilidade só podem ser comprovados manualmente em janela autorizada.

## Endpoints esperados

Somente estes alvos são elegíveis:

```text
GET https://api.orchestra.mcm.eng.br/v1/status
GET https://api.orchestra.mcm.eng.br/v1/status/availability
```

`GET /health` continua exclusivo do readiness governado do transport. Ele não é alvo selecionável da execução de `corporate.status.read`. URL e path não são recebidos por argumento; o adapter mantém os três paths compilados e o preflight 16Y imprime somente os dois endpoints públicos esperados.

## Contrato esperado da tool

Os endpoints 16V e a tool alinhada na 16X compartilham exatamente:

```json
{
  "status": "ok",
  "summary": "...",
  "updatedAt": "<ISO timestamp>"
}
```

`status` aceita somente `ok|degraded`; `summary` é texto sanitizado e limitado; `updatedAt` é timestamp ISO válido. Campo ausente, campo adicional, HTML, marcador sensível ou timestamp inválido deve falhar fechado. O `/health` legado pode ser normalizado internamente, mas `service` e `requestId` não são propagados.

## Variáveis necessárias

O `--local-check` exige, apenas no processo efêmero da janela:

```text
MCP_CORPORATE_READONLY_ENABLED=true
MCP_CORPORATE_READONLY_ORIGIN=https://api.orchestra.mcm.eng.br
MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=https://api.orchestra.mcm.eng.br
MCP_REMOTE_EGRESS_ALLOWLIST=https://api.orchestra.mcm.eng.br
MCP_REMOTE_EXECUTION_ENABLED=true
MCP_REMOTE_READONLY_ENABLED=true
MCP_CORPORATE_READONLY_SECRET_REF=env://ORCHESTRA_STATUS_READONLY_TOKEN
```

Esses valores não são defaults e não devem ser persistidos. A presença das flags no processo serve apenas para validar a configuração da janela; a 16Y não inicia backend nem usa os gates para executar MCP.

### `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN`

É a origem exata lida pelo adapter. Na janela futura, deve existir somente no processo backend seguro e ser textualmente igual à origem aprovada. Nos arquivos versionados ela continua vazia.

### `MCP_CORPORATE_READONLY_ORIGIN` como variável operacional do preflight

É consumida somente pelo script 16Y para validar a janela. Ela não é uma segunda allowlist, não é lida pelo backend e não autoriza uma chamada. O valor deve ser exatamente a raiz HTTPS da API, sem `/` final.

### `MCP_REMOTE_EGRESS_ALLOWLIST`

Deve conter uma única entrada, textualmente igual a `MCP_CORPORATE_READONLY_ORIGIN`. A validação estrutural 16Y não substitui a revalidação de DNS/IP público feita pelo egress governado no instante da futura execução.

### `MCP_CORPORATE_READONLY_SECRET_REF`

Deve ser a referência lógica `env://ORCHESTRA_STATUS_READONLY_TOKEN`. O preflight valida somente o formato e a igualdade com essa referência aprovada. Ele não procura a variável referenciada, não resolve o valor e não imprime a referência completa como evidência.

O valor real permanece no secret manager/processo seguro. Não usar valor bruto, prefixo de autenticação, header, dump de environment ou argumento de linha de comando. Em fase posterior à publicação, antes de abrir qualquer gate, o operador deverá confirmar que a referência cadastrada no server e o resolver server-side usam o mesmo namespace lógico aprovado.

## Readiness estrutural sem chamada real

Executar no repositório:

```bash
scripts/readiness-https-tool-status-16y.sh --dry-run
scripts/smoke-readiness-https-tool-status-16y.sh --dry-run
```

Na sessão segura da janela, com as sete variáveis já materializadas sem arquivo:

```bash
scripts/readiness-https-tool-status-16y.sh --local-check
```

O `--dry-run` lê somente arquivos versionados. O `--local-check` lê somente as sete variáveis allowlistadas, compara estrutura/igualdade e não mostra seus valores. Nenhum modo carrega `.env`, escreve arquivo, executa `curl`, resolve DNS, conecta a banco, inicia container, chama provider ou executa MCP.

Resultado verde significa apenas `structuralReadiness=true` e `realExecution=false`. Não significa `tlsVerified`, `endpointAvailable`, `secretResolved` ou `toolExecuted`.

## Readiness manual opcional com HTTPS

Para imprimir o roteiro sem executá-lo:

```bash
scripts/readiness-https-tool-status-16y.sh --https-template
```

O output contém somente:

```bash
curl -i https://api.orchestra.mcm.eng.br/v1/status
curl -i https://api.orchestra.mcm.eng.br/v1/status/availability
```

Esses comandos são orientativos. Só podem ser copiados e executados manualmente fora do CI, após a publicação autorizada e com o usuário avisado. Não usar `curl -v`, header de autenticação, dump de resposta em arquivo ou retry. Esses GETs testam os endpoints passivos; não executam a tool e não contam como chamada MCP real. A 16Z apenas os mantém como template.

## Evidências esperadas

Na 16Y:

- dry-run e smoke verdes;
- `realExecution=false`;
- origem, allowlist e contrato validados estaticamente;
- local-check verde sem valores no output;
- defaults versionados fechados e origens vazias;
- nenhum acesso de rede, provider, banco, Docker ou MCP;
- Prisma schema/migrations inalterados;
- templates HTTPS e SQL revisados, mas não executados.

Na 16Z, as evidências permanecem estáticas: documentação, artefatos produtivos presentes, defaults fail-closed e regressões offline. Evidências reais de DNS/TLS e readiness pertencem à publicação manual posterior; `runId`, `externalMcpCalled=true` e `simulated=false` pertencem somente a outra fase, depois que a API estiver publicada e validada.

## SQL/audit template seguro

Gerar sem conectar ao banco:

```bash
scripts/readiness-https-tool-status-16y.sh --audit-template
```

O template projeta exatamente doze campos técnicos allowlistados, exige um `run_id` e usa `LIMIT 1`. Ele exclui prompt, contexto, args, output, body, headers, referência lógica, valor de credencial e metadata completa. Na 16Y ele não deve ser executado, pois ainda não existe run real a correlacionar.

## Rollback

Como a 16Y não abre conexão nem altera aplicação:

1. encerrar a sessão operacional;
2. remover as sete variáveis do processo;
3. confirmar flags remotas/corporativas fechadas;
4. manter allowlists vazias nos defaults;
5. reverter somente runbook, scripts, step de CI e referências documentais 16Y;
6. executar novamente os smokes 16S–16X.

Não há migration, dado, server MCP, binding, Assistant, credencial ou recurso externo criado pela fase. Se qualquer segredo tiver sido exposto por operação manual fora do roteiro, interromper, revogar/rotacionar e tratar como incidente.

## Critérios de aceite

- runbook, readiness e smoke 16Y existem; scripts são executáveis;
- todos os cinco modos obrigatórios funcionam e nenhum aceita URL/path arbitrário;
- dry-run, template HTTPS e audit template não chamam rede;
- local-check exige a origem API exata, igualdade textual das allowlists e referência lógica;
- origem rejeita HTTP, path, query, fragment, credenciais, loopback, private e metadata;
- paths continuam `/health`, `/v1/status` e `/v1/status/availability`, com GET-only;
- contrato continua `status`, `summary`, `updatedAt`;
- CI executa somente `smoke-readiness-https-tool-status-16y.sh --dry-run`;
- env examples e Compose permanecem fail-closed, sem endpoint operacional ou segredo;
- regressões 16S–16X permanecem verdes;
- Prisma schema/migrations permanecem inalterados;
- a 16Y não executa chamada real, não testa UI/CRUD MCP e não associa MCP a Assistant;
- o usuário será avisado antes do teste direto, em fase posterior à publicação; a 16Z não realiza esse teste.

## Riscos remanescentes

- DNS, certificado, cadeia TLS, ingress, WAF e disponibilidade não foram testados;
- a origem prevista pode ainda não estar publicada ou pode resolver para IP bloqueado;
- o template HTTPS não prova execução via gateway, catálogo, policy, binding ou AgentRun;
- a referência lógica não foi resolvida e sua compatibilidade com o server/resolver deve ser confirmada somente em fase posterior autorizada;
- identidade read-only, rotação e revogação dependem do ambiente;
- audit/Analytics ponta a ponta ainda não foram comprovados;
- UI/CRUD MCP, server MCP e associação com Assistant continuam sem teste;
- erro operacional ainda pode materializar flags ou valores fora da sessão segura.

## Atualização 16Z — preparação da publicação HTTPS

A 16Z prepara a publicação HTTPS, mas não publica e não executa chamada real. O ambiente ainda é local; as URLs planejadas do frontend e da API não estão ativas. MCP real, UI/CRUD MCP, associação a Assistant e teste visual permanecem fora de escopo. A primeira execução real da tool só poderá ser planejada depois que a API HTTPS estiver publicada e validada.

## Próximo passo sugerido

Executar uma fase posterior de publicação manual e homologação HTTPS para validar DNS, TLS, proxy, CORS/cookies e os endpoints passivos. Somente depois, com o usuário avisado e uma janela autorizada, considerar outra fase para a primeira execução supervisionada de `corporate.status.read`.
