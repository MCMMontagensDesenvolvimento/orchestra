# Orchestra — Inventário governado de secrets e variáveis (Fase 17C)

## Objetivo

A Fase 17C cria o inventário governado, offline e sem valores reais das configurações
necessárias para uma futura homologação e publicação HTTPS do Orchestra. O inventário
define classificação, ambiente, obrigatoriedade, owner, origem esperada, criticidade,
risco de exposição, rotação, validação e evidência sanitizada.

A 17C não cria `.env` real.
A 17C não coleta valor real.
A 17C não imprime segredo.
A 17C não executa deploy.
A 17C não executa MCP real.
A 17C não testa UI/CRUD MCP.

## Escopo

Esta fase cobre:

- core do backend, CORS, cookies e logs;
- variáveis públicas do frontend;
- PostgreSQL, conexão, backup/restore e rotação;
- Microsoft SSO;
- providers LLM e embeddings;
- Agno e runtime bridge;
- MCP remoto, corporate read-only e referência lógica de credencial;
- referências operacionais de imagens, mudança, backup e rollback;
- inventário JSON sem valores e preflight/smoke somente leitura;
- atualização documental e um único gate 17C em `--dry-run` no CI.

## Fora de escopo

Continuam fora de escopo:

- criar ou preencher `.env`, secret store, cofre, app registration ou credencial;
- deploy, publicação, DNS, TLS, `curl`, container, Docker Compose ou migration live;
- chamar OpenAI, Azure OpenAI, Anthropic ou qualquer provider externo;
- descobrir, cadastrar, associar ou executar MCP real;
- criar servidor MCP pela tela, testar UI/CRUD MCP ou executar Chat/AgentRun com tool;
- materializar endpoint operacional em env examples, Compose, CI ou código funcional;
- alterar Prisma schema/migrations, runtime Chat, RAG, Knowledge, providers ou auth;
- build ou teste visual do frontend.

## Estado atual local

O Orchestra continua totalmente local na máquina do usuário. A base desta fase é a
`main` em `b42fbda`, após a 17B. Não há evidência 17C de publicação, DNS, TLS, secret
manager, banco de produção, app registration de produção ou imagens publicadas.

As URLs `https://orchestra.mcm.eng.br` e `https://api.orchestra.mcm.eng.br` são
planejadas, inativas e documentação somente. Elas não são valores de runtime neste
inventário e continuam ausentes de env examples, Compose, CI e código funcional.

## Relação com 16Z, 17A e 17B

1. a 16Z preparou a publicação HTTPS offline e fail-closed;
2. a 17A registrou o plano operacional Local → HTTPS, sem executá-lo;
3. a 17B endureceu Compose, imagens e Nginx, sem subir containers;
4. a 17C governa os nomes, owners, origens e ciclos de vida das configurações;
5. uma fase futura ainda deverá provisionar valores fora do Git e executar a janela.

A primeira execução real da tool depende de publicação HTTPS futura, validada e
explicitamente autorizada. O usuário será avisado quando chegar o teste direto na tela;
até lá, UI/CRUD MCP continua fora de escopo.

## Princípios de secret management

- valor real nasce e permanece em secret manager aprovado, nunca no Git;
- configuração pública não transporta secret, token, senha, bearer ou credencial;
- referência lógica identifica uma entrada; não substitui nem revela seu valor;
- acesso usa menor privilégio, segregação por ambiente e identidade de workload;
- logs, traces, screenshots, tickets e evidências não contêm valores nem dumps de env;
- secrets são injetados em runtime, não em build args, imagem ou artefato frontend;
- rotação tem owner, periodicidade, revogação e teste de recuperação;
- flags independentes continuam fechadas até aprovação específica;
- ausência, placeholder ou referência não resolvida deve falhar com segurança;
- a configuração efetiva futura será revisada sem imprimir conteúdo sensível.

## Matriz de classificação

| Classe | `secret` | Exposição cliente | Criticidade típica | Risco de exposição | Origem esperada |
|---|---:|---:|---|---|---|
| secret de autenticação | sim | proibida | crítica | acesso indevido/impersonação | secret manager |
| secret de dados | sim | proibida | crítica | leitura/escrita ou perda de dados | secret manager/DBA |
| configuração privada | não | proibida | alta | topologia, tenant ou egress expostos | configuração de runtime |
| configuração pública | não | permitida | média | abuso de contrato ou ambiente incorreto | build/config pública aprovada |
| gate fail-closed | não | proibida | alta | execução externa não autorizada | configuração de runtime |
| referência operacional | não | proibida | alta | rollback ou rastreabilidade incorretos | change/release system |
| referência lógica de secret | não | proibida | alta | resolução da entrada errada | catálogo/secret manager |

Os campos `required` do JSON representam obrigatoriedade incondicional no ambiente
indicado. Uma variável condicional usa `required=false` e a condição é registrada em
`notes`; ao habilitar a capacidade, seu conjunto condicional passa a ser obrigatório.

## Inventário core backend

| Nome | Obrigatoriedade futura | Privacidade | Owner | Origem/validação offline |
|---|---|---|---|---|
| `NODE_ENV` | produção | privada | Plataforma | valor permitido, sem execução |
| `PORT` | opcional/default interno | privada | Plataforma | inteiro e porta não privilegiada |
| `DATABASE_URL` | homolog/produção | secret | DBA | apenas presença externa; nunca imprimir |
| `JWT_SECRET` | homolog/produção | secret | Segurança | referência presente, política de força e rotação |
| `FRONTEND_ORIGIN` | homolog/produção | privada | Plataforma | uma origin HTTPS exata na execução futura |
| `COOKIE_SECURE` | produção | privada | Segurança | deve permanecer `true` no Compose produtivo |
| `COOKIE_SAME_SITE` | produção | privada | Segurança | enum revisado com a topologia SSO |
| `LOG_LEVEL` | opcional | privada | SRE | nível aprovado sem payload bruto |

`FRONTEND_ORIGIN` é a fonte efetiva da política CORS do backend; não existe uma segunda
variável de CORS a ser preenchida. `DEV_LOGIN_ENABLED` deve permanecer `false` fora do
desenvolvimento local. Cookie name/TTL e bcrypt são configurações não secretas, mas
mudanças exigem revisão de Segurança e Aplicação.

## Inventário frontend

`VITE_API_BASE_URL`, `VITE_APP_NAME`, `VITE_APP_ENV`, flags de mock/demo e preferências
públicas são incorporadas ao bundle. Toda variável `VITE_*` é observável pelo cliente.

Regra absoluta: variável pública não pode conter segredo. Nenhuma API key, client
secret, senha, token, bearer, connection string privada ou referência resolvível deve
usar prefixo `VITE_`.

Na topologia Compose atual, `VITE_API_BASE_URL` usa caminho relativo. Uma URL futura,
se necessária, será injetada no build aprovado fora do Git; as URLs planejadas não
foram adicionadas aos examples.

## Inventário banco/Postgres

| Nome/controle | Política |
|---|---|
| `POSTGRES_DB` | identificador não secreto, aprovado pelo DBA |
| `POSTGRES_USER` | identidade de workload, não humana, menor privilégio |
| `POSTGRES_PASSWORD` | secret crítico, runtime-only, rotacionado pelo DBA |
| `DATABASE_URL` | secret composto; não registrar nem usar como evidência |
| backup id | referência sanitizada e imutável, sem caminho/credencial |
| restore test id | evidência de restore isolado anterior à janela |

Estratégia futura: backup consistente identificado antes de migration, retenção e
criptografia aprovadas, teste de restore em ambiente isolado, RPO/RTO registrados e
rollback de aplicação separado de rollback de banco. O DBA é owner de
`POSTGRES_PASSWORD`, `DATABASE_URL`, backup e restore; Plataforma coordena injeção e
o Release Manager registra change/rollback.

## Inventário Microsoft SSO

`MICROSOFT_SSO_ENABLED` permanece `false` até homologação. Quando habilitado, tornam-se
condicionalmente obrigatórios `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`,
`MICROSOFT_TENANT_ID`, `MICROSOFT_REDIRECT_URI` e
`MICROSOFT_POST_LOGOUT_REDIRECT_URI`.

`MICROSOFT_ALLOWED_DOMAINS` e `MICROSOFT_ALLOWED_TENANT_IDS` devem ser allowlists
explícitas, revisadas por IAM; não são mecanismos substitutos de validação do tenant.
`MICROSOFT_SSO_AUTO_LINK_BY_EMAIL` permanece `false` até análise de account takeover.

IAM/Identity é owner do app registration, consentimentos, client secret/certificado,
redirect URIs, tenant e revogação. Segurança aprova escopos e rotação; Plataforma
injeta a configuração. O client secret nunca é evidência e nunca vai para frontend.

## Inventário LLM/providers

Os gates gerais `LLM_PROVIDERS_ENABLED` e `LLM_EXECUTION_ENABLED` ficam `false`. Para
cada provider, os gates de enable e execution também ficam `false`; configurar key,
endpoint, deployment ou model não autoriza execução.

| Provider | Configuração condicional | Secret |
|---|---|---|
| OpenAI | `OPENAI_ENABLED`, `OPENAI_EXECUTION_ENABLED`, model/base URL | `OPENAI_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_ENABLED`, `AZURE_OPENAI_EXECUTION_ENABLED`, endpoint/deployment/version | `AZURE_OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_ENABLED`, `ANTHROPIC_EXECUTION_ENABLED`, model/base URL | `ANTHROPIC_API_KEY` |
| Embeddings | `EMBEDDINGS_ENABLED`, `EMBEDDINGS_EXECUTION_ENABLED`, provider/model/dimension | key do provider selecionado |

Todos permanecem fail-closed até fase explicitamente aprovada. AI Platform é owner da
seleção/modelo e FinOps/Segurança aprovam quota, retenção, DPA, região e observabilidade.
Secrets são rotacionados por AI Platform/Segurança e revogados imediatamente em caso
de exposição.

## Inventário Agno/runtime bridge

O caminho externo depende de gates independentes: `AGNO_ENABLED`,
`AGNO_EXECUTION_ENABLED`, `AGNO_RUNTIME_HTTP_ENABLED`,
`RUNTIME_ALLOW_EXTERNAL_TOOLS`, `AGNO_RUNTIME_HTTP_TOOLS_ENABLED` e
`AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED`. O default seguro mantém execução/tools
desligados e `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0`.

O canal autenticado usa `AGNO_RUNTIME_HTTP_SECURITY_KEY`, secret runtime-only,
separado por ambiente. O bridge também declara mode/provider/model allowlist,
host/port, RAG context, gateway URL, provider keys/endpoints e telemetry. O inventário
JSON cobre todas as variáveis atuais de `runtime/agno-bridge/.env.example`.

Habilitar bridge, provider, RAG ou tools são decisões distintas. Nenhuma combinação foi
executada na 17C.

## Inventário MCP/Tools

Permanecem fechados:

- `MCP_REMOTE_ENABLED=false`;
- `MCP_REMOTE_EXECUTION_ENABLED=false`;
- `MCP_REMOTE_DISCOVERY_ENABLED=false`;
- `MCP_REMOTE_READONLY_ENABLED=false`;
- `MCP_REMOTE_EGRESS_ALLOWLIST` vazio;
- `MCP_REMOTE_ALLOW_WRITE_TOOLS=false`;
- `MCP_CORPORATE_READONLY_ENABLED=false`;
- `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN` vazio;
- `RUNTIME_ALLOW_EXTERNAL_TOOLS=false`;
- gates de tools do bridge desligados e máximo de chamadas igual a zero.

`MCP_CORPORATE_READONLY_SECRET_REF` é uma referência lógica futura, não o secret. O
formato documentado usa namespace lógico controlado, como
`env://ORCHESTRA_CORPORATE_READONLY_<PURPOSE>`, sem resolver ou armazenar o valor.
Endpoint, origin e referência efetivos continuam fora dos examples e do Compose.

Publicação HTTPS é pré-requisito técnico, não autorização de MCP. Discovery, cadastro,
associação a Assistant, UI/CRUD e chamada real continuam proibidos nesta fase.

## Inventário operações/deploy

Antes de uma janela futura, devem existir fora do Git:

- referências/digests imutáveis das imagens de frontend, backend, migration e bridge;
- `backupId` e `restoreTestId` sanitizados, com owner DBA;
- `changeId`, janela, aprovadores e Release Manager;
- release anterior e marcador de rollback compatível;
- owner de deploy, banco, IAM, Segurança, SRE e AI Platform;
- confirmação de que o profile `operations` é one-shot;
- registro de que provider/MCP/tools continuam fechados.

Esses identificadores são metadados operacionais, não credenciais. Não devem carregar
URL assinada, caminho sensível, token, senha ou conteúdo de backup.

## Variáveis públicas vs privadas

| Regra | Pública | Privada |
|---|---|---|
| destino | bundle/browser | processo/secret manager |
| prefixo típico | `VITE_*` | sem prefixo público |
| pode conter secret | nunca | somente via injeção runtime |
| evidência | nome e valor não sensível aprovado | nome, estado e hash/ref sanitizada |
| exemplos | app name, locale, API path relativo | DB URL, tenant, origins, gates, keys |

`publicClientExposed=true` no JSON só é válido quando `secret=false`.

## Secrets obrigatórios por ambiente

| Ambiente | Secrets incondicionais/condicionais |
|---|---|
| local | somente placeholders locais já existentes; nenhum valor é coletado pela 17C |
| homolog | `DATABASE_URL`, `JWT_SECRET`, `POSTGRES_PASSWORD`; SSO/provider/bridge somente se a capacidade for homologada |
| production | `DATABASE_URL`, `JWT_SECRET`, `POSTGRES_PASSWORD`; SSO/provider/bridge somente após go/no-go específico |

O banco pode ser externo e não usar `POSTGRES_PASSWORD` no mesmo workload; nesse caso,
DBA documenta o mecanismo equivalente. API keys e client secrets são obrigatórios
somente quando seus gates são deliberadamente habilitados.

## Variáveis opcionais por ambiente

- local: nomes de app, locale/timezone, delays de mock e defaults sanitizados;
- homolog: log level, limites/timeouts, model allowlists e identificadores operacionais;
- production: portas/binds internos, timeouts/limites, telemetry aprovada e referências
  de imagens;
- todos: gates externos permanecem opcionais e fechados por padrão.

Opcional não significa livre de revisão: origins, allowlists, modelos e limites afetam
segurança e precisam de owner.

## Placeholders permitidos

São permitidos apenas em documentação/examples:

- vazio para secret ou endpoint ainda não provisionado;
- `<SECRET_MANAGER_REFERENCE>`, `<LOGICAL_SECRET_REF>`, `<IMAGE_DIGEST>`,
  `<BACKUP_ID>`, `<RESTORE_TEST_ID>`, `<CHANGE_ID>` e `<OWNER_ROLE>`;
- localhost e credenciais fictícias já restritas ao desenvolvimento local;
- `documentation-only` para URL planejada claramente inativa.

Placeholder não pode se parecer com key/token real, conter hostname operacional
materializado, userinfo, bearer, senha, JWT ou conteúdo codificado de credencial.

## Variáveis proibidas em Git

É proibido versionar valores de:

- `DATABASE_URL`, `POSTGRES_PASSWORD`, `JWT_SECRET`;
- `MICROSOFT_CLIENT_SECRET`;
- `OPENAI_API_KEY`, `AZURE_OPENAI_API_KEY`, `ANTHROPIC_API_KEY`;
- `AGNO_API_KEY`, `AGNO_RUNTIME_HTTP_SECURITY_KEY`;
- credencial resolvida por `MCP_CORPORATE_READONLY_SECRET_REF`;
- cookies, bearer/authorization headers, private keys e tokens;
- endpoints/origins operacionais reais que a política mantém fora dos examples;
- dump de `.env`, Compose renderizado com secrets ou saída de secret manager.

## Rotação

| Classe | Cadência máxima sugerida | Evento antecipado | Owner |
|---|---|---|---|
| JWT/runtime channel | 90 dias | exposição, mudança de equipe ou incidente | Segurança/Plataforma |
| DB credential | 90 dias | exposição, mudança de workload ou DBA | DBA |
| SSO client secret | conforme IAM, no máximo 180 dias | app/owner/escopo alterado | IAM |
| provider API key | 90 dias ou regra mais restritiva | gasto anômalo/incidente | AI Platform |
| MCP credential | 90 dias | mudança de origem/tool/identidade | Segurança/Integrações |

Rotação futura usa sobreposição controlada quando suportada, validação passiva,
revogação do valor anterior e evidência somente de identificador/horário/resultado.

## Revogação

Em suspeita de exposição:

1. desabilitar gates relacionados;
2. revogar o valor no sistema de origem;
3. invalidar sessões/identidades conforme a classe;
4. preservar evidência sanitizada e abrir incidente;
5. criar novo valor fora do Git e validar menor privilégio;
6. remover artefato exposto do canal de distribuição apropriado;
7. não considerar apenas a remoção do Git como revogação.

## Evidência sanitizada

Evidência permitida:

- nome da variável, ambiente, owner e status `present|missing|not-applicable`;
- ID interno sanitizado da rotação/change/backup/restore;
- timestamp, resultado do gate e digest de imagem;
- flags efetivas sem secret e contagens agregadas;
- confirmação de que o secret foi resolvido, sem referência detalhada ou valor.

Evidência proibida: valor, prefixo/sufixo da credencial, tamanho distintivo, hash não
aprovado, dump de env, request headers, URL com userinfo/query, payload MCP/provider,
cookie, screenshot de cofre ou Compose resolvido.

## Checklist antes do deploy

- [ ] inventário 17C revisado por owners;
- [ ] secret manager e identidades de workload aprovados;
- [ ] nenhum valor em Git, imagem, build arg, CI output ou ticket;
- [ ] DB backup/restore, digests, change e rollback identificados;
- [ ] SSO/CORS/cookies revisados para a topologia real;
- [ ] env/Compose efetivos revisados sem impressão de secrets;
- [ ] provider/MCP/Agno/tools permanecem fail-closed;
- [ ] 17A/17B/17C e regressões offline verdes;
- [ ] URLs ainda tratadas como planejadas até a execução autorizada.

## Checklist antes de habilitar provider externo

- [ ] aprovação de AI Platform, Segurança, Privacidade e FinOps;
- [ ] contrato/região/retenção/modelo/quota revisados;
- [ ] key runtime-only, owner e rotação registrados;
- [ ] gates geral, provider e execution tratados como mudança conjunta;
- [ ] dados enviados minimizados e observabilidade sem payload bruto;
- [ ] teste explicitamente autorizado, janela e rollback definidos;
- [ ] embeddings avaliados separadamente do Chat.

## Checklist antes de habilitar MCP real

- [ ] publicação HTTPS real concluída e validada;
- [ ] nova autorização explícita e usuário avisado antes do teste direto;
- [ ] origin exata, allowlist e SSRF/egress revisados;
- [ ] identidade exclusivamente read-only e referência lógica aprovada;
- [ ] write tools bloqueadas, limites e timeout revisados;
- [ ] auditoria sanitizada, incidente e rollback prontos;
- [ ] discovery/tool/Assistant aprovados sem depender de UI/CRUD não homologado;
- [ ] uma execução supervisionada, nunca disparada por CI/preflight/smoke.

## Rollback/disable flags

Primeiro contenha execução externa:

- `LLM_EXECUTION_ENABLED=false`;
- `OPENAI_EXECUTION_ENABLED=false`;
- `AZURE_OPENAI_EXECUTION_ENABLED=false`;
- `ANTHROPIC_EXECUTION_ENABLED=false`;
- `EMBEDDINGS_EXECUTION_ENABLED=false`;
- `AGNO_EXECUTION_ENABLED=false`;
- `AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false`;
- `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0`;
- `AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false`;
- `RUNTIME_ALLOW_EXTERNAL_TOOLS=false`;
- `MCP_REMOTE_EXECUTION_ENABLED=false`;
- `MCP_REMOTE_DISCOVERY_ENABLED=false`;
- `MCP_REMOTE_READONLY_ENABLED=false`;
- `MCP_CORPORATE_READONLY_ENABLED=false`.

Depois revogue a credencial afetada, restaure digests/config anterior e siga o plano de
rollback 17A. Desabilitar flags não substitui revogação.

## Riscos remanescentes

- secret manager, owners nominais e plataforma de destino ainda não foram escolhidos;
- valores, permissões, rotação e restore não foram testados;
- SSO/CORS/cookies/redirects não foram homologados em HTTPS;
- digests, backup/change IDs e rollback real ainda não existem;
- providers, embeddings, bridge e MCP não foram chamados;
- divergência futura entre inventário e configuração efetiva é possível;
- frontend público exige revisão a cada nova variável `VITE_*`;
- primeira execução da tool e teste UI/CRUD MCP ainda não ocorreram.

## Validação offline

Os scripts 17C verificam somente arquivos locais:

- contrato e JSON válido do inventário;
- campos, tipos, owners, rotação e validation mode;
- ausência de campos de valor e de credencial aparente;
- segredo nunca público e variável frontend pública nunca secreta;
- policies fail-closed/runtime-required para providers/MCP/corporate;
- env examples e Compose permanecendo locais/fail-closed;
- URLs planejadas ausentes de configuração executável e código funcional;
- CI com uma única chamada 17C em `--dry-run`;
- Prisma, migrations e fontes funcionais sem alteração;
- regressões estáticas 16S–17B.

Nenhum modo executa rede, DNS, `curl`, Docker Compose, deploy, migration, provider,
MCP, teste visual ou alteração de arquivo.

## Próximos passos sugeridos

1. revisar inventário com owners de Plataforma, Segurança, DBA, IAM e AI Platform;
2. escolher secret manager e identidades por ambiente;
3. definir owners nominais, cadências e processo de emergência fora do Git;
4. preencher change/backup/restore/digests somente no sistema operacional aprovado;
5. manter a primeira publicação com providers/MCP/tools fechados;
6. executar deploy apenas em fase futura explicitamente autorizada pela 17A;
7. após HTTPS real validado, abrir fase separada para qualquer provider ou tool real.

Até lá, o sistema permanece local, as URLs permanecem planejadas/inativas, nenhum
valor real foi coletado e `deployment=false`, `realExecution=false`.
