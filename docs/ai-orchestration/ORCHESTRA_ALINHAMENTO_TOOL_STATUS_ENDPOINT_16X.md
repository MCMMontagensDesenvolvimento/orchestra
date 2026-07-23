# Orchestra — Alinhamento da tool com o endpoint de status 16X

## Objetivo

A Fase 16X alinha o adapter governado de `corporate.status.read`, criado na 16T, ao contrato público estrito dos endpoints da 16V. O resultado é readiness de contrato para uma execução futura em origem HTTPS aprovada, sem realizar chamada real nesta fase.

O adapter passa a normalizar toda resposta aceita para:

```json
{
  "status": "ok",
  "summary": "Orchestra operational",
  "updatedAt": "2026-07-23T12:00:00.000Z"
}
```

`status` aceita somente `ok` ou `degraded`. Qualquer outro valor falha fechado. `summary` é normalizado em espaços e deve ter de 1 a 240 caracteres; não há truncamento silencioso. `updatedAt` deve ser um timestamp ISO válido e é devolvido em formato UTC canônico.

## Escopo

- alinhar schema, mapper e testes do transport corporativo;
- manter a única tool `corporate.status.read`;
- manter `scope=summary|availability`;
- manter somente `GET /health`, `GET /v1/status` e `GET /v1/status/availability`;
- validar estritamente os payloads 16V;
- normalizar o `/health` legado somente para readiness;
- descartar `service` e `requestId` do contrato comum;
- preparar validação offline e readiness para origem HTTPS aprovada;
- preservar todos os controles de egress, limites e observabilidade das fases anteriores.

## Fora de escopo

- executar a tool, discovery remoto, readiness remoto ou qualquer chamada live;
- liberar HTTP local, loopback, rede privada ou endpoint de metadata;
- configurar ou versionar origem real, bearer, token, secret ou valor de credencial;
- aceitar URL, path, método, header ou body fornecido pelo input da tool;
- habilitar MCP remoto ou o adapter corporativo por default;
- associar MCP a Assistant;
- testar UI, CRUD visual MCP ou fluxo visual MCP/Assistant;
- alterar Prisma schema, migrations, frontend, provider, RAG ou Knowledge.

O teste visual será feito com participação explícita do usuário em fase posterior. A 16X é exclusivamente contrato, segurança e validação offline.

## Contrato comum da tool

O output público de `corporate.status.read` tem exatamente os campos:

| Campo | Regra |
|---|---|
| `status` | enum estrito `ok|degraded` |
| `summary` | texto não vazio, sanitizado, no máximo 240 caracteres |
| `updatedAt` | timestamp ISO válido, normalizado para UTC |

Campos adicionais não são copiados. Nos endpoints 16V, campos adicionais tornam o payload incompatível e causam falha fechada. HTML e campos ou textos com indícios de header, bearer, cookie, token, secret, credential, prompt, context, args, output, body, conexão ou chave privada são rejeitados antes do mapper.

## Diferença entre `/health` e os endpoints 16V

O `/health` legado do Orchestra responde:

```json
{
  "status": "ok",
  "service": "orchestra-backend",
  "timestamp": "2026-07-23T12:00:00.000Z",
  "requestId": "req_example"
}
```

Já `/v1/status` e `/v1/status/availability` respondem exatamente `status`, `summary` e `updatedAt`.

A decisão 16X é preferir os dois endpoints 16V como alvos da execução da tool. `scope=summary` seleciona `/v1/status`; `scope=availability` seleciona `/v1/status/availability`. `/health` continua reservado ao check de readiness do transport e não é selecionável pelo input.

## Normalização de `/health`

O mapper de readiness exige o contrato legado exato, confirma `service=orchestra-backend`, valida `requestId` como texto limitado e produz internamente:

```json
{
  "status": "ok",
  "summary": "Orchestra health endpoint operational",
  "updatedAt": "2026-07-23T12:00:00.000Z"
}
```

`updatedAt` recebe o valor validado de `timestamp`. `summary` é fixo. `service` e `requestId` nunca são propagados para output, metadata, audit ou Analytics.

## Validação estrita de `/v1/status` e `/v1/status/availability`

Ambos os paths exigem exatamente:

- `status` igual a `ok` ou `degraded`;
- `summary` textual, não vazio, sanitizado e com até 240 caracteres;
- `updatedAt` textual e parseável como timestamp ISO;
- nenhuma propriedade adicional.

Status inesperado, campo obrigatório ausente, timestamp inválido, summary inválido, campo adicional ou marcador sensível produzem `MCP_REMOTE_TRANSPORT_FAILED` sanitizado. O payload remoto não é incluído no erro.

## Segurança e fail-closed

Continuam obrigatórios:

- flags remotas e corporativas desabilitadas por default;
- origem HTTPS exata, sem path, query, fragment ou credenciais;
- correspondência simultânea com a allowlist global;
- DNS/IP público; loopback, private, link-local e metadata bloqueados;
- autenticação bearer obtida somente por `secretRef` lógico server-side;
- timeout e limites de request/response;
- leitura limitada do body e `application/json`;
- redirect manual e bloqueio de qualquer resposta 3xx;
- GET-only e três paths compilados;
- tool única, low risk e read-only;
- ausência de prompt, context, args, output, body, headers, secrets e payload bruto em metadata, audit e Analytics.

Ausência de configuração, divergência de contrato ou falha de segurança não ativa fallback permissivo.

## Relação com 16T, 16U, 16V e 16W

- a 16T criou o boundary, a tool fixa, a origem HTTPS exata, `secretRef`, GET-only, limites e sanitização;
- a 16U definiu homologação supervisionada, approval, evidências allowlistadas e rollback;
- a 16V criou os endpoints passivos seguros e o contrato estrito comum;
- a 16W adotou a Opção C e manteve a chamada bloqueada por HTTP local e incompatibilidade de contrato;
- a 16X resolve somente a incompatibilidade de contrato, preservando a Opção C para transporte e execução.

A 16X não transforma a preparação 16W em evidência de chamada. `realExecution=false`.

## Como validar sem execução real

Execute:

```bash
npm --prefix backend run typecheck
npm --prefix backend test -- tests/unit/corporate-readonly-transport.test.ts --run
scripts/smoke-alinhamento-tool-status-16x.sh --dry-run
```

O teste unitário usa `fetch` injetado e respostas sintéticas. O smoke lê arquivos versionados e chama somente regressões offline/dry-run. Nenhum dos dois resolve DNS, lê o valor do secret, inicia serviço, acessa banco, chama provider ou executa MCP real.

## Readiness para origem HTTPS aprovada

O código fica compatível com o payload da 16V, mas uma execução futura ainda exige:

1. origem HTTPS única e aprovada fora do Git;
2. TLS, DNS e IPs públicos revisados;
3. allowlist global exatamente igual à origem corporativa;
4. identidade exclusivamente read-only resolvida por `secretRef`;
5. flags, server, tool, policy, binding e Assistant revisados;
6. janela 16U aberta, operador e supervisor presentes;
7. readiness pelo `/health` legado alinhado;
8. uma única execução manual, sem retry automático;
9. evidências e rollback prontos antes de abrir os gates.

Esses itens não são executados nem comprovados pela 16X.

## Critérios de aceite

- output schema contém somente `status`, `summary`, `updatedAt`;
- status aceita somente `ok|degraded`;
- payloads estritos de ambos os endpoints 16V são aceitos;
- `/health` legado é normalizado e não propaga `service` ou `requestId`;
- campos obrigatórios ausentes, status inesperado e campos sensíveis falham fechado;
- paths, GET-only, HTTPS, exact-origin, SSRF, redirect, timeout e bytes permanecem protegidos;
- `secretRef` continua lógico e seu valor não aparece em resultados;
- env examples e Compose continuam fail-closed e sem origem real;
- CI executa o smoke 16X somente em `--dry-run`;
- regressões 16S–16W permanecem verdes;
- Prisma schema e migrations permanecem inalterados;
- nenhuma chamada real e nenhum teste visual são realizados.

## Rollback

Reverter o mapper/schema e os testes/documentos 16X ao estado da 16W. Não é necessário migration, seed, limpeza de banco, revogação de endpoint ou remoção de recurso externo, pois a fase não cria nem chama recursos reais. Após rollback, manter todas as flags fechadas e não tentar execução contra a 16V enquanto os contratos voltarem a divergir.

## Riscos remanescentes

- ingress/TLS/DNS e disponibilidade da origem futura não foram validados;
- secret manager, identidade e rotação continuam dependentes do ambiente;
- catálogo, policy, binding, Assistant e runtime de homologação ainda exigem revisão operacional;
- readiness degradado é contrato válido, mas precisa de decisão operacional na janela;
- audit/Analytics e correlação ponta a ponta ainda não foram comprovados em chamada real;
- uma resposta futura pode mudar e será corretamente bloqueada até novo alinhamento;
- UI/CRUD MCP e associação a Assistant continuam sem validação visual.

## Próximo passo sugerido

A 16Y implementa o passo seguinte: fixa a topologia HTTPS prevista, valida origem/allowlists e fornece templates offline. A 16Y não executa chamada real e não testa UI/CRUD MCP. A primeira execução real supervisionada fica para a 16Z, com autorização e aviso explícito ao usuário; associação MCP–Assistant e teste visual continuam bloqueados.

Consulte `ORCHESTRA_READINESS_HTTPS_TOOL_STATUS_16Y.md`.
