# Orchestra — Preparação da publicação HTTPS 16Z

## Objetivo

A Fase 16Z prepara o Orchestra para uma futura publicação HTTPS homologável. A entrega organiza a topologia alvo, os requisitos operacionais, os checklists de segurança, o preflight offline e o smoke de regressão necessários para que uma publicação manual posterior seja verificável e reversível.

A 16Z não publica nada, não executa chamada real, não executa MCP real e não comprova disponibilidade de qualquer domínio. O ambiente continua totalmente local. A primeira execução real de `corporate.status.read` somente poderá ocorrer em fase posterior, depois que a API HTTPS estiver publicada e validada. O usuário será avisado explicitamente quando chegar a etapa de teste direto no sistema.

## Escopo

- documentar frontend e backend/API como superfícies distintas;
- registrar DNS, TLS, reverse proxy, Docker Compose, environment e secrets esperados;
- documentar CORS, cookies, health/readiness, evidências e rollback;
- validar estaticamente os artefatos locais e os defaults fail-closed;
- fornecer templates de comandos manuais sem executá-los;
- adicionar ao CI somente o smoke 16Z em `--dry-run`;
- preservar as regressões 16S, 16T, 16U, 16V, 16W, 16X e 16Y.

## Fora de escopo

- deploy, publicação, provisionamento de DNS, emissão de certificado ou alteração de proxy;
- chamada a `https://orchestra.mcm.eng.br` ou `https://api.orchestra.mcm.eng.br`;
- `curl` live, `docker compose up`, migration ou deploy no CI;
- execução MCP, provider externo, OpenAI ou resolução de credencial;
- configuração de endpoint, token, API key, bearer ou secret real em arquivo versionado;
- alteração funcional de backend, frontend, runtime Chat, RAG/Knowledge ou providers;
- alteração de Prisma schema ou migrations;
- teste visual, tela MCP, UI/CRUD MCP, criação de server MCP, associação a Assistant ou teste de Chat/AgentRun com tool real.

## Contexto local atual

O repositório está na preparação posterior à Fase 16Y e continua executado apenas na máquina do usuário. Já existem:

- `docker-compose.prod.yml`;
- `backend/Dockerfile.prod`;
- `frontend/Dockerfile.prod`;
- `frontend/nginx.conf`;
- `/health`, `/v1/status` e `/v1/status/availability`;
- defaults versionados que mantêm MCP remoto e adapter corporate desligados.

Esses artefatos formam uma base estrutural. Eles não são evidência de DNS, TLS, infraestrutura, publicação ou disponibilidade externa.

## URLs planejadas

| Superfície | URL planejada | Estado na 16Z |
|---|---|---|
| Frontend | `https://orchestra.mcm.eng.br` | planejada, não publicada e não testada |
| Backend/API | `https://api.orchestra.mcm.eng.br` | planejada, não publicada e não testada |

As URLs aparecem em documentação e no template orientativo do preflight. Elas não devem ser materializadas em `.env.example`, no Compose ou em secrets versionados durante a 16Z.

## Diferença entre frontend e backend/API

O frontend entrega os arquivos estáticos da aplicação e a navegação do usuário. O backend/API executa autenticação, regras de negócio e os endpoints HTTP. O domínio do frontend não deve ser tratado como origem do backend, e o domínio da API não deve servir o bundle da aplicação por acidente.

O frontend já recebe o endereço da API por `VITE_API_BASE_URL`. Na publicação futura, a equipe deve escolher e registrar uma das topologias:

1. manter `VITE_API_BASE_URL=/api/v1` e fazer o proxy do caminho `/api` do domínio do frontend para o backend; ou
2. gerar o bundle com uma URL pública da API fornecida pelo ambiente de build/deploy.

Não deve haver endereço operacional inserido diretamente no código-fonte. A escolha precisa ser coerente com CORS, cookies e cache do bundle. O `docker-compose.prod.yml` atual usa a primeira estratégia, com `/api/v1` e proxy no Nginx do frontend.

## Topologia alvo

Fluxo planejado:

```text
Internet
  |
  +-- DNS + TLS do frontend
  |     `-- reverse proxy/ingress -> frontend:80
  |            `-- arquivos estáticos e, se mantido, /api/* -> backend:3000
  |
  `-- DNS + TLS da API
        `-- reverse proxy/ingress -> backend:3000
               +-- /health
               +-- /v1/status
               `-- /v1/status/availability

Rede privada do deployment
  +-- backend -> PostgreSQL/pgvector
  `-- agno-bridge somente se um perfil futuro for aprovado
```

Somente a borda HTTPS deve ficar pública. Banco, porta interna do backend e `agno-bridge` não devem ser expostos diretamente à Internet. O proxy deve terminar TLS ou encaminhar a uma camada de terminação aprovada e preservar corretamente os headers encaminhados.

## Checklist DNS

- [ ] confirmar owner dos dois registros e da zona `mcm.eng.br`;
- [ ] criar registros separados para frontend e API;
- [ ] apontar somente para o ingress/load balancer aprovado, nunca diretamente para banco ou porta interna;
- [ ] revisar registros A, AAAA ou CNAME e remover destinos obsoletos;
- [ ] confirmar que nenhum registro resolve para loopback, faixa privada indevida ou metadata service;
- [ ] definir TTL compatível com a primeira publicação e o rollback;
- [ ] registrar o valor anterior de cada registro fora do Git;
- [ ] validar propagação em janela manual aprovada;
- [ ] não considerar o template 16Z como prova de resolução DNS.

## Checklist TLS/certificado

- [ ] emitir certificado por ACME ou autoridade corporativa aprovada;
- [ ] cobrir os dois hostnames planejados por certificados/SANs válidos;
- [ ] manter chave privada fora do Git, imagens e logs;
- [ ] permitir somente TLS moderno e suites aprovadas;
- [ ] configurar renovação automática e alerta antes do vencimento;
- [ ] validar cadeia completa, hostname, validade e revogação;
- [ ] redirecionar HTTP para HTTPS apenas na borda;
- [ ] avaliar HSTS depois da primeira validação, com rollout conservador;
- [ ] não habilitar HSTS para a zona inteira sem revisar os demais subdomínios;
- [ ] registrar procedimento de rotação e revogação do certificado.

## Checklist reverse proxy/Nginx

- [ ] separar virtual hosts do frontend e da API;
- [ ] encaminhar o frontend para `frontend:80`;
- [ ] encaminhar a API e, se adotado, `/api/*` para `backend:3000`;
- [ ] preservar `Host`, `X-Forwarded-Host`, `X-Forwarded-For` e `X-Forwarded-Proto`;
- [ ] sobrescrever headers recebidos do cliente em vez de confiar neles;
- [ ] ocultar `X-Powered-By`, tokens de versão, stack e detalhes de upstream;
- [ ] limitar tamanho de request, timeouts e métodos conforme a aplicação;
- [ ] não fazer cache de autenticação, health dinâmico ou respostas privadas;
- [ ] manter fallback SPA somente no virtual host do frontend;
- [ ] garantir que erro do upstream use página/resposta sanitizada;
- [ ] adicionar rate limiting e observabilidade de borda sem registrar cookies ou authorization;
- [ ] manter a configuração `frontend/nginx.conf` como proxy interno, não como terminação TLS pública.

## Checklist Docker Compose produção

- [ ] usar `docker-compose.prod.yml` como estratégia declarativa, revisando overrides do ambiente;
- [ ] fornecer imagens imutáveis ou builds reproduzíveis, com tag/digest registrado;
- [ ] executar `migrate` como operação manual separada e com backup verificado;
- [ ] fornecer `DATABASE_URL`, `POSTGRES_PASSWORD` e `JWT_SECRET` pelo ambiente/secret manager;
- [ ] definir `FRONTEND_ORIGIN` correto no runtime; não aceitar o fallback local em publicação;
- [ ] manter `COOKIE_SECURE=true` em produção;
- [ ] manter `DEV_LOGIN_ENABLED=false`;
- [ ] não publicar portas de banco ou `agno-bridge`;
- [ ] manter healthchecks e política de restart;
- [ ] manter MCP remoto, corporate adapter, tools externas e providers externos fail-closed;
- [ ] revisar volume persistente, backup e restauração do PostgreSQL antes do primeiro start;
- [ ] salvar a configuração efetiva sanitizada sem valores de secrets.

O Compose atual é uma base e não executa deploy por si só. A fase de publicação poderá usar um override não versionado ou uma plataforma equivalente, desde que preserve as mesmas invariantes.

## Checklist de variáveis de ambiente

Valores operacionais devem ser injetados fora do Git. O inventário mínimo é:

| Variável/grupo | Requisito futuro |
|---|---|
| `NODE_ENV` | `production` |
| `FRONTEND_ORIGIN` | origem HTTPS exata do frontend, fornecida no runtime |
| `VITE_API_BASE_URL` | caminho relativo aprovado ou base pública da API no build |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAME_SITE` | revisar conforme a topologia escolhida |
| `DATABASE_URL` | referência/valor entregue pelo secret manager |
| `JWT_SECRET` | secret forte e exclusivo, nunca o placeholder local |
| `MICROSOFT_REDIRECT_URI` | callback HTTPS registrado manualmente no provedor SSO |
| `MICROSOFT_POST_LOGOUT_REDIRECT_URI` | redirect HTTPS do frontend |
| `MCP_REMOTE_*` | permanecer desligado/vazio na primeira publicação |
| `MCP_CORPORATE_READONLY_*` | permanecer desligado/vazio na primeira publicação |

Os `.env.example` continuam locais e seguros: `FRONTEND_ORIGIN=http://localhost:5173`, backend `PORT=3000`, `COOKIE_SECURE=false`, redirect Microsoft local e placeholder explícito de JWT. Isso não é configuração de produção. SSO produtivo exige ajuste manual futuro no portal do provedor e no ambiente de deployment.

## Checklist de secrets

- [ ] criar secrets somente no secret manager aprovado;
- [ ] gerar `JWT_SECRET` novo, forte, exclusivo e rotacionável;
- [ ] criar credenciais de banco com menor privilégio e senha exclusiva;
- [ ] separar credenciais de migration das credenciais normais quando possível;
- [ ] cadastrar credenciais Microsoft/SSO apenas após revisar os redirects HTTPS;
- [ ] não copiar secret para `.env.example`, Compose, issue, terminal compartilhado ou log;
- [ ] não enviar secrets como build args do frontend;
- [ ] documentar owner, finalidade, expiração e rotação fora do Git;
- [ ] verificar que observabilidade e dumps não exibem environment;
- [ ] manter qualquer secret MCP ausente até uma fase posterior explicitamente autorizada.

Nomes de variáveis e placeholders não são credenciais. Evidência deve comprovar apenas que o valor foi injetado e validado, nunca revelar o valor.

## Checklist de CORS/cookies

- [ ] definir `FRONTEND_ORIGIN` como uma única origem HTTPS exata;
- [ ] não usar `*` quando credentials/cookies estiverem habilitados;
- [ ] permitir somente métodos e headers usados pela aplicação;
- [ ] configurar o cliente para credentials somente se a autenticação exigir;
- [ ] manter cookie `Secure`, `HttpOnly` e com `SameSite` coerente;
- [ ] preferir cookie host-only da API; revisar `Domain` antes de qualquer compartilhamento;
- [ ] verificar login, callback e logout sem registrar tokens;
- [ ] revisar CSRF se a topologia ou política de cookie mudar;
- [ ] invalidar cache do bundle quando `VITE_API_BASE_URL` mudar;
- [ ] testar preflight CORS manualmente somente após a publicação autorizada.

Os dois subdomínios são origens diferentes, ainda que pertençam ao mesmo site registrável. Portanto, acesso direto do frontend ao domínio da API exige CORS explícito; o proxy relativo `/api` evita CORS no navegador, mas precisa manter roteamento e headers corretos.

## Checklist de health/readiness

- [ ] usar `/health` para disponibilidade superficial do processo;
- [ ] decidir separadamente se `/health/db` ficará acessível apenas internamente;
- [ ] validar `/v1/status` e `/v1/status/availability` como GET read-only;
- [ ] confirmar payload estrito `status`, `summary`, `updatedAt`;
- [ ] confirmar que respostas e erros não expõem stack, env, host interno ou secrets;
- [ ] configurar probes internos sem autenticação sensível na linha de comando;
- [ ] observar latência, status HTTP e certificado sem armazenar corpo bruto;
- [ ] não tratar health verde como prova de fluxo Chat, provider ou MCP;
- [ ] executar checks externos somente em janela manual pós-publicação.

## Checklist de MCP/corporate fail-closed

- [ ] manter `MCP_REMOTE_ENABLED=false`;
- [ ] manter `MCP_REMOTE_EXECUTION_ENABLED=false`;
- [ ] manter `MCP_REMOTE_DISCOVERY_ENABLED=false`;
- [ ] manter `MCP_REMOTE_READONLY_ENABLED=false`;
- [ ] manter `MCP_REMOTE_EGRESS_ALLOWLIST` vazio;
- [ ] manter `MCP_REMOTE_ALLOW_WRITE_TOOLS=false`;
- [ ] manter `MCP_CORPORATE_READONLY_ENABLED=false`;
- [ ] manter `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN` vazio;
- [ ] não cadastrar endpoint, server, tool, policy, binding ou Assistant pela UI;
- [ ] não resolver secretRef, não executar `corporate.status.read` e não testar AgentRun;
- [ ] tratar a publicação HTTPS da API como pré-requisito, não como autorização de MCP.

## Checklist antes do primeiro deploy

- [ ] aprovar topologia, responsáveis e janela de mudança;
- [ ] concluir DNS, certificado, proxy, firewall e secret manager;
- [ ] revisar backup e testar procedimento de restauração;
- [ ] registrar versões/digests das imagens;
- [ ] revisar a configuração efetiva sem imprimir secrets;
- [ ] executar `scripts/preflight-publicacao-https-16z.sh --dry-run`;
- [ ] executar `scripts/preflight-publicacao-https-16z.sh --check-local-config`;
- [ ] executar `scripts/smoke-publicacao-https-16z.sh --dry-run`;
- [ ] manter CI, typechecks e regressões verdes;
- [ ] confirmar que Prisma schema/migrations não mudaram nesta fase;
- [ ] confirmar plano de rollback e critério objetivo de abortar;
- [ ] não iniciar deployment como parte da 16Z.

## Checklist após deploy manual

Esta seção é um roteiro para uma fase posterior; nenhum item foi executado na 16Z.

- [ ] confirmar DNS dos dois hostnames a partir de ponto de observação aprovado;
- [ ] validar cadeia TLS, hostname e redirecionamento HTTP;
- [ ] abrir o frontend e confirmar que assets não têm mixed content;
- [ ] verificar `/health`, `/v1/status` e `/v1/status/availability`;
- [ ] validar CORS/cookies/login/logout sem expor tokens;
- [ ] confirmar que banco, backend interno e `agno-bridge` não estão diretamente expostos;
- [ ] verificar logs sanitizados e ausência de stack/env/secrets;
- [ ] confirmar que MCP/corporate permanece fail-closed;
- [ ] registrar evidências, horário, versão e responsável;
- [ ] encerrar ou fazer rollback se qualquer critério falhar.

## Comandos manuais sugeridos, mas não executados automaticamente

Os comandos abaixo são exemplos. Devem ser revisados e executados por uma pessoa somente em fase de publicação autorizada:

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml --profile operations run --rm migrate
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Checks pós-publicação planejados:

```bash
curl -i https://api.orchestra.mcm.eng.br/health
curl -i https://api.orchestra.mcm.eng.br/v1/status
curl -i https://api.orchestra.mcm.eng.br/v1/status/availability
```

Essas linhas são texto orientativo. O CI, o preflight e o smoke 16Z não as executam. Não acrescentar header de autenticação, `-v`, dump de environment ou secret na linha de comando.

## Evidências esperadas

- aprovação e janela registradas fora do Git;
- resolução DNS e cadeia TLS dos dois hostnames;
- versão/digest de frontend e backend;
- configuração do proxy revisada e sanitizada;
- resultado HTTP e contrato dos três endpoints, sem conteúdo proibido;
- confirmação de CORS/cookies e redirects SSO;
- health dos containers e banco sem dump de configuração;
- confirmação explícita de MCP remoto/corporate disabled;
- logs sem stack, env, token, cookie, authorization ou payload bruto;
- resultado e horário do rollback drill.

Na 16Z, as únicas evidências válidas são estáticas e locais: arquivos presentes, contratos documentados, defaults fechados, regressões offline e `realExecution=false`.

## Rollback

Para a 16Z, rollback significa reverter apenas o runbook, os dois scripts, o step de CI e as referências documentais. Não há infraestrutura a desfazer.

Para a publicação manual futura:

1. interromper o rollout e retirar tráfego da versão nova;
2. restaurar o digest anterior de frontend/backend;
3. restaurar a configuração anterior do proxy;
4. reverter DNS apenas se necessário e respeitar o TTL;
5. nunca fazer downgrade destrutivo de banco sem plano específico;
6. manter MCP/corporate e providers externos desligados;
7. revogar/rotacionar secrets possivelmente expostos;
8. preservar logs técnicos sanitizados e registrar o incidente;
9. validar novamente frontend, health e status na versão anterior.

## Riscos remanescentes

- DNS, certificado e infraestrutura ainda não existem ou não foram verificados;
- o Compose local não substitui orquestração, backup, firewall e secret manager produtivos;
- a escolha entre proxy relativo e API cross-origin ainda deve ser fechada pela operação;
- CORS, cookies e redirects SSO ainda não foram testados em HTTPS;
- health não cobre todos os SLOs e dependências externas;
- observabilidade, rate limiting, WAF e alertas de certificado exigem configuração operacional;
- uma publicação futura pode divergir dos templates versionados;
- nenhuma execução ponta a ponta da tool ocorreu;
- UI/CRUD MCP, associação MCP–Assistant e teste visual continuam fora de escopo.

## Relação com 16T, 16U, 16V, 16W, 16X e 16Y

- 16T criou o boundary corporativo read-only e os defaults fail-closed;
- 16U definiu aprovação, janela supervisionada, evidência e rollback;
- 16V criou os endpoints locais read-only seguros;
- 16W preparou o harness da primeira execução, mas adotou a Opção C e não chamou a tool;
- 16X alinhou `corporate.status.read` ao contrato `status`, `summary`, `updatedAt`;
- 16Y verificou estruturalmente a readiness HTTPS, ainda sem rede;
- 16Z prepara a publicação HTTPS e mantém `realExecution=false`.

A 16Z não substitui a autorização 16U e não promove os templates 16Y a checks live. Ela adiciona os pré-requisitos operacionais que precisam existir antes de qualquer teste real.

## Atualização 17A — plano operacional homologado

A 17A transforma esta preparação em um plano operacional Local → HTTPS com papéis, matriz de pré-requisitos, go/no-go, janela, checklists antes/durante/depois, evidências e rollback. Ela continua sendo somente planejamento: o deploy real ainda não ocorreu, o ambiente permanece local e as URLs planejadas continuam inativas.

O preflight e o smoke 17A são offline/somente-leitura, e o CI executa apenas o smoke em `--dry-run`. A 17A não chama DNS, TLS, endpoint, container, migration, MCP ou provider; UI/CRUD MCP permanece fora de escopo. A primeira execução da tool continua bloqueada até uma fase posterior à publicação e validação da API HTTPS, com aviso ao usuário.

## Próximo passo sugerido

Usar o plano homologado 17A para preparar responsáveis, autorização, infraestrutura, secrets, backup/restore, observabilidade e rollback de uma fase específica de publicação manual. Primeiro devem ser validados frontend, API, DNS, TLS, proxy, CORS/cookies e os endpoints passivos. Somente depois dessa API publicada e validada poderá ser planejada outra fase para a primeira execução real e supervisionada de `corporate.status.read`.

Antes de qualquer teste direto no sistema, o usuário será avisado e deverá autorizar a janela. Até lá, MCP remoto/corporate permanece fail-closed, `realExecution=false` e UI/CRUD MCP continua fora de escopo.
