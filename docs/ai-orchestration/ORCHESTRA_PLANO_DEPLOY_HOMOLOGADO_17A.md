# Orchestra — Plano de deploy homologado Local → HTTPS 17A

## Objetivo

A Fase 17A transforma a preparação offline da 16Z em um plano operacional homologável para uma futura implantação controlada do Orchestra, do ambiente local para HTTPS. O plano organiza pré-requisitos, decisões, responsáveis, janela, execução manual proposta, evidências, critérios de interrupção e rollback.

**A 17A é plano, não deploy.** Nenhuma infraestrutura foi criada ou alterada, nenhum container foi iniciado, nenhum DNS ou certificado foi consultado, nenhuma migration foi executada e nenhuma chamada HTTP, MCP ou provider ocorreu nesta fase. O ambiente continua totalmente local.

## Escopo

- definir a topologia alvo e os papéis da mudança;
- consolidar matrizes de pré-requisitos e decisão go/no-go;
- planejar as etapas antes, durante e depois da implantação;
- detalhar infraestrutura, DNS, TLS, proxy, Compose, banco, secrets e variáveis;
- detalhar SSO Microsoft, CORS/cookies, health/readiness, observabilidade e segurança;
- estabelecer evidências mínimas, comunicação, rollback e pós-rollback;
- fornecer comandos manuais propostos somente como texto;
- criar preflight e smoke 17A offline, somente-leitura e fail-closed;
- adicionar ao CI apenas o smoke 17A em `--dry-run`;
- preservar backend, frontend, Prisma e as regressões 16S–16Z.

## Fora de escopo

- executar deploy, provisionamento, promoção, rollback real ou alteração de infraestrutura;
- consultar ou alterar DNS, certificado, ingress, proxy, firewall ou secret manager;
- executar `curl`, request HTTP, `docker compose up`, container, build, pull ou push;
- executar migration, backup, restore ou qualquer operação de banco;
- chamar OpenAI, provider externo, MCP real ou a tool `corporate.status.read`;
- configurar endpoint operacional, bearer, token, API key ou secret em arquivo versionado;
- alterar backend funcional, frontend funcional, Prisma schema ou migrations;
- testar UI/CRUD MCP, criar servidor MCP pela tela ou associar MCP a Assistant;
- testar Chat/AgentRun com tool real ou realizar teste visual;
- considerar os templates deste documento como autorização de mudança.

## Estado atual local

O Orchestra permanece integralmente local na máquina do usuário, na base da Fase 16Z. O repositório contém `docker-compose.prod.yml`, Dockerfiles de produção, configuração interna de Nginx, healthchecks e os endpoints read-only, mas esses artefatos são somente uma base versionada.

Não existe evidência nesta fase de host produtivo, registry, DNS, TLS, ingress, secret manager, backup externo, observabilidade externa ou disponibilidade pública. O CI continua sendo validação de código e gates estáticos; ele não é pipeline de entrega.

## URLs planejadas

| Superfície | URL planejada | Estado na 17A |
|---|---|---|
| Frontend | `https://orchestra.mcm.eng.br` | planejada, não ativa, não consultada e não publicada |
| Backend/API | `https://api.orchestra.mcm.eng.br` | planejada, não ativa, não consultada e não publicada |

As URLs podem aparecer em documentação e nos templates textuais dos scripts 16Y, 16Z e 17A. Elas não devem ser materializadas em `.env.example`, no Compose, em código funcional ou em secrets versionados.

## Topologia alvo

```text
Usuário
  |
  +-- HTTPS frontend: orchestra.mcm.eng.br
  |     `-- DNS -> borda aprovada -> TLS/reverse proxy -> frontend:80
  |            `-- SPA e, se mantida a estratégia relativa, /api/* -> backend:3000
  |
  `-- HTTPS API: api.orchestra.mcm.eng.br
        `-- DNS -> borda aprovada -> TLS/reverse proxy -> backend:3000
               +-- /health
               +-- /v1/status
               `-- /v1/status/availability

Rede privada da implantação
  +-- backend -> PostgreSQL/pgvector persistente
  +-- serviço/job de migration acionado manualmente
  `-- agno-bridge somente em perfil futuro explicitamente aprovado
```

Somente a borda HTTPS fica pública. PostgreSQL, backend interno, volume, job de migration e `agno-bridge` não recebem exposição direta. A decisão entre proxy relativo `/api/v1` e acesso cross-origin à API deve ser fechada antes da janela e não pode mudar durante o rollout.

## Papéis e responsabilidades

Uma pessoa pode acumular papéis, mas cada papel precisa ter nome e aceite registrados fora do Git antes da janela.

| Papel | Responsabilidade | Autoriza/decide | Evidência esperada |
|---|---|---|---|
| Change owner | coordenar plano, horário, gates e comunicação | início, pausa e encerramento | registro da mudança |
| Responsável de aplicação | validar artefatos, env, health e contrato | aceite técnico da aplicação | versão/digest e checks |
| Responsável de infraestrutura | preparar host, rede, proxy e capacidade | readiness da infraestrutura | inventário sanitizado |
| Responsável DNS/TLS | operar zona, certificados e renovação | corte de DNS/TLS | registros e cadeia válidos |
| DBA/owner do banco | executar backup, migration e restore | go/no-go de dados | backup e restore drill |
| Segurança/identidade | revisar secrets, SSO, CORS e exposição | aceite de segurança | checklist aprovado |
| Observabilidade/on-call | acompanhar métricas, logs e alertas | sinalizar rollback | dashboard/eventos |
| Aprovador de negócio | aceitar janela e impacto | go/no-go final | autorização registrada |
| Comunicador | avisar início, status, falha e término | mensagens da janela | timeline de comunicação |

Ninguém deve aprovar a própria exceção crítica sem revisão independente. Ausência de owner para banco, rollback, DNS/TLS ou segurança resulta em no-go.

## Pré-requisitos

### Matriz de pré-requisitos

| Área | Pré-requisito | Critério verificável | Responsável | Bloqueia go-live |
|---|---|---|---|---|
| Mudança | ticket, escopo, janela e aprovadores definidos | registro aprovado | Change owner | sim |
| Artefatos | imagens/builds reproduzíveis e imutáveis | tag e digest registrados | Aplicação | sim |
| Infraestrutura | host/cluster, capacidade, firewall e storage prontos | checklist e inventário sanitizado | Infraestrutura | sim |
| DNS | owner, registros propostos, TTL e valores anteriores | plano de alteração e reversão | DNS/TLS | sim |
| TLS | certificado válido para os dois hostnames | cadeia, validade e renovação planejadas | DNS/TLS | sim |
| Proxy | virtual hosts, headers, limites e upstreams revisados | config revisada por pares | Infraestrutura | sim |
| Banco | compatibilidade pgvector, espaço e conectividade privada | preflight do DBA | DBA | sim |
| Backup | backup íntegro e restore ensaiado | ID/checksum e resultado do drill | DBA | sim |
| Secrets | valores criados e entregues fora do Git | referências e owners, sem valores | Segurança | sim |
| SSO | redirects HTTPS e tenant aprovados | configuração preparada no IdP | Identidade | sim, se login Microsoft for obrigatório |
| CORS/cookies | origem, estratégia de API e atributos fechados | decisão documentada | Aplicação/Segurança | sim |
| Observabilidade | logs, métricas, alertas e on-call prontos | acesso validado e alertas testados | Observabilidade | sim |
| Rollback | versão anterior, config e procedimento disponíveis | dry-run documental aprovado | Change owner | sim |
| CI | gates locais e CI verdes | execução associada ao commit | Aplicação | sim |
| MCP | todos os controles remotos/corporativos fechados | config efetiva sanitizada | Segurança | sim |

Um item obrigatório sem evidência equivale a falha, não a “pendente aceitável”.

## Matriz go/no-go

| Item de decisão | GO somente se | NO-GO quando | Evidência | Dono da decisão |
|---|---|---|---|---|
| Autorizações | todos os aprovadores confirmaram | aprovação ausente/expirada | ticket/timeline | Change owner |
| CI e versão | commit, tag/digest e gates verdes | versão ambígua ou gate vermelho | CI + manifest | Aplicação |
| Infraestrutura | capacidade, rede e storage prontos | acesso ou capacidade incertos | checklist | Infraestrutura |
| DNS/TLS/proxy | plano aprovado e rollback conhecido | certificado/proxy não validável | configs sanitizadas | DNS/TLS |
| Banco | backup verificado e restore praticável | backup ausente, inconsistente ou incompatibilidade | relatório DBA | DBA |
| Secrets | referências injetáveis e rotação definida | secret em Git/log ou valor ausente | inventário sem valores | Segurança |
| SSO/CORS/cookies | topologia e redirects coerentes | origem/redirect/cookie indefinido | checklist | Identidade/Segurança |
| Observabilidade | dashboards, logs e on-call disponíveis | sem detecção ou sem operador | painel/teste de alerta | Observabilidade |
| Rollback | versão anterior e sequência executável | rollback depende de improviso | plano assinado | Change owner |
| MCP/corporate | flags e allowlists continuam fechadas | qualquer abertura não autorizada | config sanitizada | Segurança |

**Decisão padrão: NO-GO.** O status muda para GO apenas quando todos os itens bloqueadores estiverem aprovados e anexados à mudança. Durante a janela, qualquer perda de evidência, exposição de secret, erro de migration, falha de health, regressão de login ou desvio do escopo retorna a decisão para NO-GO/rollback.

## Plano de comunicação e janela

### Antes da janela

- registrar data, início, fim, fuso `America/Sao_Paulo`, impacto e contatos;
- avisar usuários afetados, suporte, on-call, segurança, infraestrutura e DBA;
- informar que a mudança publica aplicação/API, mas não habilita MCP nem provider externo;
- confirmar canal de coordenação e canal alternativo;
- publicar critérios objetivos de sucesso, pausa, abortar e rollback;
- congelar mudanças concorrentes no escopo;
- obter confirmação nominal dos responsáveis.

### Durante a janela

- o change owner anuncia início e registra timestamp;
- cada gate recebe status `pending`, `pass`, `fail` ou `not-applicable` com justificativa;
- comunicar conclusão de backup, migration, rollout, DNS/TLS e validação;
- nunca copiar secret, cookie, authorization, dump de env ou body sensível no canal;
- em falha bloqueadora, anunciar pausa e decisão de rollback;
- limitar execução aos comandos revisados no ticket.

### Depois da janela

- anunciar sucesso ou rollback, versão final e impacto observado;
- registrar checks pós-deploy, alertas, exceções e riscos aceitos;
- manter monitoramento reforçado pelo período aprovado;
- agendar revisão pós-mudança e ações pendentes;
- avisar separadamente o usuário antes de qualquer futuro teste direto de MCP/tool.

### Sequência planejada da janela

| Marco | Ação futura | Gate de saída |
|---|---|---|
| T-60 | confirmar pessoas, freezes, backup target e dashboards | todos presentes |
| T-45 | capturar baseline sanitizada e versão anterior | rollback reproduzível |
| T-30 | executar backup e validação definida pelo DBA | backup aprovado |
| T-15 | decisão formal go/no-go | todos os bloqueadores `pass` |
| T+00 | iniciar mudança manual aprovada | comando e operador registrados |
| T+10 | executar migration somente se aplicável/aprovada | exit code e schema esperados |
| T+20 | iniciar/atualizar serviços | containers/processos healthy |
| T+30 | aplicar/validar proxy, TLS e DNS conforme plano | borda consistente |
| T+40 | executar checks passivos e SSO/CORS/cookies | critérios funcionais aprovados |
| T+50 | observar logs/métricas/alertas | sem sinal de rollback |
| T+60 | encerrar ou estender monitoramento | decisão registrada |

Os tempos são referências, não autorização. Se a janela real não comportar backup, validação e rollback, a decisão é no-go.

## Checklist antes do deploy

- [ ] escopo 17A revisado: publicação de aplicação/API, sem habilitar MCP/provider;
- [ ] change owner, operadores, aprovadores, DBA, segurança e on-call confirmados;
- [ ] commit, tag e digests imutáveis registrados;
- [ ] CI verde no mesmo commit;
- [ ] `scripts/preflight-plano-deploy-17a.sh --dry-run` aprovado;
- [ ] `scripts/preflight-plano-deploy-17a.sh --check-local-readiness` aprovado;
- [ ] `scripts/smoke-plano-deploy-17a.sh --dry-run` aprovado;
- [ ] infraestrutura, capacidade, storage, firewall e acessos aprovados;
- [ ] DNS/TLS/proxy revisados com estado anterior capturado;
- [ ] secret manager e identidades disponíveis, sem valores no ticket/log;
- [ ] banco compatível, backup concluído e restore ensaiado;
- [ ] plano de migration revisado e explicitamente autorizado;
- [ ] SSO Microsoft, CORS e cookies revisados;
- [ ] dashboards, logs, alertas e contatos de escalonamento acessíveis;
- [ ] versão anterior e configuração de rollback disponíveis;
- [ ] MCP remoto/corporate, tools e providers externos confirmados fail-closed;
- [ ] decisão go/no-go assinada antes do primeiro comando de mudança.

## Checklist durante o deploy

Esta é uma sequência futura, manual e supervisionada. Nenhum item foi executado na 17A.

- [ ] anunciar início, operador, versão e horário;
- [ ] validar configuração efetiva de Compose sem imprimir secrets;
- [ ] confirmar backup aprovado imediatamente antes de operação de dados;
- [ ] executar migration apenas pelo operador autorizado e somente uma vez;
- [ ] interromper em erro, timeout, migration parcial ou divergência de versão;
- [ ] iniciar/atualizar somente os serviços aprovados;
- [ ] verificar health interno antes de liberar tráfego;
- [ ] aplicar proxy/TLS/DNS na ordem registrada no plano do ambiente;
- [ ] não abrir banco, bridge ou backend interno diretamente à Internet;
- [ ] manter MCP, corporate adapter, tools e providers desligados;
- [ ] capturar somente evidências sanitizadas;
- [ ] registrar cada desvio e obter nova aprovação antes de continuar;
- [ ] iniciar rollback ao atingir qualquer critério objetivo de abortar.

## Checklist após deploy

- [ ] confirmar resolução DNS dos dois hostnames por ponto aprovado;
- [ ] validar certificado, cadeia, hostname, validade e redirect HTTP→HTTPS;
- [ ] validar frontend, assets e ausência de mixed content;
- [ ] validar `/health`, `/v1/status` e `/v1/status/availability`;
- [ ] confirmar payload e erros sanitizados;
- [ ] validar login/logout e SSO Microsoft sem registrar tokens;
- [ ] validar CORS e cookies na topologia escolhida;
- [ ] confirmar banco, portas internas e perfis opcionais não expostos;
- [ ] confirmar logs, métricas, traces e alertas sem dados sensíveis;
- [ ] confirmar `MCP_REMOTE_*` e `MCP_CORPORATE_READONLY_*` fail-closed;
- [ ] comparar taxa de erro, latência e uso de recursos com baseline;
- [ ] registrar versão, horários, operadores e resultado;
- [ ] manter monitoramento reforçado e encerrar a janela formalmente.

## Checklist de infraestrutura

- [ ] owner e região/localidade do ambiente definidos;
- [ ] capacidade de CPU, memória, disco, IOPS e conexões dimensionada;
- [ ] rede privada entre backend e banco;
- [ ] somente portas 80/443 públicas na borda aprovada;
- [ ] firewall/security groups com menor exposição;
- [ ] volume persistente, criptografia, retenção e monitoramento de espaço;
- [ ] sincronização de horário e timezone operacional definidos;
- [ ] registry e política de imagens/digests aprovados;
- [ ] usuário de execução sem privilégio excessivo;
- [ ] reinício, draining e dependências de boot documentados;
- [ ] acesso break-glass controlado e auditável;
- [ ] ambientes e recursos nomeados sem colisão com desenvolvimento.

## Checklist DNS

- [ ] owner da zona `mcm.eng.br` confirmado;
- [ ] registros separados para frontend e API aprovados;
- [ ] destino é apenas a borda/ingress aprovado;
- [ ] valores atuais e propostos registrados fora do Git;
- [ ] TTL compatível com a janela e com rollback;
- [ ] registros A/AAAA/CNAME conflitantes revisados;
- [ ] nenhuma resolução aponta para loopback, private indevido ou metadata;
- [ ] propagação será verificada manualmente somente durante a fase autorizada;
- [ ] reversão considera cache e TTL;
- [ ] a documentação 17A não é evidência de DNS ativo.

## Checklist TLS/certificado

- [ ] certificados cobrem exatamente os dois hostnames;
- [ ] cadeia completa, SAN, emissor, validade e revogação revisados;
- [ ] chave privada mantida fora do Git, imagem, ticket e logs;
- [ ] protocolos e suites seguem política corporativa;
- [ ] renovação automática e alerta de expiração configurados;
- [ ] HTTP redireciona para HTTPS na borda;
- [ ] HSTS só será habilitado após validação conservadora;
- [ ] OCSP/revogação tratados conforme a plataforma;
- [ ] rotação e recuperação de chave documentadas;
- [ ] TLS interno avaliado conforme o modelo de ameaça.

## Checklist reverse proxy/Nginx

- [ ] virtual hosts distintos para frontend e API;
- [ ] frontend encaminhado para `frontend:80`;
- [ ] API encaminhada para `backend:3000`;
- [ ] estratégia de `/api/v1` relativa ou cross-origin definida antes do build;
- [ ] `Host`, `X-Forwarded-Host`, `X-Forwarded-For` e `X-Forwarded-Proto` controlados;
- [ ] headers fornecidos pelo cliente são sobrescritos na borda;
- [ ] limites de body, timeout, métodos e rate limit definidos;
- [ ] respostas privadas, auth e health dinâmico não recebem cache indevido;
- [ ] fallback SPA restrito ao frontend;
- [ ] `X-Powered-By`, versões, stack e upstreams ocultados;
- [ ] logs não gravam authorization, cookies, tokens ou query sensível;
- [ ] `frontend/nginx.conf` tratado como proxy interno, não como TLS público.

## Checklist Docker Compose produção

- [ ] `docker-compose.prod.yml` e overrides do ambiente revisados;
- [ ] configuração efetiva validada sem expor secrets;
- [ ] imagens fixadas por tag/digest aprovado;
- [ ] `DATABASE_URL`, `POSTGRES_PASSWORD` e `JWT_SECRET` injetados externamente;
- [ ] `FRONTEND_ORIGIN` produtivo fornecido; fallback local não aceito;
- [ ] `COOKIE_SECURE=true` e `DEV_LOGIN_ENABLED=false`;
- [ ] banco usa PostgreSQL 16 com pgvector compatível;
- [ ] volume persistente e política de backup aprovados;
- [ ] `migrate` executado como operação separada, nunca automaticamente no CI;
- [ ] healthchecks, restart e dependências revisados;
- [ ] banco, backend interno e bridge não publicados diretamente;
- [ ] perfil `agno` permanece desligado salvo autorização futura específica;
- [ ] MCP, tools e providers externos permanecem fail-closed;
- [ ] não executar `docker compose live` como parte dos scripts 17A.

## Checklist banco, backup e restore

- [ ] versão do PostgreSQL/pgvector compatível com schema e imagens;
- [ ] owner, privilégios e credenciais de app/migration separados quando possível;
- [ ] `DATABASE_URL` entregue fora do Git;
- [ ] capacidade, conexões, locks e duração estimada de migration revisados;
- [ ] backup consistente concluído antes da mudança;
- [ ] destino, retenção, criptografia, checksum e ID do backup registrados;
- [ ] restore ensaiado em ambiente isolado e resultado aprovado;
- [ ] RPO/RTO e tempo de rollback compatíveis com a janela;
- [ ] migration forward revisada; downgrade destrutivo não presumido;
- [ ] operação interrompe em erro ou divergência de schema;
- [ ] métricas de conexão, lock, latência e espaço acompanhadas;
- [ ] pós-rollback preserva dados e exige decisão específica para restauração.

Rollback de aplicação não implica automaticamente rollback de schema. Qualquer restore real exige aprovação do DBA, avaliação de perda de dados e incidente/change record próprio.

## Checklist secrets

- [ ] `JWT_SECRET` forte, exclusivo, rotacionável e fora do Git;
- [ ] `DATABASE_URL` e senha do PostgreSQL fora do Git;
- [ ] credenciais Microsoft fora do Git e com menor privilégio;
- [ ] nenhuma credencial MCP criada ou materializada nesta fase;
- [ ] secrets não passam por build args do frontend;
- [ ] injeção não imprime valores em `docker compose config`, logs ou histórico;
- [ ] owner, finalidade, criação, expiração e rotação registrados;
- [ ] acesso por identidade de workload quando disponível;
- [ ] revogação e rotação de emergência testáveis;
- [ ] evidência comprova presença/validação sem revelar valor;
- [ ] scanner de credenciais e revisão manual aprovados.

## Checklist variáveis de ambiente

| Grupo | Requisito para a implantação futura |
|---|---|
| `NODE_ENV` | `production` |
| `FRONTEND_ORIGIN` | origem HTTPS exata do frontend; não usar fallback local |
| `VITE_API_BASE_URL` | `/api/v1` com proxy aprovado ou base HTTPS definida no build |
| `COOKIE_SECURE` | obrigatoriamente `true` em produção |
| `COOKIE_SAME_SITE` | coerente com a estratégia de origem/cookie |
| `DATABASE_URL` | valor/referência fora do Git |
| `JWT_SECRET` | secret forte fora do Git, nunca placeholder local |
| `DEV_LOGIN_ENABLED` | `false` |
| `MICROSOFT_REDIRECT_URI` | callback HTTPS cadastrado no IdP |
| `MICROSOFT_POST_LOGOUT_REDIRECT_URI` | redirect HTTPS do frontend |
| `MCP_REMOTE_*` | disabled/vazio na primeira publicação |
| `MCP_CORPORATE_READONLY_*` | disabled/vazio na primeira publicação |
| `AGNO_RUNTIME_HTTP_*` | bridge/tools desligados salvo fase específica |
| providers/embeddings | execução externa desligada salvo autorização específica |

Os `.env.example` permanecem locais/fail-closed. Eles não são exemplos de produção e não devem receber as URLs planejadas.

## Checklist SSO Microsoft produção

- [ ] owner do app registration e tenant confirmado;
- [ ] client ID, secret/certificado e tenant entregues fora do Git;
- [ ] callback HTTPS futuro cadastrado exatamente no portal Microsoft;
- [ ] post-logout redirect HTTPS cadastrado e testável;
- [ ] domínios e tenants permitidos revisados;
- [ ] consentimento e permissões seguem menor privilégio;
- [ ] credencial tem expiração, alerta e rotação;
- [ ] login local de desenvolvimento não permanece habilitado;
- [ ] callback, state/nonce, sessão e tratamento de erro revisados;
- [ ] logs não registram code, token, cookie ou claims sensíveis;
- [ ] procedimento break-glass existe se SSO falhar;
- [ ] teste real ocorre somente depois da publicação autorizada.

## Checklist CORS/cookies

- [ ] `FRONTEND_ORIGIN` é uma origem HTTPS exata;
- [ ] wildcard não é usado com credentials;
- [ ] métodos e headers permitidos são mínimos;
- [ ] estratégia relativa ou cross-origin está congelada antes do build;
- [ ] cookie é `Secure`, `HttpOnly` e com `SameSite` coerente;
- [ ] `Domain` só é configurado se houver necessidade comprovada;
- [ ] CSRF é revisto se a topologia de cookies mudar;
- [ ] cache/CDN não compartilha resposta autenticada;
- [ ] login, callback e logout serão testados sem expor tokens;
- [ ] preflight CORS live pertence apenas à janela de execução;
- [ ] mixed content e redirects para HTTP são critérios de rollback.

## Checklist health/readiness

- [ ] `/health` confirma processo, sem ser tratado como prova completa;
- [ ] `/health/db` fica restrito conforme a política de exposição;
- [ ] `/v1/status` e `/v1/status/availability` permanecem GET read-only;
- [ ] contrato expõe somente `status`, `summary` e `updatedAt`;
- [ ] erros não exibem stack, env, host interno ou secret;
- [ ] probes internos e checks externos são distinguidos;
- [ ] thresholds de latência, timeout e status HTTP definidos;
- [ ] dependência de banco monitorada sem dump de configuração;
- [ ] health verde não autoriza Chat, provider, MCP ou tool;
- [ ] falha persistente ou contrato divergente aciona rollback.

## Checklist MCP/corporate fail-closed

- [ ] `MCP_REMOTE_ENABLED=false`;
- [ ] `MCP_REMOTE_EXECUTION_ENABLED=false`;
- [ ] `MCP_REMOTE_DISCOVERY_ENABLED=false`;
- [ ] `MCP_REMOTE_READONLY_ENABLED=false`;
- [ ] `MCP_REMOTE_EGRESS_ALLOWLIST` vazio;
- [ ] `MCP_REMOTE_ALLOW_WRITE_TOOLS=false`;
- [ ] `MCP_CORPORATE_READONLY_ENABLED=false`;
- [ ] `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN` vazio;
- [ ] nenhum endpoint, server, policy, binding ou Assistant criado pela UI;
- [ ] nenhuma referência lógica ou credencial MCP resolvida;
- [ ] nenhuma execução de `corporate.status.read` ou AgentRun com tool;
- [ ] publicação HTTPS é pré-requisito técnico, não autorização de MCP.

A primeira execução real da tool só pode ocorrer após a API HTTPS estar publicada e validada em uma fase posterior, com nova autorização. UI/CRUD MCP continua fora de escopo. O usuário será avisado explicitamente quando chegar o teste direto no sistema.

## Checklist observabilidade/logs

- [ ] logs estruturados e centralizados com retenção definida;
- [ ] trace/request IDs permitem correlação sem expor payload;
- [ ] dashboards cobrem disponibilidade, latência, erros, CPU, memória, disco e banco;
- [ ] alertas têm threshold, owner, canal e runbook;
- [ ] expiração TLS, falha de backup e espaço em disco geram alerta;
- [ ] proxy e app não registram authorization, cookie, token ou secret;
- [ ] bodies, prompts, args e outputs brutos permanecem fora de logs;
- [ ] relógios sincronizados para timeline de evidência;
- [ ] baseline anterior ao deploy registrada;
- [ ] on-call acompanha a janela e o período reforçado;
- [ ] acesso aos logs é controlado e auditável.

## Checklist segurança

- [ ] revisão de exposição pública e menor privilégio concluída;
- [ ] banco, bridge e interfaces administrativas não expostos;
- [ ] imagens escaneadas e dependências críticas tratadas;
- [ ] usuário/processo de container sem privilégio excessivo;
- [ ] filesystem/read-only e capabilities avaliados;
- [ ] headers de segurança e rate limiting revisados;
- [ ] WAF/DDoS avaliados conforme risco;
- [ ] secrets, backups e volumes criptografados;
- [ ] política de retenção, privacidade e resposta a incidente aprovada;
- [ ] rota de revogação de sessão/credencial disponível;
- [ ] nenhum bypass temporário sobrevive ao encerramento;
- [ ] pentest/revisão adicional registrada como gate ou risco aceito.

## Comandos manuais propostos, mas não executados automaticamente

As linhas abaixo são **templates textuais**. Elas não foram executadas pela 17A, não pertencem ao CI e só podem ser usadas por operador autorizado, depois de substituir placeholders fora do Git e revisar o efeito no ambiente.

Inspeção e deployment propostos:

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml --profile operations run --rm migrate
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Checks passivos pós-publicação propostos:

```bash
curl -i https://api.orchestra.mcm.eng.br/health
curl -i https://api.orchestra.mcm.eng.br/v1/status
curl -i https://api.orchestra.mcm.eng.br/v1/status/availability
```

Rollback proposto:

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Antes de qualquer uso real, o ticket deve registrar diretório, arquivo de env/secret manager, digests, operador, limites de tempo e versão anterior. Não usar `curl -v`, header de autenticação, dump de env ou comando copiado diretamente deste runbook sem revisão.

## Evidências esperadas

### Evidências da 17A

- runbook 17A e referências documentais versionados;
- preflight e smoke com `realExecution=false` e `deployment=false`;
- cinco modos do preflight funcionando sem rede ou mutação;
- CI executando apenas `scripts/smoke-plano-deploy-17a.sh --dry-run`;
- env examples e Compose permanecendo fail-closed;
- URLs planejadas ausentes dos env examples;
- Prisma schema/migrations inalterados;
- regressões offline 16S–16Z verdes.

### Evidências da futura execução

- ticket, aprovadores, janela, versão e digests;
- inventário sanitizado de infraestrutura e configuração;
- IDs/checksums de backup e resultado de restore drill;
- mudança DNS, cadeia TLS e proxy validados;
- resultado dos endpoints e contrato, sem dados proibidos;
- resultado de login/SSO, CORS e cookies sem token;
- baseline e pós-deploy de métricas/logs/alertas;
- confirmação explícita de MCP/corporate/provider fail-closed;
- timeline de decisões, incidentes, rollback e versão final.

Evidência nunca inclui secret, cookie, authorization, token, chave privada, dump de env, body sensível, prompt, args/output MCP ou metadata bruta.

## Rollback

### Critérios de acionamento

- migration falha, fica parcial ou diverge do plano;
- health/readiness falha além do threshold aprovado;
- frontend/API apresenta erro crítico, mixed content ou contrato divergente;
- SSO, CORS ou cookies impedem autenticação segura;
- taxa de erro/latência/recursos ultrapassa limite;
- secret aparece em log, terminal, ticket ou artefato;
- exposição de banco, bridge, porta interna ou interface indevida;
- MCP/corporate/provider aparece habilitado sem autorização;
- DNS/TLS/proxy não corresponde ao plano;
- janela, owner ou observabilidade deixam de estar disponíveis.

### Sequência de rollback futuro

1. anunciar rollback, congelar novas mudanças e retirar tráfego da versão nova;
2. preservar evidências sanitizadas e registrar o motivo;
3. restaurar digests anteriores de frontend/backend;
4. restaurar configuração anterior de proxy/ingress;
5. reverter DNS somente quando necessário, considerando TTL/cache;
6. manter MCP, corporate adapter, tools e providers externos desligados;
7. não reverter schema nem restaurar banco sem decisão específica do DBA;
8. rotacionar/revogar credenciais se houver suspeita de exposição;
9. validar health, status, login e métricas na versão anterior;
10. comunicar versão final, impacto e próximos passos.

Para a própria 17A, rollback significa apenas reverter runbook, scripts, step de CI e referências documentais. Não existe recurso externo criado pela fase.

## Pós-rollback

- [ ] confirmar versão anterior e configuração efetiva;
- [ ] validar frontend, API, SSO, CORS/cookies e endpoints passivos;
- [ ] confirmar integridade/conectividade do banco com o DBA;
- [ ] manter flags MCP/corporate/provider fechadas;
- [ ] acompanhar métricas pelo período definido;
- [ ] preservar logs sanitizados e timeline;
- [ ] rotacionar qualquer credencial potencialmente exposta;
- [ ] comunicar encerramento e impacto;
- [ ] abrir análise de causa e ações corretivas;
- [ ] impedir nova tentativa até que bloqueadores tenham owner e evidência.

Rollback bem-sucedido recupera o serviço anterior; ele não converte a mudança falha em homologada.

## Riscos remanescentes

- infraestrutura, DNS, TLS, proxy e secret manager ainda não foram verificados;
- a estratégia real de hosting/ingress ainda precisa ser escolhida;
- os templates Compose podem exigir override específico do ambiente;
- tempos de migration, backup, restore e propagação DNS são desconhecidos;
- SSO Microsoft, CORS e cookies não foram testados em HTTPS;
- observabilidade externa, WAF, rate limiting e on-call não foram comprovados;
- health passivo não comprova fluxos autenticados nem SLO;
- divergência entre configuração planejada e efetiva continua possível;
- primeira execução MCP/tool ainda não ocorreu;
- UI/CRUD MCP, associação MCP–Assistant e teste visual continuam fora de escopo.

## Relação com 16T, 16U, 16V, 16W, 16X, 16Y e 16Z

- 16T implementou o boundary corporativo read-only e fail-closed;
- 16U definiu aprovação, janela supervisionada, evidência e rollback;
- 16V criou os endpoints operacionais locais read-only;
- 16W preparou o harness, adotou a Opção C e não executou a tool;
- 16X alinhou a tool ao contrato `status`, `summary`, `updatedAt`;
- 16Y fixou a readiness HTTPS estrutural, sem rede;
- 16Z preparou topologia e publicação HTTPS de forma offline;
- 17A consolida o plano operacional Local → HTTPS, ainda sem executar deploy.

A 17A não substitui a autorização 16U, não ativa os templates 16Y/16Z e não transforma readiness em execução. Ela cria o gate documental para uma fase futura de implantação manual.

## Atualização 17B — hardening offline dos artefatos

A 17B endurece os artefatos que este plano poderá usar: Compose com redes/exposição
mínima/profile operacional, imagens multi-stage não-root e Nginx com porta não
privilegiada, SPA fallback, headers, compressão e cache. MCP, corporate, tools e
providers externos permanecem fail-closed.

O hardening é somente estático: nenhum build ou container foi executado, o deploy real
ainda não ocorreu e as URLs permanecem planejadas/inativas. Nenhum endpoint ou secret
foi materializado em env examples, Compose ou CI. A primeira execução real da tool
continua condicionada à publicação HTTPS futura e UI/CRUD MCP continua fora de escopo.
Consulte `ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md`.

## Próximos passos sugeridos

1. revisar e integrar o hardening offline 17B;
2. escolher a plataforma/host de destino e nomear os responsáveis;
3. preencher a matriz de pré-requisitos com evidências reais fora do Git;
4. homologar backup/restore, secret manager, observabilidade e rollback;
5. aprovar a topologia de proxy, DNS/TLS, SSO e CORS/cookies;
6. abrir uma fase específica para executar a implantação HTTPS manual;
7. validar frontend, API e endpoints passivos na janela autorizada;
8. somente depois da API HTTPS publicada e validada, planejar outra fase para a primeira execução supervisionada de `corporate.status.read`.

O usuário será avisado antes do teste direto no sistema. Até esse aviso e a nova autorização, o ambiente permanece local, as URLs permanecem planejadas, `deployment=false`, `realExecution=false` e MCP/corporate continua fail-closed.
