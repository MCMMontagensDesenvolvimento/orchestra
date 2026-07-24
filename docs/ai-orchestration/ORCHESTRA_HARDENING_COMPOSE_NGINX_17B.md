# Orchestra — Hardening offline de Compose, imagens e Nginx (Fase 17B)

## Objetivo

A Fase 17B endurece, de forma exclusivamente estática e offline, os artefatos que poderão
ser usados em uma publicação HTTPS futura do Orchestra. O foco é tornar construção,
execução, isolamento, readiness, persistência e operação de migration mais previsíveis,
sem transformar o plano das fases anteriores em uma implantação real.

A 17B não executa deploy.
A 17B não publica URLs.
A 17B não executa MCP real.
A 17B não testa UI/CRUD MCP.

As URLs `https://orchestra.mcm.eng.br` e `https://api.orchestra.mcm.eng.br` permanecem planejadas e inativas. Elas aparecem neste documento apenas para registrar o alvo
homologado; não foram inseridas em env examples, Compose, Dockerfiles, Nginx, CI ou
código funcional.

## Escopo

Esta fase cobre:

- revisão e hardening de `docker-compose.prod.yml`;
- revisão e hardening de `backend/Dockerfile.prod`;
- revisão e hardening de `frontend/Dockerfile.prod`;
- revisão e hardening de `frontend/nginx.conf`;
- ajuste mínimo dos exemplos de ambiente para defaults locais/fail-closed;
- criação de preflight e smoke estáticos da 17B;
- inclusão exclusiva do smoke 17B em modo `--dry-run` no CI;
- documentação do contrato operacional, riscos e rollback.

Todo o trabalho é sobre arquivos locais versionáveis. Nenhum ambiente externo é
descoberto, consultado ou alterado.

## Fora de escopo

Continuam fora de escopo:

- deploy, publicação, provisionamento ou atualização de infraestrutura;
- consulta DNS, emissão/validação live de certificado ou chamada HTTP live;
- `docker compose up`, `run`, `build`, `pull`, `exec` ou qualquer container real;
- migration real, seed, restore ou alteração de banco;
- descoberta, cadastro, associação ou execução MCP real;
- teste visual, teste de tela, CRUD MCP ou criação de servidor MCP pela UI;
- Chat/AgentRun com tool real;
- provider OpenAI, Azure OpenAI, Anthropic ou outro provider externo;
- alteração do runtime Chat, RAG, Knowledge, LLM ou fluxo funcional de autenticação;
- alteração de Prisma schema ou migrations;
- materialização de endpoint operacional, token, bearer, API key ou secret.

## Estado atual local

O Orchestra continua totalmente local na máquina do usuário. A base da 17B é a `main`
em `c55ed9e`, após a Fase 17A. Não existe evidência nesta fase de que os domínios
planejados resolvam, que TLS esteja ativo, que imagens tenham sido publicadas ou que
um host de produção esteja disponível.

Os testes desta fase inspecionam texto, permissões locais, estado do Git e regressões
offline. Um `PASS` da 17B significa que os artefatos versionados cumprem o contrato
estático; não significa que uma implantação tenha ocorrido ou que produção esteja
pronta sem a revisão operacional da 17A.

## Relação com 16Z e 17A

A 16Z preparou a publicação HTTPS em estado offline e fail-closed. A 17A registrou o
plano operacional Local→HTTPS, com pré-requisitos, decisão go/no-go, evidências e
rollback, mas não executou esse plano.

A 17B aprofunda a preparação dos artefatos que o plano poderá consumir:

1. 16Z: fronteira de preparação HTTPS, sem publicação;
2. 17A: plano homologado de mudança, sem deploy;
3. 17B: hardening estático de Compose, imagens e Nginx, sem containers;
4. etapa futura: janela aprovada para validar configuração, publicar e observar.

A primeira execução real da tool depende de publicação HTTPS futura, concluída e
validada, seguida das autorizações específicas previstas na 17A.

## Artefatos revisados

| Artefato | Resultado da 17B |
|---|---|
| `docker-compose.prod.yml` | redes explícitas, porta mínima, runtime read-only, capabilities reduzidas, defaults fail-closed e migration isolada |
| `backend/Dockerfile.prod` | estágios de deps/build/runtime/operations, runtime com install production-only, Prisma no build e usuário não-root |
| `frontend/Dockerfile.prod` | build multi-stage, configuração Nginx completa, porta não privilegiada e usuário `nginx` |
| `frontend/nginx.conf` | SPA fallback, headers, gzip, cache, tokens ocultos e forwarded proto preservado |
| `.env.example` | placeholders locais para bind/porta e imagem operacional |
| `backend/.env.example` | providers externos desligados por padrão |
| scripts 17B | verificações somente leitura, sem rede ou execução operacional |
| CI | uma única chamada ao smoke 17B com `--dry-run` |

## Hardening do Docker Compose de produção

O Compose de produção passou a declarar explicitamente:

- `frontend`, `backend`, `db`, `agno-bridge` opt-in e `migrate` opt-in;
- somente uma porta publicada, a do frontend;
- bind padrão do frontend em `127.0.0.1`, alterável apenas pelo ambiente de implantação;
- porta interna não privilegiada `8080` para o Nginx;
- backend e banco expostos apenas dentro das redes Compose;
- `app_net` para frontend/backend/bridge e `data_net` interna para backend/banco/migration;
- volume nomeado `db_data` com driver local;
- `depends_on` condicionado a health nos caminhos que exigem readiness;
- `restart: unless-stopped` nos serviços persistentes e `restart: "no"` na operação
  one-shot;
- `read_only`, `tmpfs`, `cap_drop: ALL` e `no-new-privileges` onde são compatíveis;
- `init: true` e períodos explícitos de encerramento;
- targets de build distintos para runtime do backend e operação de migration.

Os arquivos `.env` de cada subprojeto deixaram de ser importados implicitamente pelo
Compose de produção. Isso reduz a possibilidade de um valor local ou opt-in escapar
para uma execução futura. O conjunto efetivo passa a ser explícito no bloco
`environment` e na interpolação do ambiente aprovado.

O frontend mantém `VITE_API_BASE_URL=/api/v1` como default relativo e local ao conjunto
Compose. Nenhum domínio planejado foi embutido. Se a topologia futura separar o
frontend e a API por subdomínio, o valor público deverá ser injetado no build aprovado
fora do Git e a política CORS/cookies deverá ser validada na janela da 17A.

## Hardening do backend/Dockerfile.prod

O Dockerfile do backend agora contém:

- estágio base com somente certificados e OpenSSL necessários ao runtime/Prisma;
- estágio `deps` com `npm ci` orientado pelo lockfile;
- estágio `build` que copia apenas configuração TypeScript, Prisma e `src`;
- `prisma generate` antes do build TypeScript;
- estágio `production-deps` com `npm ci --omit=dev` a partir do lockfile;
- estágio final `runner` sem código-fonte, testes ou toolchain TypeScript;
- artefatos gerados do Prisma copiados explicitamente do estágio de build;
- `NODE_ENV=production`, `PORT=3000`, `EXPOSE 3000` e healthcheck de `/health/db`;
- cópias com ownership do usuário `node` e execução não-root;
- estágio `operations` separado, necessário para disponibilizar a CLI do Prisma sem
  ampliar a imagem do serviço web.

Nenhum `ARG`, `ENV`, arquivo `.env` ou valor secreto foi adicionado à imagem. Secrets
só podem ser entregues em runtime por mecanismo externo aprovado.

## Hardening do frontend/Dockerfile.prod

O frontend continua multi-stage:

- Node executa `npm ci` e `npm run build`;
- somente argumentos públicos `VITE_*` já previstos entram no build;
- Nginx recebe apenas o `dist` e a configuração revisada;
- o arquivo é instalado como configuração Nginx completa, não como fragmento ambíguo;
- os arquivos estáticos pertencem ao usuário `nginx`;
- o processo final executa como usuário `nginx`;
- a porta interna passou de `80` para `8080`, sem capability de bind privilegiado;
- o healthcheck usa `127.0.0.1:8080/health`.

Não há endpoint real, token ou secret no build. Variáveis `VITE_*` são públicas por
natureza e não devem ser usadas para credenciais.

## Hardening do frontend/nginx.conf

A configuração completa do Nginx define:

- `server_tokens off`;
- pid e diretórios temporários sob `/tmp`, compatíveis com container read-only e
  usuário não-root;
- logs em stdout/stderr;
- SPA fallback `try_files $uri $uri/ /index.html`;
- health endpoints sem cache;
- cache prolongado para assets versionados sob `/assets/`;
- respostas gerais sem cache prolongado, protegendo `index.html` contra versão antiga;
- gzip limitado a tipos textuais/estruturados adequados;
- headers `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e
  `Permissions-Policy`;
- timeouts explícitos de proxy;
- remoção dos headers upstream `Server` e `X-Powered-By`;
- preservação controlada de `Host`, cadeia `X-Forwarded-For`, forwarded host e
  protocolo HTTP/HTTPS informado pelo terminador anterior.

O proxy relativo `/api/` foi preservado para o Compose autocontido e não aponta para
nenhum endpoint externo. HSTS e a política TLS pertencem ao terminador HTTPS futuro;
ativá-los no HTTP interno seria incorreto antes da topologia real existir.

## Variáveis obrigatórias de produção

O Compose interrompe a interpolação se estes valores não forem entregues:

| Variável | Regra |
|---|---|
| `DATABASE_URL` | obrigatória, secreta, fora do Git |
| `JWT_SECRET` | obrigatória, forte, rotacionável e fora do Git |
| `FRONTEND_ORIGIN` | obrigatória, definida pelo ambiente aprovado |
| `POSTGRES_PASSWORD` | obrigatória quando o banco Compose for usado, fora do Git |

Variáveis operacionais opcionais e não secretas incluem:

- `ORCHESTRA_FRONTEND_BIND_ADDRESS`, cujo default local é `127.0.0.1`;
- `ORCHESTRA_FRONTEND_PORT`, cujo default local é `5173`;
- referências de imagem de frontend, backend, migration e bridge;
- `COOKIE_SAME_SITE` e `LOG_LEVEL`, sujeitos à revisão de segurança;
- seleção do runtime local/bridge, sem liberar tools ou provider externo.

`COOKIE_SECURE` é fixado em `true` pelo Compose de produção e não pode ser rebaixado
por env file. Os env examples continuam locais e não constituem configuração pronta de
produção.

## Fail-closed de MCP, corporate e providers

No Compose, ficam fixados em estado fechado:

- fallback de provider e tools externas do runtime;
- Agno externo, health externo, remote MCP e tool gateway;
- MCP remote, discovery, execution, read-only e write tools;
- allowlist MCP e origin corporate vazias;
- adaptador corporate read-only;
- execução LLM geral;
- OpenAI, Azure OpenAI e Anthropic;
- embeddings e execução de embeddings.

No `backend/.env.example`, os gates de providers externos também ficam `false`. O
provider default permanece `local_deterministic`, mas até a execução geral LLM está
desligada no exemplo. Alterar um único campo não basta para abrir provider ou tool:
uma fase futura precisa revisar todos os gates, credenciais, allowlists e evidências.

## Segurança de secrets

Nenhum secret real foi lido, impresso ou adicionado. Os scripts procuram padrões
aparentes de API keys, access keys, private keys e bearer tokens nos artefatos da 17B.

Regras permanentes:

- não colocar credenciais em `ARG`/`ENV` de Dockerfile;
- não versionar `.env` operacional;
- não colar a saída de Compose renderizado se ela contiver valores resolvidos;
- usar secret manager e referências/digests aprovados;
- sanitizar evidências e logs;
- rotacionar imediatamente qualquer valor exposto por engano.

## Healthchecks e readiness

O frontend verifica `GET /health` no Nginx da própria imagem. O backend verifica
`GET /health/db`, que inclui acesso ao banco e funciona como readiness para dependentes.
O PostgreSQL usa `pg_isready`. O bridge opt-in mantém seu script local
`healthcheck.py`.

`frontend` aguarda backend healthy; `backend` e `migrate` aguardam banco healthy. O
serviço `migrate` não foi adicionado como dependência automática do backend: migration
é uma decisão operacional separada e explícita, não efeito colateral do startup.

Healthcheck estático não substitui a validação live futura de TLS, proxy, CORS,
cookies, SSO, banco, status funcional e observabilidade.

## Rede, portas e exposição mínima

Somente o frontend declara `ports`. Backend (`3000`), PostgreSQL (`5432`) e bridge
(`8091`) permanecem internos.

`data_net` é `internal: true`, impedindo o banco e o job de migration de usarem essa
rede como saída externa. O backend também participa de `app_net`, necessária para o
proxy interno e para integrações futuras explicitamente aprovadas. O bind loopback do
frontend pressupõe um terminador/reverse proxy no mesmo host; outra topologia deverá
definir conscientemente o bind no ambiente, sem alterar o default versionado.

## Volumes e persistência

`db_data` é o único volume nomeado persistente nesta composição e monta o diretório de
dados do PostgreSQL. Frontend, backend, bridge e migration não recebem bind mounts de
código ou `.env`.

Volume nomeado não é backup. Antes de qualquer migration real, a 17A continua exigindo
backup identificado, teste de restore e decisão de compatibilidade/rollback do banco.

## Profile de migrations e operations

`migrate` pertence exclusivamente ao profile `operations`, usa target/imagem própria e
tem `restart: "no"`. Nada no Compose padrão executa migration automaticamente.

O target `operations` contém a CLI Prisma e suas dependências de build, necessárias ao
comando `prisma migrate deploy`; por isso possui superfície maior que o `runner`. Ele
não publica porta, acessa somente `data_net`, roda como `node`, usa filesystem
read-only/tmpfs e deve existir apenas durante a operação aprovada.

O comando futuro mostrado pelo modo `--template` é texto instrucional. A 17B não o
executou.

## Rollback

Rollback desta fase, antes de qualquer deploy, é somente rollback de código:

1. revisar o diff dos artefatos 17B;
2. reverter de forma controlada os arquivos desta fase;
3. executar novamente os gates offline 16Z, 17A e 17B;
4. não apagar nem sobrescrever arquivos locais não relacionados.

Em uma publicação futura, rollback deve usar digests anteriores aprovados de frontend,
backend e imagem operacional, revalidar Compose, preservar evidência e respeitar a
compatibilidade das migrations. Rollback de aplicação não desfaz automaticamente
alteração de banco.

## Riscos remanescentes

- imagens base estão identificadas por tag, não por digest imutável;
- não houve build real para comprovar packages nativos, ownership e healthcheck;
- não houve renderização `docker compose config`, pois os valores obrigatórios incluem
  material secreto e a fase evita resolver ou imprimir esse conteúdo;
- a topologia exata do terminador TLS/reverse proxy ainda não existe;
- CSP não foi imposta para evitar quebrar recursos/UI sem teste visual; deverá ser
  projetada e homologada separadamente;
- HSTS depende do terminador HTTPS futuro;
- bind, firewall, certificados, DNS, backup, restore, observabilidade e capacidade
  dependem do ambiente real;
- a imagem `operations` é deliberadamente maior por conter a CLI Prisma;
- nenhuma conclusão live sobre SSO, CORS, cookies ou tool pode ser extraída daqui.

## Validação offline

Os gates da 17B validam:

- existência e contrato deste runbook;
- modos obrigatórios do preflight;
- ausência de comandos executáveis de rede, Docker Compose, deploy e migration;
- Compose, Dockerfiles e Nginx por padrões estáticos;
- defaults locais e fail-closed nos env examples;
- ausência dos domínios planejados em configuração executável e código funcional;
- ausência de credencial aparente;
- CI com uma única chamada 17B em `--dry-run`;
- Prisma schema/migrations e fontes funcionais sem alteração;
- regressão 17A e, transitivamente, 16Z a 16S.

Comandos de validação desta fase são locais e somente leitura. O modo `--template`
apenas imprime exemplos para uma janela futura; ele não executa os exemplos exibidos.

## Atualização 17C — inventário offline de secrets e variáveis

A 17C complementa este hardening com um inventário governado e machine-readable das
configurações futuras. Nenhum valor real foi coletado e nenhum `.env` real foi criado.
Não houve deploy, chamada externa, MCP real ou teste UI/CRUD MCP.

Os env examples e o Compose continuam locais/fail-closed. As URLs permanecem
planejadas/inativas e nenhum endpoint ou secret foi materializado em env examples,
Compose ou CI. A primeira execução real da tool continua dependente de publicação
HTTPS futura; o usuário será avisado antes do teste direto. Consulte
`ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md`.

## Próximo passo sugerido

Após revisão e integração da 17B, manter o sistema local e fail-closed. O próximo passo
operacional continua sendo uma publicação HTTPS futura em janela aprovada pela 17A,
com secrets externos, digests imutáveis, backup/restore comprovados e validações live
deliberadas.

Somente depois dessa publicação e de health/readiness HTTPS aprovados poderá ser
proposta uma fase específica para a primeira execução real da tool. UI/CRUD MCP
continua fora de escopo até autorização própria.
